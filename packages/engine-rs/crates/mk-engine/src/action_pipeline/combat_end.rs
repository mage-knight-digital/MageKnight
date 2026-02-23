//! End-of-combat processing and modifier expiration.

use mk_data::enemy_piles::{discard_enemy_token, enemy_id_from_token};
use mk_types::enums::*;
use mk_data::sites::conquest_reward;
use mk_types::ids::EnemyTokenId;
use mk_types::pending::SiteReward;
use mk_types::state::*;


use super::sites;
use super::skills_complex;


/// End combat: remove defeated enemies from map hex, discard tokens, clean up state.
pub(super) fn end_combat(state: &mut GameState, player_idx: usize) {
    if let Some(ref combat) = state.combat {
        // If combat has a hex coordinate, remove defeated enemies from that hex
        if let Some(hex_coord) = combat.combat_hex_coord {
            let hex_key = hex_coord.key();

            // Collect defeated enemy IDs to match against hex enemies
            let defeated_enemy_ids: Vec<String> = combat
                .enemies
                .iter()
                .filter(|e| e.is_defeated)
                .map(|e| e.enemy_id.as_str().to_string())
                .collect();

            if let Some(hex) = state.map.hexes.get_mut(&hex_key) {
                // Remove enemies whose base ID matches a defeated enemy
                // and discard their tokens to the appropriate color pile
                let mut to_remove: Vec<(EnemyTokenId, EnemyColor)> = Vec::new();

                for enemy in hex.enemies.iter() {
                    let base_id = enemy_id_from_token(&enemy.token_id);
                    if defeated_enemy_ids.contains(&base_id) {
                        to_remove.push((enemy.token_id.clone(), enemy.color));
                    }
                }

                // Remove from hex
                hex.enemies.retain(|e| {
                    let base_id = enemy_id_from_token(&e.token_id);
                    !defeated_enemy_ids.contains(&base_id)
                });

                // Discard tokens to color piles
                for (token_id, color) in &to_remove {
                    discard_enemy_token(&mut state.enemy_tokens, token_id, *color);
                }
            }
        }

        // If discard_enemies_on_failure is set, remove and discard any non-defeated enemies
        // from the hex on combat failure (e.g., BurnMonastery draws a temporary enemy).
        if combat.discard_enemies_on_failure {
            let all_defeated = combat.enemies.iter().all(|e| e.is_defeated);
            if !all_defeated {
                if let Some(hex_coord) = combat.combat_hex_coord {
                    if let Some(hex) = state.map.hexes.get_mut(&hex_coord.key()) {
                        let remaining: Vec<(EnemyTokenId, EnemyColor)> = hex
                            .enemies
                            .iter()
                            .map(|e| (e.token_id.clone(), e.color))
                            .collect();
                        hex.enemies.clear();
                        for (token_id, color) in &remaining {
                            discard_enemy_token(&mut state.enemy_tokens, token_id, *color);
                        }
                    }
                }
            }
        }
    }

    // Conquest marking: if all required-for-conquest enemies defeated and hex has an unconquered site.
    // Rampaging enemies provoked during an assault have is_required_for_conquest=false,
    // so they don't need to be defeated for the site to be conquered.
    let mut conquered_site_type: Option<SiteType> = None;
    let mut burn_monastery_reward = false;
    let mut ruins_reward: Option<SiteReward> = None;
    if let Some(ref combat) = state.combat {
        let all_required_defeated = combat
            .enemies
            .iter()
            .filter(|e| e.is_required_for_conquest)
            .all(|e| e.is_defeated);
        let has_any_required = combat
            .enemies
            .iter()
            .any(|e| e.is_required_for_conquest);
        let all_defeated = combat.enemies.iter().all(|e| e.is_defeated);
        // Conquest if: (1) all required enemies defeated (when there are required enemies), OR
        // (2) all enemies defeated (fallback for non-assault combats with no required markers)
        // BurnMonastery has its own conquest + shield logic below, skip the general path.
        let is_burn = combat.combat_context == CombatContext::BurnMonastery;
        if !is_burn && ((has_any_required && all_required_defeated) || (!has_any_required && all_defeated)) {
            if let Some(hex_coord) = combat.combat_hex_coord {
                if let Some(hex) = state.map.hexes.get_mut(&hex_coord.key()) {
                    if let Some(ref mut site) = hex.site {
                        if !site.is_conquered {
                            site.is_conquered = true;
                            site.owner = Some(state.players[player_idx].id.clone());
                            conquered_site_type = Some(site.site_type);
                        }
                    }
                    // Place shield token
                    hex.shield_tokens.push(state.players[player_idx].id.clone());
                    // Clear remaining enemies from hex (all defeated)
                    hex.enemies.clear();
                }
            }
        }

        // BurnMonastery victory: if combat_context == BurnMonastery and all enemies defeated
        if combat.combat_context == CombatContext::BurnMonastery && all_defeated {
            if let Some(hex_coord) = combat.combat_hex_coord {
                if let Some(hex) = state.map.hexes.get_mut(&hex_coord.key()) {
                    if let Some(ref mut site) = hex.site {
                        site.is_burned = true;
                        site.is_conquered = true;
                        site.owner = Some(state.players[player_idx].id.clone());
                    }
                    // Place shield token
                    hex.shield_tokens.push(state.players[player_idx].id.clone());
                }
            }
        }

        // AncientRuins victory: collect data for reward queueing
        if combat.combat_context == CombatContext::AncientRuins && all_defeated {
            if let Some(hex_coord) = combat.combat_hex_coord {
                if let Some(hex) = state.map.hexes.get_mut(&hex_coord.key()) {
                    // Remove ruins token from hex and discard to pile
                    if let Some(ruins_token) = hex.ruins_token.take() {
                        // Look up the enemy token's reward
                        if let Some(mk_data::ruins_tokens::RuinsTokenDef::Enemy(enemy_token)) =
                            mk_data::ruins_tokens::get_ruins_token(ruins_token.token_id.as_str())
                        {
                            ruins_reward = Some(mk_data::ruins_tokens::get_enemy_token_reward(enemy_token));
                        }
                        state.ruins_tokens.discard.push(ruins_token.token_id.clone());
                    }

                    // Conquest marking (ruins site conquered)
                    if let Some(ref mut site) = hex.site {
                        if !site.is_conquered {
                            site.is_conquered = true;
                            site.owner = Some(state.players[player_idx].id.clone());
                        }
                    }
                    // Place shield token
                    hex.shield_tokens.push(state.players[player_idx].id.clone());
                }
            }
        }

        // Track BurnMonastery victory for reward queueing after borrow ends
        burn_monastery_reward = combat.combat_context == CombatContext::BurnMonastery && all_defeated;
    }

    // Queue burn monastery reward (outside the combat borrow)
    if burn_monastery_reward {
        sites::queue_site_reward(state, player_idx, SiteReward::Artifact { count: 1 });
    }

    // Queue ruins reward (outside the combat borrow)
    if let Some(reward) = ruins_reward {
        sites::queue_site_reward(state, player_idx, reward);
    }

    // Queue conquest reward if a site was newly conquered
    if let Some(site_type) = conquered_site_type {
        if let Some(reward) = conquest_reward(site_type) {
            sites::queue_site_reward(state, player_idx, reward);
        }
    }

    // Dueling: award fame bonus if target defeated without unit involvement
    skills_complex::resolve_dueling_fame_bonus(state, player_idx);

    // Expire combat-duration modifiers
    expire_modifiers_combat(&mut state.active_modifiers);

    // Clear combat state
    state.combat = None;
    let player = &mut state.players[player_idx];
    player.combat_accumulator = Default::default();
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    player.flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    // Reset unit combat-specific state
    for unit in &mut player.units {
        unit.used_resistance_this_combat = false;
    }

    // Clear combat-scoped skill cooldowns
    player.skill_cooldowns.used_this_combat.clear();
}


// =============================================================================
// Modifier expiration
// =============================================================================

/// Expire all modifiers with `Combat` duration.
pub(super) fn expire_modifiers_combat(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>) {
    modifiers.retain(|m| m.duration != mk_types::modifier::ModifierDuration::Combat);
}


/// Expire `Turn` duration modifiers created by the given player.
pub fn expire_modifiers_turn_end(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>, player_id: &mk_types::ids::PlayerId) {
    modifiers.retain(|m| {
        !(m.duration == mk_types::modifier::ModifierDuration::Turn
            && m.created_by_player_id == *player_id)
    });
}


/// Expire `UntilNextTurn` modifiers created by the given player (at their turn start).
pub fn expire_modifiers_turn_start(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>, player_id: &mk_types::ids::PlayerId) {
    modifiers.retain(|m| {
        !(m.duration == mk_types::modifier::ModifierDuration::UntilNextTurn
            && m.created_by_player_id == *player_id)
    });
}


/// Expire all modifiers with `Round` duration.
pub fn expire_modifiers_round_end(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>) {
    modifiers.retain(|m| m.duration != mk_types::modifier::ModifierDuration::Round);
}

