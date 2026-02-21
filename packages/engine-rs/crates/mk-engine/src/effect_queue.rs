//! Queue-based iterative effect resolution.
//!
//! Replaces the TS recursive `resolveEffect()` with a `VecDeque` that
//! processes effects one at a time. This avoids stack overflow risk and
//! makes the control flow explicit.
//!
//! ## Key concepts
//!
//! - **Atomic effects** (GainMove, GainAttack, etc.) directly mutate `GameState`.
//! - **Structural effects** (Compound, Conditional, Scaling) decompose into
//!   sub-effects that are pushed to the front of the queue.
//! - **Choice effects** pause the queue and return the options to the caller.
//!   The remaining queue entries become the "continuation" stored alongside
//!   the pending choice in player state.
//!
//! ## Flow
//!
//! ```text
//! PLAY_CARD → push card effect → drain queue
//!   → if NeedsChoice: store options + continuation in player.pending
//!   → if Complete: done
//!
//! RESOLVE_CHOICE → push chosen option + continuation → drain queue
//!   → repeat until complete
//! ```

use std::collections::VecDeque;

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::pending::{
    ActivePending, AttackDefeatFameTracker, ChoiceResolution, ContinuationEntry, DeferredPending,
    EffectMode, PendingChoice, PendingDecompose,
};
use mk_types::state::*;

// =============================================================================
// Constants
// =============================================================================

/// Well-known card ID for wound cards.
pub const WOUND_CARD_ID: &str = "wound";

/// Maximum reputation value.
const MAX_REPUTATION: i8 = 7;
/// Minimum reputation value.
const MIN_REPUTATION: i8 = -7;

/// Maximum crystals per color.
const MAX_CRYSTALS_PER_COLOR: u8 = 3;

// =============================================================================
// Queue types
// =============================================================================

/// A single effect waiting to be resolved, with source metadata.
#[derive(Debug, Clone)]
pub struct QueuedEffect {
    pub effect: CardEffect,
    pub source_card_id: Option<CardId>,
}

/// Result of draining the effect queue.
#[derive(Debug)]
pub enum DrainResult {
    /// All effects resolved successfully, queue is empty.
    Complete,
    /// Player must choose from options before resolution can continue.
    /// `continuation` holds the remaining effects to process after the choice.
    NeedsChoice {
        options: Vec<CardEffect>,
        continuation: Vec<QueuedEffect>,
        resolution: ChoiceResolution,
    },
    /// A custom pending (not Choice) was set directly on the player.
    /// The player must resolve this pending before continuing.
    PendingSet,
}

/// Internal result from resolving a single effect.
enum ResolveResult {
    /// Effect applied directly to state.
    Applied,
    /// Effect decomposed into sub-effects to push to queue front.
    Decomposed(Vec<CardEffect>),
    /// Player must choose. Options are the available choices.
    NeedsChoice(Vec<CardEffect>),
    /// Player must choose, with a specific resolution strategy.
    NeedsChoiceWith(Vec<CardEffect>, ChoiceResolution),
    /// Effect was not applicable (e.g., no-op, unresolvable).
    Skipped,
    /// A custom pending was set directly on the player. Queue should stop.
    PendingSet,
    /// SelectCombatEnemy needs player to choose a target. Queue should stop + save continuation.
    NeedsSelectCombatEnemy {
        eligible_enemy_ids: Vec<String>,
        template: mk_types::pending::SelectEnemyTemplate,
    },
}

/// The effect queue. Created per-action, not persisted in game state.
#[derive(Debug, Default)]
pub struct EffectQueue {
    queue: VecDeque<QueuedEffect>,
}

impl EffectQueue {
    pub fn new() -> Self {
        Self {
            queue: VecDeque::new(),
        }
    }

    /// Push a single effect to the back of the queue.
    pub fn push(&mut self, effect: CardEffect, source_card_id: Option<CardId>) {
        self.queue.push_back(QueuedEffect {
            effect,
            source_card_id,
        });
    }

    /// Push multiple effects to the back of the queue.
    pub fn push_all(
        &mut self,
        effects: impl IntoIterator<Item = CardEffect>,
        source_card_id: Option<CardId>,
    ) {
        for effect in effects {
            self.queue.push_back(QueuedEffect {
                effect,
                source_card_id: source_card_id.clone(),
            });
        }
    }

    /// Push a continuation (previously saved remaining effects) to the back.
    pub fn push_continuation(&mut self, continuation: Vec<QueuedEffect>) {
        for entry in continuation {
            self.queue.push_back(entry);
        }
    }

    /// Drain the queue, resolving effects until it's empty or a choice is needed.
    pub fn drain(&mut self, state: &mut GameState, player_idx: usize) -> DrainResult {
        while let Some(queued) = self.queue.pop_front() {
            let source = queued.source_card_id.clone();
            match resolve_one(state, player_idx, &queued.effect) {
                ResolveResult::Applied => continue,
                ResolveResult::Skipped => continue,
                ResolveResult::Decomposed(sub_effects) => {
                    // Push sub-effects to FRONT of queue (they should resolve next).
                    for effect in sub_effects.into_iter().rev() {
                        self.queue.push_front(QueuedEffect {
                            effect,
                            source_card_id: source.clone(),
                        });
                    }
                }
                ResolveResult::NeedsChoice(options) => {
                    // Remaining queue entries become the continuation.
                    let continuation: Vec<QueuedEffect> = self.queue.drain(..).collect();
                    return DrainResult::NeedsChoice {
                        options,
                        continuation,
                        resolution: ChoiceResolution::Standard,
                    };
                }
                ResolveResult::NeedsChoiceWith(options, resolution) => {
                    let continuation: Vec<QueuedEffect> = self.queue.drain(..).collect();
                    return DrainResult::NeedsChoice {
                        options,
                        continuation,
                        resolution,
                    };
                }
                ResolveResult::PendingSet => {
                    // Custom pending was set directly. Discard remaining queue.
                    // (DiscardForBonus is always the entire card effect.)
                    self.queue.clear();
                    return DrainResult::PendingSet;
                }
                ResolveResult::NeedsSelectCombatEnemy { eligible_enemy_ids, template } => {
                    // Save remaining queue as continuation before setting pending.
                    let continuation: Vec<mk_types::pending::ContinuationEntry> =
                        self.queue.drain(..).map(|q| mk_types::pending::ContinuationEntry {
                            effect: q.effect,
                            source_card_id: q.source_card_id,
                        }).collect();
                    state.players[player_idx].pending.active =
                        Some(ActivePending::SelectCombatEnemy {
                            unit_instance_id: None,
                            eligible_enemy_ids,
                            template,
                            continuation,
                        });
                    return DrainResult::PendingSet;
                }
            }
        }
        DrainResult::Complete
    }

