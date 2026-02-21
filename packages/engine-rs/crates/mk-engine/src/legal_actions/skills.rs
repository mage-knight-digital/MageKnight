//! Skill activation enumeration.
//!
//! Produces `UseSkill` legal actions for skills the player can currently activate.

use mk_data::skills::{get_skill, is_motivation_skill, SkillPhaseRestriction, SkillUsageType};
use mk_types::enums::CombatPhase;
use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

/// Enumerate all skill activations available to the player.
pub(super) fn enumerate_skill_activations(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let in_combat = state.combat.is_some();
    let combat_phase = state.combat.as_ref().map(|c| c.phase);

    // Pre-check: has any player already used a motivation this round?
    let motivation_used_this_round = state.players.iter().any(|p| {
        p.skill_cooldowns
            .used_this_round
            .iter()
            .any(|id| is_motivation_skill(id.as_str()))
    });

    for skill_id in &player.skills {
        let Some(def) = get_skill(skill_id.as_str()) else {
            continue;
        };

        // Skip unimplemented skills
        if def.effect.is_none() {
            continue;
        }

        // Skip passive and interactive skills (not manually activated)
        match def.usage_type {
            SkillUsageType::Passive | SkillUsageType::Interactive => continue,
            SkillUsageType::OncePerTurn | SkillUsageType::OncePerRound => {}
        }

        // Skip flipped skills
        if player
            .skill_flip_state
            .flipped_skills
            .contains(skill_id)
        {
            continue;
        }

        // Check cooldowns
        match def.usage_type {
            SkillUsageType::OncePerTurn => {
                if player.skill_cooldowns.used_this_turn.contains(skill_id) {
                    continue;
                }
            }
            SkillUsageType::OncePerRound => {
                if player.skill_cooldowns.used_this_round.contains(skill_id) {
                    continue;
                }
            }
            _ => {}
        }

        // Motivation cross-player cooldown
        if def.is_motivation && motivation_used_this_round {
            continue;
        }

        // Phase restriction check
        if !phase_allows_skill(def.phase_restriction, in_combat, combat_phase) {
            continue;
        }

        actions.push(LegalAction::UseSkill {
            skill_id: skill_id.clone(),
        });
    }
}

