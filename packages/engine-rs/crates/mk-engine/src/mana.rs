//! Mana source operations — reroll, return dice, crystallize.
//!
//! Matches the mana management logic in:
//! - `packages/core/src/engine/mana/manaSource.ts`
//! - `packages/core/src/engine/commands/endTurn/diceManagement.ts`

use mk_types::enums::*;
use mk_types::ids::SourceDieId;
use mk_types::modifier::{ModifierEffect, ModifierSource, RuleOverride};
use mk_types::rng::RngState;
use mk_types::state::*;

use crate::card_play::{is_rule_active, modifier_applies_to_player};

const SOURCE_OPENING_SKILL_ID: &str = "goldyx_source_opening";

// =============================================================================
// Die operations
// =============================================================================

/// All 6 mana colors in dice-roll order.
const ALL_MANA_COLORS_ARRAY: [ManaColor; 6] = [
    ManaColor::Red,
    ManaColor::Blue,
    ManaColor::Green,
    ManaColor::White,
    ManaColor::Gold,
    ManaColor::Black,
];

/// Roll a single die: pick a random color from 6 options.
fn roll_die_color(rng: &mut RngState) -> ManaColor {
    let value = rng.next_f64();
    let index = (value * 6.0) as usize;
    ALL_MANA_COLORS_ARRAY[index]
}

/// Whether a die color is depleted for a given time of day.
pub fn is_depleted_for_time(color: ManaColor, time_of_day: TimeOfDay) -> bool {
    match time_of_day {
        TimeOfDay::Day => color == ManaColor::Black,
        TimeOfDay::Night => color == ManaColor::Gold,
    }
}

/// A held die can still be stored in the Source array. Ownership and reservation
/// records determine whether an effect can take or reroll it from the Source.
pub(crate) fn is_in_source(state: &GameState, die: &SourceDie) -> bool {
    die.taken_by_player_id.is_none()
        && !state.players.iter().any(|player| {
            player.used_die_ids.contains(&die.id)
                || player.mana_draw_die_ids.contains(&die.id)
                || player
                    .tactic_state
                    .stored_mana_die
                    .as_ref()
                    .is_some_and(|stored| stored.die_id == die.id)
        })
        && !is_round_claim(state, &die.id)
}

fn is_round_claim(state: &GameState, die_id: &SourceDieId) -> bool {
    state.active_modifiers.iter().any(|modifier| {
        matches!(
            &modifier.effect,
            ModifierEffect::ManaClaimSustained { claimed_die_id, .. }
            | ModifierEffect::ManaCurse { claimed_die_id, .. } if claimed_die_id == die_id
        )
    })
}

/// Remaining spends from the common pool. Mana Steal reserves its own die.
pub(crate) fn source_dice_remaining(
    state: &GameState,
    player_idx: usize,
    include_source_opening: bool,
) -> usize {
    if is_rule_active(state, player_idx, RuleOverride::SourceBlocked) {
        return 0;
    }

    let player = &state.players[player_idx];
    let extra = state.active_modifiers.iter().filter(|modifier| {
        let is_source_opening = matches!(&modifier.source,
            ModifierSource::Skill { skill_id, .. } if skill_id.as_str() == SOURCE_OPENING_SKILL_ID);
        modifier_applies_to_player(modifier, &player.id)
            && matches!(modifier.effect, ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie })
            // Source Opening still uses its existing spell allowance until its dedicated rules are implemented.
            && (include_source_opening || !is_source_opening)
    }).count();
    let used = if player.used_die_ids.is_empty() {
        usize::from(player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE))
    } else {
        player
            .used_die_ids
            .iter()
            .enumerate()
            .filter(|(index, die_id)| {
                !is_stored_mana_steal(player, die_id.as_str())
                    && !player.used_die_ids[..*index].contains(die_id)
            })
            .count()
    };
    (1 + extra).saturating_sub(used)
}

pub(crate) fn is_stored_mana_steal(player: &PlayerState, die_id: &str) -> bool {
    player
        .tactic_state
        .stored_mana_die
        .as_ref()
        .is_some_and(|stored| stored.die_id.as_str() == die_id)
}

fn is_spendable_mana_steal(player: &PlayerState, die: &SourceDie) -> bool {
    !player.tactic_state.mana_steal_used_this_turn
        && die.taken_by_player_id.as_ref() == Some(&player.id)
        && is_stored_mana_steal(player, die.id.as_str())
        && !player.used_die_ids.contains(&die.id)
}

pub(crate) fn can_select_mana_steal_die(
    state: &GameState,
    player_idx: usize,
    die: &SourceDie,
) -> bool {
    !die.is_depleted
        && die.color.is_basic()
        && (is_in_source(state, die)
            || state
                .players
                .iter()
                .enumerate()
                .any(|(index, player)| index != player_idx && is_spendable_mana_steal(player, die)))
}

pub(crate) fn spendable_source_dice(
    state: &GameState,
    player_idx: usize,
    shared_remaining: usize,
) -> impl Iterator<Item = &SourceDie> {
    let player = &state.players[player_idx];
    state.source.dice.iter().filter(move |die| {
        is_spendable_mana_steal(player, die) || (shared_remaining > 0 && is_in_source(state, die))
    })
}