    /// Returns true if the queue has no pending effects.
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

// =============================================================================
// Resolve pending choice (public API for RESOLVE_CHOICE action)
// =============================================================================

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
            // Consume a mana token matching the chosen crystal color
            if let CardEffect::GainCrystal {
                color: Some(basic_color),
            } = &chosen_effect
            {
                let target = ManaColor::from(*basic_color);
                let player = &mut state.players[player_idx];
                if let Some(idx) = player
                    .pure_mana
                    .iter()
                    .position(|t| to_basic_mana_color(t.color) == Some(*basic_color))
                {
                    player.pure_mana.remove(idx);
                }
                let _ = target; // used for position lookup above
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
        ChoiceResolution::RegenerateMana { available_colors, bonus_color } => {
            // Consume mana of chosen color, remove wound, conditionally draw
            if choice_index < available_colors.len() {
                let color = available_colors[choice_index];
                crate::action_pipeline::execute_regenerate(state, player_idx, color, *bonus_color)
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

// =============================================================================
// Resolve decompose (public API for RESOLVE_DECOMPOSE action)
// =============================================================================

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

/// Discard eligible cards from the player's hand for DiscardForBonus.
fn discard_eligible_cards(
    state: &mut GameState,
    player_idx: usize,
    discard_count: usize,
    filter: DiscardForBonusFilter,
) {
    let player = &mut state.players[player_idx];
    let mut remaining = discard_count;

    match filter {
        DiscardForBonusFilter::WoundOnly => {
            // Discard wounds only
            let mut i = 0;
            while i < player.hand.len() && remaining > 0 {
                if player.hand[i].as_str() == WOUND_CARD_ID {
                    let discarded = player.hand.remove(i);
                    player.discard.push(discarded);
                    remaining -= 1;
                } else {
                    i += 1;
                }
            }
        }
        DiscardForBonusFilter::AnyMaxOneWound => {
            // Discard any cards (up to 1 wound). Prefer non-wounds first.
            // First pass: discard non-wound cards
            let mut i = 0;
            while i < player.hand.len() && remaining > 0 {
                if player.hand[i].as_str() != WOUND_CARD_ID {
                    let discarded = player.hand.remove(i);
                    player.discard.push(discarded);
                    remaining -= 1;
                } else {
                    i += 1;
                }
            }
            // Second pass: discard one wound if still needed
            if remaining > 0 {
                if let Some(wound_idx) = player
                    .hand
                    .iter()
                    .position(|c| c.as_str() == WOUND_CARD_ID)
                {
                    let discarded = player.hand.remove(wound_idx);
                    player.discard.push(discarded);
                }
            }
        }
    }
}

// =============================================================================
// Single effect resolution (dispatch)
// =============================================================================

/// Resolve a single effect. Returns how to proceed.
fn resolve_one(state: &mut GameState, player_idx: usize, effect: &CardEffect) -> ResolveResult {
    match effect {
        // === Atomic effects ===
        CardEffect::GainMove { amount } => {
            state.players[player_idx].move_points += amount;
            ResolveResult::Applied
        }
        CardEffect::GainInfluence { amount } => {
            state.players[player_idx].influence_points += amount;
            ResolveResult::Applied
        }
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => apply_gain_attack(state, player_idx, *amount, *combat_type, *element),
        CardEffect::GainBlock { amount, element } => {
            apply_gain_block(state, player_idx, *amount, *element)
        }
        CardEffect::GainHealing { amount } => apply_gain_healing(state, player_idx, *amount),
        CardEffect::GainMana { color, amount } => {
            apply_gain_mana(state, player_idx, *color, *amount)
        }
        CardEffect::DrawCards { count } => apply_draw_cards(state, player_idx, *count),
        CardEffect::GainFame { amount } => {
            state.players[player_idx].fame += amount;
            // TODO: level-up threshold check (Phase 3)
            ResolveResult::Applied
        }
        CardEffect::ChangeReputation { amount } => {
            let player = &mut state.players[player_idx];
            let new_rep = (player.reputation as i32 + *amount as i32)
                .clamp(MIN_REPUTATION as i32, MAX_REPUTATION as i32);
            player.reputation = new_rep as i8;
            ResolveResult::Applied
        }
        CardEffect::GainCrystal { color } => apply_gain_crystal(state, player_idx, *color),
        CardEffect::TakeWound => apply_take_wound(state, player_idx),
        CardEffect::Noop => ResolveResult::Skipped,

        // === Multi-step / cost effects ===
        CardEffect::ConvertManaToCrystal => apply_convert_mana_to_crystal(state, player_idx),
        CardEffect::CardBoost { bonus } => apply_card_boost(state, player_idx, *bonus),
        CardEffect::ManaDrawPowered {
            dice_count: _,
            tokens_per_die,
        } => {
            // Simplified: gain one mana token of each basic color per token_per_die.
            // Full implementation would involve die selection from source.
            // For now, offer a color choice for each token gained.
            apply_mana_draw_powered_simplified(state, player_idx, *tokens_per_die)
        }
        CardEffect::DiscardCost {
            count,
            filter_wounds,
            wounds_only,
            then_effect,
        } => apply_discard_cost(state, player_idx, *count, *filter_wounds, *wounds_only, then_effect),
        CardEffect::ApplyModifier {
            effect,
            duration,
            scope,
        } => apply_modifier(state, player_idx, effect, duration, scope),
        CardEffect::GainBlockElement { amount, element } => {
            apply_gain_block(state, player_idx, *amount, *element)
        }
        CardEffect::HandLimitBonus { bonus } => {
            state.players[player_idx].hand_limit += bonus;
            ResolveResult::Applied
        }
        CardEffect::ReadyUnit { max_level } => apply_ready_unit(state, player_idx, *max_level),
        CardEffect::HealUnit { max_level } => apply_heal_unit(state, player_idx, *max_level),
        CardEffect::DiscardForBonus {
            choice_options,
            bonus_per_card,
            max_discards,
            discard_filter,
        } => apply_discard_for_bonus(
            state,
            player_idx,
            choice_options,
            *bonus_per_card,
            *max_discards,
            *discard_filter,
        ),
        CardEffect::Decompose { mode } => apply_decompose(state, player_idx, *mode),
        CardEffect::DiscardForAttack { attacks_by_color } => {
            apply_discard_for_attack(state, player_idx, attacks_by_color)
        }
        CardEffect::PureMagic { amount } => apply_pure_magic(state, player_idx, *amount),
        CardEffect::AttackWithDefeatBonus {
            amount,
            combat_type,
            element,
            reputation_per_defeat,
            fame_per_defeat,
            armor_reduction_per_defeat,
        } => apply_attack_with_defeat_bonus(
            state,
            player_idx,
            *amount,
            *combat_type,
            *element,
            *reputation_per_defeat,
            *fame_per_defeat,
            *armor_reduction_per_defeat,
        ),

        // === Structural effects ===
        CardEffect::Compound { effects } => ResolveResult::Decomposed(effects.clone()),
        CardEffect::Choice { options } => resolve_choice(state, player_idx, options),
        CardEffect::Conditional {
            condition,
            then_effect,
            else_effect,
        } => resolve_conditional(state, player_idx, condition, then_effect, else_effect),
        CardEffect::Scaling {
            factor,
            base_effect,
            bonus_per_count,
            maximum,
        } => resolve_scaling(state, player_idx, factor, base_effect, *bonus_per_count, *maximum),

        // === Combat targeting ===
        CardEffect::SelectCombatEnemy { template } => {
            resolve_select_combat_enemy(state, player_idx, template)
        }

        // === Healing spells ===
        CardEffect::Cure { amount } => resolve_cure(state, player_idx, *amount),
        CardEffect::Disease => resolve_disease(state, player_idx),

        // === Unimplemented complex effects ===
        CardEffect::Other { .. } => ResolveResult::Skipped,
    }
}

// =============================================================================
// Atomic effect handlers
// =============================================================================

fn apply_gain_attack(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    combat_type: CombatType,
    element: Element,
) -> ResolveResult {
    // Attack only applies in combat
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let acc = &mut state.players[player_idx].combat_accumulator.attack;
    match combat_type {
        CombatType::Melee => {
            acc.normal += amount;
            add_to_elemental(&mut acc.normal_elements, element, amount);
        }
        CombatType::Ranged => {
            acc.ranged += amount;
            add_to_elemental(&mut acc.ranged_elements, element, amount);
        }
        CombatType::Siege => {
            acc.siege += amount;
            add_to_elemental(&mut acc.siege_elements, element, amount);
        }
    }
    ResolveResult::Applied
}

fn apply_gain_block(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    element: Element,
) -> ResolveResult {
    // Block only applies in combat
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let acc = &mut state.players[player_idx].combat_accumulator;
    acc.block += amount;
    add_to_elemental(&mut acc.block_elements, element, amount);
    ResolveResult::Applied
}

fn apply_gain_healing(state: &mut GameState, player_idx: usize, amount: u32) -> ResolveResult {
    let player = &mut state.players[player_idx];

    // Count wounds in hand
    let wound_count = player
        .hand
        .iter()
        .filter(|c| c.as_str() == WOUND_CARD_ID)
        .count() as u32;
    let to_heal = amount.min(wound_count);

    // Remove wounds from hand (back to front to preserve indices)
    let mut healed = 0u32;
    player.hand.retain(|c| {
        if healed < to_heal && c.as_str() == WOUND_CARD_ID {
            healed += 1;
            false // remove
        } else {
            true // keep
        }
    });

    player.healing_points += amount.saturating_sub(to_heal);
    player.wounds_healed_from_hand_this_turn += healed;
    ResolveResult::Applied
}

fn apply_gain_mana(
    state: &mut GameState,
    player_idx: usize,
    color: ManaColor,
    amount: u32,
) -> ResolveResult {
    let player = &mut state.players[player_idx];
    for _ in 0..amount {
        player.pure_mana.push(ManaToken {
            color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    ResolveResult::Applied
}

fn apply_draw_cards(state: &mut GameState, player_idx: usize, count: u32) -> ResolveResult {
    let player = &mut state.players[player_idx];
    let actual_draw = (count as usize).min(player.deck.len());
    let drawn: Vec<CardId> = player.deck.drain(..actual_draw).collect();
    player.hand.extend(drawn);
    ResolveResult::Applied
}

fn apply_gain_crystal(
    state: &mut GameState,
    player_idx: usize,
    color: Option<BasicManaColor>,
) -> ResolveResult {
    match color {
        Some(c) => {
            gain_crystal_color(state, player_idx, c);
            ResolveResult::Applied
        }
        None => {
            // Player must choose which crystal color to gain.
            // Build choice options: one per basic color.
            let options: Vec<CardEffect> = [
                BasicManaColor::Red,
                BasicManaColor::Blue,
                BasicManaColor::Green,
                BasicManaColor::White,
            ]
            .iter()
            .map(|&c| CardEffect::GainCrystal { color: Some(c) })
            .collect();
            ResolveResult::NeedsChoice(options)
        }
    }
}

fn gain_crystal_color(state: &mut GameState, player_idx: usize, color: BasicManaColor) {
    let crystals = &mut state.players[player_idx].crystals;
    let slot = match color {
        BasicManaColor::Red => &mut crystals.red,
        BasicManaColor::Blue => &mut crystals.blue,
        BasicManaColor::Green => &mut crystals.green,
        BasicManaColor::White => &mut crystals.white,
    };
    if *slot < MAX_CRYSTALS_PER_COLOR {
        *slot += 1;
    } else {
        // Overflow: gain mana token instead
        let mana_color = ManaColor::from(color);
        state.players[player_idx].pure_mana.push(ManaToken {
            color: mana_color,
            source: ManaTokenSource::Crystal,
            cannot_power_spells: false,
        });
    }
}

fn apply_take_wound(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let player = &mut state.players[player_idx];
    player.hand.push(CardId::from(WOUND_CARD_ID));
    ResolveResult::Applied
}

// =============================================================================
// Multi-step / cost effect handlers
// =============================================================================

/// Convert one mana token to a crystal of the same color.
/// If no mana tokens, skip. If one color, auto-crystallize. If multiple, offer choice.
fn apply_convert_mana_to_crystal(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let player = &state.players[player_idx];
    if player.pure_mana.is_empty() {
        return ResolveResult::Skipped;
    }

    // Collect unique colors from tokens (only basic colors can crystallize)
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    for token in &player.pure_mana {
        if let Some(basic) = to_basic_mana_color(token.color) {
            if !available_colors.contains(&basic) {
                available_colors.push(basic);
            }
        }
    }

    if available_colors.is_empty() {
        return ResolveResult::Skipped;
    }

    if available_colors.len() == 1 {
        // Auto-crystallize the only available color
        let color = available_colors[0];
        let player = &mut state.players[player_idx];
        // Remove one token of this color
        if let Some(idx) = player
            .pure_mana
            .iter()
            .position(|t| to_basic_mana_color(t.color) == Some(color))
        {
            player.pure_mana.remove(idx);
        }
        gain_crystal_color(state, player_idx, color);
        ResolveResult::Applied
    } else {
        // Offer choice: one option per available color
        // Token consumption is deferred to ChoiceResolution::CrystallizeConsume
        // which runs when the player picks a color.
        let options: Vec<CardEffect> = available_colors
            .iter()
            .map(|&c| CardEffect::GainCrystal { color: Some(c) })
            .collect();
        ResolveResult::NeedsChoiceWith(options, ChoiceResolution::CrystallizeConsume)
    }
}

/// Helper: convert ManaColor to BasicManaColor if it's a basic color.
fn to_basic_mana_color(color: ManaColor) -> Option<BasicManaColor> {
    match color {
        ManaColor::Red => Some(BasicManaColor::Red),
        ManaColor::Blue => Some(BasicManaColor::Blue),
        ManaColor::Green => Some(BasicManaColor::Green),
        ManaColor::White => Some(BasicManaColor::White),
        _ => None, // Gold and Black are not crystallizable
    }
}

/// Apply CardBoost — find eligible hand cards, present boosted powered effects.
///
/// Eligible cards: BasicAction or AdvancedAction (not wounds, spells, artifacts).
/// - 0 eligible → skip
/// - 1 eligible → auto-select (move to play_area, resolve boosted powered_effect)
/// - N eligible → NeedsChoice with BoostTarget resolution
fn apply_card_boost(state: &mut GameState, player_idx: usize, bonus: u32) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find eligible hand cards: BasicAction or AdvancedAction
    let eligible: Vec<(usize, &CardId)> = player
        .hand
        .iter()
        .enumerate()
        .filter(|(_, card_id)| {
            mk_data::cards::get_card(card_id.as_str()).is_some_and(|def| {
                matches!(
                    def.card_type,
                    DeedCardType::BasicAction | DeedCardType::AdvancedAction
                )
            })
        })
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-select: move card to play_area, resolve boosted powered_effect
            let (hand_idx, card_id) = eligible[0];
            let boosted_effect = mk_data::cards::get_card(card_id.as_str())
                .map(|def| scale_effect(&def.powered_effect, bonus))
                .unwrap_or(CardEffect::Noop);

            let player = &mut state.players[player_idx];
            let card = player.hand.remove(hand_idx);
            player.play_area.push(card);

            ResolveResult::Decomposed(vec![boosted_effect])
        }
        _ => {
            // Present each eligible card's boosted powered_effect as a choice
            let eligible_hand_indices: Vec<usize> = eligible.iter().map(|(i, _)| *i).collect();
            let options: Vec<CardEffect> = eligible
                .iter()
                .map(|(_, card_id)| {
                    mk_data::cards::get_card(card_id.as_str())
                        .map(|def| scale_effect(&def.powered_effect, bonus))
                        .unwrap_or(CardEffect::Noop)
                })
                .collect();

            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::BoostTarget {
                    eligible_hand_indices,
                },
            )
        }
    }
}

/// Mana Draw Powered — pick an available source die, then choose a color.
///
/// Finds the first available (not taken, not depleted) die, presents 4 basic
/// color options. The die is marked as taken via ManaDrawTakeDie resolution.
fn apply_mana_draw_powered_simplified(
    state: &mut GameState,
    _player_idx: usize,
    tokens_per_die: u32,
) -> ResolveResult {
    // Find an available die
    let available_die = state
        .source
        .dice
        .iter()
        .find(|d| d.taken_by_player_id.is_none() && !d.is_depleted);

    let die = match available_die {
        Some(d) => d,
        None => return ResolveResult::Skipped,
    };

    let die_id = die.id.clone();

    // Count remaining available dice (excluding the one we're about to take)
    let remaining = state
        .source
        .dice
        .iter()
        .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted && d.id != die_id)
        .count() as u32;

    // Offer a choice of basic mana colors, each giving `tokens_per_die` tokens
    let options: Vec<CardEffect> = vec![
        CardEffect::GainMana {
            color: ManaColor::Red,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::Blue,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::Green,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::White,
            amount: tokens_per_die,
        },
    ];

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::ManaDrawTakeDie {
            die_id,
            tokens_per_die,
            remaining_dice: remaining,
        },
    )
}

/// Apply a discard cost — player must discard a card, then the then_effect resolves.
///
/// For count == 1:
/// - 0 eligible cards → skip
/// - 1 eligible card → auto-discard and resolve then_effect
/// - N eligible cards → present choice with DiscardThenContinue resolution
fn apply_discard_cost(
    state: &mut GameState,
    player_idx: usize,
    count: u32,
    filter_wounds: bool,
    wounds_only: bool,
    then_effect: &CardEffect,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Build eligible hand indices
    let eligible_indices: Vec<usize> = player
        .hand
        .iter()
        .enumerate()
        .filter(|(_, c)| {
            let is_wound = c.as_str() == WOUND_CARD_ID;
            if wounds_only {
                is_wound
            } else if filter_wounds {
                !is_wound
            } else {
                true
            }
        })
        .map(|(i, _)| i)
        .collect();

    if count == 1 {
        match eligible_indices.len() {
            0 => ResolveResult::Skipped,
            1 => {
                // Auto-discard the only eligible card
                let idx = eligible_indices[0];
                let player = &mut state.players[player_idx];
                let discarded = player.hand.remove(idx);
                player.discard.push(discarded);
                ResolveResult::Decomposed(vec![then_effect.clone()])
            }
            _ => {
                // Present each eligible card as a choice option.
                // Each option leads to the same then_effect; the card is discarded
                // via DiscardThenContinue resolution.
                let options: Vec<CardEffect> = eligible_indices
                    .iter()
                    .map(|_| then_effect.clone())
                    .collect();
                ResolveResult::NeedsChoiceWith(
                    options,
                    ChoiceResolution::DiscardThenContinue { eligible_indices },
                )
            }
        }
    } else {
        // Multi-card discard: not yet implemented, skip for Phase 2
        ResolveResult::Skipped
    }
}

/// Apply any modifier effect (rule overrides, terrain costs, combat bonuses, etc.).
fn apply_modifier(
    state: &mut GameState,
    player_idx: usize,
    effect: &ModifierEffect,
    duration: &ModifierDuration,
    scope: &ModifierScope,
) -> ResolveResult {
    let player_id = state.players[player_idx].id.clone();
    let modifier_count = state.active_modifiers.len();
    let modifier_id = format!(
        "mod_{}_r{}_t{}",
        modifier_count, state.round, state.current_player_index
    );
    // Determine the source card from the last card played (top of play area),
    // falling back to a generic source.
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from(modifier_id.as_str()),
        source: ModifierSource::Card {
            card_id: source_card_id,
            player_id: player_id.clone(),
        },
        duration: *duration,
        scope: scope.clone(),
        effect: effect.clone(),
        created_at_round: state.round,
        created_by_player_id: player_id,
    });
    ResolveResult::Applied
}

