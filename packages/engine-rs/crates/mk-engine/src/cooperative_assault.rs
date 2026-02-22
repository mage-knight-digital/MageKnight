//! Cooperative assault — proposal, response, cancel, and execution.
//!
//! In multiplayer, players adjacent to a city can jointly assault it. The initiator
//! proposes a distribution of garrison enemies among participants. Invitees accept
//! or decline. On full agreement, all participants' Round Order tokens are flipped,
//! garrison enemies are shuffled and distributed, and each participant enters combat
//! with their assigned enemy subset.

use std::collections::BTreeMap;

use mk_types::enums::*;
use mk_types::hex::HexCoord;
use mk_types::ids::*;
use mk_types::state::*;

use crate::action_pipeline::ApplyError;
use crate::combat;

// =============================================================================
// Proposal
// =============================================================================

/// Apply a cooperative assault proposal.
///
/// Validates that:
/// - The city hex exists and has an unconquered city with garrison enemies
/// - The proposer is adjacent to the city
/// - The proposer hasn't taken an action this turn
/// - The proposer's Round Order token is not flipped
/// - All invitees are valid (adjacent, token not flipped, have non-wound cards)
/// - The distribution is valid (each participant ≥1 enemy, sum = garrison size)
pub fn apply_propose(
    state: &mut GameState,
    player_idx: usize,
    hex_coord: HexCoord,
    invited_player_idxs: &[usize],
    distribution: &[(usize, u32)],
) -> Result<(), ApplyError> {
    // Validate no existing proposal
    if state.pending_cooperative_assault.is_some() {
        return Err(ApplyError::InternalError(
            "CoopAssault: proposal already pending".into(),
        ));
    }

    // Validate city hex exists and has garrison
    let garrison_size = get_garrison_size(state, hex_coord)?;

    // Validate proposer is adjacent
    let proposer_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: proposer has no position".into()))?;
    if !is_adjacent(proposer_pos, hex_coord) {
        return Err(ApplyError::InternalError(
            "CoopAssault: proposer not adjacent to city".into(),
        ));
    }

    // Validate proposer hasn't taken action
    if state.players[player_idx]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        return Err(ApplyError::InternalError(
            "CoopAssault: proposer has already taken action".into(),
        ));
    }

    // Validate proposer's token not flipped
    if state.players[player_idx]
        .flags
        .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED)
    {
        return Err(ApplyError::InternalError(
            "CoopAssault: proposer token is flipped".into(),
        ));
    }

    // Validate end of round not announced
    if state.end_of_round_announced_by.is_some() {
        return Err(ApplyError::InternalError(
            "CoopAssault: end of round announced".into(),
        ));
    }

    // Validate invitees
    for &inv_idx in invited_player_idxs {
        validate_invitee(state, inv_idx, hex_coord)?;
    }

    // Validate distribution
    validate_distribution(player_idx, invited_player_idxs, distribution, garrison_size)?;

    state.pending_cooperative_assault = Some(CooperativeAssaultProposal {
        proposer_idx: player_idx,
        hex_coord,
        invited_player_idxs: invited_player_idxs.to_vec(),
        distribution: distribution.to_vec(),
        accepted_player_idxs: Vec::new(),
    });

    Ok(())
}

// =============================================================================
// Response
// =============================================================================

