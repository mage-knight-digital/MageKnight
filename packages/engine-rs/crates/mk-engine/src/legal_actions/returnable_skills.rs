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
pub(crate) fn enumerate_returnable_skills(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player_id = &state.players[player_idx].id;

    // After end-of-round is announced, a player whose last turn is over cannot return skills.
    // A player's last turn is over if: they're not the active player AND not in the final turn list.
    if state.end_of_round_announced_by.is_some() {
        let is_active = {
            let current_idx = state.current_player_index as usize;
            current_idx < state.turn_order.len()
                && state.turn_order[current_idx] == *player_id
        };
        if !is_active && !state.players_with_final_turn.contains(player_id) {
            return;
        }
    }

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
