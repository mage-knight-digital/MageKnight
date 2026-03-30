//! Commerce interaction oracle — finds optimal influence generation and purchases.
//!
//! Given a `GameState` where the player is interacting at a site (IS_INTERACTING),
//! finds the optimal card play + purchase sequence via DFS. Much simpler and faster
//! than combat search (3-7 depth, 8-15 branching vs combat's 15-50 depth, 20-50 branching).
//!
//! Follows the same architecture as `combat_search.rs`:
//! 1. **Transposition table** — hashes interaction-relevant state to skip permutations
//! 2. **Greedy seeding** — heuristic rollouts to establish initial lower bound
//! 3. **Configurable eval weights** — tune wound/spell/AA/unit values per training run
//!
//! # Usage
//!
//! ```ignore
//! use mk_engine::commerce_search::{search_commerce, CommerceSearchConfig};
//!
//! let result = search_commerce(&state, &CommerceSearchConfig::default());
//! println!("Score: {}, actions: {}", result.score, result.actions.len());
//! ```

use std::collections::HashSet;
use std::hash::{Hash, Hasher};

use mk_types::enums::DeedCardType;
use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::state::{GameState, PlayerFlags};

use crate::action_pipeline::{apply_legal_action, ApplyResult};
use crate::legal_actions::enumerate_legal_actions;
use crate::undo::UndoStack;

// =============================================================================
// Public API
// =============================================================================

/// Configuration for the commerce search.
pub struct CommerceSearchConfig {
    /// Maximum number of nodes to visit before stopping.
    pub node_limit: u64,
    /// Number of greedy rollouts to seed the search with a lower bound.
    pub seed_rollouts: u32,
    /// Eval weights for the commerce score function.
    pub eval_weights: CommerceEvalWeights,
}

/// Tunable weights for the commerce evaluation function.
///
/// The oracle maximizes a composite score of purchases made during interaction,
/// penalized by resources consumed.
#[derive(Debug, Clone, Copy)]
pub struct CommerceEvalWeights {
    /// Value per wound healed (~2 game score points).
    pub wound_healed: f64,
    /// Value per spell gained (knowledge +2).
    pub spell_gained: f64,
    /// Value per advanced action gained (knowledge +1 + card quality).
    pub aa_gained: f64,
    /// Value per artifact gained (loot +2, artifacts are strong).
    pub artifact_gained: f64,
    /// Value per unit level recruited (leader +1/level + combat utility).
    pub unit_recruited_per_level: f64,
    /// Bonus for dismissing a wounded unit (replaced by fresh recruit).
    pub unit_dismissed_wounded: f64,
    /// Penalty per unspent influence point (encourages efficiency).
    pub influence_wasted: f64,
    /// Penalty per crystal spent during commerce.
    pub crystal_spent: f64,
    /// Penalty per card played from hand during commerce (encourages card efficiency).
    pub card_spent: f64,
}

impl Default for CommerceEvalWeights {
    fn default() -> Self {
        Self {
            wound_healed: 200.0,
            spell_gained: 200.0,
            aa_gained: 150.0,
            artifact_gained: 250.0,
            unit_recruited_per_level: 150.0,
            unit_dismissed_wounded: 50.0,
            influence_wasted: 10.0,
            crystal_spent: 50.0,
            card_spent: 20.0,
        }
    }
}

impl Default for CommerceSearchConfig {
    fn default() -> Self {
        Self {
            node_limit: 1_000_000,
            seed_rollouts: 200,
            eval_weights: CommerceEvalWeights::default(),
        }
    }
}