// =============================================================================
// Unit effect handlers
// =============================================================================

/// Ready a spent unit at or below the given level.
/// 0 eligible → skip. 1 eligible → auto-ready. N eligible → NeedsChoice.
///
/// The choice options are `GainHealing { amount: 0 }` as a sentinel — the actual
/// side effect (readying the unit) is done via `ReadyUnitTarget` resolution.
/// To avoid a new ChoiceResolution variant, we use a simpler approach:
/// each option is a `Noop` that carries metadata via the `ReadyUnitTarget` resolution.
///
/// Actually, to keep it simple and self-contained, we resolve inline:
/// - Build choice options as `CardEffect::Noop` (one per eligible unit)
/// - Use `ChoiceResolution::ReadyUnitTarget { eligible_unit_indices }` to track which
///   unit to ready when the player picks an option.
fn apply_ready_unit(state: &mut GameState, player_idx: usize, max_level: u8) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find spent units at or below max_level
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.state == UnitState::Spent && u.level <= max_level)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-ready the single eligible unit
            let unit_idx = eligible[0];
            state.players[player_idx].units[unit_idx].state = UnitState::Ready;
            ResolveResult::Applied
        }
        _ => {
            // Present choice: one Noop per eligible unit
            // Resolution side-effect readies the selected unit
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            let eligible_indices = eligible;
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::ReadyUnitTarget {
                    eligible_unit_indices: eligible_indices,
                },
            )
        }
    }
}

fn apply_heal_unit(state: &mut GameState, player_idx: usize, max_level: u8) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find wounded units at or below max_level
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.wounded && u.level <= max_level)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            let unit_idx = eligible[0];
            state.players[player_idx].units[unit_idx].wounded = false;
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::HealUnitTarget {
                    eligible_unit_indices: eligible,
                },
            )
        }
    }
}

fn apply_discard_for_bonus(
    state: &mut GameState,
    player_idx: usize,
    choice_options: &[CardEffect],
    bonus_per_card: u32,
    max_discards: u32,
    discard_filter: DiscardForBonusFilter,
) -> ResolveResult {
    use mk_types::pending::PendingDiscardForBonus;

    // Filter to resolvable options only
    let resolvable: Vec<CardEffect> = choice_options
        .iter()
        .filter(|opt| is_resolvable(state, player_idx, opt))
        .cloned()
        .collect();

    if resolvable.is_empty() {
        return ResolveResult::Skipped;
    }

    // Get the source card from the play area (most recently played)
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));

    // Set ActivePending::DiscardForBonus directly
    let pending = PendingDiscardForBonus {
        source_card_id,
        choice_options: resolvable,
        bonus_per_card,
        max_discards,
        discard_filter,
    };
    state.players[player_idx].pending.active =
        Some(ActivePending::DiscardForBonus(pending));

    // Return PendingSet to pause the queue
    ResolveResult::PendingSet
}

/// Apply Decompose effect — set pending so player can select which card to decompose.
///
/// Finds eligible hand cards (BasicAction or AdvancedAction), presents as pending.
/// 0 eligible → skip. 1 eligible → auto-select (the player still sees pending).
/// N eligible → pending with all options.
fn apply_decompose(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find eligible hand cards: BasicAction or AdvancedAction (not wounds, spells, artifacts)
    let has_eligible = player.hand.iter().any(|card_id| {
        mk_data::cards::get_card(card_id.as_str()).is_some_and(|def| {
            matches!(
                def.card_type,
                DeedCardType::BasicAction | DeedCardType::AdvancedAction
            )
        })
    });

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    // Get the source card from the play area
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));

    // Set ActivePending::Decompose
    state.players[player_idx].pending.active =
        Some(ActivePending::Decompose(PendingDecompose {
            source_card_id,
            mode,
        }));

    ResolveResult::PendingSet
}

/// Apply DiscardForAttack effect — discard an action card, then gain attack based on card color.
///
/// Finds eligible hand cards (BasicAction or AdvancedAction), presents as choice.
/// Each choice option is the attack effect for the card's color.
/// 0 eligible → skip. 1 eligible → auto-discard + resolve. N → NeedsChoice.
fn apply_discard_for_attack(
    state: &mut GameState,
    player_idx: usize,
    attacks_by_color: &[(BasicManaColor, CardEffect)],
) -> ResolveResult {
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let player = &state.players[player_idx];

    // Find eligible hand cards and their color-based attack effects
    let eligible: Vec<(usize, CardEffect)> = player
        .hand
        .iter()
        .enumerate()
        .filter_map(|(idx, card_id)| {
            let def = mk_data::cards::get_card(card_id.as_str())?;
            if !matches!(
                def.card_type,
                DeedCardType::BasicAction | DeedCardType::AdvancedAction
            ) {
                return None;
            }
            let basic_color = def.color.to_basic_mana_color()?;
            let attack = attacks_by_color
                .iter()
                .find(|(c, _)| *c == basic_color)
                .map(|(_, eff)| eff.clone())?;
            Some((idx, attack))
        })
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-discard the only eligible card
            let (hand_idx, attack_effect) = eligible.into_iter().next().unwrap();
            let player = &mut state.players[player_idx];
            let discarded = player.hand.remove(hand_idx);
            player.discard.push(discarded);
            ResolveResult::Decomposed(vec![attack_effect])
        }
        _ => {
            // Present each eligible card's attack as a choice
            let eligible_indices: Vec<usize> = eligible.iter().map(|(i, _)| *i).collect();
            let options: Vec<CardEffect> = eligible.into_iter().map(|(_, eff)| eff).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::DiscardThenContinue { eligible_indices },
            )
        }
    }
}

/// Apply Pure Magic effect — pay a mana token, gain effect based on its color.
///
/// Green→Move, White→Influence, Blue→Block(combat), Red→Attack(combat).
/// Gold allows all four choices. Token consumption via PureMagicConsume resolution.
fn apply_pure_magic(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
) -> ResolveResult {
    let player = &state.players[player_idx];
    let in_combat = state.combat.is_some();

    if player.pure_mana.is_empty() {
        return ResolveResult::Skipped;
    }

    // Collect unique basic colors from tokens
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    let mut has_gold = false;
    for token in &player.pure_mana {
        match token.color {
            ManaColor::Gold => {
                has_gold = true;
            }
            ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White => {
                if let Some(basic) = to_basic_mana_color(token.color) {
                    if !available_colors.contains(&basic) {
                        available_colors.push(basic);
                    }
                }
            }
            _ => {} // Black: not usable for pure magic
        }
    }

    // Build parallel arrays: options (gain effects) + token_colors (which token to consume)
    let mut options: Vec<CardEffect> = Vec::new();
    let mut token_colors: Vec<ManaColor> = Vec::new();

    for &basic_color in &available_colors {
        if let Some(eff) = pure_magic_effect_for_color(basic_color, amount, in_combat) {
            options.push(eff);
            token_colors.push(ManaColor::from(basic_color));
        }
    }

    // Gold: one option per basic color not already covered
    if has_gold {
        for &basic_color in &ALL_BASIC_MANA_COLORS {
            if available_colors.contains(&basic_color) {
                continue;
            }
            if let Some(eff) = pure_magic_effect_for_color(basic_color, amount, in_combat) {
                options.push(eff);
                token_colors.push(ManaColor::Gold);
            }
        }
    }

    match options.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-select: consume the token and decompose
            let color = token_colors[0];
            let player = &mut state.players[player_idx];
            if let Some(idx) = player.pure_mana.iter().position(|t| t.color == color) {
                player.pure_mana.remove(idx);
            }
            ResolveResult::Decomposed(options)
        }
        _ => ResolveResult::NeedsChoiceWith(
            options,
            ChoiceResolution::PureMagicConsume { token_colors },
        ),
    }
}

