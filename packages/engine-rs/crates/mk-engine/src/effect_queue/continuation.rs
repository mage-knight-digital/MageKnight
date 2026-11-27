//! Running source-attributed effects and saved continuations.
//!
//! Card rules choose the effect; this module owns only queue and pause plumbing.
//! The effect source and the pending-choice source are intentionally independent.

use mk_types::ids::CardId;
use mk_types::pending::{ActivePending, ContinuationEntry, PendingChoice};
use mk_types::state::GameState;

use crate::undo::UndoStack;

use super::{DrainResult, EffectQueue, QueuedEffect};

/// Where execution stopped after an effect and its continuation were drained.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ContinuationOutcome {
    Complete,
    ChoiceInstalled,
    CustomPending,
}

/// Run an effect followed by its saved continuation, installing the same
/// legacy pending choice the caller would otherwise construct on pause.
///
/// This does not emit action events or choose undo checkpoints; those remain
/// the responsibility of the action pipeline and the existing effect queue.
pub(super) fn run_effect(
    state: &mut GameState,
    player_idx: usize,
    effect: QueuedEffect,
    continuation: Vec<ContinuationEntry>,
    pending_source_card_id: Option<CardId>,
    undo: Option<&mut UndoStack>,
) -> ContinuationOutcome {
    let mut effects = vec![effect];
    effects.extend(continuation.into_iter().map(|entry| QueuedEffect {
        effect: entry.effect,
        source_card_id: entry.source_card_id,
    }));
    run_effects(state, player_idx, effects, pending_source_card_id, undo)
}

/// Resume saved entries in their original order, retaining their individual sources.
pub(super) fn run_continuation(
    state: &mut GameState,
    player_idx: usize,
    continuation: Vec<ContinuationEntry>,
    pending_source_card_id: Option<CardId>,
    undo: Option<&mut UndoStack>,
) -> ContinuationOutcome {
    let effects = continuation.into_iter().map(|entry| QueuedEffect {
        effect: entry.effect,
        source_card_id: entry.source_card_id,
    }).collect();
    run_effects(state, player_idx, effects, pending_source_card_id, undo)
}

