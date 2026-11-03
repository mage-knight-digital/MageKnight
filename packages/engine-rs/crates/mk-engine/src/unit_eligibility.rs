//! Shared eligibility rules for effects and abilities that target player units.

use mk_types::enums::UnitState;
use mk_types::state::PlayerUnit;

/// Return spent units at or below the level cap that a Ready Unit effect can target.
pub(crate) fn ready_unit_target_indices(units: &[PlayerUnit], max_level: u8) -> Vec<usize> {
    eligible_unit_indices(units, max_level, is_ready_unit_target)
}

/// Return wounded units at or below the level cap that a Heal Unit effect can target.
pub(crate) fn heal_unit_target_indices(units: &[PlayerUnit], max_level: u8) -> Vec<usize> {
    eligible_unit_indices(units, max_level, is_heal_unit_target)
}

/// Check whether a Ready Unit effect has a legal target.
pub(crate) fn has_ready_unit_target(units: &[PlayerUnit], max_level: u8) -> bool {
    has_eligible_unit(units, max_level, is_ready_unit_target)
}

/// Check whether a Heal Unit effect has a legal target.
pub(crate) fn has_heal_unit_target(units: &[PlayerUnit], max_level: u8) -> bool {
    has_eligible_unit(units, max_level, is_heal_unit_target)
}

/// Return spent units that Peaceful Moment can refresh with the available influence.
pub(crate) fn peaceful_moment_refresh_target_indices(
    units: &[PlayerUnit],
    influence: u32,
) -> Vec<usize> {
    units
        .iter()
        .enumerate()
        .filter(|(_, unit)| {
            unit.state == UnitState::Spent && (unit.level as u32 * 2) <= influence
        })
        .map(|(index, _)| index)
        .collect()
}

fn eligible_unit_indices(
    units: &[PlayerUnit],
    max_level: u8,
    is_eligible: impl Fn(&PlayerUnit) -> bool,
) -> Vec<usize> {
    units
        .iter()
        .enumerate()
        .filter(|(_, unit)| unit.level <= max_level && is_eligible(unit))
        .map(|(index, _)| index)
        .collect()
}

fn has_eligible_unit(
    units: &[PlayerUnit],
    max_level: u8,
    is_eligible: impl Fn(&PlayerUnit) -> bool,
) -> bool {
    units
        .iter()
        .any(|unit| unit.level <= max_level && is_eligible(unit))
}

fn is_ready_unit_target(unit: &PlayerUnit) -> bool {
    unit.state == UnitState::Spent
}

fn is_heal_unit_target(unit: &PlayerUnit) -> bool {
    unit.wounded
}

#[cfg(test)]
mod tests {
    use mk_types::ids::{UnitId, UnitInstanceId};

    use super::*;

    fn unit(level: u8, state: UnitState, wounded: bool, instance: &str) -> PlayerUnit {
        PlayerUnit {
            instance_id: UnitInstanceId::from(instance),
            unit_id: UnitId::from("peasants"),
            level,
            state,
            wounded,
            used_resistance_this_combat: false,
            used_ability_indices: Vec::new(),
            mana_token: None,
        }
    }

    #[test]
    fn ready_unit_targets_require_spent_state_and_respect_level_cap() {
        let units = vec![
            unit(1, UnitState::Spent, false, "spent_in_cap"),
            unit(1, UnitState::Ready, false, "ready_in_cap"),
            unit(3, UnitState::Spent, false, "spent_over_cap"),
        ];

        assert_eq!(ready_unit_target_indices(&units, 1), vec![0]);
        assert!(has_ready_unit_target(&units, 1));
        assert!(!has_ready_unit_target(&units, 0));
    }

    #[test]
    fn heal_unit_targets_require_wounds_and_respect_level_cap() {
        let units = vec![
            unit(1, UnitState::Ready, true, "wounded_in_cap"),
            unit(1, UnitState::Ready, false, "healthy_in_cap"),
            unit(3, UnitState::Ready, true, "wounded_over_cap"),
        ];

        assert_eq!(heal_unit_target_indices(&units, 1), vec![0]);
        assert!(has_heal_unit_target(&units, 1));
        assert!(!has_heal_unit_target(&units, 0));
    }
}