/// Get the effect for Pure Magic given a color.
/// Green→Move, White→Influence, Blue→Block(combat only), Red→Attack(combat only).
fn pure_magic_effect_for_color(
    color: BasicManaColor,
    amount: u32,
    in_combat: bool,
) -> Option<CardEffect> {
    match color {
        BasicManaColor::Green => Some(CardEffect::GainMove { amount }),
        BasicManaColor::White => Some(CardEffect::GainInfluence { amount }),
        BasicManaColor::Blue => {
            if in_combat {
                Some(CardEffect::GainBlock {
                    amount,
                    element: Element::Physical,
                })
            } else {
                None
            }
        }
        BasicManaColor::Red => {
            if in_combat {
                Some(CardEffect::GainAttack {
                    amount,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                })
            } else {
                None
            }
        }
    }
}

fn apply_attack_with_defeat_bonus(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    combat_type: CombatType,
    element: Element,
    reputation_per_defeat: i32,
    fame_per_defeat: u32,
    armor_reduction_per_defeat: u32,
) -> ResolveResult {
    // Step 1: Apply the attack via normal GainAttack logic
    let attack_result = apply_gain_attack(state, player_idx, amount, combat_type, element);
    if matches!(attack_result, ResolveResult::Skipped) {
        return ResolveResult::Skipped;
    }

    // Step 2: Register a tracker for per-enemy-defeated bonuses
    let tracker = AttackDefeatFameTracker {
        source_card_id: None, // Set by the queue's source tracking
        attack_type: combat_type,
        element: AttackElement::Physical,
        amount,
        remaining: amount,
        fame: 0,
        reputation_per_defeat: if reputation_per_defeat != 0 {
            Some(reputation_per_defeat)
        } else {
            None
        },
        fame_per_defeat: if fame_per_defeat != 0 {
            Some(fame_per_defeat)
        } else {
            None
        },
        armor_reduction_per_defeat: if armor_reduction_per_defeat != 0 {
            Some(armor_reduction_per_defeat)
        } else {
            None
        },
    };

    // Add to deferred pending as AttackDefeatFame
    let player = &mut state.players[player_idx];
    let mut found = false;
    for d in player.pending.deferred.iter_mut() {
        if let DeferredPending::AttackDefeatFame(trackers) = d {
            if !trackers.is_full() {
                trackers.push(tracker.clone());
            }
            found = true;
            break;
        }
    }
    if !found && !player.pending.deferred.is_full() {
        let mut trackers = arrayvec::ArrayVec::new();
        trackers.push(tracker);
        player
            .pending
            .deferred
            .push(DeferredPending::AttackDefeatFame(trackers));
    }

    ResolveResult::Applied
}

// =============================================================================
// Structural effect handlers
// =============================================================================

/// Handle a Choice effect by filtering resolvable options.
fn resolve_choice(state: &GameState, player_idx: usize, options: &[CardEffect]) -> ResolveResult {
    let resolvable: Vec<CardEffect> = options
        .iter()
        .filter(|opt| is_resolvable(state, player_idx, opt))
        .cloned()
        .collect();

    match resolvable.len() {
        0 => ResolveResult::Skipped,
        1 => ResolveResult::Decomposed(resolvable),
        _ => ResolveResult::NeedsChoice(resolvable),
    }
}

/// Evaluate a conditional and decompose into the appropriate branch.
fn resolve_conditional(
    state: &GameState,
    player_idx: usize,
    condition: &EffectCondition,
    then_effect: &CardEffect,
    else_effect: &Option<Box<CardEffect>>,
) -> ResolveResult {
    if evaluate_condition(state, player_idx, condition) {
        ResolveResult::Decomposed(vec![then_effect.clone()])
    } else if let Some(else_eff) = else_effect {
        ResolveResult::Decomposed(vec![*else_eff.clone()])
    } else {
        ResolveResult::Skipped
    }
}

/// Evaluate a scaling factor and produce a scaled version of the base effect.
fn resolve_scaling(
    state: &GameState,
    player_idx: usize,
    factor: &ScalingFactor,
    base_effect: &CardEffect,
    bonus_per_count: Option<u32>,
    maximum: Option<u32>,
) -> ResolveResult {
    let count = evaluate_scaling(state, player_idx, factor);
    let per_count = bonus_per_count.unwrap_or(1);
    let bonus = count * per_count;
    let bonus = bonus.min(maximum.unwrap_or(u32::MAX));
    let scaled = scale_effect(base_effect, bonus);
    ResolveResult::Decomposed(vec![scaled])
}

// =============================================================================
// Condition evaluator
// =============================================================================

/// Evaluate a condition against the current game state for a player.
fn evaluate_condition(state: &GameState, player_idx: usize, condition: &EffectCondition) -> bool {
    let player = &state.players[player_idx];

    match condition {
        EffectCondition::TimeOfDay { time } => state.time_of_day == *time,

        EffectCondition::InCombat => state.combat.is_some(),

        EffectCondition::InPhase { phases } => state
            .combat
            .as_ref()
            .is_some_and(|c| phases.contains(&c.phase)),

        EffectCondition::OnTerrain { terrain } => player.position.as_ref().is_some_and(|pos| {
            state
                .map
                .hexes
                .get(&pos.key())
                .is_some_and(|hex| terrain.contains(&hex.terrain))
        }),

        EffectCondition::BlockedSuccessfully => state
            .combat
            .as_ref()
            .is_some_and(|c| c.all_damage_blocked_this_phase),

        EffectCondition::EnemyDefeatedThisCombat => state
            .combat
            .as_ref()
            .is_some_and(|c| c.enemies.iter().any(|e| e.is_defeated)),

        EffectCondition::ManaUsedThisTurn { color } => match color {
            Some(c) => player.mana_used_this_turn.contains(c),
            None => !player.mana_used_this_turn.is_empty(),
        },

        EffectCondition::HasWoundsInHand => player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID),

        EffectCondition::NoUnitRecruitedThisTurn => !player
            .flags
            .contains(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN),

        EffectCondition::LowestFame => {
            let player_fame = player.fame;
            let min_fame = state.players.iter().map(|p| p.fame).min().unwrap_or(0);
            player_fame <= min_fame
        }

        EffectCondition::IsNightOrUnderground => {
            state.time_of_day == TimeOfDay::Night
                || state.combat.as_ref().is_some_and(|c| c.night_mana_rules)
        }

        EffectCondition::InInteraction => {
            // Simplified: check if player is at a site (full check needs site properties)
            player.position.as_ref().is_some_and(|pos| {
                state
                    .map
                    .hexes
                    .get(&pos.key())
                    .and_then(|hex| hex.site.as_ref())
                    .is_some()
            })
        }

        EffectCondition::AtFortifiedSite => {
            // Simplified: check if player is at keep, mage tower, or city
            player.position.as_ref().is_some_and(|pos| {
                state
                    .map
                    .hexes
                    .get(&pos.key())
                    .and_then(|hex| hex.site.as_ref())
                    .is_some_and(|site| {
                        matches!(
                            site.site_type,
                            SiteType::Keep | SiteType::MageTower | SiteType::City
                        )
                    })
            })
        }

        EffectCondition::AtMagicalGlade => player.position.as_ref().is_some_and(|pos| {
            state
                .map
                .hexes
                .get(&pos.key())
                .and_then(|hex| hex.site.as_ref())
                .is_some_and(|site| site.site_type == SiteType::MagicalGlade)
        }),
    }
}

// =============================================================================
// Scaling evaluator
// =============================================================================

/// Evaluate a scaling factor and return the multiplier count.
fn evaluate_scaling(state: &GameState, player_idx: usize, factor: &ScalingFactor) -> u32 {
    let player = &state.players[player_idx];

    match factor {
        ScalingFactor::PerEnemy => state
            .combat
            .as_ref()
            .map(|c| {
                c.enemies
                    .iter()
                    .filter(|e| !e.is_defeated && e.summoned_by_instance_id.is_none())
                    .count() as u32
            })
            .unwrap_or(0),

        ScalingFactor::PerWoundInHand => player
            .hand
            .iter()
            .filter(|c| c.as_str() == WOUND_CARD_ID)
            .count() as u32,

        ScalingFactor::PerWoundThisCombat => state
            .combat
            .as_ref()
            .map(|c| c.wounds_this_combat)
            .unwrap_or(0),

        ScalingFactor::PerUnit { filter } => count_units_with_filter(player, filter.as_ref()),

        ScalingFactor::PerCrystalColor => {
            let c = &player.crystals;
            let mut count = 0u32;
            if c.red > 0 {
                count += 1;
            }
            if c.blue > 0 {
                count += 1;
            }
            if c.green > 0 {
                count += 1;
            }
            if c.white > 0 {
                count += 1;
            }
            count
        }

        ScalingFactor::PerCompleteCrystalSet => {
            let c = &player.crystals;
            c.red.min(c.blue).min(c.green).min(c.white) as u32
        }

        ScalingFactor::PerEmptyCommandToken => {
            let used = player.units.len() as u32;
            player.command_tokens.saturating_sub(used)
        }

        ScalingFactor::PerWoundTotal => {
            let in_hand = player
                .hand
                .iter()
                .filter(|c| c.as_str() == WOUND_CARD_ID)
                .count() as u32;
            let wounded_units = player.units.iter().filter(|u| u.wounded).count() as u32;
            in_hand + wounded_units
        }

        ScalingFactor::PerEnemyBlocked => state
            .combat
            .as_ref()
            .map(|c| {
                c.enemies
                    .iter()
                    .filter(|e| e.is_blocked && e.summoned_by_instance_id.is_none())
                    .count() as u32
            })
            .unwrap_or(0),
    }
}

fn count_units_with_filter(player: &PlayerState, filter: Option<&UnitFilter>) -> u32 {
    match filter {
        None => {
            // Default: count non-wounded units
            player.units.iter().filter(|u| !u.wounded).count() as u32
        }
        Some(f) => player
            .units
            .iter()
            .filter(|u| {
                if let Some(wounded) = f.wounded {
                    if u.wounded != wounded {
                        return false;
                    }
                }
                if let Some(required_state) = &f.state {
                    if u.state != *required_state {
                        return false;
                    }
                }
                true
            })
            .count() as u32,
    }
}

// =============================================================================
// Cure / Disease resolvers
// =============================================================================

/// Cure: remove up to `amount` wounds from hand, draw 1 card per wound removed.
fn resolve_cure(state: &mut GameState, player_idx: usize, amount: u32) -> ResolveResult {
    let player = &mut state.players[player_idx];

    // Remove wounds from hand (up to amount)
    let mut wounds_removed = 0u32;
    let mut i = 0;
    while i < player.hand.len() && wounds_removed < amount {
        if player.hand[i].as_str() == WOUND_CARD_ID {
            player.hand.remove(i);
            wounds_removed += 1;
        } else {
            i += 1;
        }
    }

    if wounds_removed == 0 {
        return ResolveResult::Skipped;
    }

    // Draw 1 card per wound healed
    let actual_draw = (wounds_removed as usize).min(player.deck.len());
    let drawn: Vec<CardId> = player.deck.drain(..actual_draw).collect();
    player.hand.extend(drawn);

    ResolveResult::Applied
}