/// Apply a response to a cooperative assault proposal.
///
/// If declining: clears the proposal.
/// If accepting: adds to accepted list. If all invitees have accepted,
/// executes the agreement (shuffle, distribute, enter combat).
pub fn apply_respond(
    state: &mut GameState,
    player_idx: usize,
    accept: bool,
) -> Result<bool, ApplyError> {
    let proposal = state
        .pending_cooperative_assault
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: no pending proposal".into()))?;

    // Validate player is an invited non-respondent
    if !proposal.invited_player_idxs.contains(&player_idx) {
        return Err(ApplyError::InternalError(
            "CoopAssault: player not invited".into(),
        ));
    }
    if proposal.accepted_player_idxs.contains(&player_idx) {
        return Err(ApplyError::InternalError(
            "CoopAssault: player already responded".into(),
        ));
    }

    if !accept {
        // Decline → clear proposal
        state.pending_cooperative_assault = None;
        return Ok(false);
    }

    // Accept
    let proposal = state.pending_cooperative_assault.as_mut().unwrap();
    proposal.accepted_player_idxs.push(player_idx);

    // Check if all invitees have accepted
    let all_accepted = proposal
        .invited_player_idxs
        .iter()
        .all(|idx| proposal.accepted_player_idxs.contains(idx));

    if all_accepted {
        // Extract proposal data before consuming it
        let proposal = state.pending_cooperative_assault.take().unwrap();
        execute_agreement(state, &proposal)?;
        return Ok(true);
    }

    Ok(false)
}

// =============================================================================
// Agreement execution
// =============================================================================

