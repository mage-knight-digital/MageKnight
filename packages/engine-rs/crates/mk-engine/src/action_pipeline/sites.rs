//! Site interactions: enter, interact, plunder, commerce, banners, rewards.

use mk_data::enemy_piles::{draw_enemy_token, enemy_id_from_token};
use mk_data::offers::{take_from_monastery_offer, take_from_offer};
use mk_data::sites::{
    BURN_MONASTERY_REP_PENALTY, CITY_AA_PURCHASE_COST, CITY_ARTIFACT_PURCHASE_COST,
    CITY_ELITE_UNIT_COST, MONASTERY_AA_PURCHASE_COST, SPELL_PURCHASE_COST,
};
use mk_types::enums::*;
use arrayvec::ArrayVec;
use mk_types::ids::{CardId, CombatInstanceId, EnemyTokenId};
use mk_types::pending::{ActivePending, DeferredPending, SiteReward, MAX_REWARDS};
use mk_types::state::*;

use crate::{card_play, combat};

use super::{ApplyError, ApplyResult};


// apply_undo delegated to turn_flow module

// =============================================================================
// Reputation/shield influence bonus — applied once per turn at interaction start
// =============================================================================

/// Apply the blanket reputation + shield-token influence bonus if it hasn't
/// been applied yet this turn. Called at the top of every commerce/recruitment
/// handler so the bonus is applied exactly once (further handlers see the
/// already-mutated `influence_points`).
pub(crate) fn apply_interaction_bonus_if_needed(
    state: &mut GameState,
    player_idx: usize,
) {
    let player = &state.players[player_idx];

    // Already applied this turn — nothing to do
    if player
        .flags
        .contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN)
    {
        return;
    }

    // Must be at an inhabited site
    let pos = match player.position {
        Some(p) => p,
        None => return,
    };
    let hex_state = match state.map.hexes.get(&pos.key()) {
        Some(h) => h,
        None => return,
    };
    let site = match hex_state.site.as_ref() {
        Some(s) => s,
        None => return,
    };
    if !mk_data::sites::is_inhabited(site.site_type) {
        return;
    }

    // Compute bonus
    let rep_bonus =
        crate::legal_actions::sites::reputation_influence_bonus(player.reputation);

    let shield_bonus = if site.site_type == SiteType::City && site.is_conquered {
        hex_state
            .shield_tokens
            .iter()
            .filter(|id| **id == player.id)
            .count() as i32
    } else {
        0
    };

    let total_bonus = rep_bonus + shield_bonus;

    // Apply bonus (saturating to avoid u32 underflow)
    let player = &mut state.players[player_idx];
    if total_bonus >= 0 {
        player.influence_points += total_bonus as u32;
    } else {
        player.influence_points = player
            .influence_points
            .saturating_sub((-total_bonus) as u32);
    }

    player
        .flags
        .insert(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN);
}

// =============================================================================
// Site interactions
// =============================================================================