/// Disease: for each fully-blocked enemy, set armor to 1 for rest of combat.
fn resolve_disease(state: &mut GameState, player_idx: usize) -> ResolveResult {
    use mk_types::modifier::{
        ActiveModifier, EnemyStat as ModEnemyStat, ModifierDuration, ModifierEffect,
        ModifierScope, ModifierSource,
    };
    use mk_types::ids::ModifierId;

    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    let player_id = state.players[player_idx].id.clone();

    // Find all enemies where ALL attacks are blocked (is_blocked = true)
    let blocked_enemy_ids: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| !e.is_defeated && !e.is_summoner_hidden && e.is_blocked)
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if blocked_enemy_ids.is_empty() {
        return ResolveResult::Skipped;
    }

    // For each blocked enemy, push a modifier that sets armor to minimum 0 with a
    // large negative change (effectively reducing to 1).
    // We model this as EnemyStat Armor with a very large negative amount and minimum 1.
    for enemy_id in &blocked_enemy_ids {
        let modifier_count = state.active_modifiers.len();
        let modifier_id = format!(
            "mod_{}_r{}_t{}",
            modifier_count, state.round, state.current_player_index
        );
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from(modifier_id.as_str()),
            source: ModifierSource::Card {
                card_id: CardId::from("cure"),
                player_id: player_id.clone(),
            },
            duration: ModifierDuration::Combat,
            scope: ModifierScope::OneEnemy {
                enemy_id: enemy_id.clone(),
            },
            effect: ModifierEffect::EnemyStat {
                stat: ModEnemyStat::Armor,
                amount: -100, // large enough to reduce any armor to minimum
                minimum: 1,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
            },
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    }

    ResolveResult::Applied
}

// =============================================================================
// SelectCombatEnemy resolver (card-sourced)
// =============================================================================

/// Resolve a SelectCombatEnemy effect from a card.
/// Filters eligible enemies, auto-resolves if 0 or 1, or signals pending if N.
fn resolve_select_combat_enemy(
    state: &mut GameState,
    player_idx: usize,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> ResolveResult {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    // Filter eligible enemies (same logic as unit-ability version in action_pipeline)
    let mut eligible_ids: Vec<String> = Vec::new();
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }

        let def = match mk_data::enemies::get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Apply template filters
        if template.exclude_fortified
            && crate::combat_resolution::is_effectively_fortified(
                def,
                enemy.instance_id.as_str(),
                combat.is_at_fortified_site,
                &state.active_modifiers,
            )
        {
            continue;
        }

        if template.exclude_arcane_immune
            && crate::combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
        {
            continue;
        }

        if let Some(resist) = template.exclude_resistance {
            if def.resistances.contains(&resist) {
                continue;
            }
        }

        eligible_ids.push(enemy.instance_id.as_str().to_string());
    }

    match eligible_ids.len() {
        0 => {
            // No eligible enemies — effect fizzles
            ResolveResult::Skipped
        }
        1 => {
            // Auto-resolve with the single eligible enemy
            let uid: Option<mk_types::ids::UnitInstanceId> = None;
            if let Err(_) = crate::action_pipeline::apply_select_enemy_effects_pub(
                state, player_idx, &uid, &eligible_ids[0], template,
            ) {
                return ResolveResult::Skipped;
            }
            ResolveResult::Applied
        }
        _ => {
            // Multiple eligible — need player to choose
            ResolveResult::NeedsSelectCombatEnemy {
                eligible_enemy_ids: eligible_ids,
                template: *template,
            }
        }
    }
}

// =============================================================================
// Resolvability check
// =============================================================================

/// Check if an effect can currently be resolved (used for Choice filtering).
pub(crate) fn is_resolvable(state: &GameState, player_idx: usize, effect: &CardEffect) -> bool {
    let player = &state.players[player_idx];

    match effect {
        // Always resolvable
        CardEffect::GainMove { .. }
        | CardEffect::GainInfluence { .. }
        | CardEffect::GainFame { .. }
        | CardEffect::ChangeReputation { .. }
        | CardEffect::GainMana { .. }
        | CardEffect::GainCrystal { .. }
        | CardEffect::TakeWound
        | CardEffect::Noop => true,

        // Only in combat
        CardEffect::GainAttack { .. }
        | CardEffect::GainBlock { .. }
        | CardEffect::GainBlockElement { .. }
        | CardEffect::AttackWithDefeatBonus { .. } => state.combat.is_some(),

        // Need wounds in hand
        CardEffect::GainHealing { .. } => {
            player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID)
                || player.units.iter().any(|u| u.wounded)
        }

        // Need cards in deck
        CardEffect::DrawCards { .. } => !player.deck.is_empty(),

        // Compound: at least one sub-effect resolvable
        CardEffect::Compound { effects } => {
            effects.iter().any(|e| is_resolvable(state, player_idx, e))
        }

        // Choice: at least one option resolvable
        CardEffect::Choice { options } => {
            options.iter().any(|o| is_resolvable(state, player_idx, o))
        }

        // Conditional/Scaling: always resolvable (condition/factor evaluated at resolve time)
        CardEffect::Conditional { .. } | CardEffect::Scaling { .. } => true,

        // Multi-step effects: resolvable by default (will be filtered at resolve time)
        CardEffect::ConvertManaToCrystal
        | CardEffect::CardBoost { .. }
        | CardEffect::ManaDrawPowered { .. }
        | CardEffect::DiscardCost { .. }
        | CardEffect::ApplyModifier { .. }
        | CardEffect::HandLimitBonus { .. }
        | CardEffect::ReadyUnit { .. }
        | CardEffect::HealUnit { .. }
        | CardEffect::DiscardForBonus { .. }
        | CardEffect::Decompose { .. }
        | CardEffect::DiscardForAttack { .. }
        | CardEffect::PureMagic { .. } => true,

        // SelectCombatEnemy: only in combat
        CardEffect::SelectCombatEnemy { .. } => state.combat.is_some(),

        // Cure: need wounds in hand
        CardEffect::Cure { .. } => player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID),

        // Disease: only in combat (sets armor for blocked enemies)
        CardEffect::Disease => state.combat.is_some(),

        // Unknown: default resolvable
        CardEffect::Other { .. } => true,
    }
}

// =============================================================================
// Helpers
// =============================================================================

/// Add amount to the appropriate element field of ElementalValues.
fn add_to_elemental(values: &mut ElementalValues, element: Element, amount: u32) {
    match element {
        Element::Physical => values.physical += amount,
        Element::Fire => values.fire += amount,
        Element::Ice => values.ice += amount,
        Element::ColdFire => values.cold_fire += amount,
    }
}