/// Check if the current game context allows a skill with the given phase restriction.
fn phase_allows_skill(
    restriction: SkillPhaseRestriction,
    in_combat: bool,
    combat_phase: Option<CombatPhase>,
) -> bool {
    match restriction {
        SkillPhaseRestriction::None => true,
        SkillPhaseRestriction::NoCombat => !in_combat,
        SkillPhaseRestriction::CombatOnly => in_combat,
        SkillPhaseRestriction::MeleeAttackOnly => {
            combat_phase == Some(CombatPhase::Attack)
        }
        SkillPhaseRestriction::RangedSiegeOrAttack => matches!(
            combat_phase,
            Some(CombatPhase::RangedSiege) | Some(CombatPhase::Attack)
        ),
        SkillPhaseRestriction::BlockOnly => {
            combat_phase == Some(CombatPhase::Block)
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::enums::*;
    use mk_types::ids::SkillId;
    use mk_types::state::*;

    fn test_state_with_skill(skill_id: &str) -> GameState {
        let mut state = crate::setup::create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0]
            .skills
            .push(SkillId::from(skill_id));
        state
    }

    #[test]
    fn owned_skill_enumerated() {
        let state = test_state_with_skill("arythea_dark_paths");
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_dark_paths")),
            "Should enumerate arythea_dark_paths"
        );
    }

    #[test]
    fn cooldown_blocks_reuse() {
        let mut state = test_state_with_skill("arythea_dark_paths");
        state.players[0]
            .skill_cooldowns
            .used_this_turn
            .push(SkillId::from("arythea_dark_paths"));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_dark_paths")),
            "Should not enumerate used skill"
        );
    }

    #[test]
    fn combat_phase_gating() {
        // arythea_hot_swordsmanship requires MeleeAttackOnly
        let mut state = test_state_with_skill("arythea_hot_swordsmanship");
        // Not in combat → should not enumerate
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_hot_swordsmanship")),
            "Should not enumerate MeleeAttackOnly outside combat"
        );

        // In combat Attack phase → should enumerate
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Attack,
            ..CombatState::default()
        }));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_hot_swordsmanship")),
            "Should enumerate MeleeAttackOnly in Attack phase"
        );
    }

    #[test]
    fn flipped_blocks_activation() {
        let mut state = test_state_with_skill("arythea_dark_paths");
        state.players[0]
            .skill_flip_state
            .flipped_skills
            .push(SkillId::from("arythea_dark_paths"));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_dark_paths")),
            "Flipped skills should be blocked"
        );
    }

    #[test]
    fn motivation_cross_cooldown() {
        let mut state = test_state_with_skill("arythea_motivation");
        // Another player already used a motivation this round
        state.players[0]
            .skill_cooldowns
            .used_this_round
            .push(SkillId::from("tovak_motivation"));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_motivation")),
            "Motivation should be blocked when another motivation was used this round"
        );
    }

    #[test]
    fn unimplemented_skill_skipped() {
        let state = test_state_with_skill("arythea_invocation");
        // arythea_invocation has effect: None
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_invocation")),
            "Unimplemented skills should be skipped"
        );
    }

    #[test]
    fn no_combat_skill_blocked_in_combat() {
        let mut state = test_state_with_skill("arythea_dark_negotiation");
        state.combat = Some(Box::new(CombatState::default()));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_dark_negotiation")),
            "NoCombat skills should be blocked in combat"
        );
    }

    #[test]
    fn ranged_siege_or_attack_phases() {
        let mut state = test_state_with_skill("arythea_burning_power");

        // Block phase → not allowed
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Block,
            ..CombatState::default()
        }));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_burning_power")),
            "RangedSiegeOrAttack should not be available in Block phase"
        );

        // RangedSiege phase → allowed
        state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_burning_power")),
            "RangedSiegeOrAttack should be available in RangedSiege phase"
        );
    }

    // === Tier 2+3 skill enumeration tests ===

    #[test]
    fn shield_mastery_only_in_block_phase() {
        let mut state = test_state_with_skill("tovak_shield_mastery");

        // Outside combat → not available
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "tovak_shield_mastery")),
            "BlockOnly skill should not be available outside combat"
        );

        // Block phase → available
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Block,
            ..CombatState::default()
        }));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "tovak_shield_mastery")),
            "BlockOnly skill should be available in Block phase"
        );

        // Attack phase → not available
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "tovak_shield_mastery")),
            "BlockOnly skill should not be available in Attack phase"
        );
    }

    #[test]
    fn battle_hardened_combat_only() {
        let mut state = test_state_with_skill("krang_battle_hardened");

        // Outside combat → not available
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "krang_battle_hardened")),
            "CombatOnly skill should not be available outside combat"
        );

        // In combat → available
        state.combat = Some(Box::new(CombatState::default()));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "krang_battle_hardened")),
            "CombatOnly skill should be available in combat"
        );
    }

    #[test]
    fn leadership_combat_only() {
        let mut state = test_state_with_skill("norowas_leadership");

        // Outside combat → not available (combat-only)
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            !actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "norowas_leadership")),
        );

        // In combat → available
        state.combat = Some(Box::new(CombatState::default()));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "norowas_leadership")),
        );
    }

    #[test]
    fn tier2_skills_enumerable_outside_combat() {
        // These Tier 2 NoCombat skills should all be enumerable during normal turn
        let no_combat_skills = [
            "braevalar_beguile",
            "tovak_i_feel_no_pain",
        ];
        for id in no_combat_skills {
            let state = test_state_with_skill(id);
            let mut actions = Vec::new();
            enumerate_skill_activations(&state, 0, &mut actions);
            assert!(
                actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == id)),
                "{} should be enumerable during normal turn",
                id
            );
        }
    }

    #[test]
    fn tier2_no_restriction_skills_available_everywhere() {
        // goldyx_flight is OncePerRound+NoCombat, braevalar_thunderstorm is OncePerRound+None
        let state = test_state_with_skill("braevalar_thunderstorm");
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "braevalar_thunderstorm")),
            "No-restriction skill should be available outside combat"
        );

        // Also in combat
        let mut state = test_state_with_skill("braevalar_thunderstorm");
        state.combat = Some(Box::new(CombatState::default()));
        let mut actions = Vec::new();
        enumerate_skill_activations(&state, 0, &mut actions);
        assert!(
            actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "braevalar_thunderstorm")),
            "No-restriction skill should be available in combat"
        );
    }
}
