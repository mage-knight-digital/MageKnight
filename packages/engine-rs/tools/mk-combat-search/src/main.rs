//! Combat tree search benchmark: exhaustive DFS vs MCTS.
//!
//! Usage: mk-combat-search [node_limit]
//!   node_limit defaults to 10_000_000

use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::time::Instant;

use mk_engine::action_pipeline::{apply_legal_action, ApplyResult};
use mk_engine::legal_actions::enumerate_legal_actions;
use mk_engine::undo::UndoStack;
use mk_env::training_scenario::{create_training_game, TrainingScenario};
use mk_types::enums::{CombatPhase, Hero};
use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::state::GameState;

// =============================================================================
// Evaluation (shared by both search methods)
// =============================================================================

#[derive(Clone)]
struct PreCombatSnapshot {
    fame: u32,
    hand_size: usize,
    crystals_total: u8,
    units_wounded: usize,
}

impl PreCombatSnapshot {
    fn from_state(state: &GameState) -> Self {
        let player = &state.players[0];
        Self {
            fame: player.fame,
            hand_size: player.hand.len(),
            crystals_total: player.crystals.red + player.crystals.blue
                + player.crystals.green + player.crystals.white,
            units_wounded: player.units.iter().filter(|u| u.wounded).count(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct CombatScore {
    fame_gained: u32,
    wounds_taken: u32,
    cards_remaining: usize,
    cards_spent: usize,
    crystals_spent: i32,
    units_newly_wounded: i32,
    total: f64,
}

impl CombatScore {
    fn evaluate(pre: &PreCombatSnapshot, state: &GameState) -> Self {
        let player = &state.players[0];
        let fame_gained = player.fame.saturating_sub(pre.fame);
        let wounds_taken = player.wounds_received_this_turn.hand
            + player.wounds_received_this_turn.discard;
        // Only count non-wound cards remaining (wounds in hand shouldn't be a bonus)
        let cards_remaining = player.hand.iter()
            .filter(|c| c.as_str() != "wound")
            .count();
        let cards_spent = pre.hand_size.saturating_sub(cards_remaining);
        let crystals_now = player.crystals.red + player.crystals.blue
            + player.crystals.green + player.crystals.white;
        let crystals_spent = pre.crystals_total as i32 - crystals_now as i32;
        let units_wounded_now = player.units.iter().filter(|u| u.wounded).count();
        let units_newly_wounded = units_wounded_now as i32 - pre.units_wounded as i32;

        // Knockout: wounds in hand >= hand_limit means you lose all non-wound cards
        let wounds_in_hand = player.hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count() as u32;
        let knocked_out = wounds_in_hand >= player.hand_limit;

        let total = if knocked_out {
            // Knockout is catastrophic: you lose all cards and the rest of your turn
            fame_gained as f64 * 100.0
                - wounds_taken as f64 * 80.0
                - 500.0 // massive knockout penalty
                - crystals_spent.max(0) as f64 * 25.0
                - units_newly_wounded.max(0) as f64 * 40.0
        } else {
            fame_gained as f64 * 100.0
                - wounds_taken as f64 * 80.0
                + cards_remaining as f64 * 15.0
                - crystals_spent.max(0) as f64 * 25.0
                - units_newly_wounded.max(0) as f64 * 40.0
        };

        Self { fame_gained, wounds_taken, cards_remaining, cards_spent,
               crystals_spent, units_newly_wounded, total }
    }
}

impl std::fmt::Display for CombatScore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f,
            "score={:>7.0} | fame=+{} wounds={} cards_left={} cards_spent={} crystals={} units_wounded={}",
            self.total, self.fame_gained, self.wounds_taken,
            self.cards_remaining, self.cards_spent,
            self.crystals_spent, self.units_newly_wounded)
    }
}

/// Check if a combat state is terminal (for both search methods).
fn is_combat_terminal(state: &GameState, num_actions: usize) -> bool {
    if num_actions == 0 || state.game_ended || state.combat.is_none() {
        return true;
    }
    state.combat.as_ref()
        .map(|c| c.enemies.iter().all(|e| e.is_defeated))
        .unwrap_or(false)
}

/// Apply an action, return the new state and its legal actions. None on error.
fn step(state: &GameState, action: &LegalAction) -> Option<(GameState, LegalActionSet)> {
    let mut child = state.clone();
    let mut undo = UndoStack::new();
    let epoch = child.action_epoch;
    match apply_legal_action(&mut child, &mut undo, 0, action, epoch) {
        Ok(ApplyResult { .. }) => {
            let actions = enumerate_legal_actions(&child, 0);
            Some((child, actions))
        }
        Err(_) => None,
    }
}

// =============================================================================
// Transposition table: hash combat-relevant state to detect equivalent positions
// =============================================================================

/// Hash the combat-relevant parts of GameState. Two states that hash the same
/// will produce identical subtrees, so we only need to explore one.
/// Hand is sorted so card order doesn't matter (the key symmetry-breaking).
fn combat_state_hash(state: &GameState) -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    let p = &state.players[0];

    // Hand (sorted — this is the key insight: order doesn't matter)
    let mut hand: Vec<&str> = p.hand.iter().map(|c| c.as_str()).collect();
    hand.sort_unstable();
    for card in &hand {
        card.hash(&mut h);
    }

    // Combat accumulator — all attack/block values
    let atk = &p.combat_accumulator.attack;
    atk.normal.hash(&mut h);
    atk.ranged.hash(&mut h);
    atk.siege.hash(&mut h);
    atk.normal_elements.fire.hash(&mut h);
    atk.normal_elements.ice.hash(&mut h);
    atk.normal_elements.cold_fire.hash(&mut h);
    atk.ranged_elements.fire.hash(&mut h);
    atk.ranged_elements.ice.hash(&mut h);
    atk.siege_elements.fire.hash(&mut h);
    atk.siege_elements.ice.hash(&mut h);
    p.combat_accumulator.block.hash(&mut h);
    p.combat_accumulator.block_elements.fire.hash(&mut h);
    p.combat_accumulator.block_elements.ice.hash(&mut h);
    p.combat_accumulator.assigned_block.hash(&mut h);

    // Wounds
    p.wounds_received_this_turn.hand.hash(&mut h);
    p.wounds_received_this_turn.discard.hash(&mut h);

    // Crystals
    p.crystals.red.hash(&mut h);
    p.crystals.blue.hash(&mut h);
    p.crystals.green.hash(&mut h);
    p.crystals.white.hash(&mut h);

    // Mana tokens (sorted for order independence)
    let mut tokens: Vec<(u8, u8)> = p.pure_mana.iter()
        .map(|t| (t.color as u8, t.source as u8))
        .collect();
    tokens.sort_unstable();
    tokens.hash(&mut h);

    // Source dice state
    for die in &state.source.dice {
        die.is_depleted.hash(&mut h);
        die.taken_by_player_id.is_some().hash(&mut h);
    }

    // Combat state
    if let Some(ref c) = state.combat {
        std::mem::discriminant(&c.phase).hash(&mut h);
        c.attacks_this_phase.hash(&mut h);
        for enemy in &c.enemies {
            enemy.is_blocked.hash(&mut h);
            enemy.is_defeated.hash(&mut h);
            enemy.damage_assigned.hash(&mut h);
            enemy.attacks_blocked.hash(&mut h);
            enemy.attacks_damage_assigned.hash(&mut h);
        }
        // Pending block/damage maps affect available actions
        c.pending_block.len().hash(&mut h);
        c.pending_damage.len().hash(&mut h);
        if let Some(ref targets) = c.declared_attack_targets {
            targets.len().hash(&mut h);
        }
    }

    // Units
    for unit in &p.units {
        unit.wounded.hash(&mut h);
        unit.used_resistance_this_combat.hash(&mut h);
        unit.used_ability_indices.hash(&mut h);
    }

    // Pending choice (variant matters — different choices = different subtrees)
    p.pending.has_active().hash(&mut h);

    // Active modifiers count (rough proxy — different modifiers = different state)
    state.active_modifiers.len().hash(&mut h);

    h.finish()
}

// =============================================================================
// Exhaustive DFS
// =============================================================================

struct DfsStats {
    nodes_visited: u64,
    nodes_pruned: u64,
    transpositions: u64,
    leaves: u64,
    max_depth: u32,
    branching_sum: u64,
    non_leaf_count: u64,
    best_score: Option<CombatScore>,
    best_path: Vec<LegalAction>,
    score_sum: f64,
    score_count: u64,
    /// Total fame from killing ALL enemies (precomputed upper bound on fame)
    total_possible_fame: u32,
    /// Transposition table: states we've already fully explored
    seen: HashSet<u64>,
}

impl DfsStats {
    fn new(total_possible_fame: u32) -> Self {
        Self {
            nodes_visited: 0, nodes_pruned: 0, transpositions: 0,
            leaves: 0, max_depth: 0,
            branching_sum: 0, non_leaf_count: 0,
            best_score: None, best_path: Vec::new(),
            score_sum: 0.0, score_count: 0,
            total_possible_fame,
            seen: HashSet::new(),
        }
    }