/// Execute the cooperative assault agreement.
///
/// 1. Flip Round Order tokens for all participants
/// 2. Shuffle garrison enemy tokens via RNG
/// 3. Distribute shuffled enemies by counts
/// 4. Enter fortified combat with enemy_assignments on CombatState
fn execute_agreement(
    state: &mut GameState,
    proposal: &CooperativeAssaultProposal,
) -> Result<(), ApplyError> {
    let hex_key = proposal.hex_coord.key();

    // 1. Flip Round Order tokens for all participants
    let mut all_participant_idxs = vec![proposal.proposer_idx];
    all_participant_idxs.extend_from_slice(&proposal.invited_player_idxs);

    for &p_idx in &all_participant_idxs {
        state.players[p_idx]
            .flags
            .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);
    }

    // 2. Get garrison enemy tokens and shuffle
    let hex_state = state
        .map
        .hexes
        .get(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: city hex not found".into()))?;

    let mut enemy_tokens: Vec<EnemyTokenId> =
        hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();

    state.rng.shuffle(&mut enemy_tokens);

    // 3. Distribute shuffled enemies by counts
    // Sort distribution by player index for deterministic assignment
    let mut sorted_dist = proposal.distribution.clone();
    sorted_dist.sort_by_key(|&(idx, _)| idx);

    let mut assignments: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut token_cursor = 0usize;

    for &(p_idx, count) in &sorted_dist {
        let player_id = state.players[p_idx].id.as_str().to_string();
        let mut player_enemies = Vec::new();
        for _ in 0..count {
            if token_cursor < enemy_tokens.len() {
                // Map to instance_id format "enemy_N"
                let instance_id = format!("enemy_{}", token_cursor);
                player_enemies.push(instance_id);
                token_cursor += 1;
            }
        }
        assignments.insert(player_id, player_enemies);
    }

    // 4. Enter fortified combat for the proposer (initiator)
    let all_tokens: Vec<EnemyTokenId> = enemy_tokens;

    combat::execute_enter_combat(
        state,
        proposal.proposer_idx,
        &all_tokens,
        true, // fortified
        Some(proposal.hex_coord),
        Default::default(),
    )
    .map_err(|e| {
        ApplyError::InternalError(format!("CoopAssault: enter_combat failed: {:?}", e))
    })?;

    // Set enemy assignments on combat state
    if let Some(ref mut combat) = state.combat {
        combat.enemy_assignments = Some(assignments);
    }

    // Mark proposer as having taken action
    state.players[proposal.proposer_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(())
}

// =============================================================================
// Cancel
// =============================================================================

/// Cancel a cooperative assault proposal (initiator only).
pub fn apply_cancel(
    state: &mut GameState,
    player_idx: usize,
) -> Result<(), ApplyError> {
    let proposal = state
        .pending_cooperative_assault
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: no pending proposal".into()))?;

    if proposal.proposer_idx != player_idx {
        return Err(ApplyError::InternalError(
            "CoopAssault: only initiator can cancel".into(),
        ));
    }

    state.pending_cooperative_assault = None;
    Ok(())
}

// =============================================================================
// Helpers
// =============================================================================

/// Check if a player is adjacent to a hex.
pub(crate) fn is_adjacent(player_pos: HexCoord, target: HexCoord) -> bool {
    player_pos.neighbors().contains(&target)
}

/// Get the garrison size (number of enemies) for a city hex.
fn get_garrison_size(state: &GameState, hex_coord: HexCoord) -> Result<u32, ApplyError> {
    let hex_key = hex_coord.key();
    let hex_state = state
        .map
        .hexes
        .get(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: hex not found".into()))?;

    let site = hex_state
        .site
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: no site on hex".into()))?;

    if site.site_type != SiteType::City {
        return Err(ApplyError::InternalError(
            "CoopAssault: not a city hex".into(),
        ));
    }

    if site.is_conquered {
        return Err(ApplyError::InternalError(
            "CoopAssault: city already conquered".into(),
        ));
    }

    let enemy_count = hex_state.enemies.len() as u32;
    if enemy_count == 0 {
        return Err(ApplyError::InternalError(
            "CoopAssault: city has no garrison enemies".into(),
        ));
    }

    Ok(enemy_count)
}

/// Validate an invitee for a cooperative assault.
fn validate_invitee(
    state: &GameState,
    inv_idx: usize,
    city_hex: HexCoord,
) -> Result<(), ApplyError> {
    if inv_idx >= state.players.len() {
        return Err(ApplyError::InternalError(
            "CoopAssault: invitee index out of range".into(),
        ));
    }

    let invitee = &state.players[inv_idx];

    // Adjacent to city
    let inv_pos = invitee
        .position
        .ok_or_else(|| ApplyError::InternalError("CoopAssault: invitee has no position".into()))?;
    if !is_adjacent(inv_pos, city_hex) {
        return Err(ApplyError::InternalError(
            "CoopAssault: invitee not adjacent to city".into(),
        ));
    }

    // Token not flipped
    if invitee
        .flags
        .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED)
    {
        return Err(ApplyError::InternalError(
            "CoopAssault: invitee token is flipped".into(),
        ));
    }

    // Has non-wound cards in hand
    let has_non_wound = invitee.hand.iter().any(|c| c.as_str() != "wound");
    if !has_non_wound {
        return Err(ApplyError::InternalError(
            "CoopAssault: invitee has no non-wound cards".into(),
        ));
    }

    Ok(())
}

/// Validate the enemy distribution.
fn validate_distribution(
    proposer_idx: usize,
    invited_player_idxs: &[usize],
    distribution: &[(usize, u32)],
    garrison_size: u32,
) -> Result<(), ApplyError> {
    // All participants must appear exactly once
    let mut all_participants = vec![proposer_idx];
    all_participants.extend_from_slice(invited_player_idxs);

    if distribution.len() != all_participants.len() {
        return Err(ApplyError::InternalError(
            "CoopAssault: distribution size mismatch".into(),
        ));
    }

    let mut total_count = 0u32;
    for &(p_idx, count) in distribution {
        if !all_participants.contains(&p_idx) {
            return Err(ApplyError::InternalError(
                "CoopAssault: distribution contains unknown participant".into(),
            ));
        }
        if count == 0 {
            return Err(ApplyError::InternalError(
                "CoopAssault: each participant must get ≥1 enemy".into(),
            ));
        }
        total_count += count;
    }

    if total_count != garrison_size {
        return Err(ApplyError::InternalError(format!(
            "CoopAssault: distribution sum {} != garrison size {}",
            total_count, garrison_size
        )));
    }

    Ok(())
}

/// Find eligible invitees for a cooperative assault on a city.
///
/// Returns player indices of other players who are adjacent to the city hex,
/// have their Round Order token unflipped, and have non-wound cards in hand.
pub fn find_eligible_invitees(
    state: &GameState,
    initiator_idx: usize,
    city_hex: HexCoord,
) -> Vec<usize> {
    let mut eligible = Vec::new();
    for (idx, player) in state.players.iter().enumerate() {
        if idx == initiator_idx {
            continue;
        }

        let pos = match player.position {
            Some(p) => p,
            None => continue,
        };

        if !is_adjacent(pos, city_hex) {
            continue;
        }

        if player
            .flags
            .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED)
        {
            continue;
        }

        let has_non_wound = player.hand.iter().any(|c| c.as_str() != "wound");
        if !has_non_wound {
            continue;
        }

        eligible.push(idx);
    }
    eligible
}