/// Create a scaled copy of an effect with bonus added to its amount.
fn scale_effect(effect: &CardEffect, bonus: u32) -> CardEffect {
    match effect {
        CardEffect::GainMove { amount } => CardEffect::GainMove {
            amount: amount + bonus,
        },
        CardEffect::GainInfluence { amount } => CardEffect::GainInfluence {
            amount: amount + bonus,
        },
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => CardEffect::GainAttack {
            amount: amount + bonus,
            combat_type: *combat_type,
            element: *element,
        },
        CardEffect::GainBlock { amount, element } => CardEffect::GainBlock {
            amount: amount + bonus,
            element: *element,
        },
        CardEffect::GainHealing { amount } => CardEffect::GainHealing {
            amount: amount + bonus,
        },
        CardEffect::GainMana { color, amount } => CardEffect::GainMana {
            color: *color,
            amount: amount + bonus,
        },
        CardEffect::DrawCards { count } => CardEffect::DrawCards {
            count: count + bonus,
        },
        CardEffect::GainFame { amount } => CardEffect::GainFame {
            amount: amount + bonus,
        },
        CardEffect::ChangeReputation { amount } => CardEffect::ChangeReputation {
            amount: amount + bonus as i32,
        },
        CardEffect::AttackWithDefeatBonus {
            amount,
            combat_type,
            element,
            reputation_per_defeat,
            fame_per_defeat,
            armor_reduction_per_defeat,
        } => CardEffect::AttackWithDefeatBonus {
            amount: amount + bonus,
            combat_type: *combat_type,
            element: *element,
            reputation_per_defeat: *reputation_per_defeat,
            fame_per_defeat: *fame_per_defeat,
            armor_reduction_per_defeat: *armor_reduction_per_defeat,
        },
        // Recursive structural handling
        CardEffect::Compound { effects } => CardEffect::Compound {
            effects: effects.iter().map(|e| scale_effect(e, bonus)).collect(),
        },
        CardEffect::Choice { options } => CardEffect::Choice {
            options: options.iter().map(|o| scale_effect(o, bonus)).collect(),
        },
        CardEffect::Conditional {
            condition,
            then_effect,
            else_effect,
        } => CardEffect::Conditional {
            condition: condition.clone(),
            then_effect: Box::new(scale_effect(then_effect, bonus)),
            else_effect: else_effect
                .as_ref()
                .map(|e| Box::new(scale_effect(e, bonus))),
        },
        CardEffect::Scaling {
            factor,
            base_effect,
            bonus_per_count,
            maximum,
        } => CardEffect::Scaling {
            factor: factor.clone(),
            base_effect: Box::new(scale_effect(base_effect, bonus)),
            bonus_per_count: *bonus_per_count,
            maximum: *maximum,
        },
        // For effects without a simple "amount", return unchanged.
        other => other.clone(),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::hex::HexCoord;
    use mk_types::ids::{PlayerId, SourceDieId, UnitId, UnitInstanceId};
    use mk_types::pending::PendingQueue;
    use mk_types::rng::RngState;

    /// Create a minimal GameState for testing with one player.
    fn test_state() -> GameState {
        GameState {
            phase: GamePhase::Round,
            time_of_day: TimeOfDay::Day,
            round: 1,
            turn_order: vec![PlayerId::from("p1")],
            current_player_index: 0,
            end_of_round_announced_by: None,
            players_with_final_turn: vec![],
            players: vec![test_player()],
            map: MapState::default(),
            combat: None,
            round_phase: RoundPhase::PlayerTurns,
            available_tactics: vec![],
            removed_tactics: vec![],
            dummy_player_tactic: None,
            tactics_selection_order: vec![],
            current_tactic_selector: None,
            source: ManaSource::default(),
            offers: GameOffers::default(),
            enemy_tokens: EnemyTokenPiles::default(),
            ruins_tokens: RuinsTokenPiles::default(),
            decks: GameDecks::default(),
            city_level: 0,
            cities: Default::default(),
            active_modifiers: vec![],
            action_epoch: 0,
            next_instance_counter: 1,
            rng: RngState::new(42),
            wound_pile_count: None,
            scenario_id: mk_types::ids::ScenarioId::from("solo"),
            scenario_config: mk_data::scenarios::first_reconnaissance(),
            scenario_end_triggered: false,
            final_turns_remaining: None,
            game_ended: false,
            winning_player_id: None,
            pending_cooperative_assault: None,
            final_score_result: None,
            mana_overload_center: None,
            mana_enhancement_center: None,
            source_opening_center: None,
            dummy_player: None,
        }
    }

    fn test_player() -> PlayerState {
        PlayerState {
            id: PlayerId::from("p1"),
            hero: Hero::Arythea,
            position: Some(HexCoord::new(0, 0)),
            fame: 0,
            level: 1,
            reputation: 0,
            armor: 2,
            hand_limit: 5,
            command_tokens: 1,
            hand: vec![],
            deck: vec![
                CardId::from("march"),
                CardId::from("swiftness"),
                CardId::from("rage"),
            ],
            discard: vec![],
            play_area: vec![],
            removed_cards: vec![],
            units: Default::default(),
            bonds_of_loyalty_unit_instance_id: None,
            attached_banners: Default::default(),
            skills: vec![],
            skill_cooldowns: Default::default(),
            skill_flip_state: Default::default(),
            remaining_hero_skills: vec![],
            master_of_chaos_state: None,
            kept_enemy_tokens: Default::default(),
            crystals: Crystals::default(),
            spent_crystals_this_turn: Crystals::default(),
            selected_tactic: None,
            tactic_state: Default::default(),
            pure_mana: vec![],
            used_die_ids: vec![],
            mana_draw_die_ids: vec![],
            mana_used_this_turn: vec![],
            combat_accumulator: Default::default(),
            move_points: 0,
            influence_points: 0,
            healing_points: 0,
            enemies_defeated_this_turn: 0,
            wounds_healed_from_hand_this_turn: 0,
            units_healed_this_turn: vec![],
            units_recruited_this_interaction: vec![],
            spell_colors_cast_this_turn: vec![],
            spells_cast_by_color_this_turn: Default::default(),
            meditation_hand_limit_bonus: 0,
            wounds_received_this_turn: Default::default(),
            time_bending_set_aside_cards: vec![],
            mysterious_box_state: None,
            flags: PlayerFlags::empty(),
            pending: PendingQueue::new(),
        }
    }

    // ---- Atomic effects ----

    #[test]
    fn gain_move() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainMove { amount: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 3);
    }

    #[test]
    fn gain_influence() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainInfluence { amount: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn gain_fame() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainFame { amount: 5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].fame, 5);
    }

    #[test]
    fn change_reputation_clamped() {
        let mut state = test_state();
        state.players[0].reputation = 6;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ChangeReputation { amount: 5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].reputation, 7); // clamped to max

        state.players[0].reputation = -6;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ChangeReputation { amount: -5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].reputation, -7); // clamped to min
    }

    #[test]
    fn draw_cards() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DrawCards { count: 2 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 2);
        assert_eq!(state.players[0].deck.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "march");
        assert_eq!(state.players[0].hand[1].as_str(), "swiftness");
    }

    #[test]
    fn draw_cards_limited_by_deck() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DrawCards { count: 10 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 3); // only 3 in deck
        assert!(state.players[0].deck.is_empty());
    }

    #[test]
    fn gain_mana() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainMana {
                color: ManaColor::Red,
                amount: 2,
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].pure_mana.len(), 2);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    }

    #[test]
    fn gain_crystal() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainCrystal {
                color: Some(BasicManaColor::Blue),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    #[test]
    fn gain_crystal_overflow() {
        let mut state = test_state();
        state.players[0].crystals.blue = 3; // already at max
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainCrystal {
                color: Some(BasicManaColor::Blue),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].crystals.blue, 3); // unchanged
        assert_eq!(state.players[0].pure_mana.len(), 1); // got mana token instead
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Blue);
    }

    #[test]
    fn take_wound() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::TakeWound, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
    }

    #[test]
    fn gain_healing_removes_wounds() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("wound"),
            CardId::from("march"),
            CardId::from("wound"),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 1 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 2);
        // One wound removed, march remains, second wound remains
        assert_eq!(state.players[0].wounds_healed_from_hand_this_turn, 1);
    }

    #[test]
    fn gain_attack_requires_combat() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // No combat state, so attack should be skipped
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
    }

    #[test]
    fn gain_attack_in_combat() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Attack,
            enemies: vec![],
            wounds_this_combat: 0,
            wounds_added_to_hand_this_combat: false,
            attacks_this_phase: 0,
            fame_gained: 0,
            is_at_fortified_site: false,
            units_allowed: true,
            night_mana_rules: false,
            assault_origin: None,
            combat_hex_coord: None,
            all_damage_blocked_this_phase: false,
            discard_enemies_on_failure: false,
            combat_context: CombatContext::Standard,
            pending_damage: Default::default(),
            pending_block: Default::default(),
            pending_swift_block: Default::default(),
            cumbersome_reductions: Default::default(),
            used_defend: Default::default(),
            defend_bonuses: Default::default(),
            vampiric_armor_bonus: Default::default(),
            paid_thugs_damage_influence: Default::default(),
            damage_redirects: Default::default(),
            enemy_assignments: None,
            paid_heroes_assault_influence: false,
            declared_attack_targets: None,
            declared_block_target: None,
            declared_block_attack_index: None,
            ..Default::default()
        }));

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 4,
                combat_type: CombatType::Ranged,
                element: Element::Fire,
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 4);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .ranged_elements
                .fire,
            4
        );
    }

    // ---- Structural effects ----

    #[test]
    fn compound_sequential() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 3 },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].influence_points, 3);
    }

    #[test]
    fn nested_compound() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::Compound {
                        effects: vec![
                            CardEffect::GainMove { amount: 1 },
                            CardEffect::GainMove { amount: 1 },
                        ],
                    },
                    CardEffect::GainInfluence { amount: 5 },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].influence_points, 5);
    }

    #[test]
    fn choice_auto_resolves_single_option() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        // Only GainMove is resolvable (GainAttack needs combat)
        queue.push(
            CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 4 },
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 4); // auto-resolved
    }

    #[test]
    fn choice_returns_needs_choice() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 3 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(continuation.is_empty());
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // State unchanged
        assert_eq!(state.players[0].move_points, 0);
        assert_eq!(state.players[0].influence_points, 0);
    }

    #[test]
    fn choice_in_compound_preserves_continuation() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainInfluence { amount: 2 },
                            CardEffect::GainFame { amount: 3 },
                        ],
                    },
                    CardEffect::GainMove { amount: 5 }, // should be in continuation
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // GainMove(1) applied before choice
        assert_eq!(state.players[0].move_points, 1);

        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert_eq!(continuation.len(), 1); // GainMove(5) remains
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn choice_resume_with_continuation() {
        let mut state = test_state();
        // Simulate: compound was interrupted by choice, player chose option
        // Now resume with chosen option + continuation
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainInfluence { amount: 2 }, None); // chosen option
        queue.push_continuation(vec![QueuedEffect {
            effect: CardEffect::GainMove { amount: 5 },
            source_card_id: None,
        }]);

        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].influence_points, 2);
        assert_eq!(state.players[0].move_points, 5);
    }

    #[test]
    fn conditional_day() {
        let mut state = test_state();
        state.time_of_day = TimeOfDay::Day;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Conditional {
                condition: EffectCondition::TimeOfDay {
                    time: TimeOfDay::Day,
                },
                then_effect: Box::new(CardEffect::GainMove { amount: 4 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 2 })),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 4); // day branch
    }

    #[test]
    fn conditional_night() {
        let mut state = test_state();
        state.time_of_day = TimeOfDay::Night;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Conditional {
                condition: EffectCondition::TimeOfDay {
                    time: TimeOfDay::Day,
                },
                then_effect: Box::new(CardEffect::GainMove { amount: 4 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 2 })),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2); // night branch (else)
    }

    #[test]
    fn scaling_per_wound_in_hand() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("wound"),
            CardId::from("march"),
            CardId::from("wound"),
            CardId::from("wound"),
        ];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Scaling {
                factor: ScalingFactor::PerWoundInHand,
                base_effect: Box::new(CardEffect::GainMove { amount: 1 }),
                bonus_per_count: Some(2),
                maximum: None,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // 3 wounds * 2 per count = 6 bonus, base 1 = 7 total
        assert_eq!(state.players[0].move_points, 7);
    }

    #[test]
    fn scaling_per_crystal_color() {
        let mut state = test_state();
        state.players[0].crystals = Crystals {
            red: 2,
            blue: 0,
            green: 1,
            white: 0,
        };
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Scaling {
                factor: ScalingFactor::PerCrystalColor,
                base_effect: Box::new(CardEffect::GainInfluence { amount: 0 }),
                bonus_per_count: None, // default 1
                maximum: None,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // 2 colors (red, green) * 1 + base 0 = 2
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn noop_is_skipped() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Noop, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn gain_crystal_no_color_needs_choice() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainCrystal { color: None }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 4); // R, B, G, W
            }
            _ => panic!("Expected NeedsChoice for unspecified crystal color"),
        }
    }

    #[test]
    fn empty_queue_completes() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    // ---- Multi-step / cost effect handlers ----

    #[test]
    fn convert_mana_to_crystal_no_tokens_skips() {
        let mut state = test_state();
        assert!(state.players[0].pure_mana.is_empty());
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn convert_mana_to_crystal_single_color_auto_crystallizes() {
        let mut state = test_state();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        assert!(state.players[0].pure_mana.is_empty()); // token consumed
    }

    #[test]
    fn convert_mana_to_crystal_multiple_colors_needs_choice() {
        let mut state = test_state();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // red and blue
            }
            _ => panic!("Expected NeedsChoice for multi-color crystallize"),
        }
    }

    #[test]
    fn convert_mana_gold_not_crystallizable() {
        let mut state = test_state();
        // Only gold mana — not crystallizable
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Gold,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // No crystal gained
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn card_boost_no_eligible_cards_skips() {
        let mut state = test_state();
        // Hand empty → no eligible cards → skip
        state.players[0].hand.clear();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn card_boost_only_wounds_skips() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn card_boost_single_eligible_auto_selects() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // march moved from hand to play_area
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "march");
        // march powered_effect is GainMove{4}, boosted by 2 → GainMove{6}
        assert_eq!(state.players[0].move_points, 6);
    }

    #[test]
    fn card_boost_multiple_eligible_returns_choice() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 1 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::BoostTarget { .. }));
            }
            _ => panic!("Expected NeedsChoice for multi-eligible card boost"),
        }
        // Hand unchanged until choice is resolved
        assert_eq!(state.players[0].hand.len(), 2);
    }

    #[test]
    fn mana_draw_powered_offers_color_choice() {
        let mut state = test_state();
        // Add an available (not taken, not depleted) source die
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_1"),
            color: ManaColor::Gold,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ManaDrawPowered {
                dice_count: 1,
                tokens_per_die: 2,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 4); // R, B, G, W
                                              // Each option should grant 2 mana tokens
                for opt in &options {
                    match opt {
                        CardEffect::GainMana { amount, .. } => assert_eq!(*amount, 2),
                        _ => panic!("Expected GainMana options"),
                    }
                }
                // Resolution should be ManaDrawTakeDie
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ManaDrawTakeDie { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for mana draw powered"),
        }
    }

    #[test]
    fn mana_draw_powered_no_dice_skips() {
        let mut state = test_state();
        // No dice in source → should skip
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ManaDrawPowered {
                dice_count: 1,
                tokens_per_die: 2,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped, nothing to do
    }

    #[test]
    fn apply_modifier_rule_adds_rule_override() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ApplyModifier {
                effect: ModifierEffect::RuleOverride {
                    rule: RuleOverride::ExtraSourceDie,
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        match &state.active_modifiers[0].effect {
            ModifierEffect::RuleOverride { rule } => {
                assert_eq!(*rule, RuleOverride::ExtraSourceDie);
            }
            other => panic!("Expected RuleOverride, got {:?}", other),
        }
        assert_eq!(state.active_modifiers[0].duration, ModifierDuration::Turn);
    }

    #[test]
    fn apply_modifier_terrain_cost() {
        let mut state = test_state();
        // Put a card in play area so source tracking works
        state.players[0]
            .play_area
            .push(CardId::from("frost_bridge"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ApplyModifier {
                effect: ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::Specific(Terrain::Swamp),
                    amount: 0,
                    minimum: 0,
                    replace_cost: Some(1),
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        match &state.active_modifiers[0].effect {
            ModifierEffect::TerrainCost {
                terrain,
                replace_cost,
                ..
            } => {
                assert_eq!(*terrain, TerrainOrAll::Specific(Terrain::Swamp));
                assert_eq!(*replace_cost, Some(1));
            }
            other => panic!("Expected TerrainCost, got {:?}", other),
        }
        // Source should be the card on top of play area
        match &state.active_modifiers[0].source {
            ModifierSource::Card { card_id, .. } => {
                assert_eq!(card_id.as_ref(), "frost_bridge");
            }
            other => panic!("Expected Card source, got {:?}", other),
        }
    }

    #[test]
    fn apply_modifier_combat_duration() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ApplyModifier {
                effect: ModifierEffect::UnitCombatBonus {
                    attack_bonus: 2,
                    block_bonus: 2,
                },
                duration: ModifierDuration::Combat,
                scope: ModifierScope::AllUnits,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        assert_eq!(
            state.active_modifiers[0].duration,
            ModifierDuration::Combat
        );
        match &state.active_modifiers[0].scope {
            ModifierScope::AllUnits => {}
            other => panic!("Expected AllUnits scope, got {:?}", other),
        }
    }

    #[test]
    fn discard_cost_with_no_cards_skips() {
        let mut state = test_state();
        state.players[0].hand.clear(); // no cards to discard
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 0); // nothing happened
    }

    #[test]
    fn discard_cost_auto_discards_single_eligible() {
        let mut state = test_state();
        // Only 1 eligible card → auto-discard, then_effect resolves immediately
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: false,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand.len(), 0); // discarded the only card
        assert_eq!(state.players[0].discard.len(), 1);
        assert_eq!(state.players[0].move_points, 3); // then_effect resolved
    }

    #[test]
    fn discard_cost_multiple_eligible_returns_choice() {
        let mut state = test_state();
        // 2 eligible cards → NeedsChoice (player picks which to discard)
        state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: false,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2); // one option per eligible card
                                              // Each option is the then_effect
                for opt in &options {
                    assert!(matches!(opt, CardEffect::GainMove { amount: 3 }));
                }
                // Resolution should be DiscardThenContinue
                assert!(matches!(
                    resolution,
                    ChoiceResolution::DiscardThenContinue { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for multi-eligible discard"),
        }
        // Hand unchanged — no discard until player chooses
        assert_eq!(state.players[0].hand.len(), 2);
    }

    #[test]
    fn discard_cost_filter_wounds_skips_wounds() {
        let mut state = test_state();
        // Only wound cards in hand — can't discard if filter_wounds
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand.len(), 2); // no discard
        assert_eq!(state.players[0].move_points, 0); // nothing happened
    }

    #[test]
    fn discard_cost_auto_discard_then_inner_choice() {
        let mut state = test_state();
        // 1 non-wound + 1 wound (filter_wounds=true) → 1 eligible → auto-discard
        // then_effect is a Choice → NeedsChoice for the inner choice
        state.players[0].hand = vec![CardId::from("march"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::Choice {
                    options: vec![
                        CardEffect::GainMove { amount: 3 },
                        CardEffect::GainInfluence { amount: 3 },
                    ],
                }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should have auto-discarded march (only eligible) and presented the inner choice
        assert_eq!(state.players[0].hand.len(), 1); // wound remains
        assert_eq!(state.players[0].discard.len(), 1); // march discarded
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // move 3 or influence 3
            }
            _ => panic!("Expected NeedsChoice from inner choice"),
        }
    }

    // ---- Resolve pending choice ----

    #[test]
    fn resolve_pending_choice_no_pending_errors() {
        let mut state = test_state();
        let result = resolve_pending_choice(&mut state, 0, 0);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::NoPendingChoice);
    }

    #[test]
    fn resolve_pending_choice_invalid_index_errors() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::GainMove { amount: 2 }],
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));
        let result = resolve_pending_choice(&mut state, 0, 5);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::InvalidChoiceIndex);
        // Pending should still be set
        assert!(state.players[0].pending.has_active());
    }

    #[test]
    fn resolve_pending_choice_applies_chosen_option() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("concentration")),
            skill_id: None,
            unit_instance_id: None,
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::White,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
            ],
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 1).unwrap(); // choose white
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::White);
        assert!(!state.players[0].pending.has_active()); // resolved
    }

    #[test]
    fn resolve_pending_choice_resumes_continuation() {
        let mut state = test_state();
        // Set up a pending choice with continuation effects
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainFame { amount: 3 },
            ],
            continuation: vec![ContinuationEntry {
                effect: CardEffect::GainMove { amount: 5 },
                source_card_id: None,
            }],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 0).unwrap(); // choose influence
        assert_eq!(state.players[0].influence_points, 2);
        assert_eq!(state.players[0].move_points, 5); // continuation resolved
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn resolve_pending_choice_chain_produces_new_pending() {
        let mut state = test_state();
        // Choice where the chosen option decomposes into another choice
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::GainInfluence { amount: 1 },
                ],
            }],
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // The inner choice should create a new pending
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
        } else {
            panic!("Expected new pending choice");
        }
    }

    #[test]
    fn resolve_pending_wrong_type_errors() {
        let mut state = test_state();
        // Set a non-Choice pending type
        state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
        let result = resolve_pending_choice(&mut state, 0, 0);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::NoPendingChoice);
        // The original pending should be preserved
        assert!(state.players[0].pending.has_active());
    }

    // ---- scale_effect recursive tests ----

    #[test]
    fn scale_effect_recursive_compound() {
        let effect = CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 1 },
                CardEffect::GainInfluence { amount: 2 },
            ],
        };
        let scaled = scale_effect(&effect, 3);
        match scaled {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(
                    effects[1],
                    CardEffect::GainInfluence { amount: 5 }
                ));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn scale_effect_recursive_choice() {
        let effect = CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        };
        let scaled = scale_effect(&effect, 2);
        match scaled {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                match &options[0] {
                    CardEffect::GainAttack { amount, .. } => assert_eq!(*amount, 4),
                    _ => panic!("Expected GainAttack"),
                }
                match &options[1] {
                    CardEffect::GainBlock { amount, .. } => assert_eq!(*amount, 4),
                    _ => panic!("Expected GainBlock"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn hand_limit_bonus_increments_hand_limit() {
        let mut state = test_state();
        let initial_limit = state.players[0].hand_limit;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HandLimitBonus { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand_limit, initial_limit + 2);
    }

    #[test]
    fn hand_limit_bonus_in_compound() {
        let mut state = test_state();
        let initial_limit = state.players[0].hand_limit;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::HandLimitBonus { bonus: 1 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 1);
        assert_eq!(state.players[0].hand_limit, initial_limit + 1);
    }

    // ---- ReadyUnit effect ----

    fn make_unit(instance_id: &str, level: u8, spent: bool) -> PlayerUnit {
        PlayerUnit {
            instance_id: UnitInstanceId::from(instance_id),
            unit_id: UnitId::from("test_unit"),
            level,
            state: if spent {
                UnitState::Spent
            } else {
                UnitState::Ready
            },
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: Vec::new(),
            mana_token: None,
        }
    }

    #[test]
    fn ready_unit_no_eligible_skips() {
        let mut state = test_state();
        // No units at all
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn ready_unit_no_spent_units_skips() {
        let mut state = test_state();
        // One unit but already Ready
        state.players[0].units.push(make_unit("u0", 1, false));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_one_eligible_auto_readies() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true)); // spent, level 2
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_level_filter_excludes_high_level() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 3, true)); // spent, level 3
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 2 }, None); // max level 2
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Unit should still be spent (not eligible)
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
    }

    #[test]
    fn ready_unit_multiple_eligible_needs_choice() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true)); // spent, level 1
        state.players[0].units.push(make_unit("u1", 2, true)); // spent, level 2
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ReadyUnitTarget { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Both units still spent (choice not resolved yet)
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
        assert_eq!(state.players[0].units[1].state, UnitState::Spent);
    }

    #[test]
    fn ready_unit_choice_resolved_readies_selected() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].units.push(make_unit("u1", 2, true));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        // Should be NeedsChoice — store pending
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Resolve choice: pick unit 1 (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit 0 should still be spent, unit 1 should be ready
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
        assert_eq!(state.players[0].units[1].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_in_compound_with_healing() {
        let mut state = test_state();
        // Add a wound to heal
        state.players[0].hand.push(CardId::from("wound"));
        // Add a spent unit
        state.players[0].units.push(make_unit("u0", 1, true));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 1 },
                    CardEffect::ReadyUnit { max_level: 2 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Wound healed
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        // Unit readied
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    // =========================================================================
    // AttackWithDefeatBonus tests
    // =========================================================================

    fn combat_state() -> GameState {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state
    }

    #[test]
    fn attack_with_defeat_bonus_applies_attack_in_combat() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Attack was applied
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
    }

    #[test]
    fn attack_with_defeat_bonus_registers_tracker() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 2,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Tracker should be registered in deferred pending
        let has_tracker = state.players[0].pending.deferred.iter().any(|d| {
            matches!(d, DeferredPending::AttackDefeatFame(trackers) if !trackers.is_empty())
        });
        assert!(has_tracker, "Should have a defeat fame tracker");
        // Verify tracker fields
        if let Some(DeferredPending::AttackDefeatFame(trackers)) =
            state.players[0].pending.deferred.iter().find(|d| {
                matches!(d, DeferredPending::AttackDefeatFame(_))
            })
        {
            assert_eq!(trackers.len(), 1);
            assert_eq!(trackers[0].amount, 2);
            assert_eq!(trackers[0].remaining, 2);
            assert_eq!(trackers[0].reputation_per_defeat, Some(1));
            assert_eq!(trackers[0].fame_per_defeat, None);
        }
    }

    #[test]
    fn attack_with_defeat_bonus_skipped_without_combat() {
        let mut state = test_state();
        // No combat state
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // No attack applied
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
        // No tracker
        assert!(state.players[0].pending.deferred.is_empty());
    }

    #[test]
    fn attack_with_defeat_bonus_ranged_with_armor_reduction() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Ranged,
                element: Element::Physical,
                reputation_per_defeat: 0,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 1,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Ranged attack applied
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
        // Tracker with armor reduction
        if let Some(DeferredPending::AttackDefeatFame(trackers)) =
            state.players[0].pending.deferred.iter().find(|d| {
                matches!(d, DeferredPending::AttackDefeatFame(_))
            })
        {
            assert_eq!(trackers[0].armor_reduction_per_defeat, Some(1));
            assert_eq!(trackers[0].reputation_per_defeat, None);
        } else {
            panic!("Expected AttackDefeatFame tracker");
        }
    }

    #[test]
    fn attack_with_defeat_bonus_in_choice() {
        // Chivalry pattern: Choice(GainAttack(3), AttackWithDefeatBonus(2))
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::AttackWithDefeatBonus {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                        reputation_per_defeat: 1,
                        fame_per_defeat: 0,
                        armor_reduction_per_defeat: 0,
                    },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should need a choice (both options resolvable in combat)
        assert!(matches!(result, DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn attack_with_defeat_bonus_not_resolvable_without_combat() {
        let state = test_state(); // No combat
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        assert!(!is_resolvable(&state, 0, &effect));
    }

    #[test]
    fn attack_with_defeat_bonus_resolvable_in_combat() {
        let state = combat_state();
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        assert!(is_resolvable(&state, 0, &effect));
    }

    #[test]
    fn scale_attack_with_defeat_bonus() {
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        let scaled = scale_effect(&effect, 3);
        match scaled {
            CardEffect::AttackWithDefeatBonus {
                amount,
                reputation_per_defeat,
                ..
            } => {
                assert_eq!(amount, 5); // 2 + 3
                assert_eq!(reputation_per_defeat, 1); // unchanged
            }
            _ => panic!("Expected AttackWithDefeatBonus"),
        }
    }

    // =========================================================================
    // DiscardForBonus tests
    // =========================================================================

    #[test]
    fn discard_for_bonus_sets_pending() {
        let mut state = test_state();
        state.players[0].play_area.push(CardId::from("stout_resolve"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
            Some(CardId::from("stout_resolve")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(state.players[0].pending.active.is_some());
        match &state.players[0].pending.active {
            Some(ActivePending::DiscardForBonus(dfb)) => {
                assert_eq!(dfb.choice_options.len(), 2);
                assert_eq!(dfb.bonus_per_card, 1);
                assert_eq!(dfb.max_discards, 1);
                assert_eq!(dfb.discard_filter, DiscardForBonusFilter::WoundOnly);
            }
            other => panic!("Expected DiscardForBonus pending, got {:?}", other),
        }
    }

    #[test]
    fn discard_for_bonus_skipped_if_no_resolvable_options() {
        let mut state = test_state();
        // Options are attack and block, but not in combat
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainBlock {
                        amount: 2,
                        element: Element::Physical,
                    },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped
        assert!(state.players[0].pending.active.is_none());
    }

    #[test]
    fn discard_for_bonus_filters_combat_only_options() {
        let mut state = test_state();
        state.players[0].play_area.push(CardId::from("test"));
        // Mix of combat and non-combat options; no combat active
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        match &state.players[0].pending.active {
            Some(ActivePending::DiscardForBonus(dfb)) => {
                // Only GainMove should remain (attack filtered out)
                assert_eq!(dfb.choice_options.len(), 1);
                assert!(matches!(
                    dfb.choice_options[0],
                    CardEffect::GainMove { amount: 2 }
                ));
            }
            other => panic!("Expected DiscardForBonus, got {:?}", other),
        }
    }

    #[test]
    fn resolve_discard_for_bonus_no_discard() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("wound"),
        ];
        // Set up a DiscardForBonus pending
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        // Resolve with choice_index=0 (Move), discard_count=0 (no discard)
        resolve_discard_for_bonus(&mut state, 0, 0, 0).unwrap();

        assert!(state.players[0].pending.active.is_none());
        assert_eq!(state.players[0].move_points, 2); // base effect, no bonus
        assert_eq!(state.players[0].hand.len(), 2); // no cards discarded
    }

    #[test]
    fn resolve_discard_for_bonus_with_wound_discard() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("wound"),
        ];
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        // Resolve with choice_index=0 (Move), discard_count=1 (discard 1 wound)
        resolve_discard_for_bonus(&mut state, 0, 0, 1).unwrap();

        assert!(state.players[0].pending.active.is_none());
        assert_eq!(state.players[0].move_points, 3); // 2 + 1 (bonus)
        assert_eq!(state.players[0].hand.len(), 1); // wound removed
        assert_eq!(state.players[0].hand[0].as_str(), "march"); // march remains
        assert_eq!(state.players[0].discard.len(), 1); // wound in discard
    }

    #[test]
    fn resolve_discard_for_bonus_powered_multiple_discards() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("rage"),
            CardId::from("wound"),
        ];
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 3 },
                ],
                bonus_per_card: 2,
                max_discards: u32::MAX,
                discard_filter: DiscardForBonusFilter::AnyMaxOneWound,
            },
        ));

        // Resolve: Move 3 + discard 2 cards (1 non-wound + 1 wound) → bonus = 2*2 = 4
        resolve_discard_for_bonus(&mut state, 0, 0, 2).unwrap();

        assert_eq!(state.players[0].move_points, 7); // 3 + 4
        assert_eq!(state.players[0].hand.len(), 1); // 1 card remains
        assert_eq!(state.players[0].discard.len(), 2); // 2 discarded
    }

    #[test]
    fn resolve_discard_for_bonus_invalid_choice_index() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        let result = resolve_discard_for_bonus(&mut state, 0, 5, 0);
        assert!(matches!(result, Err(ResolveChoiceError::InvalidChoiceIndex)));
        // Pending should be restored
        assert!(state.players[0].pending.active.is_some());
    }

    #[test]
    fn resolve_discard_for_bonus_no_pending() {
        let mut state = test_state();
        let result = resolve_discard_for_bonus(&mut state, 0, 0, 0);
        assert!(matches!(result, Err(ResolveChoiceError::NoPendingChoice)));
    }

    #[test]
    fn discard_for_bonus_is_resolvable() {
        let state = test_state();
        let effect = CardEffect::DiscardForBonus {
            choice_options: vec![CardEffect::GainMove { amount: 2 }],
            bonus_per_card: 1,
            max_discards: 1,
            discard_filter: DiscardForBonusFilter::WoundOnly,
        };
        assert!(is_resolvable(&state, 0, &effect));
    }

    // =========================================================================
    // Decompose tests
    // =========================================================================

    #[test]
    fn decompose_sets_pending_with_eligible_cards() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("rage"),
        ];
        state.players[0].play_area = vec![CardId::from("decompose")];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic,
            },
            Some(CardId::from("decompose")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::Decompose(_))
        ));
    }

    #[test]
    fn decompose_skips_when_no_eligible_cards() {
        let mut state = test_state();
        // Only wound cards in hand (not action cards)
        state.players[0].hand = vec![CardId::from("wound")];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic,
            },
            Some(CardId::from("decompose")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn resolve_decompose_basic_gains_two_matching_crystals() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")]; // Green card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_ok());

        // Card removed from hand to removed_cards
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].removed_cards.len(), 1);
        assert_eq!(state.players[0].removed_cards[0].as_str(), "march");

        // Gained 2 green crystals
        assert_eq!(state.players[0].crystals.green, 2);
        assert_eq!(state.players[0].crystals.red, 0);
        assert_eq!(state.players[0].crystals.blue, 0);
        assert_eq!(state.players[0].crystals.white, 0);
    }

    #[test]
    fn resolve_decompose_powered_gains_non_matching_crystals() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("rage")]; // Red card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Powered,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_ok());

        // Card removed from hand
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].removed_cards.len(), 1);

        // Gained 1 crystal of each non-red color (blue, green, white)
        assert_eq!(state.players[0].crystals.red, 0);
        assert_eq!(state.players[0].crystals.blue, 1);
        assert_eq!(state.players[0].crystals.green, 1);
        assert_eq!(state.players[0].crystals.white, 1);
    }

    #[test]
    fn resolve_decompose_rejects_non_action_card() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound")]; // Not an action card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_err());
        // Pending should be restored
        assert!(state.players[0].pending.active.is_some());
    }

    #[test]
    fn resolve_decompose_rejects_invalid_index() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 5); // Out of bounds
        assert!(result.is_err());
    }

    // =========================================================================
    // DiscardForAttack tests
    // =========================================================================

    #[test]
    fn discard_for_attack_auto_discards_single_eligible_card() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![CardId::from("march")]; // Green card

        let attacks = vec![
            (
                BasicManaColor::Green,
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            Some(CardId::from("ritual_attack")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));

        // Card discarded
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].discard.len(), 1);

        // Attack applied
        let acc = &state.players[0].combat_accumulator.attack;
        assert_eq!(acc.siege, 2);
    }

    #[test]
    fn discard_for_attack_skips_outside_combat() {
        let mut state = test_state();
        // No combat
        state.players[0].hand = vec![CardId::from("march")];

        let attacks = vec![
            (
                BasicManaColor::Green,
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Card NOT discarded
        assert_eq!(state.players[0].hand.len(), 1);
    }

    #[test]
    fn discard_for_attack_offers_choice_with_multiple_cards() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![
            CardId::from("march"),      // Green
            CardId::from("rage"),        // Red
        ];

        let attacks = vec![
            (
                BasicManaColor::Red,
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
            ),
            (
                BasicManaColor::Green,
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            Some(CardId::from("ritual_attack")),
        );
        let result = queue.drain(&mut state, 0);

        // Should need a choice: which card to discard
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                // First option is green (march, idx 0), second is red (rage, idx 1)
                assert!(matches!(
                    resolution,
                    ChoiceResolution::DiscardThenContinue { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice, got {:?}", result),
        }
    }

    #[test]
    fn discard_for_attack_skips_when_no_matching_cards() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![CardId::from("wound")]; // No action cards

        let attacks = vec![
            (
                BasicManaColor::Red,
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    // =========================================================================
    // Pure Magic tests
    // =========================================================================

    #[test]
    fn pure_magic_auto_selects_single_color() {
        let mut state = test_state();
        // Green mana → Move
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        }];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        assert!(matches!(result, DrainResult::Complete));
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Move points gained
        assert_eq!(state.players[0].move_points, 4);
    }

    #[test]
    fn pure_magic_skips_with_no_mana() {
        let mut state = test_state();
        state.players[0].pure_mana = vec![];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn pure_magic_offers_choice_with_multiple_colors() {
        let mut state = test_state();
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::White,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                // Green → Move 4, White → Influence 4
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(options[1], CardEffect::GainInfluence { amount: 4 }));
                assert!(matches!(
                    resolution,
                    ChoiceResolution::PureMagicConsume { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_combat_only_colors_skipped_outside_combat() {
        let mut state = test_state();
        // Red and Blue are combat-only for pure magic
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Red,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Blue,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        // Red/Blue give Attack/Block which are combat-only → skipped
        assert!(matches!(result, DrainResult::Complete));
        // Tokens NOT consumed (no valid options)
        assert_eq!(state.players[0].pure_mana.len(), 2);
    }

    #[test]
    fn pure_magic_combat_includes_all_four_colors() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Red,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Blue,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::White,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 7 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, .. } => {
                // All 4 colors available → 4 options
                assert_eq!(options.len(), 4);
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_gold_adds_missing_colors() {
        let mut state = test_state();
        // Only green basic token + gold
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Gold,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                // Green (from green token) + White (from gold)
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(options[1], CardEffect::GainInfluence { amount: 4 }));
                // Check token_colors
                if let ChoiceResolution::PureMagicConsume { token_colors } = &resolution {
                    assert_eq!(token_colors[0], ManaColor::Green);
                    assert_eq!(token_colors[1], ManaColor::Gold);
                }
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::PureMagic { amount: 4 }
        ));
    }

    #[test]
    fn decompose_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic
            }
        ));
    }

    #[test]
    fn discard_for_attack_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::DiscardForAttack {
                attacks_by_color: vec![]
            }
        ));
    }

    // =========================================================================
    // HealUnit tests
    // =========================================================================

    #[test]
    fn heal_unit_no_wounded_skips() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, false)); // not wounded
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_one_wounded_auto_heals() {
        let mut state = test_state();
        let mut u = make_unit("u0", 2, false);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_level_filter_excludes_high_level() {
        let mut state = test_state();
        let mut u = make_unit("u0", 3, false);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Unit should still be wounded (level 3 > max 2)
        assert!(state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_multiple_wounded_needs_choice() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, false);
        u0.wounded = true;
        let mut u1 = make_unit("u1", 2, false);
        u1.wounded = true;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::HealUnitTarget { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Both still wounded
        assert!(state.players[0].units[0].wounded);
        assert!(state.players[0].units[1].wounded);
    }

    #[test]
    fn heal_unit_choice_resolved_heals_selected() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, false);
        u0.wounded = true;
        let mut u1 = make_unit("u1", 2, false);
        u1.wounded = true;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Pick unit 1 (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit 0 still wounded, unit 1 healed
        assert!(state.players[0].units[0].wounded);
        assert!(!state.players[0].units[1].wounded);
    }
}
