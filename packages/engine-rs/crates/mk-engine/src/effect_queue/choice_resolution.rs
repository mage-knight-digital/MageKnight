//! Resolution of pending choices and related public APIs.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::pending::{
    ActivePending, ChoiceResolution, ContinuationEntry, PeacefulMomentOption,
    PendingChoice, EffectMode,
};
use mk_types::state::*;

use super::{DrainResult, EffectQueue, QueuedEffect, ResolveResult, WOUND_CARD_ID};
use super::spells::{
    execute_free_recruit, execute_mana_claim_mode, execute_possess_enemy,
    execute_sacrifice_pair, resolve_mana_radiance,
    resolve_ready_units_budget_step,
    resolve_wings_of_night_step, setup_mana_claim_mode_choice,
};
use super::utils::*;

/// Error from resolving a pending choice.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResolveChoiceError {
    /// No pending choice active for this player.
    NoPendingChoice,
    /// Choice index out of bounds.
    InvalidChoiceIndex,
    /// Internal error during resolution.
    InternalError(String),
}

/// Resolve a pending choice by picking one of the available options.
///
/// The chosen option is pushed into a new effect queue along with any
/// continuation effects, then drained. If another choice emerges,
/// the pending state is updated again.
pub fn resolve_pending_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<(), ResolveChoiceError> {
    // Extract the pending choice
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or(ResolveChoiceError::NoPendingChoice)?;

    let choice = match pending {
        ActivePending::Choice(c) => c,
        other => {
            // Put it back — wrong pending type
            state.players[player_idx].pending.active = Some(other);
            return Err(ResolveChoiceError::NoPendingChoice);
        }
    };

    if choice_index >= choice.options.len() {
        // Put the choice back
        state.players[player_idx].pending.active = Some(ActivePending::Choice(choice));
        return Err(ResolveChoiceError::InvalidChoiceIndex);
    }

    let chosen_effect = choice.options[choice_index].clone();
    let source_card_id = choice.card_id.clone();
    let resolution = choice.resolution.clone();

    // Apply resolution-specific side-effects before enqueueing the chosen effect
    match &resolution {
        ChoiceResolution::Standard => {}
        ChoiceResolution::CrystallizeConsume => {
            // Consume a mana source (token preferred, die fallback) matching the chosen color
            if let CardEffect::GainCrystal {
                color: Some(basic_color),
            } = &chosen_effect
            {
                let player = &mut state.players[player_idx];
                // Try token first
                if let Some(idx) = player
                    .pure_mana
                    .iter()
                    .position(|t| to_basic_mana_color(t.color) == Some(*basic_color))
                {
                    player.pure_mana.remove(idx);
                } else if let Some(source_info) =
                    super::multi_step::find_crystallizable_die(state, player_idx, *basic_color)
                {
                    // Fall back to source die
                    crate::card_play::consume_specific_mana_source(
                        state,
                        player_idx,
                        &source_info,
                    );
                }
            }
        }
        ChoiceResolution::DiscardThenContinue { eligible_indices } => {
            // Discard the card at the eligible index corresponding to the choice
            if choice_index < eligible_indices.len() {
                let hand_idx = eligible_indices[choice_index];
                let player = &mut state.players[player_idx];
                if hand_idx < player.hand.len() {
                    let discarded = player.hand.remove(hand_idx);
                    player.discard.push(discarded);
                    player
                        .flags
                        .insert(PlayerFlags::DISCARDED_CARD_THIS_TURN);
                }
            }
        }
        ChoiceResolution::ManaDrawTakeDie {
            die_id,
            tokens_per_die: _,
            remaining_dice: _,
        } => {
            // Mark the die as taken by this player, set its color from the chosen effect
            if let CardEffect::GainMana { color, .. } = &chosen_effect {
                let player_id = state.players[player_idx].id.clone();
                if let Some(die) = state.source.dice.iter_mut().find(|d| d.id == *die_id) {
                    die.taken_by_player_id = Some(player_id);
                    die.color = *color;
                }
                // Track as mana draw die
                state.players[player_idx]
                    .mana_draw_die_ids
                    .push(die_id.clone());
            }
        }
        ChoiceResolution::BoostTarget {
            eligible_hand_indices,
        } => {
            // Move the selected card from hand to play_area
            if choice_index < eligible_hand_indices.len() {
                let hand_idx = eligible_hand_indices[choice_index];
                let player = &mut state.players[player_idx];
                if hand_idx < player.hand.len() {
                    let card = player.hand.remove(hand_idx);
                    player.play_area.push(card);
                }
            }
        }
        ChoiceResolution::ReadyUnitTarget {
            eligible_unit_indices,
        } => {
            // Ready the unit at the selected index
            if choice_index < eligible_unit_indices.len() {
                let unit_idx = eligible_unit_indices[choice_index];
                let player = &mut state.players[player_idx];
                if unit_idx < player.units.len() {
                    player.units[unit_idx].state = UnitState::Ready;
                }
            }
        }
        ChoiceResolution::HealUnitTarget {
            eligible_unit_indices,
        } => {
            // Heal the wounded unit at the selected index
            if choice_index < eligible_unit_indices.len() {
                let unit_idx = eligible_unit_indices[choice_index];
                let player = &mut state.players[player_idx];
                if unit_idx < player.units.len() {
                    player.units[unit_idx].wounded = false;
                }
            }
        }
        ChoiceResolution::PureMagicConsume { token_colors } => {
            // Consume a mana token of the color at token_colors[choice_index]
            if choice_index < token_colors.len() {
                let color = token_colors[choice_index];
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == color) {
                    player.pure_mana.remove(idx);
                }
            }
        }
        ChoiceResolution::UniversalPowerMana { available_colors } => {
            // Consume the basic mana token of the chosen color and push modifiers.
            if choice_index < available_colors.len() {
                let color = available_colors[choice_index];
                let mana_color = ManaColor::from(color);
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == mana_color) {
                    player.pure_mana.remove(idx);
                }
                // Push Universal Power modifiers via the action_pipeline helper
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("goldyx_universal_power")
                });
                crate::action_pipeline::push_universal_power_modifiers(
                    state, player_idx, &skill_id, color,
                );
            }
        }
        ChoiceResolution::SecretWaysLake => {
            // Choice 1 = pay Blue mana for lake modifiers. Choice 0 = decline (Noop).
            if choice_index == 1 {
                // Consume 1 Blue mana: token > crystal > die
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == ManaColor::Blue) {
                    player.pure_mana.remove(idx);
                } else if player.crystals.blue > 0 {
                    player.crystals.blue -= 1;
                    player.spent_crystals_this_turn.blue += 1;
                } else if let Some(die) = state.source.dice.iter_mut().find(|d| {
                    d.color == ManaColor::Blue && !d.is_depleted && d.taken_by_player_id.is_none()
                }) {
                    die.taken_by_player_id = Some(state.players[player_idx].id.clone());
                    die.is_depleted = true;
                }
            }
        }
        ChoiceResolution::RegenerateMana { sources, bonus_color } => {
            // Consume the specific mana source, remove wound, conditionally draw
            if choice_index < sources.len() {
                let source = &sources[choice_index];
                crate::action_pipeline::execute_regenerate(state, player_idx, source, *bonus_color)
                    .map_err(|e| ResolveChoiceError::InternalError(format!("{:?}", e)))?;
            }
        }
        ChoiceResolution::DuelingTarget { eligible_enemy_ids } => {
            // Target the chosen enemy for dueling
            if choice_index < eligible_enemy_ids.len() {
                let enemy_id = eligible_enemy_ids[choice_index].clone();
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("wolfhawk_dueling")
                });
                crate::action_pipeline::apply_dueling_target_pub(
                    state, player_idx, &skill_id, &enemy_id,
                );
            }
        }
        ChoiceResolution::InvocationDiscard { ref options } => {
            if choice_index < options.len() {
                let opt = options[choice_index].clone();
                crate::action_pipeline::execute_invocation(state, player_idx, &opt);
            }
        }
        ChoiceResolution::PolarizationConvert { ref options } => {
            if choice_index < options.len() {
                let opt = options[choice_index].clone();
                crate::action_pipeline::execute_polarization(state, player_idx, &opt);
            }
        }
        ChoiceResolution::CurseTarget { ref eligible_enemy_ids } => {
            if choice_index < eligible_enemy_ids.len() {
                let enemy_id = eligible_enemy_ids[choice_index].clone();
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("krang_curse")
                });
                crate::action_pipeline::setup_curse_mode(state, player_idx, &skill_id, &enemy_id);
            }
        }
        ChoiceResolution::CurseMode { ref enemy_instance_id, has_arcane_immunity: _, has_multi_attack } => {
            let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                mk_types::ids::SkillId::from("krang_curse")
            });
            let eid = enemy_instance_id.clone();
            crate::action_pipeline::execute_curse_mode(
                state, player_idx, &skill_id, &eid, *has_multi_attack, choice_index,
            );
        }
        ChoiceResolution::CurseAttackIndex { ref enemy_instance_id, .. } => {
            let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                mk_types::ids::SkillId::from("krang_curse")
            });
            let eid = enemy_instance_id.clone();
            crate::action_pipeline::execute_curse_attack_index(
                state, player_idx, &skill_id, &eid, choice_index,
            );
        }
        ChoiceResolution::ForkedLightningTarget { remaining, ref already_targeted } => {
            let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                mk_types::ids::SkillId::from("braevalar_forked_lightning")
            });
            let targeted = already_targeted.clone();
            crate::action_pipeline::execute_forked_lightning_target(
                state, player_idx, &skill_id, *remaining, &targeted, choice_index,
            );
        }
        ChoiceResolution::KnowYourPreyTarget { ref eligible_enemy_ids } => {
            if choice_index < eligible_enemy_ids.len() {
                let enemy_id = eligible_enemy_ids[choice_index].clone();
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("wolfhawk_know_your_prey")
                });
                crate::action_pipeline::setup_know_your_prey_options(
                    state, player_idx, &skill_id, &enemy_id,
                );
            }
        }
        ChoiceResolution::KnowYourPreyOption { ref enemy_instance_id, ref options } => {
            if choice_index < options.len() {
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("wolfhawk_know_your_prey")
                });
                let eid = enemy_instance_id.clone();
                let opt = options[choice_index].clone();
                crate::action_pipeline::execute_know_your_prey_option(
                    state, player_idx, &skill_id, &eid, &opt,
                );
            }
        }
        ChoiceResolution::PuppetMasterSelectToken { ref token_indices } => {
            if choice_index < token_indices.len() {
                let token_idx = token_indices[choice_index];
                let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                    mk_types::ids::SkillId::from("krang_puppet_master")
                });
                crate::action_pipeline::execute_puppet_master_select_token(
                    state, player_idx, &skill_id, token_idx,
                );
            }
        }
        ChoiceResolution::PuppetMasterUseMode {
            token_index, attack_value, attack_element, block_value, block_element,
        } => {
            crate::action_pipeline::execute_puppet_master_use_mode(
                state, player_idx, *token_index, choice_index,
                *attack_value, *attack_element, *block_value, *block_element,
            );
        }
        ChoiceResolution::ShapeshiftCardSelect { ref options } => {
            let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                mk_types::ids::SkillId::from("braevalar_shapeshift")
            });
            let opts = options.clone();
            crate::action_pipeline::execute_shapeshift_card_select(
                state, player_idx, &skill_id, &opts, choice_index,
            );
        }
        ChoiceResolution::ShapeshiftTypeSelect {
            ref card_id, hand_index, ref original_type, amount, ref element,
        } => {
            let skill_id = choice.skill_id.clone().unwrap_or_else(|| {
                mk_types::ids::SkillId::from("braevalar_shapeshift")
            });
            let cid = card_id.clone();
            let ot = *original_type;
            let el = *element;
            crate::action_pipeline::execute_shapeshift_type_select(
                state, player_idx, &skill_id, &cid, *hand_index, ot, *amount, el, choice_index,
            );
        }
        ChoiceResolution::RitualOfPainDiscard { max_wounds } => {
            let mw = *max_wounds;
            crate::action_pipeline::execute_ritual_of_pain_discard(
                state, player_idx, choice_index, mw,
            );
        }
        ChoiceResolution::NaturesVengeanceTarget { ref eligible_enemy_ids, is_return } => {
            let eids = eligible_enemy_ids.clone();
            let is_ret = *is_return;
            crate::action_pipeline::execute_natures_vengeance_target(
                state, player_idx, &eids, choice_index, is_ret,
            );
        }

        ChoiceResolution::ManaOverloadColorSelect => {
            crate::action_pipeline::execute_mana_overload_color_select(
                state, player_idx, choice_index,
            );
        }
        ChoiceResolution::SourceOpeningDieSelect { ref die_ids } => {
            let ids = die_ids.clone();
            crate::action_pipeline::execute_source_opening_die_select(
                state, player_idx, &ids, choice_index,
            );
        }
        ChoiceResolution::MasterOfChaosGoldChoice => {
            // Delegates to standard resolution — pick chosen option and drain
        }
        ChoiceResolution::DiscardForCrystalSelect {
            ref eligible_card_ids,
            optional,
        } => {
            // If optional and choice_index == 0, this is "skip"
            let card_offset = if *optional { 1 } else { 0 };
            if *optional && choice_index == 0 {
                // Skip — no discard, just continue
            } else {
                let card_idx = choice_index - card_offset;
                if card_idx < eligible_card_ids.len() {
                    let cid = eligible_card_ids[card_idx].clone();
                    let player = &mut state.players[player_idx];
                    if let Some(idx) = player.hand.iter().position(|c| *c == cid) {
                        let removed = player.hand.remove(idx);
                        player.discard.push(removed);
                        player
                            .flags
                            .insert(PlayerFlags::DISCARDED_CARD_THIS_TURN);
                    }
                    if let Some(def) = mk_data::cards::get_card(cid.as_str()) {
                        if let Some(basic) = def.color.to_basic_mana_color() {
                            crate::mana::gain_crystal(&mut state.players[player_idx], basic);
                        } else {
                            // Colorless artifact — present 4-color crystal choice
                            let options = vec![
                                CardEffect::GainCrystal { color: Some(BasicManaColor::Red) },
                                CardEffect::GainCrystal { color: Some(BasicManaColor::Blue) },
                                CardEffect::GainCrystal { color: Some(BasicManaColor::Green) },
                                CardEffect::GainCrystal { color: Some(BasicManaColor::White) },
                            ];
                            state.players[player_idx].pending.active =
                                Some(ActivePending::Choice(PendingChoice {
                                    card_id: source_card_id,
                                    skill_id: None,
                                    unit_instance_id: None,
                                    options,
                                    continuation: choice.continuation.into_iter().collect(),
                                    movement_bonus_applied: false,
                                    resolution: ChoiceResolution::Standard,
                                }));
                            return Ok(());
                        }
                    }
                }
            }
        }
        ChoiceResolution::EnergyFlowTarget {
            ref eligible_unit_indices,
            heal,
        } => {
            if choice_index < eligible_unit_indices.len() {
                let unit_idx = eligible_unit_indices[choice_index];
                let unit = &mut state.players[player_idx].units[unit_idx];
                unit.state = UnitState::Ready;
                if *heal {
                    unit.wounded = false;
                }
            }
        }
        ChoiceResolution::ManaBoltTokenSelect { ref token_options } => {
            if choice_index < token_options.len() {
                let (token_color, _ct, _elem, _value) = token_options[choice_index];
                // Consume the mana token
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == token_color) {
                    player.pure_mana.remove(idx);
                }
                // The chosen_effect (GainAttack) will be enqueued by the standard path below
            }
        }
        ChoiceResolution::SacrificePairSelect { ref pair_options } => {
            if choice_index < pair_options.len() {
                let (a, b, _ct, _elem, _atk, count) = pair_options[choice_index];
                execute_sacrifice_pair(state, player_idx, a, b, count);
                // The chosen_effect (GainAttack) will be enqueued by the standard path below
            }
        }
        ChoiceResolution::ManaClaimDieSelect {
            with_curse,
            ref die_ids,
            ref die_colors,
        } => {
            if choice_index < die_ids.len() {
                let die_id = die_ids[choice_index].clone();
                let color = die_colors[choice_index];
                // Set up step 2: burst vs sustained
                setup_mana_claim_mode_choice(state, player_idx, die_id, color, *with_curse);
                // Early return — we set up a new pending directly
                return Ok(());
            }
        }
        ChoiceResolution::ManaClaimModeSelect {
            ref die_id,
            color,
            with_curse,
        } => {
            let did = die_id.clone();
            let col = *color;
            let curse = *with_curse;
            execute_mana_claim_mode(state, player_idx, &did, col, curse, choice_index);
            // Early return — fully handled
            return Ok(());
        }
        ChoiceResolution::ManaSourceSelect {
            ref sources,
            ref powered_effect,
        } => {
            if choice_index < sources.len() {
                let source = sources[choice_index].clone();
                let effect = powered_effect.clone();
                let card_id = source_card_id.clone();

                // Consume the selected mana source
                let consumed_color =
                    crate::card_play::consume_specific_mana_source(state, player_idx, &source);

                // Resolve the powered effect via effect queue
                let mut queue = EffectQueue::new();
                queue.push(effect.clone(), card_id.clone());
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {
                        // Pending is already cleared (we took it above)
                    }
                    DrainResult::NeedsChoice {
                        options: new_options,
                        continuation: new_continuation,
                        resolution: new_resolution,
                    } => {
                        state.players[player_idx].pending.active =
                            Some(ActivePending::Choice(PendingChoice {
                                card_id,
                                skill_id: None,
                                unit_instance_id: None,
                                options: new_options,
                                continuation: new_continuation
                                    .into_iter()
                                    .map(|q| ContinuationEntry {
                                        effect: q.effect,
                                        source_card_id: q.source_card_id,
                                    })
                                    .collect(),
                                movement_bonus_applied: false,
                                resolution: new_resolution,
                            }));
                    }
                    DrainResult::PendingSet => {}
                }

                // Mana trigger hooks
                crate::card_play::check_mana_overload_trigger(
                    state,
                    player_idx,
                    consumed_color,
                    &effect,
                );
                crate::card_play::check_mana_enhancement_trigger(
                    state,
                    player_idx,
                    consumed_color,
                );

                // Early return — we handled effect resolution ourselves
                return Ok(());
            }
        }
        ChoiceResolution::SongOfWindLake => {
            // Choice 1 = pay Blue mana for lake cost 0. Choice 0 = decline (Noop).
            if choice_index == 1 {
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == ManaColor::Blue) {
                    player.pure_mana.remove(idx);
                } else if player.crystals.blue > 0 {
                    player.crystals.blue -= 1;
                    player.spent_crystals_this_turn.blue += 1;
                } else if let Some(die) = state.source.dice.iter_mut().find(|d| {
                    d.color == ManaColor::Blue && !d.is_depleted && d.taken_by_player_id.is_none()
                }) {
                    die.taken_by_player_id = Some(state.players[player_idx].id.clone());
                    die.is_depleted = true;
                }
            }
        }
        ChoiceResolution::SelectUnitModifier { eligible_unit_indices } => {
            if choice_index < eligible_unit_indices.len() {
                let unit_idx = eligible_unit_indices[choice_index];
                // The modifier to apply is encoded in the chosen effect (Noop placeholder).
                // We need to extract it from the context — look at the source card's effect.
                // For now, the modifier was stored in the effect directly.
                // We handle it by looking at the source_card_id and applying the right modifier.
                // Force of Nature basic: GrantResistances { Physical }
                if let Some(ref card_id) = source_card_id {
                    let player = &mut state.players[player_idx];
                    if unit_idx < player.units.len() {
                        let unit_iid = player.units[unit_idx].instance_id.clone();
                        let mod_id = ModifierId::from(format!("select_unit_mod_{}", unit_iid.as_str()).as_str());
                        let player_id = state.players[player_idx].id.clone();
                        state.active_modifiers.push(ActiveModifier {
                            id: mod_id,
                            effect: ModifierEffect::GrantResistances {
                                resistances: vec![ResistanceElement::Physical],
                            },
                            duration: ModifierDuration::Combat,
                            scope: ModifierScope::OneUnit {
                                unit_index: unit_idx as u32,
                            },
                            source: ModifierSource::Card {
                                card_id: card_id.clone(),
                                player_id: player_id.clone(),
                            },
                            created_at_round: state.round,
                            created_by_player_id: player_id,
                        });
                    }
                }
                // Don't enqueue the chosen Noop — we handled the effect directly.
                // Replay continuation.
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect,
                        source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None,
                            unit_instance_id: None,
                            options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect,
                                source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false,
                            resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors } => {
            if choice_index < eligible_colors.len() {
                gain_crystal_color(state, player_idx, eligible_colors[choice_index]);
                // Don't enqueue the Noop — we handled the effect.
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect,
                        source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::CrystalMasteryGainColor { eligible_colors } => {
            if choice_index < eligible_colors.len() {
                gain_crystal_color(state, player_idx, eligible_colors[choice_index]);
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::ManaStormDieSelect { die_ids, die_colors } => {
            if choice_index < die_ids.len() {
                let die_id = die_ids[choice_index].clone();
                let color = die_colors[choice_index];
                // Gain crystal of the die's color
                gain_crystal_color(state, player_idx, color);
                // Reroll the die
                crate::mana::reroll_die(
                    &mut state.source,
                    &die_id,
                    state.time_of_day,
                    &mut state.rng,
                );
                // Don't enqueue Noop — we handled the effect.
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::SpellForgeCrystal { spell_entries, is_second, first_spell_index: _ } => {
            if choice_index < spell_entries.len() {
                let (offer_index, spell_color) = spell_entries[choice_index];
                // Gain crystal of the spell's color
                gain_crystal_color(state, player_idx, spell_color);
                // If this is the first selection of powered, chain to second choice
                if !is_second {
                    // Build second choice: same spells minus the one just picked
                    let second_entries: Vec<(usize, BasicManaColor)> = spell_entries.iter()
                        .filter(|(idx, _)| *idx != offer_index)
                        .copied()
                        .collect();
                    if !second_entries.is_empty() {
                        let options: Vec<CardEffect> = second_entries.iter().map(|_| CardEffect::Noop).collect();
                        let mut queue = EffectQueue::new();
                        queue.push_continuation(
                            choice.continuation.into_iter().map(|c| QueuedEffect {
                                effect: c.effect, source_card_id: c.source_card_id,
                            }).collect(),
                        );
                        let continuation: Vec<ContinuationEntry> = queue.queue.drain(..).map(|q| ContinuationEntry {
                            effect: q.effect, source_card_id: q.source_card_id,
                        }).collect();
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation,
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::SpellForgeCrystal {
                                spell_entries: second_entries,
                                is_second: true,
                                first_spell_index: Some(offer_index),
                            },
                        }));
                        return Ok(());
                    }
                }
                // Single spell or second selection — continue normally
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::PeacefulMomentConversion { influence_remaining, allow_refresh, refreshed, option_map } => {
            let action = option_map.get(choice_index).cloned().unwrap_or(PeacefulMomentOption::Done);
            let mut new_influence = *influence_remaining;
            let mut new_refreshed = *refreshed;

            match action {
                PeacefulMomentOption::Done => {
                    // Done — no more conversions. Fall through to continuation.
                }
                PeacefulMomentOption::HealWound => {
                    // Cost 2 influence, remove 1 wound from hand
                    new_influence = influence_remaining.saturating_sub(2);
                    let player = &mut state.players[player_idx];
                    if let Some(wound_idx) = player.hand.iter().position(|c| c.as_str() == WOUND_CARD_ID) {
                        player.hand.remove(wound_idx);
                    }
                }
                PeacefulMomentOption::RefreshUnit => {
                    // Refresh first spent unit, cost = level × 2
                    let player = &mut state.players[player_idx];
                    if let Some(unit_idx) = player.units.iter().position(|u| u.state == UnitState::Spent) {
                        let cost = player.units[unit_idx].level as u32 * 2;
                        new_influence = influence_remaining.saturating_sub(cost);
                        player.units[unit_idx].state = UnitState::Ready;
                        new_refreshed = true;
                    }
                }
                PeacefulMomentOption::HealUnit { unit_index } => {
                    // Heal wounded unit, cost = level × 2 influence
                    let player = &mut state.players[player_idx];
                    if unit_index < player.units.len() && player.units[unit_index].wounded {
                        let cost = player.units[unit_index].level as u32 * 2;
                        new_influence = influence_remaining.saturating_sub(cost);
                        player.units[unit_index].wounded = false;
                    }
                }
            }

            // For non-Done actions, chain back to conversion loop
            if !matches!(action, PeacefulMomentOption::Done) {
                let convert_effect = CardEffect::PeacefulMomentConvert {
                    influence_remaining: new_influence,
                    allow_refresh: *allow_refresh,
                    refreshed: new_refreshed,
                };
                let mut queue = EffectQueue::new();
                queue.push(convert_effect, source_card_id.clone());
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::BloodBasicManaSelect { mana_options } => {
            if choice_index < mana_options.len() {
                let (ref mana_source, aa_color) = mana_options[choice_index];
                // Consume the mana source
                consume_mana_source(state, player_idx, mana_source);
                // Find matching AAs in offer
                let matching_aas: Vec<(usize, mk_types::ids::CardId)> = state.offers.advanced_actions.iter().enumerate()
                    .filter(|(_, card_id)| {
                        mk_data::cards::get_card_color(card_id.as_str()) == Some(aa_color)
                    })
                    .map(|(idx, card_id)| (idx, card_id.clone()))
                    .collect();
                if matching_aas.len() == 1 {
                    // Auto-gain the single matching AA
                    let (offer_idx, aa_id) = &matching_aas[0];
                    let aa_id = aa_id.clone();
                    state.offers.advanced_actions.remove(*offer_idx);
                    replenish_aa_offer(state);
                    state.players[player_idx].hand.push(aa_id);
                } else if matching_aas.len() > 1 {
                    let options: Vec<CardEffect> = matching_aas.iter().map(|_| CardEffect::Noop).collect();
                    let continuation: Vec<ContinuationEntry> = choice.continuation.into_iter().collect();
                    state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                        card_id: source_card_id,
                        skill_id: None, unit_instance_id: None, options,
                        continuation,
                        movement_bonus_applied: false,
                        resolution: ChoiceResolution::BloodBasicAaSelect { color: aa_color },
                    }));
                    return Ok(());
                }
                // Continue with any continuation
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::BloodBasicAaSelect { color } => {
            // Select AA from offer by color
            let matching_aas: Vec<(usize, mk_types::ids::CardId)> = state.offers.advanced_actions.iter().enumerate()
                .filter(|(_, card_id)| {
                    mk_data::cards::get_card_color(card_id.as_str()) == Some(*color)
                })
                .map(|(idx, card_id)| (idx, card_id.clone()))
                .collect();
            if choice_index < matching_aas.len() {
                let (offer_idx, aa_id) = &matching_aas[choice_index];
                let aa_id = aa_id.clone();
                state.offers.advanced_actions.remove(*offer_idx);
                replenish_aa_offer(state);
                state.players[player_idx].hand.push(aa_id);
            }
            // Continue with any continuation
            let mut queue = EffectQueue::new();
            queue.push_continuation(
                choice.continuation.into_iter().map(|c| QueuedEffect {
                    effect: c.effect, source_card_id: c.source_card_id,
                }).collect(),
            );
            match queue.drain(state, player_idx) {
                DrainResult::Complete => {}
                DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                    state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                        card_id: source_card_id,
                        skill_id: None, unit_instance_id: None, options,
                        continuation: continuation.into_iter().map(|q| ContinuationEntry {
                            effect: q.effect, source_card_id: q.source_card_id,
                        }).collect(),
                        movement_bonus_applied: false, resolution: new_res,
                    }));
                }
                DrainResult::PendingSet => {}
            }
            return Ok(());
        }
        ChoiceResolution::BloodPoweredWoundSelect => {
            // Choice 0 = wound to hand, choice 1 = wound to discard
            let player = &mut state.players[player_idx];
            if choice_index == 0 {
                player.hand.push(CardId::from(WOUND_CARD_ID));
                player.wounds_received_this_turn.hand += 1;
            } else {
                player.discard.push(CardId::from(WOUND_CARD_ID));
                player.wounds_received_this_turn.discard += 1;
            }
            // Now present all AAs in offer
            let aa_count = state.offers.advanced_actions.len();
            if aa_count > 0 {
                let options: Vec<CardEffect> = (0..aa_count).map(|_| CardEffect::Noop).collect();
                let continuation: Vec<ContinuationEntry> = choice.continuation.into_iter().collect();
                state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                    card_id: source_card_id,
                    skill_id: None, unit_instance_id: None, options,
                    continuation,
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::BloodPoweredAaSelect,
                }));
                return Ok(());
            }
        }
        ChoiceResolution::BloodPoweredAaSelect => {
            // Select AA from offer — resolve its powered effect for free
            let aa_list: Vec<mk_types::ids::CardId> = state.offers.advanced_actions.clone();
            if choice_index < aa_list.len() {
                let aa_id = &aa_list[choice_index];
                // Get the AA's powered effect
                if let Some(card_def) = mk_data::cards::get_card(aa_id.as_str()) {
                    let powered_effect = card_def.powered_effect;
                    // Resolve the powered effect through the queue (AA stays in offer)
                    let mut queue = EffectQueue::new();
                    queue.push(powered_effect, Some(aa_id.clone()));
                    queue.push_continuation(
                        choice.continuation.into_iter().map(|c| QueuedEffect {
                            effect: c.effect, source_card_id: c.source_card_id,
                        }).collect(),
                    );
                    match queue.drain(state, player_idx) {
                        DrainResult::Complete => {}
                        DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                                card_id: source_card_id,
                                skill_id: None, unit_instance_id: None, options,
                                continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                    effect: q.effect, source_card_id: q.source_card_id,
                                }).collect(),
                                movement_bonus_applied: false, resolution: new_res,
                            }));
                        }
                        DrainResult::PendingSet => {}
                    }
                    return Ok(());
                }
            }
        }
        ChoiceResolution::MagicTalentSpellSelect { spell_entries } => {
            if choice_index < spell_entries.len() {
                let (offer_index, ref spell_id, _spell_color) = spell_entries[choice_index];
                // Get the spell's basic effect and resolve it (spell stays in offer)
                if let Some(card_def) = mk_data::cards::get_card(spell_id.as_str()) {
                    let basic_effect = card_def.basic_effect;
                    let mut queue = EffectQueue::new();
                    queue.push(basic_effect, Some(spell_id.clone()));
                    queue.push_continuation(
                        choice.continuation.into_iter().map(|c| QueuedEffect {
                            effect: c.effect, source_card_id: c.source_card_id,
                        }).collect(),
                    );
                    match queue.drain(state, player_idx) {
                        DrainResult::Complete => {}
                        DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                                card_id: source_card_id,
                                skill_id: None, unit_instance_id: None, options,
                                continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                    effect: q.effect, source_card_id: q.source_card_id,
                                }).collect(),
                                movement_bonus_applied: false, resolution: new_res,
                            }));
                        }
                        DrainResult::PendingSet => {}
                    }
                    let _ = offer_index; // spell stays in offer
                    return Ok(());
                }
            }
        }
        ChoiceResolution::MagicTalentGainSelect { gain_entries } => {
            if choice_index < gain_entries.len() {
                let (offer_index, ref spell_id, mana_color) = gain_entries[choice_index];
                // Consume mana token of matching color
                let target = ManaColor::from(mana_color);
                let player = &mut state.players[player_idx];
                if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target) {
                    player.pure_mana.remove(idx);
                }
                // Remove spell from offer and add to discard
                if offer_index < state.offers.spells.len() {
                    state.offers.spells.remove(offer_index);
                    replenish_spell_offer(state);
                }
                state.players[player_idx].discard.push(spell_id.clone());
                // Continue
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect, source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }

        // === Spell ChoiceResolutions ===

        ChoiceResolution::ManaMeltdownColorSelect { available_colors } => {
            if choice_index < available_colors.len() {
                let color = available_colors[choice_index];
                resolve_mana_radiance(state, player_idx, color);
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
        }
        ChoiceResolution::MindReadColorSelect => {
            // Map choice_index to color: 0=Red, 1=Blue, 2=Green, 3=White
            let colors = [
                BasicManaColor::Red,
                BasicManaColor::Blue,
                BasicManaColor::Green,
                BasicManaColor::White,
            ];
            if choice_index < colors.len() {
                apply_gain_crystal_color(state, player_idx, colors[choice_index]);
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
        }
        ChoiceResolution::CallToArmsUnitSelect { eligible_unit_indices } => {
            if choice_index < eligible_unit_indices.len() {
                let unit_offer_idx = eligible_unit_indices[choice_index];
                if let Some(unit_id) = state.offers.units.get(unit_offer_idx) {
                    if let Some(unit_def) = mk_data::units::get_unit(unit_id.as_str()) {
                        // Collect activatable abilities
                        let mut ability_entries = Vec::new();
                        for (ai, slot) in unit_def.abilities.iter().enumerate() {
                            if slot.mana_cost.is_none() {
                                if let Some(effect) =
                                    unit_ability_to_card_effect(&slot.ability)
                                {
                                    ability_entries.push((ai, effect));
                                }
                            }
                        }
                        if ability_entries.len() == 1 {
                            // Auto-select single ability
                            let (_, ref effect) = ability_entries[0];
                            let mut queue = EffectQueue::new();
                            queue.push(effect.clone(), source_card_id.clone());
                            queue.push_continuation(
                                choice.continuation.into_iter().map(|c| QueuedEffect {
                                    effect: c.effect,
                                    source_card_id: c.source_card_id,
                                }).collect(),
                            );
                            match queue.drain(state, player_idx) {
                                DrainResult::Complete => {}
                                DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                                    state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                                        card_id: source_card_id,
                                        skill_id: None, unit_instance_id: None, options,
                                        continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                            effect: q.effect, source_card_id: q.source_card_id,
                                        }).collect(),
                                        movement_bonus_applied: false, resolution: new_res,
                                    }));
                                }
                                DrainResult::PendingSet => {}
                            }
                            return Ok(());
                        } else if ability_entries.len() > 1 {
                            // Present ability choice
                            let options: Vec<CardEffect> =
                                ability_entries.iter().map(|_| CardEffect::Noop).collect();
                            state.players[player_idx].pending.active =
                                Some(ActivePending::Choice(PendingChoice {
                                    card_id: source_card_id,
                                    skill_id: None,
                                    unit_instance_id: None,
                                    options,
                                    continuation: choice.continuation,
                                    movement_bonus_applied: false,
                                    resolution: ChoiceResolution::CallToArmsAbilitySelect {
                                        ability_entries,
                                    },
                                }));
                            return Ok(());
                        }
                    }
                }
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
        }
        ChoiceResolution::CallToArmsAbilitySelect { ability_entries } => {
            if choice_index < ability_entries.len() {
                let (_, ref effect) = ability_entries[choice_index];
                let mut queue = EffectQueue::new();
                queue.push(effect.clone(), source_card_id.clone());
                queue.push_continuation(
                    choice.continuation.into_iter().map(|c| QueuedEffect {
                        effect: c.effect,
                        source_card_id: c.source_card_id,
                    }).collect(),
                );
                match queue.drain(state, player_idx) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice { options, continuation, resolution: new_res } => {
                        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None, unit_instance_id: None, options,
                            continuation: continuation.into_iter().map(|q| ContinuationEntry {
                                effect: q.effect, source_card_id: q.source_card_id,
                            }).collect(),
                            movement_bonus_applied: false, resolution: new_res,
                        }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::FreeRecruitTarget { eligible_unit_indices } => {
            if choice_index < eligible_unit_indices.len() {
                let offer_idx = eligible_unit_indices[choice_index];
                execute_free_recruit(state, player_idx, offer_idx);
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
        }
        ChoiceResolution::WingsOfNightTarget {
            eligible_enemy_ids,
            targets_so_far,
        } => {
            let targets_so_far = *targets_so_far;
            // Check if "Done" was selected (index 0 when targets_so_far > 0)
            let done_offset = if targets_so_far > 0 { 1 } else { 0 };
            if targets_so_far > 0 && choice_index == 0 {
                // Done — stop targeting
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
            let enemy_idx = choice_index - done_offset;
            if enemy_idx < eligible_enemy_ids.len() {
                let enemy_id = &eligible_enemy_ids[enemy_idx];
                // Deduct move cost
                let move_cost = targets_so_far;
                if move_cost > 0 {
                    state.players[player_idx].move_points =
                        state.players[player_idx].move_points.saturating_sub(move_cost);
                }
                // Apply skip attack modifier
                let player_id = state.players[player_idx].id.clone();
                let mod_id = mk_types::ids::ModifierId::from(
                    format!("wings_night_{}", enemy_id).as_str(),
                );
                state.active_modifiers.push(ActiveModifier {
                    id: mod_id,
                    source: ModifierSource::Card {
                        card_id: CardId::from("wings_of_wind"),
                        player_id: player_id.clone(),
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::OneEnemy {
                        enemy_id: enemy_id.clone(),
                    },
                    effect: ModifierEffect::EnemySkipAttack,
                    created_at_round: state.round,
                    created_by_player_id: player_id,
                });
                // Continue to next target
                let next_targets = targets_so_far + 1;
                match resolve_wings_of_night_step(state, player_idx, next_targets) {
                    ResolveResult::NeedsChoiceWith(options, resolution) => {
                        state.players[player_idx].pending.active =
                            Some(ActivePending::Choice(PendingChoice {
                                card_id: source_card_id,
                                skill_id: None,
                                unit_instance_id: None,
                                options,
                                continuation: choice.continuation,
                                movement_bonus_applied: false,
                                resolution,
                            }));
                    }
                    _ => {
                        resume_continuation(
                            state,
                            player_idx,
                            source_card_id,
                            choice.continuation,
                        );
                    }
                }
                return Ok(());
            }
        }
        ChoiceResolution::PossessEnemyTarget { eligible_enemy_ids } => {
            if choice_index < eligible_enemy_ids.len() {
                let enemy_id = eligible_enemy_ids[choice_index].clone();
                execute_possess_enemy(state, player_idx, &enemy_id);
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
        }
        ChoiceResolution::ReadyUnitsBudgetSelect {
            eligible_unit_indices,
            remaining_levels,
        } => {
            if choice_index == 0 {
                // "Done"
                resume_continuation(state, player_idx, source_card_id, choice.continuation);
                return Ok(());
            }
            let unit_idx_in_list = choice_index - 1;
            if unit_idx_in_list < eligible_unit_indices.len() {
                let unit_idx = eligible_unit_indices[unit_idx_in_list];
                let unit_level = state.players[player_idx].units[unit_idx].level as u32;
                state.players[player_idx].units[unit_idx].state = UnitState::Ready;
                let new_remaining = remaining_levels - unit_level;
                if new_remaining > 0 {
                    match resolve_ready_units_budget_step(state, player_idx, new_remaining) {
                        ResolveResult::NeedsChoiceWith(options, resolution) => {
                            state.players[player_idx].pending.active =
                                Some(ActivePending::Choice(PendingChoice {
                                    card_id: source_card_id,
                                    skill_id: None,
                                    unit_instance_id: None,
                                    options,
                                    continuation: choice.continuation,
                                    movement_bonus_applied: false,
                                    resolution,
                                }));
                        }
                        _ => {
                            resume_continuation(
                                state,
                                player_idx,
                                source_card_id,
                                choice.continuation,
                            );
                        }
                    }
                } else {
                    resume_continuation(state, player_idx, source_card_id, choice.continuation);
                }
                return Ok(());
            }
        }
    }

    // Build a new queue with the chosen option + continuation
    let mut queue = EffectQueue::new();
    queue.push(chosen_effect, source_card_id.clone());
    queue.push_continuation(
        choice
            .continuation
            .into_iter()
            .map(|c| QueuedEffect {
                effect: c.effect,
                source_card_id: c.source_card_id,
            })
            .collect(),
    );

    // Drain the queue
    match queue.drain(state, player_idx) {
        DrainResult::Complete => {
            // Pending is already cleared (we took it above)
            Ok(())
        }
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            // Another choice emerged — set new pending
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: source_card_id,
                skill_id: None,
                unit_instance_id: None,
                options,
                continuation: continuation
                    .into_iter()
                    .map(|q| ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    })
                    .collect(),
                movement_bonus_applied: false,
                resolution,
            }));
            Ok(())
        }
        DrainResult::PendingSet => {
            // A custom pending was set directly (e.g., DiscardForBonus inside a choice).
            Ok(())
        }
    }
}