    fn avg_branching(&self) -> f64 {
        if self.non_leaf_count == 0 { 0.0 }
        else { self.branching_sum as f64 / self.non_leaf_count as f64 }
    }
}

/// Compute maximum possible attack from remaining hand cards + accumulated attack.
fn max_remaining_attack(state: &GameState) -> u32 {
    let player = &state.players[0];
    let acc = &player.combat_accumulator.attack;
    let current_attack = acc.normal + acc.ranged + acc.siege
        + acc.normal_elements.total()
        + acc.ranged_elements.total()
        + acc.siege_elements.total();

    let mut max_from_hand = 0u32;
    for card_id in &player.hand {
        let card_str = card_id.as_str();
        if card_str == "wound" { continue; }
        if let Some(def) = mk_data::cards::get_card(card_str) {
            let basic_atk = extract_max_attack(&def.basic_effect).unwrap_or(0);
            let powered_atk = extract_max_attack(&def.powered_effect).unwrap_or(0);
            let sideways = def.sideways_value;
            max_from_hand += basic_atk.max(powered_atk).max(sideways);
        }
    }

    current_attack + max_from_hand
}

/// Tight upper bound: compute max fame achievable given remaining attack potential.
/// Instead of assuming all enemies can be killed, checks which subset of enemies
/// is actually killable with the maximum possible attack from remaining cards.
fn upper_bound(state: &GameState, pre: &PreCombatSnapshot, _total_possible_fame: u32) -> f64 {
    let player = &state.players[0];
    let wounds_so_far = player.wounds_received_this_turn.hand
        + player.wounds_received_this_turn.discard;
    let cards_remaining = player.hand.len();
    let crystals_now = player.crystals.red + player.crystals.blue
        + player.crystals.green + player.crystals.white;
    let crystals_spent = (pre.crystals_total as i32 - crystals_now as i32).max(0);
    let units_wounded_now = player.units.iter().filter(|u| u.wounded).count();
    let units_newly_wounded = (units_wounded_now as i32 - pre.units_wounded as i32).max(0);

    let max_attack = max_remaining_attack(state);

    // Find best achievable fame: try all subsets of remaining enemies
    let max_fame = if let Some(ref combat) = state.combat {
        let remaining: Vec<(u32, u32)> = combat.enemies.iter()
            .filter(|e| !e.is_defeated)
            .map(|e| {
                let def = mk_data::enemies::get_enemy(e.enemy_id.as_str()).unwrap();
                (def.armor, def.fame)
            })
            .collect();

        // Fame already gained from defeated enemies (already in player.fame)
        let fame_gained_so_far = player.fame.saturating_sub(pre.fame);

        // Try all subsets of remaining enemies (max 2^4 = 16 for 4 enemies)
        let n = remaining.len();
        let mut best_remaining_fame = 0u32;
        for mask in 0..(1u32 << n) {
            let mut total_armor = 0u32;
            let mut total_fame = 0u32;
            for i in 0..n {
                if mask & (1 << i) != 0 {
                    total_armor += remaining[i].0;
                    total_fame += remaining[i].1;
                }
            }
            if max_attack >= total_armor && total_fame > best_remaining_fame {
                best_remaining_fame = total_fame;
            }
        }

        fame_gained_so_far + best_remaining_fame
    } else {
        0
    };

    max_fame as f64 * 100.0
        - wounds_so_far as f64 * 80.0
        + cards_remaining as f64 * 15.0
        - crystals_spent as f64 * 25.0
        - units_newly_wounded as f64 * 40.0
}

/// Action priority for DFS ordering. Lower = explored first.
/// Card plays first (find kills early), EndCombatPhase last (abandoning is worst case).
fn action_priority(action: &LegalAction) -> u32 {
    match action {
        LegalAction::PlayCardPowered { .. } => 0,
        LegalAction::PlayCardBasic { .. } => 1,
        LegalAction::PlayCardSideways { .. } => 2,
        LegalAction::ActivateUnit { .. } => 3,
        LegalAction::DeclareBlock { .. } => 4,
        LegalAction::ResolveAttack => 5,
        LegalAction::ResolveChoice { .. } => 6,
        LegalAction::SubsetSelect { .. } => 7,
        LegalAction::SubsetConfirm => 8,
        LegalAction::AssignDamageToUnit { .. } => 9,
        LegalAction::AssignDamageToHero { .. } => 10,
        LegalAction::EndCombatPhase => 20,
        LegalAction::Undo => 30,
        _ => 15,
    }
}

/// Run fast greedy rollouts to find an initial lower bound for DFS pruning.
fn greedy_seed(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    num_rollouts: u32,
) -> Option<(CombatScore, Vec<LegalAction>)> {
    let mut best: Option<(CombatScore, Vec<LegalAction>)> = None;
    let mut rng = 12345u32;
    let mut stats = NmcsStats::default();

    for _ in 0..num_rollouts {
        let (score, path) = nmcs_rollout(state, actions, pre, &mut rng, &mut stats);
        if best.as_ref().map_or(true, |(b, _)| score.total > b.total) {
            best = Some((score, path));
        }
    }
    best
}

fn dfs(
    state: &GameState,
    action_set: &LegalActionSet,
    depth: u32,
    stats: &mut DfsStats,
    node_limit: u64,
    pre: &PreCombatSnapshot,
    path: &mut Vec<LegalAction>,
) {
    if stats.nodes_visited >= node_limit { return; }
    stats.nodes_visited += 1;

    if stats.nodes_visited % 500_000 == 0 {
        let best = stats.best_score.map(|s| s.total).unwrap_or(f64::NEG_INFINITY);
        eprint!("\r  [DFS] nodes: {}k, pruned: {}k, transpos: {}k, unique: {}k, best: {:.0}    ",
            stats.nodes_visited / 1000, stats.nodes_pruned / 1000,
            stats.transpositions / 1000, stats.seen.len() / 1000, best);
    }

    let num_actions = action_set.actions.len();

    if is_combat_terminal(state, num_actions) {
        stats.leaves += 1;
        let score = CombatScore::evaluate(pre, state);
        stats.score_sum += score.total;
        stats.score_count += 1;
        let is_best = stats.best_score.map(|b| score.total > b.total).unwrap_or(true);
        if is_best {
            stats.best_score = Some(score);
            stats.best_path = path.clone();
        }
        return;
    }

    // Pruning: if the best possible outcome from here can't beat our current best, skip.
    if let Some(ref best) = stats.best_score {
        let ub = upper_bound(state, pre, stats.total_possible_fame);
        if ub <= best.total {
            stats.nodes_pruned += 1;
            return;
        }
    }

    // Transposition check: skip states we've already fully explored.
    let state_hash = combat_state_hash(state);
    if !stats.seen.insert(state_hash) {
        stats.transpositions += 1;
        return;
    }

    stats.non_leaf_count += 1;
    stats.branching_sum += num_actions as u64;
    if depth > stats.max_depth { stats.max_depth = depth; }

    // Sort actions by priority: card plays first, EndCombatPhase last.
    // Finding good solutions early makes pruning much more effective.
    let mut sorted_actions: Vec<&LegalAction> = action_set.actions.iter().collect();
    sorted_actions.sort_by_key(|a| action_priority(a));

    for action in sorted_actions {
        if stats.nodes_visited >= node_limit { return; }
        if let Some((child_state, child_actions)) = step(state, action) {
            path.push(action.clone());
            dfs(&child_state, &child_actions, depth + 1, stats, node_limit, pre, path);
            path.pop();
        }
    }
}

// =============================================================================
// Heuristic rollout policy
// =============================================================================

/// Classify a legal action for rollout weighting.
/// Higher weight = more likely to be picked.
fn action_weight(action: &LegalAction) -> u32 {
    match action {
        // Playing cards = the core of combat. Strongly prefer.
        LegalAction::PlayCardBasic { .. } => 10,
        LegalAction::PlayCardPowered { .. } => 12, // powered is usually stronger
        LegalAction::PlayCardSideways { .. } => 8,

        // Declaring blocks/attacks = critical combat actions
        LegalAction::DeclareBlock { .. } => 15,    // blocking is high-value (prevents wounds)
        LegalAction::ResolveAttack => 15,           // resolving an attack = killing enemies

        // Subset selection (choosing targets, etc.)
        LegalAction::SubsetSelect { .. } => 10,
        LegalAction::SubsetConfirm => 10,

        // Resolve choices (card effects, mana choices)
        LegalAction::ResolveChoice { .. } => 10,

        // Unit activations
        LegalAction::ActivateUnit { .. } => 8,

        // Assign damage to hero (taking wounds) — lower weight, not great
        LegalAction::AssignDamageToHero { .. } => 3,
        LegalAction::AssignDamageToUnit { .. } => 5,

        // Skipping / ending phases — sometimes correct, but shouldn't dominate
        LegalAction::EndCombatPhase => 2,
        LegalAction::EndTurn => 1,

        // Everything else (shouldn't appear in combat, but handle gracefully)
        _ => 5,
    }
}