/// Generate all valid distributions of `garrison_size` enemies among participants.
///
/// Each participant must get at least 1 enemy. Returns (invited_player_idxs, distribution) pairs.
pub fn generate_distributions(
    initiator_idx: usize,
    invitees: &[usize],
    garrison_size: u32,
) -> Vec<Vec<(usize, u32)>> {
    let mut all_participants = vec![initiator_idx];
    all_participants.extend_from_slice(invitees);
    let n = all_participants.len();

    if garrison_size < n as u32 {
        return Vec::new(); // Can't give each participant at least 1
    }

    let remaining = garrison_size - n as u32; // After giving 1 each
    let mut results = Vec::new();
    let mut counts = vec![1u32; n]; // Start with 1 each

    // Generate all ways to distribute `remaining` among `n` participants
    distribute_remaining(&all_participants, &mut counts, remaining, 0, &mut results);

    results
}

/// Recursive helper to distribute remaining enemies among participants.
fn distribute_remaining(
    participants: &[usize],
    counts: &mut Vec<u32>,
    remaining: u32,
    start_idx: usize,
    results: &mut Vec<Vec<(usize, u32)>>,
) {
    if remaining == 0 {
        let dist: Vec<(usize, u32)> = participants
            .iter()
            .zip(counts.iter())
            .map(|(&idx, &count)| (idx, count))
            .collect();
        results.push(dist);
        return;
    }

    for i in start_idx..participants.len() {
        counts[i] += 1;
        distribute_remaining(participants, counts, remaining - 1, i, results);
        counts[i] -= 1;
    }
}

