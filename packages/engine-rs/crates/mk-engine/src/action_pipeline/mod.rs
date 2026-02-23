//! Execution pipeline — `apply_legal_action()` dispatch.
//!
//! Takes a `LegalAction` and applies it to the game state, returning an
//! `ApplyResult` on success or `ApplyError` on failure. Every action from
//! `enumerate_legal_actions()` MUST succeed — the contract is CI-gated.

use mk_types::enums::*;
use mk_types::events::{CardPlayMode, GameEvent};
use mk_types::ids::CombatInstanceId;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::undo::UndoStack;

mod choices;
mod combat_actions;
mod combat_end;
mod conversions;
mod sites;
mod skills;
mod skills_complex;
mod skills_interactive;
mod tactics;
mod turn_flow;
mod units;

// Public re-exports (used outside this crate or as the module's public API)
pub use combat_end::{expire_modifiers_turn_end, expire_modifiers_turn_start, expire_modifiers_round_end};
pub use sites::try_negate_wound_with_fortitude;
pub use units::apply_select_enemy_effects_pub;
pub use skills::{
    apply_power_of_pain_pub, apply_i_dont_give_a_damn_pub,
    apply_who_needs_magic_pub, apply_universal_power_pub,
};
pub use skills_interactive::place_skill_in_center_pub;

// Crate-internal re-exports (used by other modules within this crate)
pub(crate) use skills::push_universal_power_modifiers;
pub(crate) use skills_complex::{
    has_shapeshift_eligible_cards, has_strippable_attributes_pub,
    has_polarization_options,
    apply_dueling_target_pub,
    execute_invocation, execute_polarization,
    setup_curse_mode, execute_curse_mode, execute_curse_attack_index,
    execute_forked_lightning_target,
    setup_know_your_prey_options, execute_know_your_prey_option,
    execute_puppet_master_select_token, execute_puppet_master_use_mode,
    execute_shapeshift_card_select, execute_shapeshift_type_select,
    execute_regenerate,
};
pub(crate) use skills_interactive::{
    execute_ritual_of_pain_discard, execute_natures_vengeance_target,
    execute_mana_overload_color_select, execute_source_opening_die_select,
};

// =============================================================================
// Error & result types
// =============================================================================

/// Error from applying a legal action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApplyError {
    /// The action set was computed at a different epoch than the current state.
    StaleActionSet { expected: u64, got: u64 },
    /// Internal error — should never happen for properly enumerated actions.
    InternalError(String),
}

/// Result of applying a legal action.
#[derive(Debug, Clone)]
pub struct ApplyResult {
    /// Whether the caller should re-enumerate legal actions.
    pub needs_reenumeration: bool,
    /// Whether the game has ended.
    pub game_ended: bool,
    /// Events emitted by this action (for replay recording / activity feed).
    pub events: Vec<GameEvent>,
}

// =============================================================================
// Public API
// =============================================================================