/// Result of the commerce search.
#[derive(Debug, Clone)]
pub struct CommerceSearchResult {
    /// Composite score (higher = better).
    pub score: f64,
    /// Number of wounds healed.
    pub wounds_healed: u32,
    /// Number of spells gained.
    pub spells_gained: u32,
    /// Number of advanced actions gained.
    pub aas_gained: u32,
    /// Number of artifacts gained.
    pub artifacts_gained: u32,
    /// Number of units recruited.
    pub units_recruited: u32,
    /// Total influence generated during interaction.
    pub influence_generated: u32,
    /// Optimal action sequence from the search.
    pub actions: Vec<LegalAction>,
    /// Number of nodes visited during the search.
    pub nodes_visited: u64,
    /// Number of transposition hits.
    pub transpositions: u64,
    /// Whether the search exhausted the full tree.
    pub complete: bool,
}

/// Search for the optimal commerce interaction from the current state.
///
/// The state must have IS_INTERACTING set on the current player.
/// Returns the best action sequence found within the node budget.
pub fn search_commerce(state: &GameState, config: &CommerceSearchConfig) -> CommerceSearchResult {
    let pre = PreCommerceSnapshot::from_state(state);
    let action_set = enumerate_legal_actions(state, 0);
    let weights = &config.eval_weights;

    let mut stats = DfsStats::new();

    // Seed with greedy rollouts.
    if config.seed_rollouts > 0 {
        if let Some((seed_score, seed_path)) =
            greedy_seed(state, &action_set, &pre, config.seed_rollouts, weights)
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
        weights,
    );

    let complete = stats.nodes_visited < config.node_limit;

    match stats.best_score {
        Some(score) => CommerceSearchResult {
            score: score.total,
            wounds_healed: score.wounds_healed,
            spells_gained: score.spells_gained,
            aas_gained: score.aas_gained,
            artifacts_gained: score.artifacts_gained,
            units_recruited: score.units_recruited,
            influence_generated: score.influence_generated,
            actions: stats.best_path,
            nodes_visited: stats.nodes_visited,
            transpositions: stats.transpositions,
            complete,
        },
        None => {
            // No valid interaction found — return empty (EndTurn immediately)
            CommerceSearchResult {
                score: 0.0,
                wounds_healed: 0,
                spells_gained: 0,
                aas_gained: 0,
                artifacts_gained: 0,
                units_recruited: 0,
                influence_generated: 0,
                actions: Vec::new(),
                nodes_visited: stats.nodes_visited,
                transpositions: stats.transpositions,
                complete: true,
            }
        }
    }
}

// =============================================================================
// Evaluation
// =============================================================================

#[derive(Clone)]
struct PreCommerceSnapshot {
    wound_count: u32,
    spell_count: u32,
    aa_count: u32,
    artifact_count: u32,
    unit_count: usize,
    unit_level_sum: u32,
    wounded_unit_count: usize,
    crystals_total: u8,
    influence_points: u32,
    hand_size: usize,
    play_area_size: usize,
}