/// Pick an action using weighted random selection.
/// Prefers card plays and blocks over skipping.
fn heuristic_pick<'a>(actions: &'a LegalActionSet, rng: &mut u32) -> &'a LegalAction {
    let weights: Vec<u32> = actions.actions.iter().map(|a| action_weight(a)).collect();
    let total: u32 = weights.iter().sum();

    // Simple LCG-style RNG
    *rng = rng.wrapping_mul(1664525).wrapping_add(1013904223);
    let roll = (*rng >> 8) % total; // use middle bits for less bias

    let mut cumulative = 0;
    for (i, &w) in weights.iter().enumerate() {
        cumulative += w;
        if roll < cumulative {
            return &actions.actions[i];
        }
    }

    // Fallback (shouldn't happen)
    actions.actions.last().unwrap()
}

// =============================================================================
// MCTS
// =============================================================================

/// A node in the MCTS tree.
struct MctsNode {
    /// The action that led to this node (None for root).
    action: Option<LegalAction>,
    /// Game state at this node.
    state: GameState,
    /// Legal actions from this state.
    legal_actions: LegalActionSet,
    /// Is this a terminal combat state?
    terminal: bool,
    /// Children (one per legal action, lazily expanded).
    children: Vec<MctsNode>,
    /// Have we expanded this node's children?
    expanded: bool,
    /// Number of times this node has been visited.
    visits: u32,
    /// Sum of all scores backpropagated through this node.
    total_value: f64,
}

impl MctsNode {
    fn new(state: GameState, legal_actions: LegalActionSet, action: Option<LegalAction>) -> Self {
        let terminal = is_combat_terminal(&state, legal_actions.actions.len());
        Self {
            action, state, legal_actions, terminal,
            children: Vec::new(), expanded: false,
            visits: 0, total_value: 0.0,
        }
    }

    fn avg_value(&self) -> f64 {
        if self.visits == 0 { 0.0 } else { self.total_value / self.visits as f64 }
    }

    /// UCB1 score for child selection. Higher = more worth exploring.
    fn ucb1(&self, parent_visits: u32, explore_c: f64) -> f64 {
        if self.visits == 0 {
            return f64::INFINITY; // Unvisited children get priority
        }
        self.avg_value() + explore_c * ((parent_visits as f64).ln() / self.visits as f64).sqrt()
    }
}

struct MctsResult {
    best_score: CombatScore,
    best_path: Vec<LegalAction>,
    iterations: u32,
    nodes_created: u32,
}

/// Run MCTS for the given iteration budget.
fn mcts_search(
    initial_state: &GameState,
    initial_actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    iteration_budget: u32,
    explore_c: f64,
) -> MctsResult {
    let mut root = MctsNode::new(initial_state.clone(), initial_actions.clone(), None);
    let mut nodes_created: u32 = 1;
    let mut rng_counter: u32 = 0;

    // Track best terminal found across all rollouts
    let mut best_score: Option<CombatScore> = None;
    let mut best_path: Vec<LegalAction> = Vec::new();

    for iter in 0..iteration_budget {
        if iter % 1000 == 0 && iter > 0 {
            let best = best_score.map(|s| s.total).unwrap_or(f64::NEG_INFINITY);
            eprint!("\r  [MCTS] iter: {}, nodes: {}, best: {:.0}    ", iter, nodes_created, best);
        }

        // === SELECT + EXPAND ===
        // Walk down the tree, selecting children by UCB1.
        // When we reach an unexpanded node, expand it.
        // Collect the path of indices so we can backpropagate.
        let mut node_path: Vec<usize> = Vec::new(); // indices into children
        let mut current = &mut root;

        loop {
            if current.terminal {
                break;
            }

            // Expand if not yet expanded
            if !current.expanded {
                for action in &current.legal_actions.actions {
                    if let Some((child_state, child_actions)) = step(&current.state, action) {
                        let child = MctsNode::new(child_state, child_actions, Some(action.clone()));
                        nodes_created += 1;
                        current.children.push(child);
                    }
                }
                current.expanded = true;

                // If no children could be created, mark terminal
                if current.children.is_empty() {
                    current.terminal = true;
                    break;
                }
            }

            // Select child by UCB1
            let parent_visits = current.visits;
            let mut best_idx = 0;
            let mut best_ucb = f64::NEG_INFINITY;
            for (i, child) in current.children.iter().enumerate() {
                let ucb = child.ucb1(parent_visits, explore_c);
                if ucb > best_ucb {
                    best_ucb = ucb;
                    best_idx = i;
                }
            }

            node_path.push(best_idx);
            current = &mut current.children[best_idx];
        }

        // === ROLLOUT ===
        // From the selected leaf, play actions with heuristic bias until terminal.
        let rollout_score = if current.terminal {
            CombatScore::evaluate(pre, &current.state)
        } else {
            let mut rollout_state = current.state.clone();
            let mut rollout_actions = current.legal_actions.clone();

            loop {
                if is_combat_terminal(&rollout_state, rollout_actions.actions.len()) {
                    break;
                }
                let action = heuristic_pick(&rollout_actions, &mut rng_counter);
                if let Some((next_state, next_actions)) = step(&rollout_state, action) {
                    rollout_state = next_state;
                    rollout_actions = next_actions;
                } else {
                    break;
                }
            }

            CombatScore::evaluate(pre, &rollout_state)
        };

        let value = rollout_score.total;

        // Track best terminal found across all iterations
        // Build the path from root to this leaf
        let is_new_best = best_score.map(|b| rollout_score.total > b.total).unwrap_or(true);
        if is_new_best {
            best_score = Some(rollout_score);
            // Reconstruct path from node_path indices
            let mut path = Vec::new();
            let mut node_ref = &root;
            for &idx in &node_path {
                if let Some(ref action) = node_ref.children[idx].action {
                    path.push(action.clone());
                }
                node_ref = &node_ref.children[idx];
            }
            best_path = path;
        }

        // === BACKPROPAGATE ===
        root.visits += 1;
        root.total_value += value;

        let mut node_ref = &mut root;
        for &idx in &node_path {
            node_ref = &mut node_ref.children[idx];
            node_ref.visits += 1;
            node_ref.total_value += value;
        }
    }

    MctsResult {
        best_score: best_score.unwrap_or(CombatScore {
            fame_gained: 0, wounds_taken: 0, cards_remaining: 0,
            cards_spent: 0, crystals_spent: 0, units_newly_wounded: 0, total: f64::NEG_INFINITY,
        }),
        best_path,
        iterations: iteration_budget,
        nodes_created,
    }
}

// =============================================================================
// NMCS (Nested Monte Carlo Search)
// =============================================================================
//
// How it works:
//   Level 0: heuristic rollout (weighted random to terminal, return score + path)
//   Level N: at each step, try every legal action. For each, recursively call
//            level N-1 from the resulting state. Pick the action whose nested
//            search returned the best score. Advance one step along the best
//            action, repeat until terminal.
//
// Key insight: level 1 tries every action and does a heuristic rollout from each.
// Level 2 tries every action and does a level-1 search from each. This naturally
// discovers multi-step sequences that random rollouts miss.

#[derive(Default)]
struct NmcsStats {
    rollouts: u64,
    steps: u64,
}

/// Level-0: heuristic rollout to terminal.
fn nmcs_rollout(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    rng: &mut u32,
    stats: &mut NmcsStats,
) -> (CombatScore, Vec<LegalAction>) {
    stats.rollouts += 1;
    let mut current_state = state.clone();
    let mut current_actions = actions.clone();
    let mut path = Vec::new();

    loop {
        if is_combat_terminal(&current_state, current_actions.actions.len()) {
            break;
        }
        stats.steps += 1;
        let action = heuristic_pick(&current_actions, rng);
        path.push(action.clone());
        if let Some((next_state, next_actions)) = step(&current_state, action) {
            current_state = next_state;
            current_actions = next_actions;
        } else {
            break;
        }
    }

    (CombatScore::evaluate(pre, &current_state), path)
}

