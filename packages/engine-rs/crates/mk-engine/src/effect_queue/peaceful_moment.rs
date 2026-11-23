//! Peaceful Moment's accumulation window and conversion workflow.
//!
//! The existing flags, `PeacefulMomentConversion` pending representation and
//! source-less conversion are compatibility boundaries.

use super::{DrainResult, EffectQueue, ResolveResult, WOUND_CARD_ID};
use crate::undo::UndoStack;
use crate::unit_eligibility::peaceful_moment_refresh_target_indices;
use mk_types::effect::CardEffect;
use mk_types::enums::UnitState;
use mk_types::ids::CardId;
use mk_types::pending::{
    ActivePending, ChoiceResolution, ContinuationEntry, PeacefulMomentOption, PendingChoice,
};
use mk_types::state::{GameState, PlayerFlags};

pub(super) fn apply_peaceful_moment_action(
    state: &mut GameState,
    player_idx: usize,
    influence: u32,
    allow_refresh: bool,
) -> ResolveResult {
    // Influence is already granted by the preceding GainInfluence in the Compound.
    // In combat, healing is not allowed — skip so only the influence portion applies.
    if state.combat.is_some() {
        return ResolveResult::Skipped;
    }

    // "You MAY play this as the action for your turn" — check if there's anything
    // worth converting (wounds to heal or units to refresh). If not, skip silently.
    let player = &state.players[player_idx];
    let has_wound = player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID);
    let has_wounded_unit = player
        .units
        .iter()
        .any(|u| u.wounded && (u.level as u32 * 2) <= influence);
    let has_refreshable_unit = allow_refresh
        && !peaceful_moment_refresh_target_indices(&player.units, influence).is_empty();

    if !has_wound && !has_wounded_unit && !has_refreshable_unit {
        // Nothing to heal or refresh — skip silently
        return ResolveResult::Skipped;
    }

    // Set flags to open the healing accumulation window.
    // The player can now play more cards for influence before entering the
    // conversion loop via BeginPeacefulMomentHealing.
    let flags = &mut state.players[player_idx].flags;
    flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    flags.insert(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING);
    if allow_refresh {
        flags.insert(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH);
    }
    ResolveResult::Applied
}

pub(super) fn apply_peaceful_moment_convert(
    state: &mut GameState,
    player_idx: usize,
    influence_remaining: u32,
    allow_refresh: bool,
    refreshed: bool,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Build available conversion options with explicit option_map
    let mut options: Vec<CardEffect> = Vec::new();
    let mut option_map: Vec<PeacefulMomentOption> = Vec::new();

    // Always: Done
    options.push(CardEffect::Noop);
    option_map.push(PeacefulMomentOption::Done);

    // Heal wound from hand (2 influence = 1 healing point)
    let has_wound = player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID);
    if influence_remaining >= 2 && has_wound {
        options.push(CardEffect::Noop);
        option_map.push(PeacefulMomentOption::HealWound);
    }

    // Heal wounded units (level × 2 influence = level healing points)
    for (i, unit) in player.units.iter().enumerate() {
        if unit.wounded {
            let cost = unit.level as u32 * 2;
            if influence_remaining >= cost {
                options.push(CardEffect::Noop);
                option_map.push(PeacefulMomentOption::HealUnit { unit_index: i });
            }
        }
    }

    // Refresh spent unit (powered only, not yet refreshed)
    if allow_refresh && !refreshed {
        if let Some(unit_index) =
            peaceful_moment_refresh_target_indices(&player.units, influence_remaining).first()
        {
            options.push(CardEffect::Noop);
            option_map.push(PeacefulMomentOption::RefreshUnit {
                unit_index: *unit_index,
            });
        }
    }

    if options.len() <= 1 {
        // Only "Done" available — exit loop
        return ResolveResult::Skipped;
    }

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::PeacefulMomentConversion {
            influence_remaining,
            allow_refresh,
            refreshed,
            option_map,
        },
    )
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
    enter_peaceful_moment_conversion_with_undo(state, player_idx, None)
}

pub(crate) fn enter_peaceful_moment_conversion_with_undo(
    state: &mut GameState,
    player_idx: usize,
    undo: Option<&mut UndoStack>,
) {
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
    match queue.drain_with_undo(state, player_idx, undo) {
        DrainResult::Complete => {
            // Nothing to convert (shouldn't happen if enumeration was correct).
        }
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
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

/// Ephemeral view of the fields already persisted in the legacy pending choice.
/// This type never changes the serialized save format.
#[derive(Clone, Copy)]
pub(super) struct ConversionState {
    pub influence_remaining: u32,
    pub allow_refresh: bool,
    pub refreshed: bool,
}

/// Apply one option from the saved mapping. `None` means Done; otherwise
/// the returned effect resumes the conversion before the saved continuation.
pub(super) fn choose_conversion(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    stage: ConversionState,
    option_map: &[PeacefulMomentOption],
) -> Option<CardEffect> {
    let ConversionState {
        influence_remaining,
        allow_refresh,
        refreshed,
    } = stage;
    let action = option_map
        .get(choice_index)
        .cloned()
        .unwrap_or(PeacefulMomentOption::Done);
    let mut new_influence = influence_remaining;
    let mut new_refreshed = refreshed;

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
        PeacefulMomentOption::RefreshUnit { unit_index } => {
            let player = &mut state.players[player_idx];
            if let Some(unit) = player.units.get_mut(unit_index) {
                let cost = unit.level as u32 * 2;
                if unit.state == UnitState::Spent && influence_remaining >= cost {
                    new_influence = influence_remaining - cost;
                    unit.state = UnitState::Ready;
                    new_refreshed = true;
                }
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
    if matches!(action, PeacefulMomentOption::Done) {
        None
    } else {
        Some(CardEffect::PeacefulMomentConvert {
            influence_remaining: new_influence,
            allow_refresh,
            refreshed: new_refreshed,
        })
    }
}

pub(crate) fn describe_peaceful_moment_choice(
    option_map: &[PeacefulMomentOption],
    choice_index: usize,
    state: &GameState,
    player_idx: usize,
) -> Option<String> {
    option_map.get(choice_index).map(|opt| match opt {
        PeacefulMomentOption::Done => "Done".to_string(),
        PeacefulMomentOption::HealWound => "Heal wound".to_string(),
        PeacefulMomentOption::RefreshUnit { .. } => "Refresh unit".to_string(),
        PeacefulMomentOption::HealUnit { unit_index } => state.players[player_idx]
            .units
            .get(*unit_index)
            .map(|unit| format!("Heal {}", unit.unit_id))
            .unwrap_or_else(|| "Heal unit".to_string()),
    })
}
