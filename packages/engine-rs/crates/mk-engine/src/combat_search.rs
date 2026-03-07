//! Exhaustive combat tree search with transposition table.
//!
//! Given a `GameState` in combat, finds the optimal sequence of actions
//! by exhaustive DFS with three key optimizations:
//!
//! 1. **Transposition table** — hashes combat-relevant state to skip
//!    permutation-equivalent orderings (e.g., playing card A then B vs B then A).
//! 2. **Upper-bound pruning** — computes max achievable fame given remaining
//!    attack potential, prunes branches that can't beat the current best.
//! 3. **Greedy seeding** — runs fast heuristic rollouts first to establish
//!    a good initial lower bound, making pruning effective from the start.
//!
//! # Usage
//!
//! ```ignore
//! use mk_engine::combat_search::{search_combat, CombatSearchConfig};
//!
//! let result = search_combat(&state, &CombatSearchConfig::default());
//! println!("Optimal score: {}, actions: {}", result.score, result.actions.len());
//! ```

use std::collections::HashSet;
use std::hash::{Hash, Hasher};

use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::state::GameState;

use crate::action_pipeline::{apply_legal_action, ApplyResult};
use crate::legal_actions::enumerate_legal_actions;
use crate::undo::UndoStack;

// =============================================================================
// Public API
// =============================================================================

/// Configuration for the combat search.
pub struct CombatSearchConfig {
    /// Maximum number of nodes to visit before stopping.
    pub node_limit: u64,
    /// Number of greedy rollouts to seed the search with a lower bound.
    pub seed_rollouts: u32,
}

impl Default for CombatSearchConfig {
    fn default() -> Self {
        Self {
            node_limit: 10_000_000,
            seed_rollouts: 1000,
        }
    }
}

/// Result of the combat search.
#[derive(Debug, Clone)]
pub struct CombatSearchResult {
    /// Composite score (higher = better).
    pub score: f64,
    /// Fame gained during combat.
    pub fame_gained: u32,
    /// Wounds taken during combat.
    pub wounds_taken: u32,
    /// Non-wound cards remaining in hand after combat.
    pub cards_remaining: usize,
    /// Crystals spent during combat.
    pub crystals_spent: i32,
    /// Units newly wounded during combat.
    pub units_newly_wounded: i32,
    /// Whether the player would be knocked out.
    pub knocked_out: bool,
    /// Optimal action sequence from the search.
    pub actions: Vec<LegalAction>,
    /// Number of nodes visited during the search.
    pub nodes_visited: u64,
    /// Number of nodes pruned by upper-bound.
    pub nodes_pruned: u64,
    /// Number of transposition hits (permutation duplicates skipped).
    pub transpositions: u64,
    /// Number of unique states explored.
    pub unique_states: usize,
    /// Whether the search exhausted the full tree (vs hitting node limit).
    pub complete: bool,
}

/// Search for the optimal combat play from the current state.
///
/// The state must be in combat (`state.combat.is_some()`).
/// Returns the best action sequence found within the node budget.
pub fn search_combat(state: &GameState, config: &CombatSearchConfig) -> CombatSearchResult {
    let pre = PreCombatSnapshot::from_state(state);
    let action_set = enumerate_legal_actions(state, 0);

    let total_possible_fame: u32 = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .map(|e| {
                    mk_data::enemies::get_enemy(e.enemy_id.as_str())
                        .map(|d| d.fame)
                        .unwrap_or(0)
                })
                .sum()
        })
        .unwrap_or(0);

    let mut stats = DfsStats::new(total_possible_fame);

    // Seed with greedy rollouts.
    if config.seed_rollouts > 0 {
        if let Some((seed_score, seed_path)) =
            greedy_seed(state, &action_set, &pre, config.seed_rollouts)
        {
            stats.best_score = Some(seed_score);
            stats.best_path = seed_path;
        }
    }

    // Run exhaustive DFS.
    let mut path = Vec::new();
    dfs(
        state,
        &action_set,
        &mut stats,
        config.node_limit,
        &pre,
        &mut path,
    );

    let complete = stats.nodes_visited < config.node_limit;

    match stats.best_score {
        Some(score) => CombatSearchResult {
            score: score.total,
            fame_gained: score.fame_gained,
            wounds_taken: score.wounds_taken,
            cards_remaining: score.cards_remaining,
            crystals_spent: score.crystals_spent,
            units_newly_wounded: score.units_newly_wounded,
            knocked_out: score.knocked_out,
            actions: stats.best_path,
            nodes_visited: stats.nodes_visited,
            nodes_pruned: stats.nodes_pruned,
            transpositions: stats.transpositions,
            unique_states: stats.seen.len(),
            complete,
        },
        None => CombatSearchResult {
            score: f64::NEG_INFINITY,
            fame_gained: 0,
            wounds_taken: 0,
            cards_remaining: 0,
            crystals_spent: 0,
            units_newly_wounded: 0,
            knocked_out: false,
            actions: Vec::new(),
            nodes_visited: stats.nodes_visited,
            nodes_pruned: stats.nodes_pruned,
            transpositions: stats.transpositions,
            unique_states: stats.seen.len(),
            complete,
        },
    }
}

