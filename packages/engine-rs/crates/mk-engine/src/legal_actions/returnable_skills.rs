//! Returnable interactive skill enumeration.
//!
//! When another player has placed an interactive skill in the center (detected
//! via Round-duration OtherPlayers-scope modifiers), the current player can
//! return it for a benefit.
//!
//! In solo mode, a player can return their own interactive skill if it was
//! placed on a previous turn (detected via placement_turn < turn_number).

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

    let is_solo = state.dummy_player.is_some();

    for &(skill_str, requires_combat) in RETURNABLE_SKILLS {
        if requires_combat && state.combat.is_none() {
            continue;
        }

        // Check if any center marker (Round/OtherPlayers) exists from a different player
        let in_center = state.active_modifiers.iter().any(|m| {
            matches!(&m.source, ModifierSource::Skill { skill_id, player_id: owner }
                if skill_id.as_str() == skill_str && *owner != *player_id)
            && matches!(m.duration, mk_types::modifier::ModifierDuration::Round)
            && matches!(m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        });

        // Solo: allow self-return if center marker exists from self, placed on a previous turn
        let solo_self_return = !in_center
            && is_solo
            && state.active_modifiers.iter().any(|m| {
                matches!(&m.source, ModifierSource::Skill { skill_id, player_id: owner }
                    if skill_id.as_str() == skill_str && *owner == *player_id)
                && matches!(m.duration, mk_types::modifier::ModifierDuration::Round)
                && matches!(m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
            })
            && solo_return_window_open(state, player_idx, skill_str);

        if in_center || solo_self_return {
            actions.push(LegalAction::ReturnInteractiveSkill {
                skill_id: SkillId::from(skill_str),
            });
        }
    }
}

/// Check if the solo return window is open for a given skill.
/// For most skills, checks placement_turn on SkillFlipState.
/// For Mana Enhancement (auto-triggered), checks its own center state.
fn solo_return_window_open(state: &GameState, player_idx: usize, skill_str: &str) -> bool {
    match skill_str {
        "krang_mana_enhancement" => {
            state.mana_enhancement_center.as_ref()
                .is_some_and(|c| c.placement_turn < state.turn_number)
        }
        _ => {
            let pt = state.players[player_idx].skill_flip_state.placement_turn;
            pt < state.turn_number
        }
    }
}