pub(super) fn apply_enter_site(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("EnterSite: player has no position".into()))?;

    let hex_key = player_pos.key();
    let hex_state = state
        .map
        .hexes
        .get(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("EnterSite: hex not found".into()))?;

    let site = hex_state
        .site
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("EnterSite: no site on hex".into()))?;

    let site_type = site.site_type;

    // Determine enemy tokens for combat
    let enemy_tokens: Vec<EnemyTokenId>;

    if site_type == SiteType::AncientRuins {
        // Ancient Ruins: enemies persist on the hex until defeated.
        // If enemies already exist from a previous retreat, use those.
        // Only draw fresh enemies on first entry.
        let hex_has_enemies = !hex_state.enemies.is_empty();

        if hex_has_enemies {
            // Re-entry: fight the same enemies still on the hex
            enemy_tokens = hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();
        } else {
            // First entry: draw enemies from the ruins token's color list
            let ruins_token_id = hex_state
                .ruins_token
                .as_ref()
                .map(|t| t.token_id.clone())
                .ok_or_else(|| ApplyError::InternalError("EnterSite: no ruins token on hex".into()))?;

            let enemy_token = match mk_data::ruins_tokens::get_ruins_token(ruins_token_id.as_str()) {
                Some(mk_data::ruins_tokens::RuinsTokenDef::Enemy(e)) => *e,
                _ => {
                    return Err(ApplyError::InternalError(
                        "EnterSite: ruins token is not an enemy token".into(),
                    ));
                }
            };

            // Draw one enemy per color from the token definition
            let mut drawn = Vec::new();
            for &color in enemy_token.enemy_colors {
                let token = draw_enemy_token(&mut state.enemy_tokens, color, &mut state.rng)
                    .ok_or_else(|| {
                        ApplyError::InternalError(format!(
                            "EnterSite: no {:?} enemy tokens available for ruins",
                            color
                        ))
                    })?;
                drawn.push(token);
            }

            // Place drawn tokens onto hex
            let hex = state.map.hexes.get_mut(&hex_key).unwrap();
            for token in &drawn {
                let enemy_id_str = enemy_id_from_token(token);
                let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
                    ApplyError::InternalError(format!("EnterSite: unknown enemy {}", enemy_id_str))
                })?;
                hex.enemies.push(HexEnemy {
                    token_id: token.clone(),
                    color: def.color,
                    is_revealed: true,
                });
            }

            enemy_tokens = drawn;
        }

        // Enter combat (ruins: units allowed, no fortification, no night mana rules)
        combat::execute_enter_combat(
            state,
            player_idx,
            &enemy_tokens,
            false,
            Some(player_pos),
            Default::default(),
        )
        .map_err(|e| {
            ApplyError::InternalError(format!("EnterSite: enter_combat failed: {:?}", e))
        })?;

        // Set combat context to AncientRuins
        if let Some(ref mut combat) = state.combat {
            combat.combat_context = CombatContext::AncientRuins;
        }

        state.players[player_idx]
            .flags
            .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: vec![],
        });
    } else if mk_data::sites::draws_fresh_enemies(site_type) {
        // Dungeon/Tomb: always draw fresh enemies
        let config = mk_data::sites::adventure_site_enemies(site_type)
            .ok_or_else(|| ApplyError::InternalError("EnterSite: not an adventure site".into()))?;

        let mut drawn = Vec::new();
        for _ in 0..config.count {
            let token = draw_enemy_token(&mut state.enemy_tokens, config.color, &mut state.rng)
                .ok_or_else(|| {
                    ApplyError::InternalError("EnterSite: no enemy tokens available".into())
                })?;
            drawn.push(token);
        }

        // Place drawn tokens onto hex
        let hex = state.map.hexes.get_mut(&hex_key).unwrap();
        for token in &drawn {
            let enemy_id_str = enemy_id_from_token(token);
            let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
                ApplyError::InternalError(format!("EnterSite: unknown enemy {}", enemy_id_str))
            })?;
            hex.enemies.push(HexEnemy {
                token_id: token.clone(),
                color: def.color,
                is_revealed: true,
            });
        }

        enemy_tokens = drawn;
    } else {
        // MonsterDen/SpawningGrounds: use existing hex enemies, or draw if none
        if !hex_state.enemies.is_empty() {
            enemy_tokens = hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();
        } else {
            let config = mk_data::sites::adventure_site_enemies(site_type).ok_or_else(|| {
                ApplyError::InternalError("EnterSite: not an adventure site".into())
            })?;

            let mut drawn = Vec::new();
            for _ in 0..config.count {
                let token =
                    draw_enemy_token(&mut state.enemy_tokens, config.color, &mut state.rng)
                        .ok_or_else(|| {
                            ApplyError::InternalError(
                                "EnterSite: no enemy tokens available".into(),
                            )
                        })?;
                drawn.push(token);
            }

            // Place drawn tokens onto hex
            let hex = state.map.hexes.get_mut(&hex_key).unwrap();
            for token in &drawn {
                let enemy_id_str = enemy_id_from_token(token);
                let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
                    ApplyError::InternalError(format!("EnterSite: unknown enemy {}", enemy_id_str))
                })?;
                hex.enemies.push(HexEnemy {
                    token_id: token.clone(),
                    color: def.color,
                    is_revealed: true,
                });
            }

            enemy_tokens = drawn;
        }
    }

    // Determine combat options based on site type
    let options = match site_type {
        SiteType::Dungeon | SiteType::Tomb => combat::EnterCombatOptions {
            units_allowed: false,
            night_mana_rules: true,
        },
        _ => Default::default(),
    };

    let is_fortified = mk_data::sites::is_fortified(site_type);

    // Enter combat
    combat::execute_enter_combat(
        state,
        player_idx,
        &enemy_tokens,
        is_fortified,
        Some(player_pos),
        options,
    )
    .map_err(|e| ApplyError::InternalError(format!("EnterSite: enter_combat failed: {:?}", e)))?;

    // Dungeon/Tomb: "Whether you defeat the enemy or not, discard it afterwards"
    if matches!(site_type, SiteType::Dungeon | SiteType::Tomb) {
        if let Some(ref mut combat) = state.combat {
            combat.discard_enemies_on_failure = true;
        }
    }

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_interact_site(
    state: &mut GameState,
    player_idx: usize,
    healing: u32,
) -> Result<ApplyResult, ApplyError> {
    // Apply blanket reputation + shield bonus (once per turn)
    apply_interaction_bonus_if_needed(state, player_idx);

    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("InteractSite: no position".into()))?;

    let hex_state = state
        .map
        .hexes
        .get(&player_pos.key())
        .ok_or_else(|| ApplyError::InternalError("InteractSite: hex not found".into()))?;

    let site = hex_state
        .site
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("InteractSite: no site on hex".into()))?;

    let cost_per_wound = mk_data::sites::healing_cost(site.site_type)
        .ok_or_else(|| ApplyError::InternalError("InteractSite: site has no healing cost".into()))?;

    let total_cost = healing * cost_per_wound;

    let player = &mut state.players[player_idx];

    if player.influence_points < total_cost {
        return Err(ApplyError::InternalError(
            "InteractSite: not enough influence".into(),
        ));
    }

    // Deduct influence
    player.influence_points -= total_cost;

    // Remove wound cards from hand
    let mut healed = 0u32;
    player.hand.retain(|card| {
        if healed < healing && card.as_str() == "wound" {
            healed += 1;
            false
        } else {
            true
        }
    });

    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_plunder_site(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: no position".into()))?;

    let hex_key = player_pos.key();
    let hex = state
        .map
        .hexes
        .get_mut(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: hex not found".into()))?;

    let site = hex
        .site
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: no site on hex".into()))?;

    site.is_burned = true;

    // Reputation loss (capped at -7)
    let player = &mut state.players[player_idx];
    player.reputation = (player.reputation - 1).max(-7);
    player.flags.insert(PlayerFlags::HAS_PLUNDERED_THIS_TURN);

    // Draw 2 cards from deck
    let cards_to_draw = 2.min(player.deck.len());
    for _ in 0..cards_to_draw {
        let card = player.deck.remove(0);
        player.hand.push(card);
    }

    // Clear pending
    state.players[player_idx].pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_decline_plunder(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    // Clear pending
    state.players[player_idx].pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Site commerce handlers
// =============================================================================

pub(super) fn apply_buy_spell(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
    mana_color: BasicManaColor,
) -> Result<ApplyResult, ApplyError> {
    // Apply blanket reputation + shield bonus (once per turn)
    apply_interaction_bonus_if_needed(state, player_idx);

    let player = &mut state.players[player_idx];

    if player.influence_points < SPELL_PURCHASE_COST {
        return Err(ApplyError::InternalError("BuySpell: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= SPELL_PURCHASE_COST;

    // Consume matching-color mana (token > gold > crystal)
    super::units::consume_mana_for_unit(state, player_idx, mana_color)
        .map_err(|_| ApplyError::InternalError("BuySpell: cannot afford mana cost".into()))?;

    // Insert card at top of deed deck
    state.players[player_idx].deck.insert(0, card_id.clone());

    // Take from spell offer (replenishes from deck)
    take_from_offer(
        &mut state.offers.spells,
        &mut state.decks.spell_deck,
        card_id.as_str(),
    );

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_learn_advanced_action(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
) -> Result<ApplyResult, ApplyError> {
    // Apply blanket reputation + shield bonus (once per turn)
    apply_interaction_bonus_if_needed(state, player_idx);

    let player = &mut state.players[player_idx];

    if player.influence_points < MONASTERY_AA_PURCHASE_COST {
        return Err(ApplyError::InternalError("LearnAA: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= MONASTERY_AA_PURCHASE_COST;

    // Insert card at top of deed deck
    player.deck.insert(0, card_id.clone());

    // Take from monastery offer (no replenishment)
    take_from_monastery_offer(
        &mut state.offers.monastery_advanced_actions,
        card_id.as_str(),
    );

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_burn_monastery(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("BurnMonastery: no position".into()))?;

    // Deduct reputation (capped at -7)
    let player = &mut state.players[player_idx];
    player.reputation = (player.reputation as i32 - BURN_MONASTERY_REP_PENALTY)
        .max(-7) as i8;

    // Draw 1 violet enemy token
    let token = draw_enemy_token(
        &mut state.enemy_tokens,
        EnemyColor::Violet,
        &mut state.rng,
    )
    .ok_or_else(|| ApplyError::InternalError("BurnMonastery: no violet tokens".into()))?;

    // Place token onto hex
    let hex_key = player_pos.key();
    let hex = state
        .map
        .hexes
        .get_mut(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("BurnMonastery: hex not found".into()))?;

    let enemy_id_str = enemy_id_from_token(&token);
    let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
        ApplyError::InternalError(format!("BurnMonastery: unknown enemy {}", enemy_id_str))
    })?;
    hex.enemies.push(HexEnemy {
        token_id: token.clone(),
        color: def.color,
        is_revealed: true,
    });

    // Enter combat: units NOT allowed, combat_context = BurnMonastery
    let options = combat::EnterCombatOptions {
        units_allowed: false,
        night_mana_rules: false,
    };

    combat::execute_enter_combat(
        state,
        player_idx,
        &[token],
        false, // not fortified
        Some(player_pos),
        options,
    )
    .map_err(|e| ApplyError::InternalError(format!("BurnMonastery: enter_combat failed: {:?}", e)))?;

    // Set combat context
    if let Some(ref mut combat) = state.combat {
        combat.combat_context = CombatContext::BurnMonastery;
        combat.discard_enemies_on_failure = true;
    }

    let player = &mut state.players[player_idx];
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    player.flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_altar_tribute(
    state: &mut GameState,
    player_idx: usize,
    mana_sources: &[mk_types::action::ManaSourceInfo],
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("AltarTribute: no position".into()))?;

    let hex_key = player_pos.key();

    // Get the ruins token from the hex
    let token_id = state
        .map
        .hexes
        .get(&hex_key)
        .and_then(|h| h.ruins_token.as_ref())
        .map(|t| t.token_id.clone())
        .ok_or_else(|| ApplyError::InternalError("AltarTribute: no ruins token on hex".into()))?;

    // Look up the altar definition
    let altar = match mk_data::ruins_tokens::get_ruins_token(token_id.as_str()) {
        Some(mk_data::ruins_tokens::RuinsTokenDef::Altar(a)) => *a,
        _ => {
            return Err(ApplyError::InternalError(
                "AltarTribute: token is not an altar".into(),
            ));
        }
    };

    // Consume mana from the provided sources
    for source in mana_sources {
        card_play::consume_specific_mana_source(state, player_idx, source);
    }

    // Grant fame
    state.players[player_idx].fame += altar.fame;

    // Conquer the site
    if let Some(hex) = state.map.hexes.get_mut(&hex_key) {
        if let Some(ref mut site) = hex.site {
            site.is_conquered = true;
            site.owner = Some(state.players[player_idx].id.clone());
        }
        // Place shield token
        hex.shield_tokens.push(state.players[player_idx].id.clone());
        // Remove ruins token from hex and discard
        hex.ruins_token = None;
    }

    // Discard token to ruins pile
    state.ruins_tokens.discard.push(token_id);

    // Set flags
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    // Check for level-ups from fame gain
    crate::end_turn::process_level_ups_pub(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


// =============================================================================
// Banner assignment handlers
// =============================================================================

pub(super) fn apply_assign_banner(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    card_id: &CardId,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    // Validate hand index
    if hand_index >= player.hand.len() || player.hand[hand_index] != *card_id {
        return Err(ApplyError::InternalError(format!(
            "AssignBanner: hand_index {} invalid or card mismatch",
            hand_index
        )));
    }

    // Validate unit exists
    if !player.units.iter().any(|u| u.instance_id == *unit_instance_id) {
        return Err(ApplyError::InternalError(format!(
            "AssignBanner: unit '{}' not found",
            unit_instance_id.as_str()
        )));
    }

    // Remove card from hand, add to play area
    let card = player.hand.remove(hand_index);
    player.play_area.push(card);

    // Create banner attachment
    player.attached_banners.push(BannerAttachment {
        banner_id: card_id.clone(),
        unit_instance_id: unit_instance_id.clone(),
        is_used_this_round: false,
    });

    // Banner assignment is a free action — does NOT set HAS_TAKEN_ACTION

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_use_banner_courage(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    // Find the banner attachment
    let banner_idx = player
        .attached_banners
        .iter()
        .position(|b| {
            b.banner_id.as_str() == "banner_of_courage"
                && b.unit_instance_id == *unit_instance_id
                && !b.is_used_this_round
        })
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "UseBannerCourage: no unused courage banner on unit '{}'",
                unit_instance_id.as_str()
            ))
        })?;

    // Mark banner as used this round
    player.attached_banners[banner_idx].is_used_this_round = true;

    // Ready the unit
    let unit_idx = player
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "UseBannerCourage: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    player.units[unit_idx].state = UnitState::Ready;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_use_banner_fear(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    enemy_instance_id: &CombatInstanceId,
    attack_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    // Find the banner attachment
    let banner_idx = player
        .attached_banners
        .iter()
        .position(|b| {
            b.banner_id.as_str() == "banner_of_fear"
                && b.unit_instance_id == *unit_instance_id
                && !b.is_used_this_round
        })
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "UseBannerFear: no unused fear banner on unit '{}'",
                unit_instance_id.as_str()
            ))
        })?;

    // Mark banner as used this round
    player.attached_banners[banner_idx].is_used_this_round = true;

    // Spend the unit (cost of using fear)
    let unit_idx = player
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "UseBannerFear: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    player.units[unit_idx].state = UnitState::Spent;

    // Cancel the enemy attack
    let combat = state.combat.as_mut().ok_or_else(|| {
        ApplyError::InternalError("UseBannerFear: no combat".into())
    })?;

    let enemy = combat
        .enemies
        .iter_mut()
        .find(|e| e.instance_id == *enemy_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "UseBannerFear: enemy '{}' not found",
                enemy_instance_id.as_str()
            ))
        })?;

    if attack_index < enemy.attacks_cancelled.len() {
        enemy.attacks_cancelled[attack_index] = true;
    }

    // Grant +1 fame
    state.players[player_idx].fame += 1;
    crate::end_turn::process_level_ups_pub(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


/// Check if a unit's wound can be negated by Banner of Fortitude.
/// Returns true if the wound was negated (banner consumed).
pub fn try_negate_wound_with_fortitude(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> bool {
    let player = &mut state.players[player_idx];
    if let Some(attachment) = player.attached_banners.iter_mut().find(|b| {
        b.banner_id.as_str() == "banner_of_fortitude"
            && b.unit_instance_id == *unit_instance_id
            && !b.is_used_this_round
    }) {
        attachment.is_used_this_round = true;
        return true; // wound negated
    }
    false
}


// =============================================================================
// City commerce handlers
// =============================================================================

pub(super) fn apply_buy_artifact(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    // Apply shield influence bonus if needed
    apply_shield_influence_if_needed(state, player_idx, CITY_ARTIFACT_PURCHASE_COST)?;

    let player = &mut state.players[player_idx];

    if player.influence_points < CITY_ARTIFACT_PURCHASE_COST {
        return Err(ApplyError::InternalError("BuyArtifact: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= CITY_ARTIFACT_PURCHASE_COST;

    // Draw up to 2 from artifact deck
    let first = state.decks.artifact_deck.remove(0);
    if state.decks.artifact_deck.is_empty() {
        // Only 1 card in deck: auto-grant (no choice)
        state.players[player_idx].deck.insert(0, first);
    } else {
        // Draw second card, create pending selection
        let second = state.decks.artifact_deck.remove(0);
        let mut choices = ArrayVec::new();
        choices.push(first);
        choices.push(second);
        state.players[player_idx].pending.active =
            Some(mk_types::pending::ActivePending::ArtifactSelection(
                mk_types::pending::PendingArtifactSelection { choices, keep_count: 1 },
            ));
    }

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_buy_city_advanced_action(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
) -> Result<ApplyResult, ApplyError> {
    // Apply shield influence bonus if needed
    apply_shield_influence_if_needed(state, player_idx, CITY_AA_PURCHASE_COST)?;

    let player = &mut state.players[player_idx];

    if player.influence_points < CITY_AA_PURCHASE_COST {
        return Err(ApplyError::InternalError("BuyCityAA: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= CITY_AA_PURCHASE_COST;

    // Insert card at top of deed deck
    player.deck.insert(0, card_id.clone());

    // Take from main AA offer (replenishes from deck)
    take_from_offer(
        &mut state.offers.advanced_actions,
        &mut state.decks.advanced_action_deck,
        card_id.as_str(),
    );

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_buy_city_aa_from_deck(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    // Apply shield influence bonus if needed
    apply_shield_influence_if_needed(state, player_idx, CITY_AA_PURCHASE_COST)?;

    let player = &mut state.players[player_idx];

    if player.influence_points < CITY_AA_PURCHASE_COST {
        return Err(ApplyError::InternalError("BuyCityAAFromDeck: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= CITY_AA_PURCHASE_COST;

    // Pop top card from AA deck (blind draw)
    if state.decks.advanced_action_deck.is_empty() {
        return Err(ApplyError::InternalError("BuyCityAAFromDeck: AA deck empty".into()));
    }
    let card = state.decks.advanced_action_deck.remove(0);

    // Insert at top of deed deck
    state.players[player_idx].deck.insert(0, card);

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


pub(super) fn apply_add_elite_to_offer(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    // Apply shield influence bonus if needed
    apply_shield_influence_if_needed(state, player_idx, CITY_ELITE_UNIT_COST)?;

    let player = &mut state.players[player_idx];

    if player.influence_points < CITY_ELITE_UNIT_COST {
        return Err(ApplyError::InternalError("AddEliteToOffer: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= CITY_ELITE_UNIT_COST;

    // Pop from unit deck and add to unit offer
    if let Some(unit_id) = state.decks.unit_deck.pop() {
        state.offers.units.push(unit_id);
    }

    // Free action — does NOT set HAS_TAKEN_ACTION_THIS_TURN

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


// =============================================================================
// Shield influence + mana consumption helpers
// =============================================================================

/// Apply shield token influence bonus if the player is at a conquered city
/// and hasn't claimed it this turn. Only grants enough to cover the shortfall.
fn apply_shield_influence_if_needed(
    state: &mut GameState,
    player_idx: usize,
    cost: u32,
) -> Result<(), ApplyError> {
    let player = &mut state.players[player_idx];
    if player
        .flags
        .contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN)
    {
        return Ok(());
    }
    if player.influence_points >= cost {
        return Ok(());
    }

    // Find current hex and city shield bonus
    let pos = match player.position {
        Some(p) => p,
        None => return Ok(()),
    };
    let hex = match state.map.hexes.get(&pos.key()) {
        Some(h) => h,
        None => return Ok(()),
    };
    let is_conquered_city = hex
        .site
        .as_ref()
        .is_some_and(|s| s.site_type == SiteType::City && s.is_conquered);
    if !is_conquered_city {
        return Ok(());
    }

    let player_id = state.players[player_idx].id.clone();
    let shield_count = hex
        .shield_tokens
        .iter()
        .filter(|id| **id == player_id)
        .count() as u32;
    if shield_count == 0 {
        return Ok(());
    }

    // Grant just enough to cover shortfall (up to shield_count)
    let shortfall = cost - state.players[player_idx].influence_points;
    let bonus = shortfall.min(shield_count);
    state.players[player_idx].influence_points += bonus;
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN);

    Ok(())
}

pub(super) fn apply_select_reward(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
    unit_id: Option<&mk_types::ids::UnitId>,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    // Take the pending SiteRewardChoice
    let pending = player.pending.active.take().ok_or_else(|| {
        ApplyError::InternalError("SelectReward: no active pending".into())
    })?;

    let (reward, _reward_index) = match pending {
        ActivePending::SiteRewardChoice { reward, reward_index } => (reward, reward_index),
        _ => {
            return Err(ApplyError::InternalError(
                "SelectReward: active pending is not SiteRewardChoice".into(),
            ));
        }
    };

    match reward {
        SiteReward::Spell { count } => {
            // Move card to top of deed deck
            state.players[player_idx].deck.insert(0, card_id.clone());
            take_from_offer(
                &mut state.offers.spells,
                &mut state.decks.spell_deck,
                card_id.as_str(),
            );

            // If count > 1, re-queue remainder
            if count > 1 {
                queue_site_reward(state, player_idx, SiteReward::Spell { count: count - 1 });
            }
        }
        SiteReward::AdvancedAction { count } => {
            state.players[player_idx].deck.insert(0, card_id.clone());
            take_from_offer(
                &mut state.offers.advanced_actions,
                &mut state.decks.advanced_action_deck,
                card_id.as_str(),
            );

            if count > 1 {
                queue_site_reward(
                    state,
                    player_idx,
                    SiteReward::AdvancedAction { count: count - 1 },
                );
            }
        }
        SiteReward::Unit => {
            // Take the unit from the offer
            let uid = unit_id.ok_or_else(|| {
                ApplyError::InternalError("SelectReward: Unit reward but no unit_id".into())
            })?;
            let offer_idx = state.offers.units.iter().position(|u| u == uid)
                .ok_or_else(|| ApplyError::InternalError(
                    format!("SelectReward: unit {:?} not in offer", uid),
                ))?;
            state.offers.units.remove(offer_idx);

            // Create PlayerUnit and add to player
            let new_unit = mk_types::state::PlayerUnit {
                instance_id: mk_types::ids::UnitInstanceId::from(
                    format!("unit_{}", state.players[player_idx].units.len())
                ),
                unit_id: uid.clone(),
                level: mk_data::units::get_unit(uid.as_str()).map(|u| u.level).unwrap_or(1),
                state: UnitState::Ready,
                wounded: false,
                used_resistance_this_combat: false,
                used_ability_indices: Vec::new(),
                mana_token: None,
            };
            state.players[player_idx].units.push(new_unit);

            // Replenish unit offer from deck
            if !state.decks.unit_deck.is_empty() {
                let new_offer_unit = state.decks.unit_deck.remove(0);
                state.offers.units.push(new_offer_unit);
            }
        }
        _ => {
            return Err(ApplyError::InternalError(format!(
                "SelectReward: unexpected reward type: {:?}",
                reward
            )));
        }
    }

    // Promote next reward if any
    promote_site_reward(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}


// =============================================================================
// Site reward queueing & promotion
// =============================================================================

/// Queue a site reward for the player. Auto-grants immediate rewards (Fame, CrystalRoll,
/// Artifact) and queues choice rewards (Spell, AdvancedAction) as deferred.
pub(super) fn queue_site_reward(state: &mut GameState, player_idx: usize, reward: SiteReward) {
    match reward {
        SiteReward::Compound { rewards } => {
            // Flatten compound rewards — process each sub-reward
            for sub in rewards {
                queue_site_reward(state, player_idx, sub);
            }
        }
        SiteReward::Fame { amount } => {
            state.players[player_idx].fame += amount;
        }
        SiteReward::CrystalRoll { count } => {
            // Roll 0-5 mapping to R/B/G/W/Gold/Black.
            resolve_crystal_rolls(state, player_idx, count);
        }
        SiteReward::DungeonRoll => {
            // Roll a mana die: gold/black → Spell, basic color → Artifact.
            let roll = state.rng.next_int(0, 5) as usize;
            if roll >= 4 {
                // Gold or Black → Spell reward
                queue_site_reward(state, player_idx, SiteReward::Spell { count: 1 });
            } else {
                // Basic color → Artifact reward
                queue_site_reward(state, player_idx, SiteReward::Artifact { count: 1 });
            }
        }
        SiteReward::Artifact { count } => {
            // Draw count+1 from artifact deck, keep count, return rest to deck bottom.
            let deck_len = state.decks.artifact_deck.len() as u32;
            let draw_count = (count + 1).min(deck_len);
            if draw_count == 0 {
                // Empty deck — no reward
            } else if draw_count == 1 {
                // Only 1 card in deck — auto-grant (no choice)
                let artifact = state.decks.artifact_deck.remove(0);
                state.players[player_idx].deck.insert(0, artifact);
            } else {
                // Draw draw_count, keep count, return rest to bottom
                let mut choices = ArrayVec::<CardId, 4>::new();
                for _ in 0..draw_count {
                    choices.push(state.decks.artifact_deck.remove(0));
                }
                state.players[player_idx].pending.active = Some(
                    ActivePending::ArtifactSelection(mk_types::pending::PendingArtifactSelection {
                        choices,
                        keep_count: count as usize,
                    })
                );
            }
        }
        SiteReward::Spell { .. } | SiteReward::AdvancedAction { .. } | SiteReward::Unit => {
            // Auto-skip Unit if no units available in offer
            if matches!(reward, SiteReward::Unit) && state.offers.units.is_empty() {
                return;
            }

            // Queue as deferred reward
            let player = &mut state.players[player_idx];
            // Find existing Rewards deferred entry or create new one
            let mut found = false;
            for d in player.pending.deferred.iter_mut() {
                if let DeferredPending::Rewards(ref mut rewards) = d {
                    if !rewards.is_full() {
                        rewards.push(reward.clone());
                    }
                    found = true;
                    break;
                }
            }
            if !found {
                let mut arr = ArrayVec::<SiteReward, MAX_REWARDS>::new();
                arr.push(reward);
                if !player.pending.deferred.is_full() {
                    player.pending.deferred.push(DeferredPending::Rewards(arr));
                }
            }

            // If no active pending, promote immediately
            if player.pending.active.is_none() {
                promote_site_reward(state, player_idx);
            }
        }
    }
}


/// Promote the first deferred site reward to active pending.
pub(super) fn promote_site_reward(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];

    // Already have an active pending — don't overwrite
    if player.pending.active.is_some() {
        return;
    }

    // Find the first Rewards deferred entry and pop the first reward
    let mut reward_to_promote: Option<SiteReward> = None;
    let mut empty_deferred_idx: Option<usize> = None;

    for (i, d) in player.pending.deferred.iter_mut().enumerate() {
        if let DeferredPending::Rewards(ref mut rewards) = d {
            if !rewards.is_empty() {
                reward_to_promote = Some(rewards.remove(0));
                if rewards.is_empty() {
                    empty_deferred_idx = Some(i);
                }
                break;
            }
        }
    }

    // Clean up empty deferred entry
    if let Some(idx) = empty_deferred_idx {
        player.pending.deferred.remove(idx);
    }

    // Set as active pending
    if let Some(reward) = reward_to_promote {
        player.pending.active = Some(ActivePending::SiteRewardChoice {
            reward,
            reward_index: 0,
        });
    }
}


/// Roll crystal dice one at a time. Basic color → auto-grant crystal.
/// Gold → create CrystalRollColorChoice pending (player picks).
/// Black → +1 fame.
fn resolve_crystal_rolls(state: &mut GameState, player_idx: usize, count: u32) {
    let colors = [
        BasicManaColor::Red,
        BasicManaColor::Blue,
        BasicManaColor::Green,
        BasicManaColor::White,
    ];
    for i in 0..count {
        let roll = state.rng.next_int(0, 5) as usize;
        if roll < 4 {
            // Basic color → gain crystal of that color
            crate::mana::gain_crystal(&mut state.players[player_idx], colors[roll]);
        } else if roll == 4 {
            // Gold → player chooses color (if any color has room)
            let c = &state.players[player_idx].crystals;
            let max = crate::mana::MAX_CRYSTALS_PER_COLOR;
            if c.red < max || c.blue < max || c.green < max || c.white < max {
                state.players[player_idx].pending.active = Some(
                    ActivePending::CrystalRollColorChoice {
                        remaining_rolls: count - i - 1,
                    }
                );
                return; // Remaining rolls resume after choice
            } else {
                // All colors at max → fame +1 instead
                state.players[player_idx].fame += 1;
            }
        } else {
            // Black → +1 fame
            state.players[player_idx].fame += 1;
        }
    }
}

/// Handle player choosing a crystal color after a gold die roll.
pub(super) fn apply_resolve_crystal_roll_color(
    state: &mut GameState,
    player_idx: usize,
    color: BasicManaColor,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take().ok_or_else(|| {
        ApplyError::InternalError("ResolveCrystalRollColor: no active pending".into())
    })?;

    let remaining_rolls = match pending {
        ActivePending::CrystalRollColorChoice { remaining_rolls } => remaining_rolls,
        _ => {
            return Err(ApplyError::InternalError(
                "ResolveCrystalRollColor: active pending is not CrystalRollColorChoice".into(),
            ));
        }
    };

    crate::mana::gain_crystal(&mut state.players[player_idx], color);

    if remaining_rolls > 0 {
        resolve_crystal_rolls(state, player_idx, remaining_rolls);
    } else {
        promote_site_reward(state, player_idx);
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

/// Handle selecting an artifact from an ArtifactSelection pending.
pub(super) fn apply_select_artifact(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take().ok_or_else(|| {
        ApplyError::InternalError("SelectArtifact: no active pending".into())
    })?;

    let selection = match pending {
        ActivePending::ArtifactSelection(s) => s,
        _ => {
            return Err(ApplyError::InternalError(
                "SelectArtifact: active pending is not ArtifactSelection".into(),
            ));
        }
    };

    // Verify the chosen card is in the choices
    if !selection.choices.iter().any(|c| c == card_id) {
        return Err(ApplyError::InternalError(
            format!("SelectArtifact: card {:?} not in choices", card_id),
        ));
    }

    // Keep the selected card — add to top of deed deck
    state.players[player_idx].deck.insert(0, card_id.clone());

    // Return unchosen cards to artifact deck bottom
    for c in &selection.choices {
        if c != card_id {
            state.decks.artifact_deck.push(c.clone());
        }
    }

    // Promote next reward if any
    promote_site_reward(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

/// Forfeit a unit reward — skip it entirely.
pub(super) fn apply_forfeit_unit_reward(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take().ok_or_else(|| {
        ApplyError::InternalError("ForfeitUnitReward: no active pending".into())
    })?;

    match pending {
        ActivePending::SiteRewardChoice { reward: SiteReward::Unit, .. } => {}
        _ => {
            return Err(ApplyError::InternalError(
                "ForfeitUnitReward: active pending is not SiteRewardChoice(Unit)".into(),
            ));
        }
    }

    promote_site_reward(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

/// Disband an existing unit and take the reward unit.
pub(super) fn apply_disband_unit_for_reward(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    reward_unit_id: &mk_types::ids::UnitId,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take().ok_or_else(|| {
        ApplyError::InternalError("DisbandUnitForReward: no active pending".into())
    })?;

    match pending {
        ActivePending::SiteRewardChoice { reward: SiteReward::Unit, .. } => {}
        _ => {
            return Err(ApplyError::InternalError(
                "DisbandUnitForReward: active pending is not SiteRewardChoice(Unit)".into(),
            ));
        }
    }

    // Remove the unit being disbanded
    let player = &mut state.players[player_idx];
    let unit_idx = player.units.iter().position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| ApplyError::InternalError(
            format!("DisbandUnitForReward: unit {:?} not found", unit_instance_id),
        ))?;
    player.units.remove(unit_idx);

    // Take reward unit from offer
    let offer_idx = state.offers.units.iter().position(|u| u == reward_unit_id)
        .ok_or_else(|| ApplyError::InternalError(
            format!("DisbandUnitForReward: unit {:?} not in offer", reward_unit_id),
        ))?;
    state.offers.units.remove(offer_idx);

    // Create a PlayerUnit and add to player
    let level = mk_data::units::get_unit(reward_unit_id.as_str()).map(|u| u.level).unwrap_or(1);
    let new_unit = mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from(
            format!("unit_{}", state.players[player_idx].units.len())
        ),
        unit_id: reward_unit_id.clone(),
        level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    };
    state.players[player_idx].units.push(new_unit);

    // Replenish unit offer from deck
    if !state.decks.unit_deck.is_empty() {
        let new_offer_unit = state.decks.unit_deck.remove(0);
        state.offers.units.push(new_offer_unit);
    }

    // Promote next reward
    promote_site_reward(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_resolve_glade_wound(
    state: &mut GameState,
    player_idx: usize,
    choice: &GladeWoundChoice,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    match choice {
        GladeWoundChoice::Hand => {
            if let Some(idx) = player.hand.iter().position(|c| c.as_str() == "wound") {
                player.hand.remove(idx);
            }
        }
        GladeWoundChoice::Discard => {
            if let Some(idx) = player.discard.iter().position(|c| c.as_str() == "wound") {
                player.discard.remove(idx);
            }
        }
        GladeWoundChoice::Skip => {
            // Player chose to skip — no wound removed
        }
    }

    // Clear pending
    player.pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}