/// Source spends that require an exact, undepleted die face.
pub(crate) fn exact_source_dice(
    state: &GameState,
    player_idx: usize,
) -> impl Iterator<Item = &SourceDie> {
    spendable_source_dice(
        state,
        player_idx,
        source_dice_remaining(state, player_idx, false),
    )
    .filter(|die| !die.is_depleted)
}

pub(crate) fn spend_exact_die_face(
    state: &mut GameState,
    player_idx: usize,
    color: ManaColor,
) -> bool {
    let die = exact_source_dice(state, player_idx)
        .find(|die| die.color == color)
        .map(|die| die.id.clone());
    die.is_some_and(|id| spend_source_die(state, player_idx, id.as_str(), false))
}

pub(crate) fn spend_source_die(
    state: &mut GameState,
    player_idx: usize,
    die_id: &str,
    include_source_opening: bool,
) -> bool {
    let remaining = source_dice_remaining(state, player_idx, include_source_opening);
    let Some(id) = spendable_source_dice(state, player_idx, remaining)
        .find(|die| die.id.as_str() == die_id)
        .map(|die| die.id.clone())
    else {
        return false;
    };

    let player = &mut state.players[player_idx];
    if is_stored_mana_steal(player, die_id) {
        player.tactic_state.mana_steal_used_this_turn = true;
    } else {
        player.used_die_ids.push(id.clone());
        player.flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
    }
    if let Some(die) = state.source.dice.iter_mut().find(|die| die.id == id) {
        die.taken_by_player_id = Some(player.id.clone());
    }
    true
}

/// Reroll a single die in the source. Sets new color, resets depletion, clears player.
pub fn reroll_die(
    source: &mut ManaSource,
    die_id: &SourceDieId,
    time_of_day: TimeOfDay,
    rng: &mut RngState,
) {
    if let Some(die) = source.dice.iter_mut().find(|d| d.id == *die_id) {
        die.color = roll_die_color(rng);
        die.is_depleted = is_depleted_for_time(die.color, time_of_day);
        die.taken_by_player_id = None;
    }
}

/// Return a die without rerolling (preserves its current color face).
/// Used for mana draw/pull dice which keep their chosen color.
pub fn return_die_without_reroll(
    source: &mut ManaSource,
    die_id: &SourceDieId,
    time_of_day: TimeOfDay,
) {
    if let Some(die) = source.dice.iter_mut().find(|d| d.id == *die_id) {
        die.is_depleted = is_depleted_for_time(die.color, time_of_day);
        die.taken_by_player_id = None;
    }
}

// =============================================================================
// End-of-turn dice return
// =============================================================================

/// Return all dice held by a player at end of turn.
///
/// - Dice in `used_die_ids` are rerolled (new random color).
/// - Dice in `mana_draw_die_ids` are returned without reroll (color preserved).
/// - Mana Claim dice stay reserved until the round resets the Source.
///
/// Matches TS `processDiceReturn()` in `diceManagement.ts`.
pub fn return_player_dice(state: &mut GameState, player_idx: usize) {
    let time_of_day = state.time_of_day;
    let player_id = state.players[player_idx].id.clone();

    let used_die_ids = state.players[player_idx].used_die_ids.clone();
    for (index, die_id) in used_die_ids.iter().enumerate() {
        if !used_die_ids[..index].contains(die_id)
            && !is_stored_mana_steal(&state.players[player_idx], die_id.as_str())
            && !state.players[player_idx].mana_draw_die_ids.contains(die_id)
            && can_return_die(state, die_id, &player_id)
        {
            reroll_die(&mut state.source, die_id, time_of_day, &mut state.rng);
        }
    }

    let draw_die_ids = state.players[player_idx].mana_draw_die_ids.clone();
    for die_id in &draw_die_ids {
        if can_return_die(state, die_id, &player_id) {
            return_die_without_reroll(&mut state.source, die_id, time_of_day);
        }
    }

    if state.players[player_idx]
        .tactic_state
        .mana_steal_used_this_turn
    {
        if let Some(stored) = state.players[player_idx]
            .tactic_state
            .stored_mana_die
            .take()
        {
            if can_return_die(state, &stored.die_id, &player_id) {
                reroll_die(
                    &mut state.source,
                    &stored.die_id,
                    time_of_day,
                    &mut state.rng,
                );
            }
        }
    }
}

/// Complete a Source Opening return before general end-turn dice cleanup.
pub(crate) fn return_source_opening_die(
    state: &mut GameState,
    player_idx: usize,
    die_id: &SourceDieId,
    reroll: bool,
) -> bool {
    let player = &state.players[player_idx];
    if !player.used_die_ids.contains(die_id) || !can_return_die(state, die_id, &player.id) {
        return false;
    }
    if reroll {
        reroll_die(&mut state.source, die_id, state.time_of_day, &mut state.rng);
    } else {
        return_die_without_reroll(&mut state.source, die_id, state.time_of_day);
    }
    state.players[player_idx]
        .used_die_ids
        .retain(|used| used != die_id);
    true
}