/// Nested Monte Carlo Search at the given level.
///
/// Returns the best (score, action_path) found.
fn nmcs(
    state: &GameState,
    actions: &LegalActionSet,
    level: u32,
    pre: &PreCombatSnapshot,
    stats: &mut NmcsStats,
) -> (CombatScore, Vec<LegalAction>) {
    if level == 0 {
        let mut rng = 42u32;
        return nmcs_rollout(state, actions, pre, &mut rng, stats);
    }

    // Terminal check
    if is_combat_terminal(state, actions.actions.len()) {
        return (CombatScore::evaluate(pre, state), Vec::new());
    }

    // Track the best sequence found so far at this level
    let mut best_score: Option<CombatScore> = None;
    let mut best_path: Vec<LegalAction> = Vec::new();

    // Current position — we'll advance along the best action at each step
    let mut current_state = state.clone();
    let mut current_actions = actions.clone();
    let mut committed_path: Vec<LegalAction> = Vec::new();

    loop {
        if is_combat_terminal(&current_state, current_actions.actions.len()) {
            let score = CombatScore::evaluate(pre, &current_state);
            if best_score.map(|b| score.total > b.total).unwrap_or(true) {
                best_score = Some(score);
                best_path = committed_path.clone();
            }
            break;
        }

        let mut step_best_score: Option<CombatScore> = None;
        let mut step_best_action: Option<LegalAction> = None;

        // Try each legal action, run level-1 search from each
        for action in &current_actions.actions {
            stats.steps += 1;

            if let Some((child_state, child_actions)) = step(&current_state, action) {
                let (child_score, child_suffix) = nmcs(
                    &child_state, &child_actions, level - 1, pre, stats,
                );

                let is_step_best = step_best_score
                    .map(|b| child_score.total > b.total)
                    .unwrap_or(true);
                if is_step_best {
                    step_best_score = Some(child_score);
                    step_best_action = Some(action.clone());

                    // Update overall best if this full path is the best we've seen
                    let mut full_path = committed_path.clone();
                    full_path.push(action.clone());
                    full_path.extend(child_suffix);

                    if best_score.map(|b| child_score.total > b.total).unwrap_or(true) {
                        best_score = Some(child_score);
                        best_path = full_path;
                    }
                }
            }
        }

        // Advance one step along the best action found
        if let Some(best_action) = step_best_action {
            if let Some((next_state, next_actions)) = step(&current_state, &best_action) {
                committed_path.push(best_action);
                current_state = next_state;
                current_actions = next_actions;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    (
        best_score.unwrap_or(CombatScore {
            fame_gained: 0, wounds_taken: 0, cards_remaining: 0,
            cards_spent: 0, crystals_spent: 0, units_newly_wounded: 0, total: f64::NEG_INFINITY,
        }),
        best_path,
    )
}

// =============================================================================
// Beam Search
// =============================================================================
//
// At each depth, expand all states in the beam by trying every legal action.
// Score each child, keep the top-K (beam width), repeat until all are terminal.
// Uses the same eval function as DFS but applied at every step.

struct BeamSearchResult {
    best_score: CombatScore,
    best_path: Vec<LegalAction>,
    max_depth: u32,
    states_evaluated: u64,
}

fn beam_search(
    initial_state: &GameState,
    initial_actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    beam_width: usize,
) -> BeamSearchResult {
    struct BeamEntry {
        state: GameState,
        actions: LegalActionSet,
        path: Vec<LegalAction>,
        score: f64,
    }

    let initial_score = CombatScore::evaluate(pre, &initial_state);
    let mut beam = vec![BeamEntry {
        state: initial_state.clone(),
        actions: initial_actions.clone(),
        path: Vec::new(),
        score: initial_score.total,
    }];

    let mut best_score = initial_score;
    let mut best_path = Vec::new();
    let mut states_evaluated = 0u64;
    let mut depth = 0u32;

    // Terminal entries that we've finished exploring
    let mut finished: Vec<BeamEntry> = Vec::new();

    loop {
        depth += 1;
        let mut candidates: Vec<BeamEntry> = Vec::new();

        for entry in &beam {
            let num_actions = entry.actions.actions.len();
            if is_combat_terminal(&entry.state, num_actions) {
                // This path is done — preserve it
                finished.push(BeamEntry {
                    state: entry.state.clone(),
                    actions: entry.actions.clone(),
                    path: entry.path.clone(),
                    score: entry.score,
                });
                continue;
            }

            for action in &entry.actions.actions {
                if let Some((child_state, child_actions)) = step(&entry.state, action) {
                    states_evaluated += 1;
                    let score = CombatScore::evaluate(pre, &child_state);
                    let mut child_path = entry.path.clone();
                    child_path.push(action.clone());

                    candidates.push(BeamEntry {
                        state: child_state,
                        actions: child_actions,
                        path: child_path,
                        score: score.total,
                    });
                }
            }
        }

        if candidates.is_empty() {
            break;
        }

        // Sort by score descending, keep top beam_width
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        candidates.truncate(beam_width);

        if depth % 5 == 0 {
            eprint!("  [Beam] depth: {depth}, candidates: {}, best: {:.0}      \r",
                candidates.len(), candidates[0].score);
        }

        beam = candidates;
    }

    // Check finished entries too
    for entry in &finished {
        let score = CombatScore::evaluate(pre, &entry.state);
        if score.total > best_score.total {
            best_score = score;
            best_path = entry.path.clone();
        }
    }

    // Check remaining beam entries
    for entry in &beam {
        let score = CombatScore::evaluate(pre, &entry.state);
        if score.total > best_score.total {
            best_score = score;
            best_path = entry.path.clone();
        }
    }

    BeamSearchResult {
        best_score,
        best_path,
        max_depth: depth,
        states_evaluated,
    }
}

// =============================================================================
// Phase-Decomposed Beam Search
// =============================================================================
//
// Instead of one beam across all combat, we run a separate beam search within
// each combat phase. At phase boundaries we keep the top-K states and start
// a fresh beam for the next phase. This avoids the greedy trap where spending
// cards early looks bad at intermediate steps.
//
// Phases: RangedSiege → Block → AssignDamage → Attack → (combat ends)

struct PhasedBeamResult {
    best_score: CombatScore,
    best_path: Vec<LegalAction>,
    states_evaluated: u64,
    phase_stats: Vec<(String, usize, u64)>, // (phase_name, survivors, states_evaluated)
}

/// Get the current combat phase, or None if combat is over.
fn current_combat_phase(state: &GameState) -> Option<CombatPhase> {
    state.combat.as_ref().map(|c| c.phase)
}

/// Total accumulated attack across all types.
fn total_accumulated_attack(state: &GameState) -> u32 {
    let acc = &state.players[0].combat_accumulator.attack;
    acc.normal + acc.ranged + acc.siege
        + acc.normal_elements.total()
        + acc.ranged_elements.total()
        + acc.siege_elements.total()
}

/// Phase-aware scoring: within a phase, reward progress toward that phase's goal
/// rather than using the terminal eval which penalizes card spending.
fn phase_score(state: &GameState, pre: &PreCombatSnapshot, phase: Option<CombatPhase>) -> f64 {
    let base = CombatScore::evaluate(pre, state);

    match phase {
        Some(CombatPhase::RangedSiege) => {
            // Reward ranged/siege damage dealt
            base.total + total_accumulated_attack(state) as f64 * 10.0
        }
        Some(CombatPhase::Block) => {
            // Reward block progress: each blocked enemy avoids wounds.
            // Each unblocked enemy with attack A vs armor 2 = ceil(A/2) wounds * 80 penalty.
            // So blocking an enemy saves ~80-160 points. Cards cost 15. Blocking is very valuable.
            let block_acc = state.players[0].combat_accumulator.block;
            let enemies_blocked = state.combat.as_ref()
                .map(|c| c.enemies.iter().filter(|e| e.is_blocked).count())
                .unwrap_or(0);
            // Strongly reward enemies blocked (saves wounds), plus incremental block progress
            enemies_blocked as f64 * 120.0
                + block_acc as f64 * 20.0
                + base.cards_remaining as f64 * 5.0  // slight preference for fewer cards used
        }
        Some(CombatPhase::AssignDamage) => {
            // Fewer wounds is better — use base score
            base.total
        }
        Some(CombatPhase::Attack) => {
            // Strongly reward accumulated attack during attack phase.
            // Cards spent on attack are investments toward fame, not waste.
            // Override the base score's card penalty by using fame potential instead.
            let attack_acc = total_accumulated_attack(state);
            let enemies_defeated = state.combat.as_ref()
                .map(|c| c.enemies.iter().filter(|e| e.is_defeated).count())
                .unwrap_or(0);
            let total_enemy_armor: u32 = state.combat.as_ref()
                .map(|c| c.enemies.iter()
                    .filter(|e| !e.is_defeated)
                    .map(|e| mk_data::enemies::get_enemy(e.enemy_id.as_str())
                        .map(|d| d.armor).unwrap_or(0))
                    .sum())
                .unwrap_or(0);
            // Reward progress toward killing: attack as fraction of needed armor
            let kill_progress = if total_enemy_armor > 0 {
                (attack_acc as f64 / total_enemy_armor as f64).min(1.0)
            } else {
                1.0
            };
            // Potential fame from kill (assume we'll kill if we get enough attack)
            let total_fame: u32 = state.combat.as_ref()
                .map(|c| c.enemies.iter()
                    .filter(|e| !e.is_defeated)
                    .map(|e| mk_data::enemies::get_enemy(e.enemy_id.as_str())
                        .map(|d| d.fame).unwrap_or(0))
                    .sum())
                .unwrap_or(0);
            // Score: base + huge bonus for attack progress + fame for already defeated
            kill_progress * total_fame as f64 * 100.0
                + enemies_defeated as f64 * 100.0
                - base.wounds_taken as f64 * 80.0
        }
        None => base.total,
    }
}

/// Run beam search within a single phase. Expands states until they either:
/// - transition to a different combat phase
/// - leave combat entirely (terminal)
/// - have a pending choice (keep expanding — choices are within-phase)
///
/// Returns (phase_exit_states, terminal_states, total_states_evaluated)
fn beam_search_single_phase(
    entries: Vec<(GameState, LegalActionSet, Vec<LegalAction>)>,
    pre: &PreCombatSnapshot,
    beam_width: usize,
    phase_name: &str,
) -> (
    Vec<(GameState, LegalActionSet, Vec<LegalAction>)>, // states that exited to next phase
    Vec<(GameState, Vec<LegalAction>)>,                  // terminal states (combat ended)
    u64,                                                  // states evaluated
) {
    struct BeamEntry {
        state: GameState,
        actions: LegalActionSet,
        path: Vec<LegalAction>,
    }

    let start_phase = entries.first()
        .and_then(|(s, _, _)| current_combat_phase(s));

    let mut beam: Vec<BeamEntry> = entries.into_iter()
        .map(|(state, actions, path)| BeamEntry { state, actions, path })
        .collect();

    let mut phase_exits: Vec<(GameState, LegalActionSet, Vec<LegalAction>)> = Vec::new();
    let mut terminals: Vec<(GameState, Vec<LegalAction>)> = Vec::new();
    let mut states_evaluated = 0u64;
    let mut depth = 0u32;

    loop {
        depth += 1;
        let mut candidates: Vec<(BeamEntry, f64)> = Vec::new();

        for entry in &beam {
            let num_actions = entry.actions.actions.len();

            // Terminal: combat over or no actions
            if is_combat_terminal(&entry.state, num_actions) {
                terminals.push((entry.state.clone(), entry.path.clone()));
                continue;
            }

            for action in &entry.actions.actions {
                if let Some((child_state, child_actions)) = step(&entry.state, action) {
                    states_evaluated += 1;
                    let mut child_path = entry.path.clone();
                    child_path.push(action.clone());

                    let child_phase = current_combat_phase(&child_state);

                    // Did we exit this phase?
                    if child_phase != start_phase {
                        if child_phase.is_none() {
                            // Combat ended entirely
                            terminals.push((child_state, child_path));
                        } else {
                            // Transitioned to next phase
                            phase_exits.push((child_state, child_actions, child_path));
                        }
                        continue;
                    }

                    // Still in same phase — use phase-aware scoring
                    let score = phase_score(&child_state, pre, start_phase);
                    candidates.push((
                        BeamEntry { state: child_state, actions: child_actions, path: child_path },
                        score,
                    ));
                }
            }
        }

        if candidates.is_empty() {
            break;
        }

        // Sort by score descending, keep top beam_width
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        candidates.truncate(beam_width);

        if depth % 5 == 0 {
            eprint!("  [Phase:{phase_name}] depth: {depth}, beam: {}, exits: {}      \r",
                candidates.len(), phase_exits.len());
        }

        beam = candidates.into_iter().map(|(e, _)| e).collect();
    }

    // Any remaining beam entries that didn't expand are also checked
    for entry in beam {
        let num_actions = entry.actions.actions.len();
        if is_combat_terminal(&entry.state, num_actions) {
            terminals.push((entry.state, entry.path));
        } else {
            // Stuck but not terminal — treat as terminal for scoring
            terminals.push((entry.state, entry.path));
        }
    }

    (phase_exits, terminals, states_evaluated)
}

/// Mini-DFS within a single state: exhaustive search from this point to combat end.
/// Used for the Attack phase where beam search fails due to all-or-nothing rewards.
fn mini_dfs(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    path: &mut Vec<LegalAction>,
    best: &mut Option<(CombatScore, Vec<LegalAction>)>,
    nodes: &mut u64,
    node_limit: u64,
) {
    if *nodes >= node_limit { return; }
    *nodes += 1;

    let num_actions = actions.actions.len();
    if is_combat_terminal(state, num_actions) {
        let score = CombatScore::evaluate(pre, state);
        if best.as_ref().map_or(true, |(b, _)| score.total > b.total) {
            *best = Some((score, path.clone()));
        }
        return;
    }

    for action in &actions.actions {
        if let Some((child_state, child_actions)) = step(state, action) {
            path.push(action.clone());
            mini_dfs(&child_state, &child_actions, pre, path, best, nodes, node_limit);
            path.pop();
            if *nodes >= node_limit { return; }
        }
    }
}

fn phased_beam_search(
    initial_state: &GameState,
    initial_actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    beam_width: usize,
) -> PhasedBeamResult {
    // Beam search through RangedSiege, Block, AssignDamage phases.
    // Then exhaustive DFS through Attack phase (much smaller search space).
    let early_phases = ["RangedSiege", "Block", "AssignDamage"];
    let mut current_entries = vec![
        (initial_state.clone(), initial_actions.clone(), Vec::<LegalAction>::new())
    ];
    let mut all_terminals: Vec<(GameState, Vec<LegalAction>)> = Vec::new();
    let mut total_states_evaluated = 0u64;
    let mut phase_stats = Vec::new();

    for phase_name in &early_phases {
        if current_entries.is_empty() {
            break;
        }

        let (phase_exits, terminals, evaluated) = beam_search_single_phase(
            current_entries,
            pre,
            beam_width,
            phase_name,
        );

        phase_stats.push((phase_name.to_string(), phase_exits.len(), evaluated));
        total_states_evaluated += evaluated;
        all_terminals.extend(terminals);

        // Keep diverse set for next phase: bucket by (enemies_blocked, cards_remaining)
        let mut scored_exits: Vec<_> = phase_exits.into_iter()
            .map(|(s, a, p)| {
                let cards_left = s.players[0].hand.len();
                let enemies_blocked = s.combat.as_ref()
                    .map(|c| c.enemies.iter().filter(|e| e.is_blocked).count())
                    .unwrap_or(0);
                let base_score = CombatScore::evaluate(pre, &s).total;
                (s, a, p, cards_left, enemies_blocked, base_score)
            })
            .collect();

        scored_exits.sort_by(|a, b| {
            b.4.cmp(&a.4)
                .then(b.3.cmp(&a.3))
                .then(b.5.partial_cmp(&a.5).unwrap())
        });

        use std::collections::BTreeMap;
        let mut buckets: BTreeMap<(usize, usize), Vec<_>> = BTreeMap::new();
        for entry in scored_exits {
            buckets.entry((entry.4, entry.3)).or_default().push(entry);
        }
        let per_bucket = (beam_width / buckets.len().max(1)).max(1);
        let mut diverse_entries = Vec::new();
        for (_key, mut entries) in buckets {
            entries.truncate(per_bucket);
            diverse_entries.extend(entries);
        }
        diverse_entries.truncate(beam_width);

        current_entries = diverse_entries.into_iter()
            .map(|(s, a, p, _, _, _)| (s, a, p))
            .collect();
    }

    // Attack phase: exhaustive mini-DFS from each surviving state.
    // Each state has ~2-5 cards left, so the search space is small.
    let attack_node_limit = 100_000u64; // per state
    let mut attack_evaluated = 0u64;
    for (state, actions, base_path) in &current_entries {
        let num_actions = actions.actions.len();
        if is_combat_terminal(state, num_actions) {
            all_terminals.push((state.clone(), base_path.clone()));
            continue;
        }
        let mut best: Option<(CombatScore, Vec<LegalAction>)> = None;
        let mut nodes = 0u64;
        let mut dfs_path = base_path.clone();
        mini_dfs(state, actions, pre, &mut dfs_path, &mut best, &mut nodes, attack_node_limit);
        attack_evaluated += nodes;
        if let Some((_, path)) = best {
            // Re-evaluate to get the score from the terminal state reached by this path
            // We already have the best score from mini_dfs
            all_terminals.push((state.clone(), path));
        } else {
            all_terminals.push((state.clone(), base_path.clone()));
        }
    }
    phase_stats.push(("Attack(DFS)".to_string(), 0, attack_evaluated));
    total_states_evaluated += attack_evaluated;

    // Find best terminal by replaying best paths
    let mut best_score = CombatScore {
        fame_gained: 0, wounds_taken: 0, cards_remaining: 0,
        cards_spent: 0, crystals_spent: 0, units_newly_wounded: 0,
        total: f64::NEG_INFINITY,
    };
    let mut best_path = Vec::new();

    for (_, path) in &all_terminals {
        // Replay path from initial state to get final state
        let mut state = initial_state.clone();
        let mut valid = true;
        for action in path {
            let mut undo = UndoStack::new();
            let epoch = state.action_epoch;
            match apply_legal_action(&mut state, &mut undo, 0, action, epoch) {
                Ok(_) => {}
                Err(_) => { valid = false; break; }
            }
        }
        if !valid { continue; }
        let score = CombatScore::evaluate(pre, &state);
        if score.total > best_score.total {
            best_score = score;
            best_path = path.clone();
        }
    }

    PhasedBeamResult {
        best_score,
        best_path,
        states_evaluated: total_states_evaluated,
        phase_stats,
    }
}

// =============================================================================
// Heuristic Combat Solver
// =============================================================================
//
// Thinks like a human: "What do the enemies need? What can my cards provide?"
// Enumerates card role assignments (unused/sideways_atk/sideways_blk/basic_atk/
// basic_blk/powered_atk/powered_blk) and scores each assignment.
//
// With 5 cards × 7 roles = 16,807 combos. With 8 cards = 5.7M. Still instant.

/// What a single card can contribute to combat.
#[derive(Debug, Clone)]
struct CardCombatProfile {
    card_id: String,
    sideways_value: u32, // typically 1
    /// (amount, combat_type) for basic effect, if it has attack
    basic_attack: Option<u32>,
    /// amount for basic effect, if it has block
    basic_block: Option<u32>,
    /// (amount, combat_type) for powered effect
    powered_attack: Option<u32>,
    /// amount for powered effect
    powered_block: Option<u32>,
    /// Can we afford to power this card?
    can_power: bool,
}

/// Extract the maximum attack value from a CardEffect (recursively).
fn extract_max_attack(effect: &mk_types::effect::CardEffect) -> Option<u32> {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainAttack { amount, .. } => Some(*amount),
        CardEffect::Choice { options } => {
            options.iter().filter_map(extract_max_attack).max()
        }
        CardEffect::Compound { effects } => {
            // Sum all attack values in a compound
            let total: u32 = effects.iter().filter_map(extract_max_attack).sum();
            if total > 0 { Some(total) } else { None }
        }
        CardEffect::DiscardCost { then_effect, .. } => extract_max_attack(then_effect),
        CardEffect::Conditional { then_effect, .. } => extract_max_attack(then_effect),
        CardEffect::Scaling { base_effect, .. } => extract_max_attack(base_effect),
        _ => None,
    }
}

/// Extract the maximum block value from a CardEffect (recursively).
fn extract_max_block(effect: &mk_types::effect::CardEffect) -> Option<u32> {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainBlock { amount, .. } => Some(*amount),
        CardEffect::Choice { options } => {
            options.iter().filter_map(extract_max_block).max()
        }
        CardEffect::Compound { effects } => {
            let total: u32 = effects.iter().filter_map(extract_max_block).sum();
            if total > 0 { Some(total) } else { None }
        }
        CardEffect::DiscardCost { then_effect, .. } => extract_max_block(then_effect),
        CardEffect::Conditional { then_effect, .. } => extract_max_block(then_effect),
        CardEffect::Scaling { base_effect, .. } => extract_max_block(base_effect),
        _ => None,
    }
}

fn build_card_profiles(state: &GameState) -> Vec<CardCombatProfile> {
    let player = &state.players[0];
    // Simple mana check: can we power a card of this color?
    // Check source die pool + crystals + tokens
    let has_mana = |color: mk_types::enums::BasicManaColor| -> bool {
        // Check crystals
        let has_crystal = match color {
            mk_types::enums::BasicManaColor::Red => player.crystals.red > 0,
            mk_types::enums::BasicManaColor::Blue => player.crystals.blue > 0,
            mk_types::enums::BasicManaColor::Green => player.crystals.green > 0,
            mk_types::enums::BasicManaColor::White => player.crystals.white > 0,
        };
        // Check mana tokens
        let mana_color = mk_types::enums::ManaColor::from(color);
        let has_token = player.pure_mana.iter().any(|t| {
            t.color == mana_color
                || t.color == mk_types::enums::ManaColor::Gold
        });
        // Check source dice (simplified — just check if any die matches)
        let has_die = state.source.dice.iter().any(|d| {
            !d.is_depleted && d.taken_by_player_id.is_none()
                && (d.color == mana_color
                    || d.color == mk_types::enums::ManaColor::Gold)
        });
        has_crystal || has_token || has_die
    };

    player.hand.iter().map(|card_id| {
        let card_str = card_id.as_str();
        let mut profile = CardCombatProfile {
            card_id: card_str.to_string(),
            sideways_value: 1,
            basic_attack: None,
            basic_block: None,
            powered_attack: None,
            powered_block: None,
            can_power: false,
        };

        if card_str == "wound" {
            profile.sideways_value = 0;
            return profile;
        }

        if let Some(def) = mk_data::cards::get_card(card_str) {
            profile.sideways_value = def.sideways_value;
            profile.basic_attack = extract_max_attack(&def.basic_effect);
            profile.basic_block = extract_max_block(&def.basic_effect);
            profile.powered_attack = extract_max_attack(&def.powered_effect);
            profile.powered_block = extract_max_block(&def.powered_effect);
            profile.can_power = match def.powered_by {
                mk_data::cards::PoweredBy::Single(color) => has_mana(color),
                mk_data::cards::PoweredBy::AnyBasic => true, // simplified
                mk_data::cards::PoweredBy::None => false,
            };
        }

        profile
    }).collect()
}

/// What role a card is assigned to in a combat plan.
#[derive(Debug, Clone, Copy, PartialEq)]
enum CardRole {
    Unused,         // kept in hand
    SidewaysAttack, // 1 attack
    SidewaysBlock,  // 1 block
    BasicAttack,    // use basic effect for attack
    BasicBlock,     // use basic effect for block
    PoweredAttack,  // use powered effect for attack
    PoweredBlock,   // use powered effect for block
}

const ALL_ROLES: [CardRole; 7] = [
    CardRole::Unused,
    CardRole::SidewaysAttack,
    CardRole::SidewaysBlock,
    CardRole::BasicAttack,
    CardRole::BasicBlock,
    CardRole::PoweredAttack,
    CardRole::PoweredBlock,
];

struct HeuristicResult {
    score: CombatScore,
    plan: Vec<(String, CardRole)>,
    total_attack: u32,
    total_block: u32,
    enemies_killed: u32,
    wounds_avoided: u32,
}

fn heuristic_solve(state: &GameState, _pre: &PreCombatSnapshot) -> HeuristicResult {
    let profiles = build_card_profiles(state);
    let combat = state.combat.as_ref().expect("must be in combat");

    // Gather enemy info
    struct EnemyInfo {
        armor: u32,
        attack: u32,
        fame: u32,
    }
    let enemies: Vec<EnemyInfo> = combat.enemies.iter().map(|e| {
        let def = mk_data::enemies::get_enemy(e.enemy_id.as_str())
            .expect("unknown enemy");
        EnemyInfo { armor: def.armor, attack: def.attack, fame: def.fame }
    }).collect();

    let hero_armor = state.players[0].armor.max(1); // avoid div by zero
    let total_enemy_armor: u32 = enemies.iter().map(|e| e.armor).sum();
    let total_enemy_attack: u32 = enemies.iter().map(|e| e.attack).sum();
    let total_fame: u32 = enemies.iter().map(|e| e.fame).sum();
    let num_cards = profiles.len();

    // Enumerate all role assignments
    // For N cards, iterate through 7^N combinations
    let num_combos = 7u64.pow(num_cards as u32);

    let mut best_score = f64::NEG_INFINITY;
    let mut best_assignment: Vec<CardRole> = vec![CardRole::Unused; num_cards];
    let mut best_total_attack = 0u32;
    let mut best_total_block = 0u32;

    for combo in 0..num_combos {
        // Decode combo into roles
        let mut roles = vec![CardRole::Unused; num_cards];
        let mut c = combo;
        let mut valid = true;
        let mut powered_count = 0u32;

        for i in 0..num_cards {
            let role_idx = (c % 7) as usize;
            c /= 7;
            roles[i] = ALL_ROLES[role_idx];

            // Validate: can this card do this role?
            let p = &profiles[i];
            match roles[i] {
                CardRole::Unused => {}
                CardRole::SidewaysAttack | CardRole::SidewaysBlock => {
                    if p.sideways_value == 0 { valid = false; break; }
                }
                CardRole::BasicAttack => {
                    if p.basic_attack.is_none() { valid = false; break; }
                }
                CardRole::BasicBlock => {
                    if p.basic_block.is_none() { valid = false; break; }
                }
                CardRole::PoweredAttack => {
                    if !p.can_power || p.powered_attack.is_none() { valid = false; break; }
                    powered_count += 1;
                }
                CardRole::PoweredBlock => {
                    if !p.can_power || p.powered_block.is_none() { valid = false; break; }
                    powered_count += 1;
                }
            }
        }

        if !valid { continue; }
        // Simplified: assume we can only power 1 card per combat (1 mana source)
        if powered_count > 1 { continue; }

        // Calculate totals
        let mut total_attack = 0u32;
        let mut total_block = 0u32;
        let mut cards_used = 0u32;

        for (i, role) in roles.iter().enumerate() {
            let p = &profiles[i];
            match role {
                CardRole::Unused => {}
                CardRole::SidewaysAttack => {
                    total_attack += p.sideways_value;
                    cards_used += 1;
                }
                CardRole::SidewaysBlock => {
                    total_block += p.sideways_value;
                    cards_used += 1;
                }
                CardRole::BasicAttack => {
                    total_attack += p.basic_attack.unwrap_or(0);
                    cards_used += 1;
                }
                CardRole::BasicBlock => {
                    total_block += p.basic_block.unwrap_or(0);
                    cards_used += 1;
                }
                CardRole::PoweredAttack => {
                    total_attack += p.powered_attack.unwrap_or(0);
                    cards_used += 1;
                }
                CardRole::PoweredBlock => {
                    total_block += p.powered_block.unwrap_or(0);
                    cards_used += 1;
                }
            }
        }

        // Score this assignment
        // Block must fully cover an enemy's attack to negate it.
        // Unblocked enemies deal full attack damage. Each `armor` points = 1 wound (rounded up).
        let mut wounds = 0u32;
        let mut block_remaining = total_block;
        for enemy in &enemies {
            if block_remaining >= enemy.attack {
                // Fully blocked — no damage
                block_remaining -= enemy.attack;
            } else {
                // Not fully blocked — takes full attack as damage
                // wounds = ceil(attack / armor)
                let damage = enemy.attack;
                wounds += (damage + hero_armor - 1) / hero_armor;
                block_remaining = 0;
            }
        }

        // Can we kill all enemies?
        let can_kill_all = total_attack >= total_enemy_armor;
        let fame_gained = if can_kill_all { total_fame } else { 0 };
        let cards_remaining = (num_cards as u32).saturating_sub(cards_used);

        // Same eval function weights as the search
        let score = fame_gained as f64 * 100.0
            - wounds as f64 * 80.0
            + cards_remaining as f64 * 15.0;

        if score > best_score {
            best_score = score;
            best_assignment = roles;
            best_total_attack = total_attack;
            best_total_block = total_block;
        }
    }

    // Build result
    let cards_used: usize = best_assignment.iter().filter(|r| **r != CardRole::Unused).count();
    let cards_remaining = num_cards - cards_used;

    // Recalculate wounds for best
    let mut wounds = 0u32;
    let mut block_remaining = best_total_block;
    for enemy in &enemies {
        if block_remaining >= enemy.attack {
            block_remaining -= enemy.attack;
        } else {
            let damage = enemy.attack;
            wounds += (damage + hero_armor - 1) / hero_armor;
            block_remaining = 0;
        }
    }
    let wounds_avoided = enemies.len() as u32 - wounds;
    let can_kill_all = best_total_attack >= total_enemy_armor;

    let plan: Vec<(String, CardRole)> = profiles.iter().zip(best_assignment.iter())
        .map(|(p, r)| (p.card_id.clone(), *r))
        .collect();

    HeuristicResult {
        score: CombatScore {
            fame_gained: if can_kill_all { total_fame } else { 0 },
            wounds_taken: wounds,
            cards_remaining,
            cards_spent: cards_used,
            crystals_spent: 0,
            units_newly_wounded: 0,
            total: best_score,
        },
        plan,
        total_attack: best_total_attack,
        total_block: best_total_block,
        enemies_killed: if can_kill_all { enemies.len() as u32 } else { 0 },
        wounds_avoided,
    }
}

fn compare_to_dfs(dfs_stats: &DfsStats, score: &CombatScore) {
    if let Some(ref dfs_best) = dfs_stats.best_score {
        let gap = dfs_best.total - score.total;
        if gap.abs() < 0.01 {
            println!("    >> MATCHES DFS optimal!");
        } else {
            println!("    >> Gap from DFS optimal: {:.0} ({:.1}%)",
                gap, gap / dfs_best.total.abs() * 100.0);
        }
    }
}

// =============================================================================
// Display helpers
// =============================================================================

fn format_action_short(action: &LegalAction) -> String {
    let s = format!("{action:?}");
    if s.len() > 100 { format!("{}...", &s[..97]) } else { s }
}

fn print_path(label: &str, score: &CombatScore, path: &[LegalAction]) {
    println!("\n  {label}:");
    println!("    {score}");
    println!("    Path ({} actions):", path.len());
    for (i, action) in path.iter().enumerate() {
        println!("      {i:2}. {}", format_action_short(action));
    }
}

// =============================================================================
// Scenario runner — runs both DFS and MCTS, compares results
// =============================================================================

/// Apply level stats to the player state so combat scenarios are realistic.
/// Sets armor, hand_limit, and command_tokens based on the level table.
fn apply_level_stats(state: &mut GameState, level: u32) {
    let stats = mk_data::levels::get_level_stats(level);
    let player = &mut state.players[0];
    player.level = level;
    player.armor = stats.armor;
    player.hand_limit = stats.hand_limit;
    player.command_tokens = stats.command_slots;
}

fn run_scenario(name: &str, scenario: TrainingScenario, seed: u32, dfs_node_limit: u64, dfs_only: bool, level: Option<u32>) {
    println!("\n{}", "=".repeat(70));
    println!("Scenario: {name}");
    println!("Seed: {seed}");

    let mut setup = create_training_game(seed, Hero::Arythea, &scenario);

    // Apply level stats for realistic armor/hand_limit/command
    if let Some(lvl) = level {
        apply_level_stats(&mut setup.state, lvl);
    }

    let pre = PreCombatSnapshot::from_state(&setup.state);

    if let Some(ref combat) = setup.state.combat {
        let enemies: Vec<&str> = combat.enemies.iter().map(|e| e.enemy_id.as_str()).collect();
        println!("Enemies: {enemies:?}  Fortified: {}", combat.is_at_fortified_site);
    }
    let p = &setup.state.players[0];
    let hand: Vec<&str> = p.hand.iter().map(|c| c.as_str()).collect();
    println!("Hand ({} cards): {hand:?}", hand.len());
    println!("Level: {}  Armor: {}  Hand limit: {}  Command: {}",
        p.level, p.armor, p.hand_limit, p.command_tokens);

    // ---- Exhaustive DFS (seeded + tight pruning + action ordering) ----
    println!("\n--- Exhaustive DFS (limit: {dfs_node_limit}) ---");
    let total_possible_fame: u32 = setup.state.combat.as_ref()
        .map(|c| c.enemies.iter()
            .map(|e| mk_data::enemies::get_enemy(e.enemy_id.as_str())
                .map(|d| d.fame).unwrap_or(0))
            .sum())
        .unwrap_or(0);
    let mut dfs_stats = DfsStats::new(total_possible_fame);

    // Seed with greedy rollouts to establish a good initial lower bound for pruning.
    let seed_start = Instant::now();
    if let Some((seed_score, seed_path)) = greedy_seed(&setup.state, &setup.action_set, &pre, 1000) {
        println!("  Seed score: {:.0} (from 1000 rollouts in {:.0?})", seed_score.total, seed_start.elapsed());
        dfs_stats.best_score = Some(seed_score);
        dfs_stats.best_path = seed_path;
    }

    let mut path = Vec::new();
    let dfs_start = Instant::now();
    dfs(&setup.state, &setup.action_set, 0, &mut dfs_stats, dfs_node_limit, &pre, &mut path);
    let dfs_elapsed = dfs_start.elapsed();
    eprintln!();

    let dfs_complete = dfs_stats.nodes_visited < dfs_node_limit;
    println!("  Time:          {:.2?}", dfs_elapsed);
    println!("  Nodes:         {}", dfs_stats.nodes_visited);
    println!("  Pruned:        {}", dfs_stats.nodes_pruned);
    println!("  Transpositions:{}", dfs_stats.transpositions);
    println!("  Unique states: {}", dfs_stats.seen.len());
    println!("  Leaves:        {}", dfs_stats.leaves);
    println!("  Avg branching: {:.2}", dfs_stats.avg_branching());
    println!("  Status:        {}", if dfs_complete { "COMPLETE" } else { "HIT LIMIT" });

    if let Some(ref score) = dfs_stats.best_score {
        print_path("DFS BEST", score, &dfs_stats.best_path);

        // Replay best path and print combat state at each step
        println!("\n    Replay:");
        let mut replay = setup.state.clone();
        for (i, action) in dfs_stats.best_path.iter().enumerate() {
            let phase_before = replay.combat.as_ref().map(|c| format!("{:?}", c.phase));
            let mut undo = UndoStack::new();
            let epoch = replay.action_epoch;
            if let Err(e) = apply_legal_action(&mut replay, &mut undo, 0, action, epoch) {
                println!("      {i:2}. ERROR: {e:?}");
                break;
            }
            let phase_after = replay.combat.as_ref().map(|c| format!("{:?}", c.phase));
            // Print phase transitions and enemy changes
            if phase_before != phase_after {
                if let Some(ref combat) = replay.combat {
                    let enemies: Vec<String> = combat.enemies.iter()
                        .map(|e| format!("{}({}{}{})",
                            e.enemy_id.as_str(),
                            if e.is_defeated { "dead" } else { "alive" },
                            if e.is_blocked { ",blk" } else { "" },
                            if e.summoned_by_instance_id.is_some() { ",summoned" } else { "" },
                        ))
                        .collect();
                    println!("      >> Phase: {:?} → {:?}  Enemies: {:?}",
                        phase_before.as_deref().unwrap_or("?"),
                        phase_after.as_deref().unwrap_or("none"),
                        enemies);
                } else {
                    println!("      >> Combat ended after step {i}");
                }
            }
        }
    }

    if dfs_only { return; }

    // ---- Beam Search at various widths ----
    for width in [10, 50, 100, 500] {
        println!("\n--- Beam Search (width={width}) ---");
        let beam_start = Instant::now();
        let result = beam_search(&setup.state, &setup.action_set, &pre, width);
        let beam_elapsed = beam_start.elapsed();
        eprintln!();

        println!("  Time:          {:.2?}", beam_elapsed);
        println!("  States eval'd: {}", result.states_evaluated);
        println!("  Max depth:     {}", result.max_depth);

        print_path(&format!("Beam BEST (w={width})"), &result.best_score, &result.best_path);
        compare_to_dfs(&dfs_stats, &result.best_score);
    }

    // ---- Phased Beam Search at various widths ----
    for width in [10, 50, 100, 500] {
        println!("\n--- Phased Beam Search (width={width}) ---");
        let phased_start = Instant::now();
        let result = phased_beam_search(&setup.state, &setup.action_set, &pre, width);
        let phased_elapsed = phased_start.elapsed();
        eprintln!();

        println!("  Time:          {:.2?}", phased_elapsed);
        println!("  States eval'd: {}", result.states_evaluated);
        for (phase, survivors, evaluated) in &result.phase_stats {
            println!("    {phase}: {evaluated} states → {survivors} survivors");
        }

        print_path(&format!("Phased Beam BEST (w={width})"), &result.best_score, &result.best_path);
        compare_to_dfs(&dfs_stats, &result.best_score);
    }

    // ---- Heuristic Solver ----
    println!("\n--- Heuristic Solver ---");
    let heuristic_start = Instant::now();
    let heuristic = heuristic_solve(&setup.state, &pre);
    let heuristic_elapsed = heuristic_start.elapsed();

    println!("  Time:          {:.2?}", heuristic_elapsed);
    println!("  Score:         {}", heuristic.score);
    println!("  Attack: {} (need {})  Block: {} (enemy attack: {})",
        heuristic.total_attack,
        setup.state.combat.as_ref().map(|c| c.enemies.iter()
            .map(|e| mk_data::enemies::get_enemy(e.enemy_id.as_str()).unwrap().armor)
            .sum::<u32>()).unwrap_or(0),
        heuristic.total_block,
        setup.state.combat.as_ref().map(|c| c.enemies.iter()
            .map(|e| mk_data::enemies::get_enemy(e.enemy_id.as_str()).unwrap().attack)
            .sum::<u32>()).unwrap_or(0),
    );
    println!("  Kills: {}  Wounds avoided: {}",
        heuristic.enemies_killed, heuristic.wounds_avoided);
    println!("  Plan:");
    for (card_id, role) in &heuristic.plan {
        if *role != CardRole::Unused {
            println!("    {card_id}: {role:?}");
        } else {
            println!("    {card_id}: (keep in hand)");
        }
    }
    compare_to_dfs(&dfs_stats, &heuristic.score);

    // ---- MCTS at various budgets ----
    let mcts_budgets = [100, 500, 1000, 5000];
    let explore_c = 1.414; // sqrt(2), standard UCB1

    for budget in mcts_budgets {
        println!("\n--- MCTS ({budget} iterations, C={explore_c:.3}) ---");
        let mcts_start = Instant::now();
        let result = mcts_search(&setup.state, &setup.action_set, &pre, budget, explore_c);
        let mcts_elapsed = mcts_start.elapsed();
        eprintln!();

        println!("  Time:          {:.2?}", mcts_elapsed);
        println!("  Iterations:    {}", result.iterations);
        println!("  Nodes created: {}", result.nodes_created);

        print_path(&format!("MCTS BEST ({budget} iters)"), &result.best_score, &result.best_path);

        compare_to_dfs(&dfs_stats, &result.best_score);
    }

    // ---- NMCS at various levels ----
    for level in [1, 2, 3] {
        println!("\n--- NMCS (level {level}) ---");
        let nmcs_start = Instant::now();
        let mut nmcs_stats = NmcsStats::default();
        let (score, path) = nmcs(
            &setup.state, &setup.action_set, level, &pre, &mut nmcs_stats,
        );
        let nmcs_elapsed = nmcs_start.elapsed();
        eprintln!();

        println!("  Time:          {:.2?}", nmcs_elapsed);
        println!("  Rollouts:      {}", nmcs_stats.rollouts);
        println!("  Steps:         {}", nmcs_stats.steps);

        print_path(&format!("NMCS BEST (level {level})"), &score, &path);

        compare_to_dfs(&dfs_stats, &score);
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let dfs_only = args.iter().any(|a| a == "--dfs-only");
    let dfs_limit: u64 = args.iter()
        .filter(|a| a.parse::<u64>().is_ok())
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10_000_000);

    // Scenario 1: Small — both methods should easily find optimal
    run_scenario(
        "1x Diggers (rage+determination+stamina)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".into()],
            is_fortified: false,
            hand_override: Some(vec!["rage".into(), "determination".into(), "stamina".into()]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        None, // level 1 default
    );

    // Scenario 2: Medium — 5 card hand, level 1
    run_scenario(
        "1x Diggers (random hand)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".into()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        None,
    );

    // Scenario 3: 2 enemies, 5 cards, level 1
    run_scenario(
        "2x Diggers (random hand)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".into(), "diggers_2".into()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        None,
    );

    // Scenario 4: 3 enemies, 6-card hand, level 5 (armor=3, hand_limit=6)
    run_scenario(
        "3x enemies (6 cards, level 5)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "diggers_1".into(), "wolf_riders_1".into(), "orc_skirmishers_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".into(), "determination".into(), "stamina".into(),
                "march".into(), "swiftness".into(), "improvisation".into(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        Some(5), // level 5: armor=3, hand_limit=6, command=3
    );

    // Scenario 5: 4 enemies, 7-card hand, level 9 (armor=4, hand_limit=7)
    run_scenario(
        "4x enemies (7 cards, level 9)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "diggers_1".into(), "diggers_2".into(),
                "wolf_riders_1".into(), "orc_skirmishers_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".into(), "determination".into(), "stamina".into(),
                "march".into(), "swiftness".into(), "improvisation".into(),
                "arythea_battle_versatility".into(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        Some(9), // level 9: armor=4, hand_limit=7, command=5
    );

    // Scenario 6: Summoner — RNG at phase boundary
    run_scenario(
        "Orc Summoners + Diggers (summoner test, level 5)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "orc_summoners_1".into(), "diggers_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".into(), "determination".into(), "stamina".into(),
                "march".into(), "swiftness".into(), "improvisation".into(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        42,
        dfs_limit,
        dfs_only,
        Some(5),
    );

    // Scenario 7: Advanced actions + spell mix (level 5)
    // AAs/spells aren't in the starting deck, so use extra_cards to add them first
    run_scenario(
        "2x enemies with AAs + spell (level 5)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "ironclads_1".into(), "cursed_hags_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "blood_rage".into(), "ice_bolt".into(), "shield_bash".into(),
                "fireball".into(), "stamina".into(), "determination".into(),
            ]),
            extra_cards: Some(vec![
                "blood_rage".into(), "ice_bolt".into(), "shield_bash".into(),
                "fireball".into(),
            ]),
            units: None,
            skills: None,
            crystals: Some(mk_types::state::Crystals { red: 1, blue: 1, green: 0, white: 0 }),
        },
        99,
        dfs_limit,
        dfs_only,
        Some(5),
    );

    // Scenario 8: Artifacts + fortified (need siege to break fortification)
    run_scenario(
        "Fortified ironclads with artifacts (level 7)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "ironclads_1".into(), "diggers_1".into(),
            ],
            is_fortified: true,
            hand_override: Some(vec![
                "sword_of_justice".into(), "rage".into(), "determination".into(),
                "stamina".into(), "swiftness".into(), "improvisation".into(),
            ]),
            extra_cards: Some(vec![
                "sword_of_justice".into(),
            ]),
            units: None,
            skills: None,
            crystals: Some(mk_types::state::Crystals { red: 1, blue: 0, green: 0, white: 1 }),
        },
        77,
        dfs_limit,
        dfs_only,
        Some(7),
    );

    // Scenario 9: Elemental enemies (resistances matter)
    run_scenario(
        "Fire elemental + ice bolt/fireball (level 5)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "fire_elemental_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "ice_bolt".into(), "fireball".into(), "rage".into(),
                "determination".into(), "stamina".into(),
            ]),
            extra_cards: Some(vec![
                "ice_bolt".into(), "fireball".into(),
            ]),
            units: None,
            skills: None,
            crystals: Some(mk_types::state::Crystals { red: 1, blue: 1, green: 0, white: 0 }),
        },
        55,
        dfs_limit,
        dfs_only,
        Some(5),
    );

    // Scenario 10: Swift enemy (attacks in ranged/siege phase)
    run_scenario(
        "Centaur Outriders (swift) + basic hand (level 3)",
        TrainingScenario::CombatDrill {
            enemy_tokens: vec![
                "centaur_outriders_1".into(), "diggers_1".into(),
            ],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".into(), "determination".into(), "stamina".into(),
                "swiftness".into(), "march".into(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        },
        33,
        dfs_limit,
        dfs_only,
        Some(3),
    );

    println!("\nDone.");
}