impl PreCommerceSnapshot {
    fn from_state(state: &GameState) -> Self {
        let player = &state.players[0];

        let all_cards: Vec<&str> = player
            .hand
            .iter()
            .chain(player.deck.iter())
            .chain(player.discard.iter())
            .chain(player.play_area.iter())
            .map(|c| c.as_str())
            .collect();

        let wound_count = all_cards.iter().filter(|&&c| c == "wound").count() as u32;

        let mut spell_count = 0u32;
        let mut aa_count = 0u32;
        let mut artifact_count = 0u32;
        for &card_id in &all_cards {
            if let Some(card_def) = mk_data::cards::get_card(card_id) {
                match card_def.card_type {
                    DeedCardType::Spell => spell_count += 1,
                    DeedCardType::AdvancedAction => aa_count += 1,
                    DeedCardType::Artifact => artifact_count += 1,
                    _ => {}
                }
            }
        }

        let unit_level_sum: u32 = player.units.iter().map(|u| u.level as u32).sum();
        let wounded_unit_count = player.units.iter().filter(|u| u.wounded).count();

        Self {
            wound_count,
            spell_count,
            aa_count,
            artifact_count,
            unit_count: player.units.len(),
            unit_level_sum,
            wounded_unit_count,
            crystals_total: player.crystals.red
                + player.crystals.blue
                + player.crystals.green
                + player.crystals.white,
            influence_points: player.influence_points,
            hand_size: player.hand.len(),
            play_area_size: player.play_area.len(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct CommerceScore {
    wounds_healed: u32,
    spells_gained: u32,
    aas_gained: u32,
    artifacts_gained: u32,
    units_recruited: u32,
    influence_generated: u32,
    total: f64,
}

impl CommerceScore {
    fn evaluate(pre: &PreCommerceSnapshot, state: &GameState, w: &CommerceEvalWeights) -> Self {
        let player = &state.players[0];

        // Count current cards across all zones
        let all_cards: Vec<&str> = player
            .hand
            .iter()
            .chain(player.deck.iter())
            .chain(player.discard.iter())
            .chain(player.play_area.iter())
            .map(|c| c.as_str())
            .collect();

        let wound_count_now = all_cards.iter().filter(|&&c| c == "wound").count() as u32;
        let wounds_healed = pre.wound_count.saturating_sub(wound_count_now);

        let mut spell_count_now = 0u32;
        let mut aa_count_now = 0u32;
        let mut artifact_count_now = 0u32;
        for &card_id in &all_cards {
            if let Some(card_def) = mk_data::cards::get_card(card_id) {
                match card_def.card_type {
                    DeedCardType::Spell => spell_count_now += 1,
                    DeedCardType::AdvancedAction => aa_count_now += 1,
                    DeedCardType::Artifact => artifact_count_now += 1,
                    _ => {}
                }
            }
        }

        let spells_gained = spell_count_now.saturating_sub(pre.spell_count);
        let aas_gained = aa_count_now.saturating_sub(pre.aa_count);
        let artifacts_gained = artifact_count_now.saturating_sub(pre.artifact_count);

        // Unit changes
        let unit_level_sum_now: u32 = player.units.iter().map(|u| u.level as u32).sum();
        let unit_levels_gained = unit_level_sum_now.saturating_sub(pre.unit_level_sum);
        let units_recruited = player.units.len().saturating_sub(pre.unit_count) as u32;
        // Detect dismissed wounded units (unit count stayed same or decreased but new units appeared)
        let wounded_now = player.units.iter().filter(|u| u.wounded).count();
        let wounded_dismissed = pre.wounded_unit_count.saturating_sub(wounded_now) as u32;

        // Crystal cost
        let crystals_now =
            player.crystals.red + player.crystals.blue + player.crystals.green + player.crystals.white;
        let crystals_spent = pre.crystals_total.saturating_sub(crystals_now) as i32;

        // Influence tracking
        let influence_generated = player
            .influence_points
            .saturating_sub(pre.influence_points)
            // Also count influence already spent (it was generated then consumed)
            + wounds_healed * 3 // approximate: healing costs vary by site
            + spells_gained * 7
            + aas_gained * 6;
        // Note: this is approximate — actual costs depend on site type and reputation.
        // For the score, what matters is the purchases, not the exact influence generated.

        // Cards spent = cards moved from hand to play area during commerce
        let cards_spent = player.play_area.len().saturating_sub(pre.play_area_size) as u32;

        // Wasted influence = influence remaining that wasn't spent on anything
        let made_purchases =
            wounds_healed > 0 || spells_gained > 0 || aas_gained > 0 || artifacts_gained > 0 || units_recruited > 0;
        let influence_remaining = player.influence_points;
        let wasted = if made_purchases {
            influence_remaining
        } else {
            0 // Don't penalize wasted influence if nothing was bought
        };

        // Always penalize cards spent (prefer fewer cards for same purchases)
        let card_efficiency_penalty = cards_spent as f64 * w.card_spent;
        // If no purchases at all, add heavy extra penalty (don't play cards for nothing)
        let cards_wasted_penalty = if made_purchases {
            0.0
        } else {
            cards_spent as f64 * 80.0
        };

        let total = wounds_healed as f64 * w.wound_healed
            + spells_gained as f64 * w.spell_gained
            + aas_gained as f64 * w.aa_gained
            + artifacts_gained as f64 * w.artifact_gained
            + unit_levels_gained as f64 * w.unit_recruited_per_level
            + wounded_dismissed as f64 * w.unit_dismissed_wounded
            - wasted as f64 * w.influence_wasted
            - crystals_spent.max(0) as f64 * w.crystal_spent
            - card_efficiency_penalty
            - cards_wasted_penalty;

        Self {
            wounds_healed,
            spells_gained,
            aas_gained,
            artifacts_gained,
            units_recruited,
            influence_generated,
            total,
        }
    }
}

// =============================================================================
// State helpers
// =============================================================================

/// Commerce interaction is terminal when:
/// - IS_INTERACTING is no longer set (EndTurn clears it)
/// - No legal actions remain
/// - Game has ended
/// - Combat has started (e.g., BurnMonastery)
fn is_commerce_terminal(state: &GameState, num_actions: usize) -> bool {
    if num_actions == 0 || state.game_ended {
        return true;
    }
    // If IS_INTERACTING is cleared, the interaction has ended
    if !state.players[0]
        .flags
        .contains(PlayerFlags::IS_INTERACTING)
    {
        return true;
    }
    // If combat started (e.g., BurnMonastery), stop commerce search
    if state.combat.is_some() {
        return true;
    }
    false
}

/// Filter out actions that would start combat (BurnMonastery).
/// The combat oracle should handle those, not the commerce oracle.
fn filter_combat_actions(actions: &LegalActionSet) -> LegalActionSet {
    let filtered: Vec<LegalAction> = actions
        .actions
        .iter()
        .filter(|a| !matches!(a, LegalAction::BurnMonastery))
        .cloned()
        .collect();
    LegalActionSet {
        epoch: actions.epoch,
        player_idx: actions.player_idx,
        actions: filtered,
    }
}

fn step(state: &GameState, action: &LegalAction) -> Option<(GameState, LegalActionSet)> {
    let mut child = state.clone();
    let mut undo = UndoStack::new();
    let epoch = child.action_epoch;
    match apply_legal_action(&mut child, &mut undo, 0, action, epoch) {
        Ok(ApplyResult { .. }) => {
            let actions = enumerate_legal_actions(&child, 0);
            Some((child, filter_combat_actions(&actions)))
        }
        Err(_) => None,
    }
}

// =============================================================================
// Transposition table
// =============================================================================

fn commerce_state_hash(state: &GameState) -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    let p = &state.players[0];

    // Hand (sorted — card play order doesn't matter for outcome)
    let mut hand: Vec<&str> = p.hand.iter().map(|c| c.as_str()).collect();
    hand.sort_unstable();
    for card in &hand {
        card.hash(&mut h);
    }

    // Influence accumulated
    p.influence_points.hash(&mut h);
    p.healing_points.hash(&mut h);

    // Wounds in hand (relevant for healing)
    let wounds_in_hand = p.hand.iter().filter(|c| c.as_str() == "wound").count();
    wounds_in_hand.hash(&mut h);

    // Crystals (may be spent for powered plays)
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

    // Source dice state (relevant for powered card plays)
    for die in &state.source.dice {
        die.is_depleted.hash(&mut h);
        die.taken_by_player_id.is_some().hash(&mut h);
    }

    // Units (relevant for recruitment decisions)
    p.units.len().hash(&mut h);
    for unit in &p.units {
        unit.wounded.hash(&mut h);
        unit.unit_id.as_str().hash(&mut h);
    }

    // Unit offer (what's available to recruit)
    for unit_id in &state.offers.units {
        unit_id.as_str().hash(&mut h);
    }

    // Flags relevant to commerce
    p.flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        .hash(&mut h);
    p.flags
        .contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN)
        .hash(&mut h);

    // Pending choice
    p.pending.has_active().hash(&mut h);

    // Active modifiers
    state.active_modifiers.len().hash(&mut h);

    h.finish()
}

// =============================================================================
// Action ordering (influence-generating actions first, EndTurn last)
// =============================================================================

fn action_priority(action: &LegalAction) -> u32 {
    match action {
        // Influence-generating card plays first
        LegalAction::PlayCardPowered { .. } => 0,
        LegalAction::PlayCardBasic { .. } => 1,
        LegalAction::PlayCardSideways { .. } => 2,
        // Unit abilities (may generate influence)
        LegalAction::ActivateUnit { .. } => 3,
        // Commerce purchases
        LegalAction::InteractSite { .. } => 4,
        LegalAction::BuySpell { .. } => 5,
        LegalAction::LearnAdvancedAction { .. } => 5,
        LegalAction::RecruitUnit { .. } => 5,
        LegalAction::BuyCityAdvancedAction { .. } => 5,
        LegalAction::BuyCityAdvancedActionFromDeck => 5,
        LegalAction::BuyArtifact => 5,
        LegalAction::AddEliteToOffer => 6,
        // Choices/selections
        LegalAction::ResolveChoice { .. } => 7,
        LegalAction::SubsetSelect { .. } => 7,
        LegalAction::SubsetConfirm => 7,
        // Use skill (might generate influence)
        LegalAction::UseSkill { .. } => 8,
        // EndTurn last
        LegalAction::EndTurn => 30,
        _ => 15,
    }
}

// =============================================================================
// Greedy seeding
// =============================================================================

fn action_weight(action: &LegalAction) -> u32 {
    match action {
        // Heavily favor commerce purchases
        LegalAction::InteractSite { .. } => 20,
        LegalAction::BuySpell { .. } => 15,
        LegalAction::LearnAdvancedAction { .. } => 15,
        LegalAction::RecruitUnit { .. } => 15,
        LegalAction::BuyCityAdvancedAction { .. } => 15,
        LegalAction::BuyCityAdvancedActionFromDeck => 15,
        LegalAction::BuyArtifact => 15,
        LegalAction::AddEliteToOffer => 10,
        // Card plays for influence
        LegalAction::PlayCardPowered { .. } => 12,
        LegalAction::PlayCardBasic { .. } => 10,
        LegalAction::PlayCardSideways { .. } => 8,
        LegalAction::ActivateUnit { .. } => 8,
        LegalAction::UseSkill { .. } => 8,
        // Choices
        LegalAction::ResolveChoice { .. } => 10,
        LegalAction::SubsetSelect { .. } => 10,
        LegalAction::SubsetConfirm => 10,
        // EndTurn (low weight — try to buy things first)
        LegalAction::EndTurn => 2,
        _ => 5,
    }
}

fn heuristic_pick<'a>(actions: &'a LegalActionSet, rng: &mut u32) -> &'a LegalAction {
    let weights: Vec<u32> = actions.actions.iter().map(action_weight).collect();
    let total: u32 = weights.iter().sum();
    if total == 0 {
        return &actions.actions[0];
    }

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
    pre: &PreCommerceSnapshot,
    rng: &mut u32,
    weights: &CommerceEvalWeights,
) -> (CommerceScore, Vec<LegalAction>) {
    let mut current_state = state.clone();
    let mut current_actions = actions.clone();
    let mut path = Vec::new();

    loop {
        if is_commerce_terminal(&current_state, current_actions.actions.len()) {
            break;
        }
        let action = heuristic_pick(&current_actions, rng);
        // Evaluate BEFORE EndTurn so play_area/influence state is intact
        if matches!(action, LegalAction::EndTurn) {
            path.push(action.clone());
            break;
        }
        path.push(action.clone());
        if let Some((next_state, next_actions)) = step(&current_state, action) {
            current_state = next_state;
            current_actions = next_actions;
        } else {
            break;
        }
    }

    (
        CommerceScore::evaluate(pre, &current_state, weights),
        path,
    )
}