/// Drain an ordered effect sequence, installing the legacy choice on pause.
pub(super) fn run_effects(
    state: &mut GameState,
    player_idx: usize,
    effects: Vec<QueuedEffect>,
    pending_source_card_id: Option<CardId>,
    undo: Option<&mut UndoStack>,
) -> ContinuationOutcome {
    let mut queue = EffectQueue::new();
    queue.push_continuation(effects);

    match queue.drain_with_undo(state, player_idx, undo) {
        DrainResult::Complete => ContinuationOutcome::Complete,
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: pending_source_card_id,
                skill_id: None,
                unit_instance_id: None,
                options,
                continuation: continuation
                    .into_iter()
                    .map(|entry| ContinuationEntry {
                        effect: entry.effect,
                        source_card_id: entry.source_card_id,
                    })
                    .collect(),
                movement_bonus_applied: false,
                resolution,
            }));
            ContinuationOutcome::ChoiceInstalled
        }
        DrainResult::PendingSet => ContinuationOutcome::CustomPending,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::legal_actions::enumerate_legal_actions_with_undo;
    use crate::setup::create_solo_game;
    use mk_types::effect::CardEffect;
    use mk_types::enums::{Hero, ManaColor, RoundPhase};
    use mk_types::pending::EffectMode;
    use serde_json::{json, Value};

    const EFFECT_SOURCE: &str = "blood_ritual";
    const PENDING_SOURCE: &str = "blood_of_ancients";
    const CONTINUATION_SOURCE: &str = "march";

    // Independent copy of the original card-local queue sequence. Keep this
    // reference only for the boundary comparison, not production dispatch.
    fn legacy_run(
        state: &mut GameState,
        undo: &mut UndoStack,
        effect: QueuedEffect,
        continuation: Vec<ContinuationEntry>,
        pending_source: Option<CardId>,
    ) -> ContinuationOutcome {
        let mut queue = EffectQueue::new();
        queue.push(effect.effect, effect.source_card_id);
        queue.push_continuation(
            continuation
                .into_iter()
                .map(|entry| QueuedEffect {
                    effect: entry.effect,
                    source_card_id: entry.source_card_id,
                })
                .collect(),
        );
        match queue.drain_with_undo(state, 0, Some(undo)) {
            DrainResult::Complete => ContinuationOutcome::Complete,
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
                    card_id: pending_source,
                    skill_id: None,
                    unit_instance_id: None,
                    options,
                    continuation: continuation
                        .into_iter()
                        .map(|entry| ContinuationEntry {
                            effect: entry.effect,
                            source_card_id: entry.source_card_id,
                        })
                        .collect(),
                    movement_bonus_applied: false,
                    resolution,
                }));
                ContinuationOutcome::ChoiceInstalled
            }
            DrainResult::PendingSet => ContinuationOutcome::CustomPending,
        }
    }

    fn snapshot(state: &GameState, undo: &UndoStack) -> Value {
        let mut copy = undo.clone();
        json!({ "state": state, "legal": enumerate_legal_actions_with_undo(state, 0, undo),
            "depth": undo.depth(), "checkpoint": undo.is_checkpoint_active(), "undo": copy.undo() })
    }

    #[test]
    fn effect_and_continuation_match_legacy_queue_boundaries() {
        let choice = CardEffect::Choice {
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
            ],
        };
        let auto_choice = CardEffect::Choice {
            options: vec![CardEffect::GainMove { amount: 1 }],
        };
        let cases = [
            (
                CardEffect::GainMove { amount: 1 },
                ContinuationOutcome::Complete,
            ),
            (choice, ContinuationOutcome::ChoiceInstalled),
            (auto_choice, ContinuationOutcome::Complete),
            (
                CardEffect::Training {
                    mode: EffectMode::Basic,
                },
                ContinuationOutcome::CustomPending,
            ),
            (
                CardEffect::DrawCards { count: 1 },
                ContinuationOutcome::Complete,
            ),
        ];
        for (effect, expected_outcome) in cases {
            let is_draw = matches!(effect, CardEffect::DrawCards { .. });
            let is_auto_choice =
                matches!(&effect, CardEffect::Choice { options } if options.len() == 1);
            let mut old_state = create_solo_game(42, Hero::Arythea);
            old_state.round_phase = RoundPhase::PlayerTurns;
            old_state.players[0].hand = vec![CardId::from(CONTINUATION_SOURCE)];
            let mut new_state = old_state.clone();
            let mut old_undo = UndoStack::new();
            old_undo.save(&old_state);
            let mut new_undo = old_undo.clone();
            let queued = QueuedEffect {
                effect,
                source_card_id: Some(CardId::from(EFFECT_SOURCE)),
            };
            let continuation = vec![ContinuationEntry {
                effect: CardEffect::GainMove { amount: 2 },
                source_card_id: Some(CardId::from(CONTINUATION_SOURCE)),
            }];
            let old = legacy_run(
                &mut old_state,
                &mut old_undo,
                queued.clone(),
                continuation.clone(),
                Some(CardId::from(PENDING_SOURCE)),
            );
            let new = run_effect(
                &mut new_state,
                0,
                queued,
                continuation,
                Some(CardId::from(PENDING_SOURCE)),
                Some(&mut new_undo),
            );
            assert_eq!(old, expected_outcome);
            assert_eq!(new, old);
            assert_eq!(
                snapshot(&new_state, &new_undo),
                snapshot(&old_state, &old_undo)
            );
            if is_draw {
                assert!(new_undo.is_checkpoint_active());
                assert_eq!(new_undo.depth(), 0);
            }
            if is_auto_choice {
                assert!(new_state.event_buffer.iter().any(|event| matches!(
                    event,
                    mk_types::events::GameEvent::ChoiceResolved { card_id: Some(card_id), .. }
                        if card_id.as_str() == EFFECT_SOURCE
                )));
            }
            if let ContinuationOutcome::ChoiceInstalled = new {
                let Some(ActivePending::Choice(pending)) = &new_state.players[0].pending.active
                else {
                    panic!("expected choice")
                };
                assert_eq!(
                    pending.card_id.as_ref().map(CardId::as_str),
                    Some(PENDING_SOURCE)
                );
                assert_eq!(
                    pending.continuation[0]
                        .source_card_id
                        .as_ref()
                        .map(CardId::as_str),
                    Some(CONTINUATION_SOURCE)
                );
            }
            if let ContinuationOutcome::CustomPending = new {
                // PendingSet discards the remaining queue, as before.
                assert_eq!(new_state.players[0].move_points, 0);
            }
        }
    }

    #[test]
    fn saved_sequences_match_legacy_queue_order_and_pause() {
        let choice = CardEffect::Choice { options: vec![
            CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
            CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
        ] };
        let cases = vec![
            vec![CardEffect::GainMove { amount: 1 }, CardEffect::GainMove { amount: 2 }],
            vec![CardEffect::GainMove { amount: 1 }, choice, CardEffect::GainMove { amount: 3 }],
            vec![CardEffect::DrawCards { count: 1 }, CardEffect::GainMove { amount: 2 }],
            vec![CardEffect::Training { mode: EffectMode::Basic }, CardEffect::GainMove { amount: 2 }],
        ];
        for effects in cases {
            let mut old_state = create_solo_game(42, Hero::Arythea);
            old_state.round_phase = RoundPhase::PlayerTurns;
            old_state.players[0].hand = vec![CardId::from(CONTINUATION_SOURCE)];
            let mut new_state = old_state.clone();
            let mut old_undo = UndoStack::new();
            old_undo.save(&old_state);
            let mut new_undo = old_undo.clone();
            let entries: Vec<ContinuationEntry> = effects.into_iter().enumerate().map(|(index, effect)| {
                ContinuationEntry {
                    effect,
                    source_card_id: Some(CardId::from(if index == 0 { EFFECT_SOURCE } else { CONTINUATION_SOURCE })),
                }
            }).collect();
            let first = entries[0].clone();
            let old = legacy_run(&mut old_state, &mut old_undo,
                QueuedEffect { effect: first.effect, source_card_id: first.source_card_id },
                entries[1..].to_vec(), Some(CardId::from(PENDING_SOURCE)));
            let new = run_continuation(&mut new_state, 0, entries,
                Some(CardId::from(PENDING_SOURCE)), Some(&mut new_undo));
            assert_eq!(new, old);
            assert_eq!(snapshot(&new_state, &new_undo), snapshot(&old_state, &old_undo));
        }
        let mut state = create_solo_game(42, Hero::Arythea);
        let before = serde_json::to_value(&state).unwrap();
        let outcome = run_continuation(&mut state, 0, Vec::new(), None, None);
        assert_eq!(outcome, ContinuationOutcome::Complete);
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
    }

    #[test]
    fn source_less_pending_matches_legacy_queue() {
        let mut old_state = create_solo_game(42, Hero::Arythea);
        old_state.round_phase = RoundPhase::PlayerTurns;
        let mut new_state = old_state.clone();
        let mut old_undo = UndoStack::new();
        let mut new_undo = UndoStack::new();
        let effect = QueuedEffect {
            effect: CardEffect::Choice {
                options: vec![
                    CardEffect::GainMana {
                        color: ManaColor::Red,
                        amount: 1,
                    },
                    CardEffect::GainMana {
                        color: ManaColor::Blue,
                        amount: 1,
                    },
                ],
            },
            source_card_id: None,
        };
        let continuation = vec![ContinuationEntry {
            effect: CardEffect::GainMove { amount: 2 },
            source_card_id: Some(CardId::from(CONTINUATION_SOURCE)),
        }];
        let old = legacy_run(
            &mut old_state,
            &mut old_undo,
            effect.clone(),
            continuation.clone(),
            None,
        );
        let new = run_effect(
            &mut new_state,
            0,
            effect,
            continuation,
            None,
            Some(&mut new_undo),
        );
        assert_eq!(new, ContinuationOutcome::ChoiceInstalled);
        assert_eq!(new, old);
        assert_eq!(
            snapshot(&new_state, &new_undo),
            snapshot(&old_state, &old_undo)
        );
        let Some(ActivePending::Choice(pending)) = &new_state.players[0].pending.active else {
            panic!("expected choice")
        };
        assert!(pending.card_id.is_none());
        assert_eq!(
            pending.continuation[0]
                .source_card_id
                .as_ref()
                .map(CardId::as_str),
            Some(CONTINUATION_SOURCE)
        );
    }
}
