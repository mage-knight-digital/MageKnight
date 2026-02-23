//! Site interactions: enter, interact, plunder, commerce, banners, rewards.

use mk_data::enemy_piles::{draw_enemy_token, enemy_id_from_token};
use mk_data::offers::{take_from_monastery_offer, take_from_offer};
use mk_data::sites::{
    BURN_MONASTERY_REP_PENALTY, MONASTERY_AA_PURCHASE_COST,
    SPELL_PURCHASE_COST,
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
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.influence_points < SPELL_PURCHASE_COST {
        return Err(ApplyError::InternalError("BuySpell: insufficient influence".into()));
    }

    // Deduct influence
    player.influence_points -= SPELL_PURCHASE_COST;

    // Insert card at top of deed deck
    player.deck.insert(0, card_id.clone());

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


pub(super) fn apply_select_reward(
    state: &mut GameState,
    player_idx: usize,
    card_id: &CardId,
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
            // Simplified: Gold die → Red crystal, Black → +1 fame.
            // Roll 0-5 mapping to R/B/G/W/Gold/Black.
            for _ in 0..count {
                let roll = state.rng.next_int(0, 5) as usize;
                let colors = [
                    BasicManaColor::Red,
                    BasicManaColor::Blue,
                    BasicManaColor::Green,
                    BasicManaColor::White,
                ];
                if roll < 4 {
                    // Basic color → gain crystal of that color
                    crate::mana::gain_crystal(&mut state.players[player_idx], colors[roll]);
                } else if roll == 4 {
                    // Gold → Red crystal
                    crate::mana::gain_crystal(
                        &mut state.players[player_idx],
                        BasicManaColor::Red,
                    );
                } else {
                    // Black → +1 fame
                    state.players[player_idx].fame += 1;
                }
            }
        }
        SiteReward::Artifact { count } => {
            // Draw from artifact deck to top of deed deck
            for _ in 0..count {
                if !state.decks.artifact_deck.is_empty() {
                    let artifact = state.decks.artifact_deck.remove(0);
                    state.players[player_idx].deck.insert(0, artifact);
                }
            }
        }
        SiteReward::Spell { .. } | SiteReward::AdvancedAction { .. } => {
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
        SiteReward::Unit => {
            // Unit rewards: not yet implemented (would need unit offer selection)
            // For now, auto-skip
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