fn greedy_seed(
    state: &GameState,
    actions: &LegalActionSet,
    pre: &PreCommerceSnapshot,
    num_rollouts: u32,
    weights: &CommerceEvalWeights,
) -> Option<(CommerceScore, Vec<LegalAction>)> {
    let mut best: Option<(CommerceScore, Vec<LegalAction>)> = None;
    let mut rng = 12345u32;

    for _ in 0..num_rollouts {
        let (score, path) = rollout(state, actions, pre, &mut rng, weights);
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
    transpositions: u64,
    best_score: Option<CommerceScore>,
    best_path: Vec<LegalAction>,
    seen: HashSet<u64>,
}

impl DfsStats {
    fn new() -> Self {
        Self {
            nodes_visited: 0,
            transpositions: 0,
            best_score: None,
            best_path: Vec::new(),
            seen: HashSet::new(),
        }
    }
}

fn dfs(
    state: &GameState,
    action_set: &LegalActionSet,
    stats: &mut DfsStats,
    node_limit: u64,
    pre: &PreCommerceSnapshot,
    path: &mut Vec<LegalAction>,
    weights: &CommerceEvalWeights,
) {
    if stats.nodes_visited >= node_limit {
        return;
    }
    stats.nodes_visited += 1;

    let num_actions = action_set.actions.len();

    if is_commerce_terminal(state, num_actions) {
        let score = CommerceScore::evaluate(pre, state, weights);
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

    // Transposition check.
    let state_hash = commerce_state_hash(state);
    if !stats.seen.insert(state_hash) {
        stats.transpositions += 1;
        return;
    }

    // Sort actions: influence-generating first, EndTurn last.
    let mut sorted_actions: Vec<&LegalAction> = action_set.actions.iter().collect();
    sorted_actions.sort_by_key(|a| action_priority(a));

    for action in sorted_actions {
        if stats.nodes_visited >= node_limit {
            return;
        }
        // Evaluate BEFORE EndTurn so play_area and influence are still intact.
        // EndTurn clears play_area and resets influence, which breaks cards_spent
        // detection in the evaluation function.
        if matches!(action, LegalAction::EndTurn) {
            let score = CommerceScore::evaluate(pre, state, weights);
            path.push(action.clone());
            let is_best = stats
                .best_score
                .map(|b| score.total > b.total)
                .unwrap_or(true);
            if is_best {
                stats.best_score = Some(score);
                stats.best_path = path.clone();
            }
            path.pop();
            continue;
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
                weights,
            );
            path.pop();
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::{create_solo_game, place_initial_tiles};
    use mk_types::enums::Hero;
    use mk_types::hex::HexCoord;
    use mk_types::ids::CardId;

    #[test]
    fn commerce_search_at_village_with_wounds() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);

        // Find a village hex
        let village_hex = state
            .map
            .hexes
            .iter()
            .find(|(_, hex)| {
                hex.site
                    .as_ref()
                    .map(|s| {
                        s.site_type == mk_types::enums::SiteType::Village && !s.is_conquered
                    })
                    .unwrap_or(false)
            })
            .map(|(key, _)| key.clone());

        if let Some(hex_key) = village_hex {
            let parts: Vec<i32> = hex_key.split(',').map(|s| s.parse().unwrap()).collect();
            state.players[0].position = Some(HexCoord::new(parts[0], parts[1]));

            // Add wounds to hand
            state.players[0].hand.push(CardId::from("wound"));
            state.players[0].hand.push(CardId::from("wound"));

            // Set interacting flag
            state.players[0]
                .flags
                .insert(PlayerFlags::IS_INTERACTING);

            let config = CommerceSearchConfig {
                node_limit: 100_000,
                ..CommerceSearchConfig::default()
            };
            let result = search_commerce(&state, &config);

            assert!(
                result.nodes_visited > 0,
                "Search should visit at least one node"
            );
            // With wounds in hand and influence from sideways plays,
            // the oracle should find a healing sequence
            if result.score > 0.0 {
                assert!(result.wounds_healed > 0, "Should heal at least one wound");
            }
        }
    }

    #[test]
    fn commerce_search_no_interaction_returns_empty() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);

        // NOT interacting — search should return immediately
        let config = CommerceSearchConfig::default();
        let result = search_commerce(&state, &config);

        assert_eq!(result.score, 0.0);
        assert!(result.actions.is_empty());
    }

    #[test]
    fn commerce_search_default_config() {
        let config = CommerceSearchConfig::default();
        assert_eq!(config.node_limit, 1_000_000);
        assert_eq!(config.seed_rollouts, 200);
        assert!(config.eval_weights.wound_healed > 0.0);
    }

    /// Reproduce the replay scenario: Norowas at a village with no wounds in hand,
    /// units in offer cost 6 each, and player can only generate ~4 influence.
    /// Oracle should NOT play cards since nothing can be purchased.
    #[test]
    fn commerce_search_village_no_affordable_purchases() {
        use mk_types::enums::SiteType;
        use mk_types::ids::{TacticId, UnitId};

        let mut state = create_solo_game(4, Hero::Norowas);
        place_initial_tiles(&mut state);

        // Find a village hex
        let village_hex = state
            .map
            .hexes
            .iter()
            .find(|(_, hex)| {
                hex.site
                    .as_ref()
                    .map(|s| s.site_type == SiteType::Village && !s.is_conquered)
                    .unwrap_or(false)
            })
            .map(|(key, _)| key.clone());

        let hex_key = village_hex.expect("Should have a village");
        let parts: Vec<i32> = hex_key.split(',').map(|s| s.parse().unwrap()).collect();
        state.players[0].position = Some(HexCoord::new(parts[0], parts[1]));

        // Set up hand: only non-wound cards (rage, determination)
        state.players[0].hand.clear();
        state.players[0].hand.push(CardId::from("rage"));
        state.players[0].hand.push(CardId::from("determination"));

        // Set reputation to 3 (+1 influence bonus)
        state.players[0].reputation = 3;

        // Set unit offer to expensive units (cost 6 each)
        state.offers.units.clear();
        state.offers.units.push(UnitId::from("utem_swordsmen"));
        state.offers.units.push(UnitId::from("shocktroops"));

        // Player already has 2 units and 2 command tokens — no room for more
        state.players[0].command_tokens = 2;

        // Simulate mid-turn: tactic already selected, action already taken
        state.players[0].selected_tactic = Some(TacticId::from("early_bird"));
        state.players[0]
            .flags
            .insert(PlayerFlags::IS_INTERACTING);
        state.players[0]
            .flags
            .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
        state.players[0]
            .flags
            .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

        let config = CommerceSearchConfig {
            node_limit: 100_000,
            ..CommerceSearchConfig::default()
        };
        let result = search_commerce(&state, &config);

        eprintln!("Score: {}", result.score);
        eprintln!("Actions: {:?}", result.actions);
        eprintln!("Wounds healed: {}", result.wounds_healed);
        eprintln!("Spells gained: {}", result.spells_gained);
        eprintln!("AAs gained: {}", result.aas_gained);
        eprintln!("Units recruited: {}", result.units_recruited);
        eprintln!("Nodes visited: {}", result.nodes_visited);

        // Oracle should find that nothing useful can be purchased
        // and should NOT play any cards (score should be 0 or the actions
        // should be just EndTurn)
        assert!(
            result.score <= 0.0,
            "Score should be <= 0 when nothing can be purchased, got {}",
            result.score
        );
        // No card plays should appear in the optimal sequence
        let card_plays = result.actions.iter().filter(|a| {
            matches!(
                a,
                LegalAction::PlayCardBasic { .. }
                    | LegalAction::PlayCardPowered { .. }
                    | LegalAction::PlayCardSideways { .. }
            )
        }).count();
        assert_eq!(
            card_plays, 0,
            "Should not play cards when nothing can be purchased"
        );
    }

    /// The oracle should prefer playing Threaten basic (2 influence) over
    /// Threaten sideways (1 influence) + another card sideways (1 influence)
    /// when both paths achieve the same purchase.
    #[test]
    fn commerce_search_prefers_fewer_cards() {
        use mk_types::enums::SiteType;
        use mk_types::ids::{TacticId, UnitId};

        let mut state = create_solo_game(42, Hero::Norowas);
        place_initial_tiles(&mut state);

        // Find a village hex
        let village_hex = state
            .map
            .hexes
            .iter()
            .find(|(_, hex)| {
                hex.site
                    .as_ref()
                    .map(|s| s.site_type == SiteType::Village && !s.is_conquered)
                    .unwrap_or(false)
            })
            .map(|(key, _)| key.clone());

        let hex_key = village_hex.expect("Should have a village");
        let parts: Vec<i32> = hex_key.split(',').map(|s| s.parse().unwrap()).collect();
        state.players[0].position = Some(HexCoord::new(parts[0], parts[1]));

        // Hand: threaten + rage (both can be played sideways for 1 influence each,
        // but threaten basic gives 2 influence)
        state.players[0].hand.clear();
        state.players[0].hand.push(CardId::from("threaten"));
        state.players[0].hand.push(CardId::from("rage"));

        // Rep 1 gives +0 bonus, so we need exactly the card influence
        // Herbalist costs 3 influence
        // Path A: threaten basic (2) + rage sideways (1) = 3 influence, 2 cards
        // Path B: threaten sideways (1) + rage sideways (1) = 2 influence, not enough
        // So both paths need 2 cards, but let's adjust:
        // Rep 2 gives +1 bonus
        // Path A: threaten basic (2) + rep (1) = 3, only 1 card played
        // Path B: threaten sideways (1) + rage sideways (1) + rep (1) = 3, 2 cards played
        state.players[0].reputation = 2;

        // Offer a cheap unit
        state.offers.units.clear();
        state.offers.units.push(UnitId::from("herbalist"));

        // Give enough command tokens to recruit
        state.players[0].command_tokens = 3;

        // Mid-turn state
        state.players[0].selected_tactic = Some(TacticId::from("early_bird"));
        state.players[0]
            .flags
            .insert(PlayerFlags::IS_INTERACTING);
        state.players[0]
            .flags
            .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
        state.players[0]
            .flags
            .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

        let config = CommerceSearchConfig {
            node_limit: 100_000,
            ..CommerceSearchConfig::default()
        };
        let result = search_commerce(&state, &config);

        eprintln!("Score: {}", result.score);
        eprintln!("Actions: {:?}", result.actions);
        eprintln!("Units recruited: {}", result.units_recruited);

        // Should recruit the herbalist
        assert!(
            result.units_recruited > 0,
            "Should recruit the herbalist"
        );

        // Should use threaten basic (2 influence) not sideways (1 influence)
        // to minimize cards played
        let sideways_plays = result.actions.iter().filter(|a| {
            matches!(a, LegalAction::PlayCardSideways { card_id, .. } if card_id.as_str() == "threaten")
        }).count();
        assert_eq!(
            sideways_plays, 0,
            "Should play threaten basic (2 influence), not sideways (1 influence)"
        );

        let card_plays = result.actions.iter().filter(|a| {
            matches!(
                a,
                LegalAction::PlayCardBasic { .. }
                    | LegalAction::PlayCardPowered { .. }
                    | LegalAction::PlayCardSideways { .. }
            )
        }).count();
        assert!(
            card_plays <= 1,
            "Should use at most 1 card to recruit herbalist (threaten basic + rep bonus), got {}",
            card_plays
        );
    }
}
