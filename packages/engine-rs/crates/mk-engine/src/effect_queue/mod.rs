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

mod advanced_actions;
mod artifacts;
mod atomic;
mod choice_resolution;
mod conditions;
mod multi_step;
mod resolve;
mod spells;
mod utils;

#[cfg(test)]
mod tests;

use std::collections::VecDeque;

use mk_types::effect::*;
use mk_types::ids::CardId;
use mk_types::pending::{
    ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice,
};
use mk_types::state::*;

pub use self::choice_resolution::{
    resolve_decompose, resolve_discard_for_bonus, resolve_pending_choice, ResolveChoiceError,
};
pub(crate) use self::conditions::is_resolvable;
pub(crate) use self::utils::{gain_crystal_color, replenish_aa_offer, replenish_spell_offer};

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
            match resolve::resolve_one(state, player_idx, &queued.effect) {
                ResolveResult::Applied => continue,
                ResolveResult::Skipped => continue,
                ResolveResult::Decomposed(sub_effects) => {
                    // Emit event when a Choice auto-resolves to a single option.
                    if matches!(&queued.effect, CardEffect::Choice { .. }) && sub_effects.len() == 1 {
                        if let Some(desc) = sub_effects[0].describe() {
                            use mk_types::events::GameEvent;
                            state.event_buffer.push(GameEvent::ChoiceResolved {
                                player_id: state.players[player_idx].id.clone(),
                                choice_index: 0,
                                card_id: source.clone(),
                                skill_id: None,
                                chosen_description: Some(desc),
                            });
                        }
                    }
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
                    let continuation: Vec<ContinuationEntry> =
                        self.queue.drain(..).map(|q| ContinuationEntry {
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
// Enter Peaceful Moment conversion (public API for BeginPeacefulMomentHealing)
// =============================================================================

/// Enter the Peaceful Moment conversion loop from the action pipeline.
///
/// Clears the healing-window flags, reads accumulated influence, and pushes a
/// `PeacefulMomentConvert` effect through the queue. If options exist, a pending
/// choice is set; otherwise, nothing happens (e.g. influence was 0).
pub fn enter_peaceful_moment_conversion(state: &mut GameState, player_idx: usize) {
    let allow_refresh = state.players[player_idx]
        .flags
        .contains(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH);
    let influence_remaining = state.players[player_idx].influence_points;

    // Clear the healing-window flags.
    state.players[player_idx]
        .flags
        .remove(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING);
    state.players[player_idx]
        .flags
        .remove(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH);

    // Push the convert effect through the queue to set up the pending choice.
    let mut queue = EffectQueue::new();
    queue.push(
        CardEffect::PeacefulMomentConvert {
            influence_remaining,
            allow_refresh,
            refreshed: false,
        },
        None,
    );
    let peaceful_moment_card_id: Option<CardId> = None;
    match queue.drain(state, player_idx) {
        DrainResult::Complete => {
            // Nothing to convert (shouldn't happen if enumeration was correct).
        }
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: peaceful_moment_card_id,
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
        DrainResult::PendingSet => {
            // Custom pending was set — nothing more to do.
        }
    }
}
