//! Mana source operations — reroll, return dice, crystallize.
//!
//! Matches the mana management logic in:
//! - `packages/core/src/engine/mana/manaSource.ts`
//! - `packages/core/src/engine/commands/endTurn/diceManagement.ts`

use mk_types::enums::*;
use mk_types::ids::SourceDieId;
use mk_types::rng::RngState;
use mk_types::state::*;

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
/// - Any remaining dice held by this player are cleaned up.
///
/// Matches TS `processDiceReturn()` in `diceManagement.ts`.
pub fn return_player_dice(state: &mut GameState, player_idx: usize) {
    let time_of_day = state.time_of_day;
    let player_id = state.players[player_idx].id.clone();

    // 1. Reroll used dice
    let used_die_ids: Vec<SourceDieId> = state.players[player_idx].used_die_ids.clone();
    for die_id in &used_die_ids {
        reroll_die(&mut state.source, die_id, time_of_day, &mut state.rng);
    }

    // 2. Return mana draw/pull dice without reroll
    let mana_draw_die_ids: Vec<SourceDieId> = state.players[player_idx].mana_draw_die_ids.clone();
    for die_id in &mana_draw_die_ids {
        return_die_without_reroll(&mut state.source, die_id, time_of_day);
    }

    // 3. Handle Mana Steal stored die (if used this turn, reroll it)
    if state.players[player_idx]
        .tactic_state
        .mana_steal_used_this_turn
    {
        if let Some(stored) = state.players[player_idx]
            .tactic_state
            .stored_mana_die
            .take()
        {
            reroll_die(
                &mut state.source,
                &stored.die_id,
                time_of_day,
                &mut state.rng,
            );
        }
    }

    // 4. Safety net: clear any remaining dice still marked with this player
    for die in state.source.dice.iter_mut() {
        if die.taken_by_player_id.as_ref() == Some(&player_id) {
            // Don't touch stored Mana Steal die (persists across turns)
            let is_stored_steal = state.players[player_idx]
                .tactic_state
                .stored_mana_die
                .as_ref()
                .is_some_and(|s| s.die_id == die.id);
            if !is_stored_steal {
                die.taken_by_player_id = None;
            }
        }
    }
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