/// Apply a legal action to the game state.
///
/// # Epoch check
/// The `expected_epoch` must match `state.action_epoch`. If they differ,
/// the action set is stale and the caller must re-enumerate.
///
/// # Contract
/// For every action produced by `enumerate_legal_actions()`, this function
/// MUST return `Ok(...)`. A failure is a contract violation (CI-gated test).
pub fn apply_legal_action(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
    player_idx: usize,
    action: &LegalAction,
    expected_epoch: u64,
) -> Result<ApplyResult, ApplyError> {
    // Epoch check
    if state.action_epoch != expected_epoch {
        return Err(ApplyError::StaleActionSet {
            expected: state.action_epoch,
            got: expected_epoch,
        });
    }

    // Capture pre-action state for event generation
    let player_id = state.players[player_idx].id.clone();
    let pre_position = state.players[player_idx].position;
    let pre_fame = state.players[player_idx].fame;
    let pre_combat = state.combat.is_some();
    let pre_level = state.players[player_idx].level;
    let pre_wound_count = state.players[player_idx]
        .hand
        .iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    let pre_crystals = state.players[player_idx].crystals;
    let pre_defeated: Vec<CombatInstanceId> = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .filter(|e| e.is_defeated)
                .map(|e| e.instance_id.clone())
                .collect()
        })
        .unwrap_or_default();

    let mut events = Vec::new();

    let mut result = match action {
        LegalAction::SelectTactic { tactic_id } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            events.push(GameEvent::TacticSelected {
                player_id: player_id.clone(),
                tactic_id: tactic_id.clone(),
            });
            tactics::apply_select_tactic(state, player_idx, tactic_id)?
        }

        LegalAction::PlayCardBasic { hand_index, card_id } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            events.push(GameEvent::CardPlayed {
                player_id: player_id.clone(),
                card_id: card_id.clone(),
                mode: CardPlayMode::Basic,
            });
            turn_flow::apply_play_card(state, player_idx, *hand_index, false, None)?
        }

        LegalAction::PlayCardPowered {
            hand_index,
            card_id,
            mana_color,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            events.push(GameEvent::CardPlayed {
                player_id: player_id.clone(),
                card_id: card_id.clone(),
                mode: CardPlayMode::Powered,
            });
            turn_flow::apply_play_card(state, player_idx, *hand_index, true, Some(*mana_color))?
        }

        LegalAction::PlayCardSideways {
            hand_index,
            card_id,
            sideways_as,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            events.push(GameEvent::CardPlayed {
                player_id: player_id.clone(),
                card_id: card_id.clone(),
                mode: CardPlayMode::Sideways(*sideways_as),
            });
            turn_flow::apply_play_card_sideways(state, player_idx, *hand_index, *sideways_as)?
        }

        LegalAction::Move { target, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            turn_flow::apply_move(state, player_idx, *target)?
        }

        LegalAction::Explore { direction } => {
            // Irreversible: set checkpoint (tile reveal + RNG)
            undo_stack.set_checkpoint();
            turn_flow::apply_explore(state, player_idx, *direction)?
        }

        LegalAction::ChallengeRampaging { hex } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            turn_flow::apply_challenge_rampaging(state, player_idx, *hex)?
        }

        LegalAction::DeclareBlock {
            enemy_instance_id,
            attack_index,
        } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            combat_actions::apply_declare_block(state, player_idx, enemy_instance_id, *attack_index)?
        }

        LegalAction::InitiateAttack { attack_type } => {
            // Reversible: save snapshot (enters SubsetSelection, undo returns to combat)
            undo_stack.save(state);
            tactics::apply_initiate_attack(state, player_idx, *attack_type)?
        }

        LegalAction::ResolveChoice { choice_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            events.push(GameEvent::ChoiceResolved {
                player_id: player_id.clone(),
                choice_index: *choice_index,
            });
            choices::apply_resolve_choice(state, player_idx, *choice_index)?
        }

        LegalAction::ResolveDiscardForBonus {
            choice_index,
            discard_count,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            choices::apply_resolve_discard_for_bonus(state, player_idx, *choice_index, *discard_count)?
        }

        LegalAction::ResolveDecompose { hand_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            choices::apply_resolve_decompose(state, player_idx, *hand_index)?
        }

        LegalAction::ResolveDiscardForCrystal { .. } => {
            // Handled by ChoiceResolution::DiscardForCrystalSelect now
            return Err(ApplyError::InternalError(
                "ResolveDiscardForCrystal should use Choice path".to_string(),
            ));
        }

        LegalAction::SpendMoveOnCumbersome {
            enemy_instance_id,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            combat_actions::apply_spend_move_on_cumbersome(state, player_idx, enemy_instance_id)?
        }

        LegalAction::ResolveTacticDecision { data } => {
            // Irreversible: uses RNG for shuffles
            undo_stack.set_checkpoint();
            tactics::apply_resolve_tactic_decision(state, player_idx, data)?
        }

        LegalAction::ActivateTactic => {
            // Irreversible: changes game state significantly
            undo_stack.set_checkpoint();
            tactics::apply_activate_tactic(state, player_idx)?
        }

        LegalAction::InitiateManaSearch => {
            // Reversible: save snapshot (enters SubsetSelection, undo returns to normal turn)
            undo_stack.save(state);
            tactics::apply_initiate_mana_search(state, player_idx)?
        }

        LegalAction::EnterSite => {
            // Irreversible: draws enemy tokens (RNG)
            undo_stack.set_checkpoint();
            if let Some(hex) = state.players[player_idx].position {
                events.push(GameEvent::SiteEntered {
                    player_id: player_id.clone(),
                    hex,
                });
            }
            sites::apply_enter_site(state, player_idx)?
        }

        LegalAction::InteractSite { healing } => {
            // Irreversible: wound removal + influence deduction
            undo_stack.set_checkpoint();
            sites::apply_interact_site(state, player_idx, *healing)?
        }

        LegalAction::PlunderSite => {
            // Irreversible: burns site + reputation loss
            undo_stack.set_checkpoint();
            sites::apply_plunder_site(state, player_idx)?
        }

        LegalAction::DeclinePlunder => {
            // Reversible: just clears pending
            undo_stack.save(state);
            sites::apply_decline_plunder(state, player_idx)?
        }

        LegalAction::ResolveGladeWound { choice } => {
            // Reversible: removes wound from hand or discard
            undo_stack.save(state);
            sites::apply_resolve_glade_wound(state, player_idx, choice)?
        }

        LegalAction::RecruitUnit {
            unit_id,
            offer_index: _,
            influence_cost,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            units::apply_recruit_unit(state, player_idx, unit_id, *influence_cost)?
        }

        LegalAction::ActivateUnit {
            unit_instance_id,
            ability_index,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            units::apply_activate_unit(state, player_idx, unit_instance_id, *ability_index)?
        }

        LegalAction::AssignDamageToHero {
            enemy_index,
            attack_index,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            combat_actions::apply_assign_damage_to_hero(state, player_idx, *enemy_index, *attack_index)?
        }

        LegalAction::AssignDamageToUnit {
            enemy_index,
            attack_index,
            unit_instance_id,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            combat_actions::apply_assign_damage_to_unit(state, player_idx, *enemy_index, *attack_index, unit_instance_id)?
        }

        LegalAction::ChooseLevelUpReward {
            skill_index,
            from_common_pool,
            advanced_action_id,
        } => {
            // Irreversible: affects offers and skill pools
            undo_stack.set_checkpoint();
            choices::apply_choose_level_up_reward(
                state,
                player_idx,
                *skill_index,
                *from_common_pool,
                advanced_action_id,
            )?
        }

        LegalAction::ResolveCrystalJoyReclaim { discard_index } => {
            undo_stack.set_checkpoint();
            choices::apply_resolve_crystal_joy_reclaim(state, player_idx, *discard_index)?
        }

        LegalAction::ResolveSteadyTempoDeckPlacement { place } => {
            undo_stack.set_checkpoint();
            choices::apply_resolve_steady_tempo(state, player_idx, *place)?
        }

        LegalAction::ResolveBannerProtection { remove_all } => {
            undo_stack.set_checkpoint();
            choices::apply_resolve_banner_protection(state, player_idx, *remove_all)?
        }

        LegalAction::EndTurn => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            events.push(GameEvent::TurnEnded {
                player_id: player_id.clone(),
            });
            turn_flow::apply_end_turn(state, player_idx)?
        }

        LegalAction::DeclareRest => {
            // Reversible: save snapshot
            undo_stack.save(state);
            turn_flow::apply_declare_rest(state, player_idx)
        }

        LegalAction::CompleteRest { discard_hand_index } => {
            // Reversible: save snapshot (no RNG involved).
            undo_stack.save(state);
            turn_flow::apply_complete_rest(state, player_idx, *discard_hand_index)?
        }

        LegalAction::EndCombatPhase => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            combat_actions::apply_end_combat_phase(state, player_idx)?
        }

        LegalAction::UseSkill { skill_id } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            skills::apply_use_skill(state, player_idx, skill_id)?
        }

        LegalAction::ReturnInteractiveSkill { skill_id } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            skills_interactive::apply_return_interactive_skill(state, player_idx, skill_id)?
        }

        LegalAction::SubsetSelect { index } => {
            // No undo save: only mutates pending.active.selected
            tactics::apply_subset_select(state, player_idx, *index)?
        }

        LegalAction::SubsetConfirm => {
            // Irreversible: RNG consumed by shuffle
            undo_stack.set_checkpoint();
            tactics::apply_subset_confirm(state, player_idx)?
        }

        LegalAction::AnnounceEndOfRound => {
            // Irreversible: affects game flow for all players
            undo_stack.set_checkpoint();
            turn_flow::apply_announce_end_of_round(state, player_idx)?
        }

        LegalAction::Undo => {
            let r = turn_flow::apply_undo(state, undo_stack)?;
            events.push(GameEvent::Undone {
                player_id: player_id.clone(),
            });
            r
        }

        LegalAction::ResolveSourceOpeningReroll { reroll } => {
            // Irreversible: RNG may be consumed
            undo_stack.set_checkpoint();
            skills_interactive::apply_resolve_source_opening_reroll(state, player_idx, *reroll)?
        }

        LegalAction::ResolveTraining { selection_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            choices::apply_resolve_training(state, player_idx, *selection_index)?
        }

        LegalAction::ResolveBookOfWisdom { selection_index } => {
            undo_stack.save(state);
            choices::apply_resolve_book_of_wisdom(state, player_idx, *selection_index)?
        }

        LegalAction::ResolveTomeOfAllSpells { selection_index } => {
            undo_stack.save(state);
            choices::apply_resolve_tome_of_all_spells(state, player_idx, *selection_index)?
        }

        LegalAction::ResolveCircletOfProficiency { selection_index } => {
            undo_stack.save(state);
            choices::apply_resolve_circlet_of_proficiency(state, player_idx, *selection_index)?
        }

        LegalAction::ResolveMaximalEffect { hand_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            choices::apply_resolve_maximal_effect(state, player_idx, *hand_index)?
        }

        LegalAction::ResolveMeditation {
            selection_index,
            place_on_top,
        } => {
            undo_stack.save(state);
            choices::apply_resolve_meditation(state, player_idx, *selection_index, *place_on_top)?
        }

        LegalAction::MeditationDoneSelecting => {
            undo_stack.save(state);
            choices::apply_meditation_done_selecting(state, player_idx)?
        }

        LegalAction::ProposeCooperativeAssault {
            hex_coord,
            invited_player_idxs,
            distribution,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            crate::cooperative_assault::apply_propose(
                state,
                player_idx,
                *hex_coord,
                invited_player_idxs,
                distribution,
            )?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            }
        }

        LegalAction::RespondToCooperativeProposal { accept } => {
            // Irreversible: RNG shuffle on agreement
            undo_stack.set_checkpoint();
            crate::cooperative_assault::apply_respond(state, player_idx, *accept)?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            }
        }

        LegalAction::CancelCooperativeProposal => {
            // Reversible: save snapshot
            undo_stack.save(state);
            crate::cooperative_assault::apply_cancel(state, player_idx)?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            }
        }

        LegalAction::BuySpell { card_id, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            sites::apply_buy_spell(state, player_idx, card_id)?
        }

        LegalAction::LearnAdvancedAction { card_id, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            sites::apply_learn_advanced_action(state, player_idx, card_id)?
        }

        LegalAction::BurnMonastery => {
            // Irreversible: RNG consumed for enemy draw
            undo_stack.set_checkpoint();
            sites::apply_burn_monastery(state, player_idx)?
        }

        LegalAction::SelectReward { card_id, unit_id, .. } => {
            // Irreversible: modifies offers
            undo_stack.set_checkpoint();
            sites::apply_select_reward(state, player_idx, card_id, unit_id.as_ref())?
        }

        LegalAction::AltarTribute { mana_sources } => {
            // Irreversible: consumes mana, grants fame
            undo_stack.set_checkpoint();
            sites::apply_altar_tribute(state, player_idx, mana_sources)?
        }

        LegalAction::AssignBanner {
            hand_index,
            card_id,
            unit_instance_id,
        } => {
            // Free action: save snapshot (reversible)
            undo_stack.save(state);
            sites::apply_assign_banner(state, player_idx, *hand_index, card_id, unit_instance_id)?
        }

        LegalAction::UseBannerCourage { unit_instance_id } => {
            // Free action: save snapshot (reversible)
            undo_stack.save(state);
            sites::apply_use_banner_courage(state, player_idx, unit_instance_id)?
        }

        LegalAction::UseBannerFear {
            unit_instance_id,
            enemy_instance_id,
            attack_index,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            sites::apply_use_banner_fear(state, player_idx, unit_instance_id, enemy_instance_id, *attack_index)?
        }

        LegalAction::ConvertMoveToAttack {
            move_points,
            attack_type,
        } => {
            undo_stack.save(state);
            conversions::apply_convert_move_to_attack(state, player_idx, *move_points, *attack_type)?
        }

        LegalAction::ConvertInfluenceToBlock {
            influence_points,
            element,
        } => {
            undo_stack.save(state);
            conversions::apply_convert_influence_to_block(state, player_idx, *influence_points, *element)?
        }

        LegalAction::PayHeroesAssaultInfluence => {
            undo_stack.save(state);
            conversions::apply_pay_heroes_assault_influence(state, player_idx)?
        }

        LegalAction::PayThugsDamageInfluence { unit_instance_id } => {
            undo_stack.save(state);
            conversions::apply_pay_thugs_damage_influence(state, player_idx, unit_instance_id)?
        }

        LegalAction::ResolveUnitMaintenance {
            unit_instance_id,
            keep_unit,
            crystal_color,
            new_mana_token_color,
        } => {
            undo_stack.set_checkpoint();
            conversions::apply_resolve_unit_maintenance(
                state,
                player_idx,
                unit_instance_id,
                *keep_unit,
                *crystal_color,
                *new_mana_token_color,
            )?
        }

        LegalAction::ResolveHexCostReduction { coordinate } => {
            undo_stack.save(state);
            conversions::apply_resolve_hex_cost_reduction(state, player_idx, *coordinate)?
        }

        LegalAction::ResolveTerrainCostReduction { terrain } => {
            undo_stack.save(state);
            conversions::apply_resolve_terrain_cost_reduction(state, player_idx, *terrain)?
        }

        LegalAction::ResolveCrystalRollColor { color } => {
            // Irreversible: RNG consumed
            undo_stack.set_checkpoint();
            sites::apply_resolve_crystal_roll_color(state, player_idx, *color)?
        }

        LegalAction::SelectArtifact { card_id } => {
            // Irreversible: modifies offers
            undo_stack.set_checkpoint();
            sites::apply_select_artifact(state, player_idx, card_id)?
        }

        LegalAction::ForfeitUnitReward => {
            undo_stack.set_checkpoint();
            sites::apply_forfeit_unit_reward(state, player_idx)?
        }

        LegalAction::DisbandUnitForReward {
            unit_instance_id,
            reward_unit_id,
        } => {
            undo_stack.set_checkpoint();
            sites::apply_disband_unit_for_reward(state, player_idx, unit_instance_id, reward_unit_id)?
        }
    };

    // Post-action event generation based on state deltas
    let post_position = state.players[player_idx].position;
    if post_position != pre_position {
        if let (Some(from), Some(to)) = (pre_position, post_position) {
            events.push(GameEvent::PlayerMoved {
                player_id: player_id.clone(),
                from,
                to,
            });
        }
    }

    // Detect combat start/end
    let post_combat = state.combat.is_some();
    if !pre_combat && post_combat {
        if let Some(hex) = post_position {
            events.push(GameEvent::CombatStarted {
                player_id: player_id.clone(),
                hex,
            });
        }
    } else if pre_combat && !post_combat {
        events.push(GameEvent::CombatEnded {
            player_id: player_id.clone(),
        });
    }

    // Detect fame gain
    let post_fame = state.players[player_idx].fame;
    if post_fame > pre_fame {
        events.push(GameEvent::FameGained {
            player_id: player_id.clone(),
            amount: post_fame - pre_fame,
        });
    }

    // Detect wound gain
    let post_wound_count = state.players[player_idx]
        .hand
        .iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    for _ in pre_wound_count..post_wound_count {
        events.push(GameEvent::WoundTaken {
            player_id: player_id.clone(),
        });
    }

    // Detect level up
    let post_level = state.players[player_idx].level;
    if post_level > pre_level {
        events.push(GameEvent::LevelUp {
            player_id: player_id.clone(),
            new_level: post_level,
        });
    }

    // Detect enemy defeats
    if let Some(combat) = &state.combat {
        for enemy in &combat.enemies {
            if enemy.is_defeated && !pre_defeated.contains(&enemy.instance_id) {
                events.push(GameEvent::EnemyDefeated {
                    player_id: player_id.clone(),
                    enemy_id: enemy.enemy_id.clone(),
                });
            }
        }
    }

    // Detect crystal gains
    let post_crystals = state.players[player_idx].crystals;
    for (color, pre, post) in [
        (BasicManaColor::Red, pre_crystals.red, post_crystals.red),
        (BasicManaColor::Blue, pre_crystals.blue, post_crystals.blue),
        (BasicManaColor::Green, pre_crystals.green, post_crystals.green),
        (BasicManaColor::White, pre_crystals.white, post_crystals.white),
    ] {
        for _ in pre..post {
            events.push(GameEvent::CrystalGained {
                player_id: player_id.clone(),
                color,
            });
        }
    }

    // Detect game end
    if result.game_ended {
        events.push(GameEvent::GameEnded {
            reason: "game_over".to_string(),
        });
    }

    // Merge events: action-specific events first, then delta-detected events
    if result.events.is_empty() {
        result.events = events;
    } else {
        let mut merged = events;
        merged.append(&mut result.events);
        result.events = merged;
    }

    // Increment epoch after every action
    state.action_epoch += 1;

    Ok(result)
}

/// Generate the initial batch of events for a newly created game.
///
/// Called once after `create_solo_game()` + `place_initial_tiles()` to produce
/// the first set of events (GameStarted, TurnStarted) that go into the first
/// replay frame.
pub fn initial_events(state: &GameState, seed: u32, hero: Hero) -> Vec<GameEvent> {
    let mut events = Vec::new();
    events.push(GameEvent::GameStarted { seed, hero });
    if let Some(player) = state.players.first() {
        events.push(GameEvent::TurnStarted {
            player_id: player.id.clone(),
            round: state.round,
            time_of_day: state.time_of_day,
        });
    }
    events
}

// =============================================================================
// Gap 1: Convert Move to Attack / Influence to Block
// =============================================================================

// Conversion functions delegated to conversions module

// =============================================================================
// Tests
// =============================================================================

// Test-only re-exports: private helper functions used directly in tests
#[cfg(test)]
use combat_actions::resolve_soul_harvester_crystals;
#[cfg(test)]
use skills_interactive::{init_master_of_chaos_if_needed, rotate_clockwise};
#[cfg(test)]
use sites::{queue_site_reward, promote_site_reward};


#[cfg(test)]
mod tests;
