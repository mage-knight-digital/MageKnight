//! Combat entry — `execute_enter_combat()`.
//!
//! Creates a CombatState from enemy token IDs, matching TS `createCombatState()`.

use std::collections::BTreeMap;

use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::enemy_id_from_token;
use mk_types::enums::*;
use mk_types::hex::HexCoord;
use mk_types::ids::*;
use mk_types::state::*;

// =============================================================================
// Error type
// =============================================================================

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CombatError {
    UnknownEnemy(String),
    NoEnemies,
}

// =============================================================================
// Options
// =============================================================================

/// Options for entering combat.
pub struct EnterCombatOptions {
    pub units_allowed: bool,
    pub night_mana_rules: bool,
}

impl Default for EnterCombatOptions {
    fn default() -> Self {
        Self {
            units_allowed: true,
            night_mana_rules: false,
        }
    }
}

// =============================================================================
// Enter combat
// =============================================================================

/// Enter combat with the given enemy tokens.
///
/// Steps:
/// 1. Look up each token's enemy definition via `enemy_id_from_token()` + `get_enemy()`
/// 2. Create `CombatEnemy` instances with instance IDs `"enemy_0"`, `"enemy_1"`, etc.
/// 3. Initialize multi-attack tracking vectors
/// 4. Clear player healing points (rulebook: unspent healing disappears)
/// 5. Set `state.combat = Some(Box::new(combat_state))`
pub fn execute_enter_combat(
    state: &mut GameState,
    player_idx: usize,
    enemy_token_ids: &[EnemyTokenId],
    is_fortified: bool,
    combat_hex_coord: Option<HexCoord>,
    options: EnterCombatOptions,
) -> Result<(), CombatError> {
    if enemy_token_ids.is_empty() {
        return Err(CombatError::NoEnemies);
    }

    let mut enemies = Vec::with_capacity(enemy_token_ids.len());

    for (i, token_id) in enemy_token_ids.iter().enumerate() {
        let enemy_id_str = enemy_id_from_token(token_id);
        let def = get_enemy(&enemy_id_str)
            .ok_or_else(|| CombatError::UnknownEnemy(enemy_id_str.clone()))?;

        let num_attacks = attack_count(def);

        enemies.push(CombatEnemy {
            instance_id: CombatInstanceId::from(format!("enemy_{}", i)),
            enemy_id: EnemyId::from(enemy_id_str),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false; num_attacks],
            attacks_damage_assigned: vec![false; num_attacks],
            attacks_cancelled: vec![false; num_attacks],
        });
    }

    let combat = CombatState {
        phase: CombatPhase::RangedSiege,
        enemies,
        wounds_this_combat: 0,
        wounds_added_to_hand_this_combat: false,
        attacks_this_phase: 0,
        fame_gained: 0,
        is_at_fortified_site: is_fortified,
        units_allowed: options.units_allowed,
        night_mana_rules: options.night_mana_rules,
        assault_origin: None,
        combat_hex_coord,
        all_damage_blocked_this_phase: false,
        discard_enemies_on_failure: false,
        combat_context: CombatContext::Standard,
        pending_damage: BTreeMap::new(),
        pending_block: BTreeMap::new(),
        pending_swift_block: BTreeMap::new(),
        cumbersome_reductions: BTreeMap::new(),
        used_defend: BTreeMap::new(),
        defend_bonuses: BTreeMap::new(),
        vampiric_armor_bonus: BTreeMap::new(),
        paid_thugs_damage_influence: BTreeMap::new(),
        damage_redirects: BTreeMap::new(),
        enemy_assignments: None,
        paid_heroes_assault_influence: false,
        declared_attack_targets: None,
        declared_block_target: None,
        declared_block_attack_index: None,
        has_paralyze_damage_to_hero: false,
    };

    // Clear healing points (rulebook: unspent healing disappears when entering combat)
    state.players[player_idx].healing_points = 0;

    state.combat = Some(Box::new(combat));

    Ok(())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::enums::Hero;

    fn setup_playing_game() -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state
    }

    #[test]
    fn enter_combat_creates_combat_state() {
        let mut state = setup_playing_game();
        let tokens = vec![
            EnemyTokenId::from("diggers_1"),
            EnemyTokenId::from("prowlers_2"),
        ];

        execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert_eq!(combat.enemies.len(), 2);
        assert_eq!(combat.enemies[0].instance_id.as_str(), "enemy_0");
        assert_eq!(combat.enemies[0].enemy_id.as_str(), "diggers");
        assert_eq!(combat.enemies[1].instance_id.as_str(), "enemy_1");
        assert_eq!(combat.enemies[1].enemy_id.as_str(), "prowlers");
        assert_eq!(combat.phase, CombatPhase::RangedSiege);
    }

    #[test]
    fn enter_combat_clears_healing_points() {
        let mut state = setup_playing_game();
        state.players[0].healing_points = 5;
        let tokens = vec![EnemyTokenId::from("diggers_1")];

        execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        assert_eq!(state.players[0].healing_points, 0);
    }

    #[test]
    fn enter_combat_fortified() {
        let mut state = setup_playing_game();
        let tokens = vec![EnemyTokenId::from("guardsmen_1")];

        execute_enter_combat(
            &mut state, 0, &tokens, true, None, Default::default(),
        ).unwrap();

        assert!(state.combat.as_ref().unwrap().is_at_fortified_site);
    }

    #[test]
    fn enter_combat_multi_attack_enemy() {
        let mut state = setup_playing_game();
        let tokens = vec![EnemyTokenId::from("hydra_1")];

        execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let enemy = &state.combat.as_ref().unwrap().enemies[0];
        assert_eq!(enemy.attacks_blocked.len(), 3);
        assert_eq!(enemy.attacks_damage_assigned.len(), 3);
        assert_eq!(enemy.attacks_cancelled.len(), 3);
    }

    #[test]
    fn enter_combat_single_attack_enemy() {
        let mut state = setup_playing_game();
        let tokens = vec![EnemyTokenId::from("diggers_1")];

        execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let enemy = &state.combat.as_ref().unwrap().enemies[0];
        assert_eq!(enemy.attacks_blocked.len(), 1);
    }

    #[test]
    fn enter_combat_no_enemies_error() {
        let mut state = setup_playing_game();
        let result = execute_enter_combat(
            &mut state, 0, &[], false, None, Default::default(),
        );
        assert_eq!(result, Err(CombatError::NoEnemies));
    }

    #[test]
    fn enter_combat_unknown_enemy_error() {
        let mut state = setup_playing_game();
        let tokens = vec![EnemyTokenId::from("nonexistent_1")];
        let result = execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        );
        assert!(matches!(result, Err(CombatError::UnknownEnemy(_))));
    }

    #[test]
    fn enter_combat_with_hex_coord() {
        let mut state = setup_playing_game();
        let tokens = vec![EnemyTokenId::from("wolf_riders_1")];
        let hex = HexCoord::new(1, -1);

        execute_enter_combat(
            &mut state, 0, &tokens, false, Some(hex), Default::default(),
        ).unwrap();

        assert_eq!(state.combat.as_ref().unwrap().combat_hex_coord, Some(hex));
    }
}