fn can_return_die(
    state: &GameState,
    die_id: &SourceDieId,
    player_id: &mk_types::ids::PlayerId,
) -> bool {
    !is_round_claim(state, die_id)
        && state.source.dice.iter().any(|die| {
            &die.id == die_id
                && die
                    .taken_by_player_id
                    .as_ref()
                    .is_none_or(|owner| owner == player_id)
        })
}

// =============================================================================
// Crystallize helpers
// =============================================================================

/// Maximum crystals per color.
pub const MAX_CRYSTALS_PER_COLOR: u8 = 3;

/// Gain a crystal of the given color. If at max (3), the excess overflows
/// into a mana token instead. Returns true if crystal was stored, false if overflowed.
pub fn gain_crystal(player: &mut PlayerState, color: BasicManaColor) -> bool {
    let current = match color {
        BasicManaColor::Red => &mut player.crystals.red,
        BasicManaColor::Blue => &mut player.crystals.blue,
        BasicManaColor::Green => &mut player.crystals.green,
        BasicManaColor::White => &mut player.crystals.white,
    };

    if *current < MAX_CRYSTALS_PER_COLOR {
        *current += 1;
        true
    } else {
        // Overflow: convert to mana token
        player.pure_mana.push(ManaToken {
            color: color.into(),
            source: ManaTokenSource::Crystal,
            cannot_power_spells: false,
        });
        false
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::enums::Hero;

    #[test]
    fn reroll_die_changes_color() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let die_id = state.source.dice[0].id.clone();
        let original_color = state.source.dice[0].color;

        // Reroll many times to verify it changes (probabilistic but very unlikely to fail)
        let mut changed = false;
        for _ in 0..100 {
            reroll_die(
                &mut state.source,
                &die_id,
                state.time_of_day,
                &mut state.rng,
            );
            if state.source.dice[0].color != original_color {
                changed = true;
                break;
            }
        }
        assert!(changed, "Die should change color after rerolling 100 times");
    }

    #[test]
    fn reroll_die_resets_taken_by() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let die_id = state.source.dice[0].id.clone();

        // Mark as taken
        state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());

        reroll_die(
            &mut state.source,
            &die_id,
            state.time_of_day,
            &mut state.rng,
        );
        assert!(state.source.dice[0].taken_by_player_id.is_none());
    }

    #[test]
    fn return_die_without_reroll_preserves_color() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let die_id = state.source.dice[0].id.clone();
        let original_color = state.source.dice[0].color;

        state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());

        return_die_without_reroll(&mut state.source, &die_id, state.time_of_day);
        assert_eq!(state.source.dice[0].color, original_color);
        assert!(state.source.dice[0].taken_by_player_id.is_none());
    }

    #[test]
    fn return_player_dice_rerolls_used() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let die_id = state.source.dice[0].id.clone();

        // Simulate taking a die
        state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());
        state.players[0].used_die_ids.push(die_id);

        return_player_dice(&mut state, 0);

        // Die should be released
        assert!(state.source.dice[0].taken_by_player_id.is_none());
    }

    #[test]
    fn return_player_dice_preserves_mana_draw_color() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let die_id = state.source.dice[1].id.clone();
        let original_color = state.source.dice[1].color;

        // Simulate mana draw
        state.source.dice[1].taken_by_player_id = Some(state.players[0].id.clone());
        state.players[0].mana_draw_die_ids.push(die_id);

        return_player_dice(&mut state, 0);

        // Color preserved, but player released
        assert_eq!(state.source.dice[1].color, original_color);
        assert!(state.source.dice[1].taken_by_player_id.is_none());
    }

    #[test]
    fn depletion_day_black_depleted() {
        assert!(is_depleted_for_time(ManaColor::Black, TimeOfDay::Day));
        assert!(!is_depleted_for_time(ManaColor::Gold, TimeOfDay::Day));
        assert!(!is_depleted_for_time(ManaColor::Red, TimeOfDay::Day));
    }

    #[test]
    fn depletion_night_gold_depleted() {
        assert!(is_depleted_for_time(ManaColor::Gold, TimeOfDay::Night));
        assert!(!is_depleted_for_time(ManaColor::Black, TimeOfDay::Night));
        assert!(!is_depleted_for_time(ManaColor::Red, TimeOfDay::Night));
    }

    #[test]
    fn gain_crystal_basic() {
        let mut state = create_solo_game(42, Hero::Arythea);

        assert!(gain_crystal(&mut state.players[0], BasicManaColor::Red));
        assert_eq!(state.players[0].crystals.red, 1);

        assert!(gain_crystal(&mut state.players[0], BasicManaColor::Red));
        assert_eq!(state.players[0].crystals.red, 2);

        assert!(gain_crystal(&mut state.players[0], BasicManaColor::Red));
        assert_eq!(state.players[0].crystals.red, 3);
    }

    #[test]
    fn gain_crystal_overflow_creates_token() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].crystals.blue = 3;

        assert!(!gain_crystal(&mut state.players[0], BasicManaColor::Blue));
        assert_eq!(state.players[0].crystals.blue, 3); // still 3
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Blue);
    }
}
