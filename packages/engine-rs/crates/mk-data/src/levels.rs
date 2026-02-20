//! Level system — fame thresholds, stat progression, level-up types.
//!
//! Matches `packages/shared/src/levels.ts`.

/// Fame thresholds for each level. Index 0 = Level 1 (0 fame).
pub const LEVEL_THRESHOLDS: [u32; 10] = [
    0,  // Level 1 (start)
    3,  // Level 2
    8,  // Level 3
    14, // Level 4
    21, // Level 5
    29, // Level 6
    38, // Level 7
    48, // Level 8
    59, // Level 9
    71, // Level 10
];

/// Maximum player level.
pub const MAX_LEVEL: u32 = 10;

/// Stats at a given level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LevelStats {
    pub armor: u32,
    pub hand_limit: u32,
    pub command_slots: u32,
}

/// Get stats for a level (1-10). Levels outside range clamp.
pub fn get_level_stats(level: u32) -> LevelStats {
    match level {
        0 | 1 | 2 => LevelStats {
            armor: 2,
            hand_limit: 5,
            command_slots: 1,
        },
        3 | 4 => LevelStats {
            armor: 3,
            hand_limit: 5,
            command_slots: 2,
        },
        5 | 6 => LevelStats {
            armor: 3,
            hand_limit: 6,
            command_slots: 3,
        },
        7 | 8 => LevelStats {
            armor: 4,
            hand_limit: 6,
            command_slots: 4,
        },
        _ => LevelStats {
            armor: 4,
            hand_limit: 7,
            command_slots: 5,
        }, // 9, 10+
    }
}

/// Calculate level from fame. Scans thresholds from highest to lowest.
pub fn get_level_from_fame(fame: u32) -> u32 {
    for level in (1..=MAX_LEVEL).rev() {
        if fame >= LEVEL_THRESHOLDS[(level - 1) as usize] {
            return level;
        }
    }
    1
}

/// Get levels crossed when gaining fame (old_fame -> new_fame).
/// Returns empty vec if no level-ups occurred.
pub fn get_levels_crossed(old_fame: u32, new_fame: u32) -> Vec<u32> {
    let old_level = get_level_from_fame(old_fame);
    let new_level = get_level_from_fame(new_fame);

    if new_level <= old_level {
        return Vec::new();
    }

    ((old_level + 1)..=new_level).collect()
}

/// Whether this level grants immediate stat upgrades (odd levels: 3, 5, 7, 9).
/// Odd-level rewards: +armor/hand_limit (from stat table), +command slot.
pub fn is_stat_level_up(level: u32) -> bool {
    level >= 3 && level % 2 == 1
}

/// Whether this level grants a skill choice (even levels: 2, 4, 6, 8, 10).
/// Even-level rewards: choose 1 of 2 drawn skills.
pub fn is_skill_level_up(level: u32) -> bool {
    level >= 2 && level % 2 == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn level_from_fame_boundaries() {
        assert_eq!(get_level_from_fame(0), 1);
        assert_eq!(get_level_from_fame(2), 1);
        assert_eq!(get_level_from_fame(3), 2);
        assert_eq!(get_level_from_fame(7), 2);
        assert_eq!(get_level_from_fame(8), 3);
        assert_eq!(get_level_from_fame(13), 3);
        assert_eq!(get_level_from_fame(14), 4);
        assert_eq!(get_level_from_fame(21), 5);
        assert_eq!(get_level_from_fame(29), 6);
        assert_eq!(get_level_from_fame(38), 7);
        assert_eq!(get_level_from_fame(48), 8);
        assert_eq!(get_level_from_fame(59), 9);
        assert_eq!(get_level_from_fame(71), 10);
        assert_eq!(get_level_from_fame(100), 10);
    }

    #[test]
    fn levels_crossed_basic() {
        // 0 fame -> 3 fame: cross level 2
        assert_eq!(get_levels_crossed(0, 3), vec![2]);
        // 0 fame -> 8 fame: cross levels 2 and 3
        assert_eq!(get_levels_crossed(0, 8), vec![2, 3]);
        // 7 fame -> 14 fame: cross levels 3 and 4
        assert_eq!(get_levels_crossed(7, 14), vec![3, 4]);
    }

    #[test]
    fn levels_crossed_none() {
        assert!(get_levels_crossed(0, 0).is_empty());
        assert!(get_levels_crossed(0, 2).is_empty());
        assert!(get_levels_crossed(5, 5).is_empty());
    }

    #[test]
    fn levels_crossed_decrease_returns_empty() {
        assert!(get_levels_crossed(10, 5).is_empty());
    }

    #[test]
    fn level_stats_progression() {
        let l1 = get_level_stats(1);
        assert_eq!(
            l1,
            LevelStats {
                armor: 2,
                hand_limit: 5,
                command_slots: 1
            }
        );

        let l3 = get_level_stats(3);
        assert_eq!(
            l3,
            LevelStats {
                armor: 3,
                hand_limit: 5,
                command_slots: 2
            }
        );

        let l5 = get_level_stats(5);
        assert_eq!(
            l5,
            LevelStats {
                armor: 3,
                hand_limit: 6,
                command_slots: 3
            }
        );

        let l7 = get_level_stats(7);
        assert_eq!(
            l7,
            LevelStats {
                armor: 4,
                hand_limit: 6,
                command_slots: 4
            }
        );

        let l9 = get_level_stats(9);
        assert_eq!(
            l9,
            LevelStats {
                armor: 4,
                hand_limit: 7,
                command_slots: 5
            }
        );

        // Even levels match their odd predecessor
        assert_eq!(get_level_stats(2), get_level_stats(1));
        assert_eq!(get_level_stats(4), get_level_stats(3));
        assert_eq!(get_level_stats(6), get_level_stats(5));
        assert_eq!(get_level_stats(8), get_level_stats(7));
        assert_eq!(get_level_stats(10), get_level_stats(9));
    }

    #[test]
    fn stat_vs_skill_level_up() {
        // Level 1: no level-up
        assert!(!is_stat_level_up(1));
        assert!(!is_skill_level_up(1));

        // Even levels: skill choice
        for level in [2, 4, 6, 8, 10] {
            assert!(is_skill_level_up(level), "level {} should be skill", level);
            assert!(
                !is_stat_level_up(level),
                "level {} should not be stat",
                level
            );
        }

        // Odd levels >= 3: stat upgrade
        for level in [3, 5, 7, 9] {
            assert!(is_stat_level_up(level), "level {} should be stat", level);
            assert!(
                !is_skill_level_up(level),
                "level {} should not be skill",
                level
            );
        }
    }

    #[test]
    fn thresholds_are_monotonically_increasing() {
        for i in 1..LEVEL_THRESHOLDS.len() {
            assert!(
                LEVEL_THRESHOLDS[i] > LEVEL_THRESHOLDS[i - 1],
                "Threshold for level {} ({}) should be > level {} ({})",
                i + 1,
                LEVEL_THRESHOLDS[i],
                i,
                LEVEL_THRESHOLDS[i - 1]
            );
        }
    }
}