/// Check if an enemy instance is assigned to a specific player in cooperative combat.
///
/// Returns true if:
/// - There are no assignments (non-cooperative / solo combat — all enemies visible)
/// - The enemy instance is in the player's assignment list
pub fn is_enemy_assigned_to_player(
    assignments: &Option<BTreeMap<String, Vec<String>>>,
    player_id: &str,
    enemy_instance_id: &str,
) -> bool {
    match assignments {
        None => true, // No assignments = solo/non-cooperative, all enemies visible
        Some(map) => map
            .get(player_id)
            .map(|ids| ids.iter().any(|id| id == enemy_instance_id))
            .unwrap_or(false),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_two_player_game;
    use mk_types::enums::Hero;
    use mk_types::legal_action::LegalAction;

    /// Different enemy token IDs for varied garrison composition.
    const GARRISON_TOKENS: [(&str, EnemyColor); 8] = [
        ("guardsmen_1", EnemyColor::Gray),
        ("prowlers_1", EnemyColor::Gray),
        ("crossbowmen_1", EnemyColor::Gray),
        ("swordsmen_1", EnemyColor::Gray),
        ("guardsmen_2", EnemyColor::Gray),
        ("prowlers_2", EnemyColor::Gray),
        ("crossbowmen_2", EnemyColor::Gray),
        ("swordsmen_2", EnemyColor::Gray),
    ];

    /// Set up a two-player game with a city hex at `city_pos` that has `garrison_count` enemies.
    fn setup_coop_game(city_pos: HexCoord, garrison_count: usize) -> GameState {
        let mut state = create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        state.round_phase = RoundPhase::PlayerTurns;

        // Clear tactic selection state so players can act
        for player in &mut state.players {
            player.selected_tactic = Some(TacticId::from("planning"));
            player.flags.insert(PlayerFlags::TACTIC_FLIPPED);
        }

        // Place a city hex with varied garrison enemies
        let city_hex = HexState {
            coord: city_pos,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: Some(BasicManaColor::Blue),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: arrayvec::ArrayVec::new(),
            enemies: {
                let mut enemies = arrayvec::ArrayVec::new();
                for i in 0..garrison_count {
                    let (token_str, color) = GARRISON_TOKENS[i % GARRISON_TOKENS.len()];
                    enemies.push(HexEnemy {
                        token_id: EnemyTokenId::from(token_str),
                        color,
                        is_revealed: true,
                    });
                }
                enemies
            },
            ruins_token: None,
            shield_tokens: Vec::new(),
        };
        state.map.hexes.insert(city_pos.key(), city_hex);

        state
    }

    /// Place both players adjacent to the city hex.
    fn place_players_adjacent(state: &mut GameState, city_pos: HexCoord) {
        let neighbors = city_pos.neighbors();
        state.players[0].position = Some(neighbors[0]);
        state.players[1].position = Some(neighbors[1]);
    }

    // ---- Proposal validation ----

    #[test]
    fn propose_succeeds_with_valid_state() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_ok());
        assert!(state.pending_cooperative_assault.is_some());

        let proposal = state.pending_cooperative_assault.as_ref().unwrap();
        assert_eq!(proposal.proposer_idx, 0);
        assert_eq!(proposal.hex_coord, city_pos);
        assert_eq!(proposal.invited_player_idxs, vec![1]);
        assert_eq!(proposal.distribution, vec![(0, 1), (1, 1)]);
        assert!(proposal.accepted_player_idxs.is_empty());
    }

    #[test]
    fn propose_fails_when_not_adjacent() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        // Player 0 far away, player 1 adjacent
        state.players[0].position = Some(HexCoord::new(10, 10));
        let neighbors = city_pos.neighbors();
        state.players[1].position = Some(neighbors[0]);

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_invitee_not_adjacent() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        let neighbors = city_pos.neighbors();
        state.players[0].position = Some(neighbors[0]);
        state.players[1].position = Some(HexCoord::new(10, 10)); // Far away

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_end_of_round_announced() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);
        state.end_of_round_announced_by = Some(PlayerId::from("player_0"));

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_initiator_token_flipped() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);
        state.players[0]
            .flags
            .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_invitee_token_flipped() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);
        state.players[1]
            .flags
            .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_invitee_has_only_wounds() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);
        // Replace invitee's hand with all wounds
        state.players[1].hand = vec![
            CardId::from("wound"),
            CardId::from("wound"),
            CardId::from("wound"),
        ];

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_when_initiator_has_taken_action() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);
        state.players[0]
            .flags
            .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    #[test]
    fn propose_fails_with_invalid_distribution_count() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 3);
        place_players_adjacent(&mut state, city_pos);

        // Sum doesn't equal garrison (3 != 2)
        let result = apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]);
        assert!(result.is_err());
    }

    // ---- Response flow ----

    #[test]
    fn accept_single_invitee_triggers_combat() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        let result = apply_respond(&mut state, 1, true).unwrap();
        assert!(result, "Should trigger combat on full agreement");
        assert!(state.pending_cooperative_assault.is_none());
        assert!(state.combat.is_some());
    }

    #[test]
    fn decline_clears_proposal() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        let result = apply_respond(&mut state, 1, false).unwrap();
        assert!(!result, "Decline should not trigger combat");
        assert!(state.pending_cooperative_assault.is_none());
        assert!(state.combat.is_none());
    }

    #[test]
    fn tokens_flipped_on_agreement() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED));
        assert!(state.players[1]
            .flags
            .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED));
    }

    #[test]
    fn combat_state_has_enemy_assignments() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert!(combat.enemy_assignments.is_some());
        let assignments = combat.enemy_assignments.as_ref().unwrap();
        // Each player should have 1 enemy assigned
        let p0_enemies = assignments.get("player_0").unwrap();
        let p1_enemies = assignments.get("player_1").unwrap();
        assert_eq!(p0_enemies.len(), 1);
        assert_eq!(p1_enemies.len(), 1);
        // No overlap
        assert_ne!(p0_enemies[0], p1_enemies[0]);
    }

    #[test]
    fn non_invited_player_cannot_respond() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        // Proposer (idx 0) is not invited, they initiated
        let result = apply_respond(&mut state, 0, true);
        assert!(result.is_err());
    }

    #[test]
    fn already_responded_cannot_re_respond() {
        let city_pos = HexCoord::new(2, 0);
        // Need 3+ enemies for 3 participants (but we only have 2 players for now)
        // Test with just 2 players — single accept triggers combat, so we can't re-respond
        // This tests the path where the player has already been added to accepted_player_idxs
        // We need a multi-invitee scenario... but we only have 2 players
        // So let's just check the error case directly
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        // First response triggers combat (single invitee), so try the error case manually
        // by pre-adding the player to accepted list
        state
            .pending_cooperative_assault
            .as_mut()
            .unwrap()
            .accepted_player_idxs
            .push(1);
        // Also add another fake invitee so we don't trigger full agreement
        state
            .pending_cooperative_assault
            .as_mut()
            .unwrap()
            .invited_player_idxs
            .push(99);

        let result = apply_respond(&mut state, 1, true);
        assert!(result.is_err());
    }

    // ---- Cancel ----

    #[test]
    fn initiator_can_cancel() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        let result = apply_cancel(&mut state, 0);
        assert!(result.is_ok());
        assert!(state.pending_cooperative_assault.is_none());
    }

    #[test]
    fn non_initiator_cannot_cancel() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        let result = apply_cancel(&mut state, 1);
        assert!(result.is_err());
        assert!(state.pending_cooperative_assault.is_some());
    }

    #[test]
    fn cancel_clears_state() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_cancel(&mut state, 0).unwrap();

        assert!(state.pending_cooperative_assault.is_none());
        assert!(state.combat.is_none());
    }

    // ---- Enemy distribution ----

    #[test]
    fn distribution_deterministic_with_seed() {
        let city_pos = HexCoord::new(2, 0);
        let mut state1 = setup_coop_game(city_pos, 4);
        place_players_adjacent(&mut state1, city_pos);
        let mut state2 = setup_coop_game(city_pos, 4);
        place_players_adjacent(&mut state2, city_pos);
        // Sync RNG
        state2.rng = state1.rng.clone();

        apply_propose(&mut state1, 0, city_pos, &[1], &[(0, 2), (1, 2)]).unwrap();
        apply_respond(&mut state1, 1, true).unwrap();

        apply_propose(&mut state2, 0, city_pos, &[1], &[(0, 2), (1, 2)]).unwrap();
        apply_respond(&mut state2, 1, true).unwrap();

        let a1 = state1.combat.as_ref().unwrap().enemy_assignments.as_ref().unwrap();
        let a2 = state2.combat.as_ref().unwrap().enemy_assignments.as_ref().unwrap();
        assert_eq!(a1, a2, "Same seed should produce same distribution");
    }

    #[test]
    fn distribution_sums_to_garrison() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 4);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 3)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        let assignments = state
            .combat
            .as_ref()
            .unwrap()
            .enemy_assignments
            .as_ref()
            .unwrap();
        let total: usize = assignments.values().map(|v| v.len()).sum();
        assert_eq!(total, 4, "Total assigned should equal garrison size");
    }

    #[test]
    fn each_participant_gets_at_least_one() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 4);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 3)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        let assignments = state
            .combat
            .as_ref()
            .unwrap()
            .enemy_assignments
            .as_ref()
            .unwrap();
        for (player_id, enemies) in assignments {
            assert!(
                !enemies.is_empty(),
                "Player {} should have at least 1 enemy",
                player_id
            );
        }
    }

    #[test]
    fn different_seeds_produce_different_enemy_ordering() {
        let city_pos = HexCoord::new(2, 0);

        // The shuffle changes which real enemy each instance_id maps to.
        // Compare the enemy_id ordering in combat.enemies across different seeds.
        let mut found_difference = false;
        for seed_offset in 0..100 {
            let mut state1 = setup_coop_game(city_pos, 4);
            place_players_adjacent(&mut state1, city_pos);
            state1.rng = mk_types::rng::RngState::new(100 + seed_offset);

            let mut state2 = setup_coop_game(city_pos, 4);
            place_players_adjacent(&mut state2, city_pos);
            state2.rng = mk_types::rng::RngState::new(200 + seed_offset);

            apply_propose(&mut state1, 0, city_pos, &[1], &[(0, 2), (1, 2)]).unwrap();
            apply_respond(&mut state1, 1, true).unwrap();

            apply_propose(&mut state2, 0, city_pos, &[1], &[(0, 2), (1, 2)]).unwrap();
            apply_respond(&mut state2, 1, true).unwrap();

            let ids1: Vec<&str> = state1.combat.as_ref().unwrap().enemies
                .iter().map(|e| e.enemy_id.as_str()).collect();
            let ids2: Vec<&str> = state2.combat.as_ref().unwrap().enemies
                .iter().map(|e| e.enemy_id.as_str()).collect();
            if ids1 != ids2 {
                found_difference = true;
                break;
            }
        }
        assert!(
            found_difference,
            "Different seeds should produce different enemy orderings"
        );
    }

    // ---- Combat filtering ----

    #[test]
    fn null_assignments_means_all_enemies_visible() {
        assert!(is_enemy_assigned_to_player(&None, "player_0", "enemy_0"));
        assert!(is_enemy_assigned_to_player(&None, "player_0", "enemy_5"));
    }

    #[test]
    fn assigned_enemies_visible_to_owner() {
        let mut assignments = BTreeMap::new();
        assignments.insert(
            "player_0".to_string(),
            vec!["enemy_0".to_string(), "enemy_2".to_string()],
        );
        assignments.insert("player_1".to_string(), vec!["enemy_1".to_string()]);

        let assignments = Some(assignments);
        assert!(is_enemy_assigned_to_player(
            &assignments,
            "player_0",
            "enemy_0"
        ));
        assert!(is_enemy_assigned_to_player(
            &assignments,
            "player_0",
            "enemy_2"
        ));
        assert!(!is_enemy_assigned_to_player(
            &assignments,
            "player_0",
            "enemy_1"
        ));
        assert!(is_enemy_assigned_to_player(
            &assignments,
            "player_1",
            "enemy_1"
        ));
        assert!(!is_enemy_assigned_to_player(
            &assignments,
            "player_1",
            "enemy_0"
        ));
    }

    // ---- Generate distributions ----

    #[test]
    fn generate_distributions_basic() {
        let dists = generate_distributions(0, &[1], 2);
        assert_eq!(dists.len(), 1);
        assert_eq!(dists[0], vec![(0, 1), (1, 1)]);
    }

    #[test]
    fn generate_distributions_three_enemies_two_players() {
        let dists = generate_distributions(0, &[1], 3);
        assert_eq!(dists.len(), 2);
        // (2,1) and (1,2)
        assert!(dists.contains(&vec![(0, 2), (1, 1)]));
        assert!(dists.contains(&vec![(0, 1), (1, 2)]));
    }

    #[test]
    fn generate_distributions_fewer_than_participants() {
        // 1 enemy, 2 players — impossible
        let dists = generate_distributions(0, &[1], 1);
        assert!(dists.is_empty());
    }

    // ---- Fortified combat ----

    #[test]
    fn combat_is_fortified_after_agreement() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert!(
            combat.is_at_fortified_site,
            "City combat should be fortified"
        );
    }

    // ---- Legal enumeration ----

    #[test]
    fn propose_enumerated_when_eligible() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0);
        let propose_count = actions
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::ProposeCooperativeAssault { .. }))
            .count();
        assert!(
            propose_count > 0,
            "Should have at least one Propose action"
        );
    }

    #[test]
    fn accept_decline_enumerated_for_invitee_out_of_turn() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        // Player 1 is NOT the active player (player 0 is), but should get response actions
        let actions = crate::legal_actions::enumerate_legal_actions(&state, 1);
        let accepts: Vec<_> = actions
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::RespondToCooperativeProposal { accept: true }))
            .collect();
        let declines: Vec<_> = actions
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::RespondToCooperativeProposal { accept: false }))
            .collect();
        assert_eq!(accepts.len(), 1, "Should have Accept action");
        assert_eq!(declines.len(), 1, "Should have Decline action");
        assert_eq!(actions.actions.len(), 2, "Should only have response actions");
    }

    #[test]
    fn cancel_enumerated_for_initiator() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0);
        let cancel_count = actions
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::CancelCooperativeProposal))
            .count();
        assert_eq!(cancel_count, 1, "Initiator should have Cancel action");
    }

    #[test]
    fn propose_not_enumerated_when_no_eligible_invitees() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        let neighbors = city_pos.neighbors();
        state.players[0].position = Some(neighbors[0]);
        // Player 1 is far away — not adjacent to city
        state.players[1].position = Some(HexCoord::new(10, 10));

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0);
        let propose_count = actions
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::ProposeCooperativeAssault { .. }))
            .count();
        assert_eq!(propose_count, 0, "No eligible invitees → no propose actions");
    }

    // ---- Combat filtering via legal actions ----

    #[test]
    fn block_only_assigned_enemies() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        // Set combat phase to Block and give player 0 enough block
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 100,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0);

        // Player 0 should only see block options for their assigned enemy
        let p0_assigned = state
            .combat
            .as_ref()
            .unwrap()
            .enemy_assignments
            .as_ref()
            .unwrap()
            .get("player_0")
            .unwrap();

        for action in &actions.actions {
            if let LegalAction::DeclareBlock {
                enemy_instance_id, ..
            } = action
            {
                assert!(
                    p0_assigned.iter().any(|id| id == enemy_instance_id.as_str()),
                    "Block target {} should be assigned to player_0",
                    enemy_instance_id
                );
            }
        }
    }

    #[test]
    fn damage_only_assigned_enemies() {
        let city_pos = HexCoord::new(2, 0);
        let mut state = setup_coop_game(city_pos, 2);
        place_players_adjacent(&mut state, city_pos);

        apply_propose(&mut state, 0, city_pos, &[1], &[(0, 1), (1, 1)]).unwrap();
        apply_respond(&mut state, 1, true).unwrap();

        // Set combat phase to AssignDamage
        state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0);

        // Should only see damage options for player 0's assigned enemy
        let p0_assigned = state
            .combat
            .as_ref()
            .unwrap()
            .enemy_assignments
            .as_ref()
            .unwrap()
            .get("player_0")
            .unwrap();

        for action in &actions.actions {
            let enemy_idx = match action {
                LegalAction::AssignDamageToHero { enemy_index, .. } => *enemy_index,
                LegalAction::AssignDamageToUnit { enemy_index, .. } => *enemy_index,
                _ => continue,
            };
            let enemy = &state.combat.as_ref().unwrap().enemies[enemy_idx];
            assert!(
                p0_assigned.iter().any(|id| id == enemy.instance_id.as_str()),
                "Damage target {} should be assigned to player_0",
                enemy.instance_id
            );
        }
    }
}
