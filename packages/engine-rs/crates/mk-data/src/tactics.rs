//! Tactic ID constants — day and night tactic sets.
//!
//! Matches `packages/shared/src/tacticIds/`.

/// The 6 day tactics, in canonical order.
pub const DAY_TACTIC_IDS: [&str; 6] = [
    "early_bird",
    "rethink",
    "mana_steal",
    "planning",
    "great_start",
    "the_right_moment",
];

/// The 6 night tactics, in canonical order.
pub const NIGHT_TACTIC_IDS: [&str; 6] = [
    "from_the_dusk",
    "long_night",
    "mana_search",
    "midnight_meditation",
    "preparation",
    "sparing_power",
];

/// Get tactic IDs for a given time of day.
pub fn get_tactics_for_time(time_of_day: mk_types::enums::TimeOfDay) -> &'static [&'static str; 6] {
    match time_of_day {
        mk_types::enums::TimeOfDay::Day => &DAY_TACTIC_IDS,
        mk_types::enums::TimeOfDay::Night => &NIGHT_TACTIC_IDS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::enums::TimeOfDay;

    #[test]
    fn day_has_6_tactics() {
        assert_eq!(DAY_TACTIC_IDS.len(), 6);
        assert_eq!(DAY_TACTIC_IDS[0], "early_bird");
        assert_eq!(DAY_TACTIC_IDS[5], "the_right_moment");
    }

    #[test]
    fn night_has_6_tactics() {
        assert_eq!(NIGHT_TACTIC_IDS.len(), 6);
        assert_eq!(NIGHT_TACTIC_IDS[0], "from_the_dusk");
        assert_eq!(NIGHT_TACTIC_IDS[5], "sparing_power");
    }

    #[test]
    fn get_tactics_returns_correct_set() {
        let day = get_tactics_for_time(TimeOfDay::Day);
        assert_eq!(day[0], "early_bird");

        let night = get_tactics_for_time(TimeOfDay::Night);
        assert_eq!(night[0], "from_the_dusk");
    }
}