// =============================================================================
// Resolve discard-for-bonus (public API for RESOLVE_DISCARD_FOR_BONUS action)
// =============================================================================

/// Resolve a pending discard-for-bonus by picking a base effect and discard count.
///
/// The chosen base effect is scaled by `bonus_per_card * discard_count`, then
/// eligible cards are discarded from hand. The result is drained through the
/// effect queue.
pub fn resolve_discard_for_bonus(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    discard_count: usize,
) -> Result<(), ResolveChoiceError> {
    // Extract the pending
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or(ResolveChoiceError::NoPendingChoice)?;

    let dfb = match pending {
        ActivePending::DiscardForBonus(d) => d,
        other => {
            state.players[player_idx].pending.active = Some(other);
            return Err(ResolveChoiceError::NoPendingChoice);
        }
    };

    if choice_index >= dfb.choice_options.len() {
        state.players[player_idx].pending.active =
            Some(ActivePending::DiscardForBonus(dfb));
        return Err(ResolveChoiceError::InvalidChoiceIndex);
    }

    let chosen_base = dfb.choice_options[choice_index].clone();
    let bonus = dfb.bonus_per_card * discard_count as u32;

    // Discard eligible cards from hand
    discard_eligible_cards(state, player_idx, discard_count, dfb.discard_filter);

    // Scale the chosen effect by the bonus
    let final_effect = if bonus > 0 {
        scale_effect(&chosen_base, bonus)
    } else {
        chosen_base
    };

    // Drain through the effect queue
    let source_card_id = Some(dfb.source_card_id);
    let mut queue = EffectQueue::new();
    queue.push(final_effect, source_card_id.clone());
    match queue.drain(state, player_idx) {
        DrainResult::Complete => Ok(()),
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            // Another choice emerged — set new pending
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: source_card_id,
                    skill_id: None,
                    unit_instance_id: None,
                    options,
                    continuation: continuation
                        .into_iter()
                        .map(|q| ContinuationEntry {
                            effect: q.effect,
                            source_card_id: q.source_card_id,
                        })
                        .collect(),
                    movement_bonus_applied: false,
                    resolution,
                }));
            Ok(())
        }
        DrainResult::PendingSet => Ok(()),
    }
}