// =============================================================================
// Evaluation
// =============================================================================

#[derive(Clone)]
struct PreCombatSnapshot {
    fame: u32,
    crystals_total: u8,
    units_wounded: usize,
}

impl PreCombatSnapshot {
    fn from_state(state: &GameState) -> Self {
        let player = &state.players[0];
        Self {
            fame: player.fame,
            crystals_total: player.crystals.red
                + player.crystals.blue
                + player.crystals.green
                + player.crystals.white,
            units_wounded: player.units.iter().filter(|u| u.wounded).count(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct CombatScore {
    fame_gained: u32,
    wounds_taken: u32,
    cards_remaining: usize,
    crystals_spent: i32,
    units_newly_wounded: i32,
    knocked_out: bool,
    total: f64,
}

impl CombatScore {
    fn evaluate(pre: &PreCombatSnapshot, state: &GameState) -> Self {
        let player = &state.players[0];
        let fame_gained = player.fame.saturating_sub(pre.fame);
        let wounds_taken =
            player.wounds_received_this_turn.hand + player.wounds_received_this_turn.discard;
        let cards_remaining = player.hand.iter().filter(|c| c.as_str() != "wound").count();
        let crystals_now =
            player.crystals.red + player.crystals.blue + player.crystals.green + player.crystals.white;
        let crystals_spent = pre.crystals_total as i32 - crystals_now as i32;
        let units_wounded_now = player.units.iter().filter(|u| u.wounded).count();
        let units_newly_wounded = units_wounded_now as i32 - pre.units_wounded as i32;

        let wounds_in_hand = player.hand.iter().filter(|c| c.as_str() == "wound").count() as u32;
        let knocked_out = wounds_in_hand >= player.hand_limit;

        let total = if knocked_out {
            fame_gained as f64 * 100.0 - wounds_taken as f64 * 80.0 - 500.0
                - crystals_spent.max(0) as f64 * 25.0
                - units_newly_wounded.max(0) as f64 * 40.0
        } else {
            fame_gained as f64 * 100.0 - wounds_taken as f64 * 80.0
                + cards_remaining as f64 * 15.0
                - crystals_spent.max(0) as f64 * 25.0
                - units_newly_wounded.max(0) as f64 * 40.0
        };

        Self {
            fame_gained,
            wounds_taken,
            cards_remaining,
            crystals_spent,
            units_newly_wounded,
            knocked_out,
            total,
        }
    }
}

// =============================================================================
// State helpers
// =============================================================================

fn is_combat_terminal(state: &GameState, num_actions: usize) -> bool {
    if num_actions == 0 || state.game_ended || state.combat.is_none() {
        return true;
    }
    state
        .combat
        .as_ref()
        .map(|c| c.enemies.iter().all(|e| e.is_defeated))
        .unwrap_or(false)
}

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
// Transposition table
// =============================================================================

fn combat_state_hash(state: &GameState) -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    let p = &state.players[0];

    // Hand (sorted — order doesn't matter)
    let mut hand: Vec<&str> = p.hand.iter().map(|c| c.as_str()).collect();
    hand.sort_unstable();
    for card in &hand {
        card.hash(&mut h);
    }

    // Combat accumulator
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
    let mut tokens: Vec<(u8, u8)> = p
        .pure_mana
        .iter()
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

    // Pending choice
    p.pending.has_active().hash(&mut h);

    // Active modifiers count
    state.active_modifiers.len().hash(&mut h);

    h.finish()
}

// =============================================================================
// Upper bound pruning
// =============================================================================

/// Extract the maximum attack value from a CardEffect (recursively).
fn extract_max_attack(effect: &mk_types::effect::CardEffect) -> Option<u32> {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainAttack { amount, .. } => Some(*amount),
        CardEffect::Choice { options } => options.iter().filter_map(extract_max_attack).max(),
        CardEffect::Compound { effects } => {
            let total: u32 = effects.iter().filter_map(extract_max_attack).sum();
            if total > 0 {
                Some(total)
            } else {
                None
            }
        }
        CardEffect::DiscardCost { then_effect, .. } => extract_max_attack(then_effect),
        CardEffect::Conditional { then_effect, .. } => extract_max_attack(then_effect),
        CardEffect::Scaling { base_effect, .. } => extract_max_attack(base_effect),
        _ => None,
    }
}

fn max_remaining_attack(state: &GameState) -> u32 {
    let player = &state.players[0];
    let acc = &player.combat_accumulator.attack;
    let current_attack = acc.normal
        + acc.ranged
        + acc.siege
        + acc.normal_elements.total()
        + acc.ranged_elements.total()
        + acc.siege_elements.total();

    let mut max_from_hand = 0u32;
    for card_id in &player.hand {
        let card_str = card_id.as_str();
        if card_str == "wound" {
            continue;
        }
        if let Some(def) = mk_data::cards::get_card(card_str) {
            let basic_atk = extract_max_attack(&def.basic_effect).unwrap_or(0);
            let powered_atk = extract_max_attack(&def.powered_effect).unwrap_or(0);
            let sideways = def.sideways_value;
            max_from_hand += basic_atk.max(powered_atk).max(sideways);
        }
    }

    current_attack + max_from_hand
}

fn upper_bound(state: &GameState, pre: &PreCombatSnapshot, _total_possible_fame: u32) -> f64 {
    let player = &state.players[0];
    let wounds_so_far =
        player.wounds_received_this_turn.hand + player.wounds_received_this_turn.discard;
    let cards_remaining = player.hand.len();
    let crystals_now =
        player.crystals.red + player.crystals.blue + player.crystals.green + player.crystals.white;
    let crystals_spent = (pre.crystals_total as i32 - crystals_now as i32).max(0);
    let units_wounded_now = player.units.iter().filter(|u| u.wounded).count();
    let units_newly_wounded = (units_wounded_now as i32 - pre.units_wounded as i32).max(0);

    let max_attack = max_remaining_attack(state);

    let max_fame = if let Some(ref combat) = state.combat {
        let remaining: Vec<(u32, u32)> = combat
            .enemies
            .iter()
            .filter(|e| !e.is_defeated)
            .map(|e| {
                let def = mk_data::enemies::get_enemy(e.enemy_id.as_str()).unwrap();
                (def.armor, def.fame)
            })
            .collect();

        let fame_gained_so_far = player.fame.saturating_sub(pre.fame);

        // Try all subsets of remaining enemies (max 2^N, N ≤ ~8)
        let n = remaining.len();
        let mut best_remaining_fame = 0u32;
        for mask in 0..(1u32 << n) {
            let mut total_armor = 0u32;
            let mut total_fame = 0u32;
            for (i, &(armor, fame)) in remaining.iter().enumerate() {
                if mask & (1 << i) != 0 {
                    total_armor += armor;
                    total_fame += fame;
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

    max_fame as f64 * 100.0 - wounds_so_far as f64 * 80.0 + cards_remaining as f64 * 15.0
        - crystals_spent as f64 * 25.0
        - units_newly_wounded as f64 * 40.0
}

// =============================================================================
// Action ordering
// =============================================================================

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

// =============================================================================
// Greedy seeding (heuristic rollouts)
// =============================================================================

fn action_weight(action: &LegalAction) -> u32 {
    match action {
        LegalAction::PlayCardBasic { .. } => 10,
        LegalAction::PlayCardPowered { .. } => 12,
        LegalAction::PlayCardSideways { .. } => 8,
        LegalAction::DeclareBlock { .. } => 15,
        LegalAction::ResolveAttack => 15,
        LegalAction::SubsetSelect { .. } => 10,
        LegalAction::SubsetConfirm => 10,
        LegalAction::ResolveChoice { .. } => 10,
        LegalAction::ActivateUnit { .. } => 8,
        LegalAction::AssignDamageToHero { .. } => 3,
        LegalAction::AssignDamageToUnit { .. } => 5,
        LegalAction::EndCombatPhase => 2,
        LegalAction::EndTurn => 1,
        _ => 5,
    }
}

fn heuristic_pick<'a>(actions: &'a LegalActionSet, rng: &mut u32) -> &'a LegalAction {
    let weights: Vec<u32> = actions.actions.iter().map(action_weight).collect();
    let total: u32 = weights.iter().sum();

    *rng = rng.wrapping_mul(1664525).wrapping_add(1013904223);
    let roll = (*rng >> 8) % total;

    let mut cumulative = 0;
    for (i, &w) in weights.iter().enumerate() {
        cumulative += w;
        if roll < cumulative {
            return &actions.actions[i];
        }
    }

    actions.actions.last().unwrap()
}

fn rollout(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    rng: &mut u32,
) -> (CombatScore, Vec<LegalAction>) {
    let mut current_state = state.clone();
    let mut current_actions = actions.clone();
    let mut path = Vec::new();

    loop {
        if is_combat_terminal(&current_state, current_actions.actions.len()) {
            break;
        }
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

fn greedy_seed(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCombatSnapshot,
    num_rollouts: u32,
) -> Option<(CombatScore, Vec<LegalAction>)> {
    let mut best: Option<(CombatScore, Vec<LegalAction>)> = None;
    let mut rng = 12345u32;

    for _ in 0..num_rollouts {
        let (score, path) = rollout(state, actions, pre, &mut rng);
        if best.as_ref().is_none_or(|(b, _)| score.total > b.total) {
            best = Some((score, path));
        }
    }
    best
}

// =============================================================================
// DFS
// =============================================================================

struct DfsStats {
    nodes_visited: u64,
    nodes_pruned: u64,
    transpositions: u64,
    best_score: Option<CombatScore>,
    best_path: Vec<LegalAction>,
    total_possible_fame: u32,
    seen: HashSet<u64>,
}

impl DfsStats {
    fn new(total_possible_fame: u32) -> Self {
        Self {
            nodes_visited: 0,
            nodes_pruned: 0,
            transpositions: 0,
            best_score: None,
            best_path: Vec::new(),
            total_possible_fame,
            seen: HashSet::new(),
        }
    }
}

fn dfs(
    state: &GameState,
    action_set: &LegalActionSet,
    stats: &mut DfsStats,
    node_limit: u64,
    pre: &PreCombatSnapshot,
    path: &mut Vec<LegalAction>,
) {
    if stats.nodes_visited >= node_limit {
        return;
    }
    stats.nodes_visited += 1;

    let num_actions = action_set.actions.len();

    if is_combat_terminal(state, num_actions) {
        let score = CombatScore::evaluate(pre, state);
        let is_best = stats
            .best_score
            .map(|b| score.total > b.total)
            .unwrap_or(true);
        if is_best {
            stats.best_score = Some(score);
            stats.best_path = path.clone();
        }
        return;
    }

    // Upper-bound pruning.
    if let Some(ref best) = stats.best_score {
        let ub = upper_bound(state, pre, stats.total_possible_fame);
        if ub <= best.total {
            stats.nodes_pruned += 1;
            return;
        }
    }

    // Transposition check.
    let state_hash = combat_state_hash(state);
    if !stats.seen.insert(state_hash) {
        stats.transpositions += 1;
        return;
    }

    // Sort actions: card plays first, EndCombatPhase last.
    let mut sorted_actions: Vec<&LegalAction> = action_set.actions.iter().collect();
    sorted_actions.sort_by_key(|a| action_priority(a));

    for action in sorted_actions {
        if stats.nodes_visited >= node_limit {
            return;
        }
        if let Some((child_state, child_actions)) = step(state, action) {
            path.push(action.clone());
            dfs(
                &child_state,
                &child_actions,
                stats,
                node_limit,
                pre,
                path,
            );
            path.pop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::enums::{Hero, RoundPhase};
    use mk_types::ids::{CardId, EnemyTokenId};

    fn setup_combat_state(enemy_ids: &[&str], hand: Vec<&str>) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        let tokens: Vec<EnemyTokenId> = enemy_ids
            .iter()
            .map(|id| EnemyTokenId::from(*id))
            .collect();
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        )
        .unwrap();
        state
    }

    #[test]
    fn search_finds_optimal_for_simple_combat() {
        let state = setup_combat_state(
            &["diggers_1"],
            vec!["rage", "determination", "stamina"],
        );

        let result = search_combat(&state, &CombatSearchConfig::default());

        assert!(result.complete, "search should complete for simple combat");
        assert_eq!(result.fame_gained, 2, "should kill diggers (fame=2)");
        assert_eq!(result.wounds_taken, 0, "should block all damage");
        assert!(result.score > 0.0);
    }

    #[test]
    fn search_handles_no_combat() {
        let mut state = setup_combat_state(
            &["diggers_1"],
            vec!["rage", "determination", "stamina"],
        );
        state.combat = None;

        let result = search_combat(&state, &CombatSearchConfig::default());

        assert!(result.complete);
        assert_eq!(result.nodes_visited, 1);
    }

    #[test]
    fn search_completes_multi_enemy() {
        let state = setup_combat_state(
            &["diggers_1", "diggers_2"],
            vec!["rage", "determination", "stamina", "march", "swiftness"],
        );

        let config = CombatSearchConfig {
            node_limit: 100_000,
            seed_rollouts: 500,
        };
        let result = search_combat(&state, &config);

        assert!(result.complete, "2x diggers with 5 cards should complete");
        assert!(result.fame_gained > 0, "should be able to kill at least one");
    }
}
