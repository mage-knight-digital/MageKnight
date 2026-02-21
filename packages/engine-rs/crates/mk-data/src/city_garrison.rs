//! City garrison composition tables.
//!
//! Maps city color + level to enemy colors drawn as defenders when a city is assaulted.
//! Ported from TS `cityGarrison.ts`.

use mk_types::enums::{BasicManaColor, EnemyColor};

use EnemyColor::*;

/// Get the garrison composition for a city by color and level (1-11).
///
/// Returns the list of enemy colors to draw from their respective piles.
/// Panics if level is outside 1..=11.
pub fn get_city_garrison(city_color: BasicManaColor, level: u32) -> &'static [EnemyColor] {
    match city_color {
        BasicManaColor::Blue => match level {
            1 => &[Gray, Violet],
            2 => &[Violet, Violet],
            3 => &[Violet, White],
            4 => &[Gray, Violet, White],
            5 => &[Violet, Violet, White],
            6 => &[Violet, White, White],
            7 => &[Gray, Violet, Violet, White],
            8 => &[Violet, Violet, White, White],
            9 => &[Violet, White, White, White],
            10 => &[Gray, Violet, Violet, White, White],
            11 => &[Violet, Violet, White, White, White],
            _ => panic!("Invalid city level: {level} (valid: 1-11)"),
        },
        BasicManaColor::Green => match level {
            1 => &[Gray, Brown],
            2 => &[Brown, Brown],
            3 => &[Gray, Gray, Brown],
            4 => &[Gray, Brown, White],
            5 => &[Brown, Brown, White],
            6 => &[Gray, Gray, Brown, White],
            7 => &[Gray, Brown, Brown, White],
            8 => &[Brown, Brown, White, White],
            9 => &[Gray, Brown, Brown, Brown, White],
            10 => &[Gray, Brown, Brown, White, White],
            11 => &[Brown, Brown, White, White, White],
            _ => panic!("Invalid city level: {level} (valid: 1-11)"),
        },
        BasicManaColor::Red => match level {
            1 => &[White],
            2 => &[Brown, Violet],
            3 => &[Brown, White],
            4 => &[Brown, Violet, Violet],
            5 => &[Brown, Violet, White],
            6 => &[Brown, Brown, Violet, Violet],
            7 => &[Brown, Violet, Violet, White],
            8 => &[Brown, Violet, White, White],
            9 => &[Brown, Brown, Violet, Violet, White],
            10 => &[Brown, Brown, Violet, White, White],
            11 => &[Brown, Violet, White, White, White],
            _ => panic!("Invalid city level: {level} (valid: 1-11)"),
        },
        BasicManaColor::White => match level {
            1 => &[White],
            2 => &[Gray, White],
            3 => &[White, White],
            4 => &[Gray, Gray, White],
            5 => &[Gray, White, White],
            6 => &[Gray, Gray, Gray, White],
            7 => &[Gray, Gray, White, White],
            8 => &[Gray, White, White, White],
            9 => &[Gray, Gray, Gray, White, White],
            10 => &[Gray, Gray, White, White, White],
            11 => &[Gray, White, White, White, White],
            _ => panic!("Invalid city level: {level} (valid: 1-11)"),
        },
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blue_city_level_1_garrison() {
        let garrison = get_city_garrison(BasicManaColor::Blue, 1);
        assert_eq!(garrison, &[EnemyColor::Gray, EnemyColor::Violet]);
    }

    #[test]
    fn red_city_level_1_garrison() {
        let garrison = get_city_garrison(BasicManaColor::Red, 1);
        assert_eq!(garrison, &[EnemyColor::White]);
    }

    #[test]
    fn green_city_level_11_garrison() {
        let garrison = get_city_garrison(BasicManaColor::Green, 11);
        assert_eq!(
            garrison,
            &[
                EnemyColor::Brown,
                EnemyColor::Brown,
                EnemyColor::White,
                EnemyColor::White,
                EnemyColor::White,
            ]
        );
    }

    #[test]
    fn white_city_level_6_garrison() {
        let garrison = get_city_garrison(BasicManaColor::White, 6);
        assert_eq!(
            garrison,
            &[
                EnemyColor::Gray,
                EnemyColor::Gray,
                EnemyColor::Gray,
                EnemyColor::White,
            ]
        );
    }
}