/// Resolve a pending decompose by picking which hand card to decompose.
///
/// The selected card is removed from hand to `removed_cards` (permanent removal).
/// Based on mode + card color:
/// - Basic: gain 2 crystals of matching color
/// - Powered: gain 1 crystal of each non-matching color
pub fn resolve_decompose(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
) -> Result<(), ResolveChoiceError> {
    // Extract the pending
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or(ResolveChoiceError::NoPendingChoice)?;

    let decompose = match pending {
        ActivePending::Decompose(d) => d,
        other => {
            state.players[player_idx].pending.active = Some(other);
            return Err(ResolveChoiceError::NoPendingChoice);
        }
    };

    // Validate hand_index
    let player = &state.players[player_idx];
    if hand_index >= player.hand.len() {
        state.players[player_idx].pending.active =
            Some(ActivePending::Decompose(decompose));
        return Err(ResolveChoiceError::InvalidChoiceIndex);
    }

    // Validate the card is an action card
    let card_id = &player.hand[hand_index];
    let card_def = mk_data::cards::get_card(card_id.as_str());
    let card_color = card_def.as_ref().and_then(|d| d.color.to_basic_mana_color());

    let is_action = card_def.as_ref().is_some_and(|d| {
        matches!(
            d.card_type,
            DeedCardType::BasicAction | DeedCardType::AdvancedAction
        )
    });

    if !is_action {
        state.players[player_idx].pending.active =
            Some(ActivePending::Decompose(decompose));
        return Err(ResolveChoiceError::InvalidChoiceIndex);
    }

    // Remove card from hand to removed_cards (permanent removal)
    let removed_card = state.players[player_idx].hand.remove(hand_index);
    state.players[player_idx].removed_cards.push(removed_card);

    // Build crystal gain effects based on mode + color
    let mut effects: Vec<CardEffect> = Vec::new();
    if let Some(color) = card_color {
        match decompose.mode {
            EffectMode::Basic => {
                // Gain 2 crystals of matching color
                effects.push(CardEffect::GainCrystal {
                    color: Some(color),
                });
                effects.push(CardEffect::GainCrystal {
                    color: Some(color),
                });
            }
            EffectMode::Powered => {
                // Gain 1 crystal of each non-matching basic color
                for &c in &ALL_BASIC_MANA_COLORS {
                    if c != color {
                        effects.push(CardEffect::GainCrystal { color: Some(c) });
                    }
                }
            }
        }
    }

    // Drain the crystal effects through the queue
    if effects.is_empty() {
        return Ok(());
    }

    let source_card_id = Some(decompose.source_card_id);
    let mut queue = EffectQueue::new();
    queue.push_all(effects, source_card_id.clone());
    match queue.drain(state, player_idx) {
        DrainResult::Complete => Ok(()),
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: source_card_id,
                    skill_id: None,
                    unit_instance_id: None,
                    options,
                    continuation: continuation
                        .into_iter()
                        .map(|q| ContinuationEntry {
                            effect: q.effect,
                            source_card_id: q.source_card_id,
                        })
                        .collect(),
                    movement_bonus_applied: false,
                    resolution,
                }));
            Ok(())
        }
        DrainResult::PendingSet => Ok(()),
    }
}
