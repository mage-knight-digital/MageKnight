//! Returnable interactive skill enumeration.
//!
//! When another player has placed an interactive skill in the center (detected
//! via Round-duration OtherPlayers-scope modifiers), the current player can
//! return it for a benefit.

use mk_types::ids::SkillId;
use mk_types::legal_action::LegalAction;
use mk_types::modifier::ModifierSource;
use mk_types::state::GameState;

/// Interactive skills that can be returned, and whether they require combat.
const RETURNABLE_SKILLS: &[(&str, bool)] = &[
    ("norowas_prayer_of_weather", false),
    ("arythea_ritual_of_pain", false),
    ("braevalar_natures_vengeance", true),
    ("krang_mana_enhancement", false),
    ("goldyx_source_opening", false),
];

/// Enumerate `ReturnInteractiveSkill` actions for skills another player placed in center.
pub(super) fn enumerate_returnable_skills(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player_id = &state.players[player_idx].id;

    for &(skill_str, requires_combat) in RETURNABLE_SKILLS {
        if requires_combat && state.combat.is_none() {
            continue;
        }

        // Check if any modifier with this skill source exists from a different player
        let in_center = state.active_modifiers.iter().any(|m| {
            matches!(&m.source, ModifierSource::Skill { skill_id, player_id: owner }
                if skill_id.as_str() == skill_str && *owner != *player_id)
        });

        if in_center {
            actions.push(LegalAction::ReturnInteractiveSkill {
                skill_id: SkillId::from(skill_str),
            });
        }
    }
}
