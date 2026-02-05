/**
 * Shared skill phasing rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift between what actions are validated and what options
 * are shown to the player.
 */

import type { GameState } from "../../state/GameState.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import type { SkillId } from "@mage-knight/shared";
import { SKILL_ARYTHEA_HOT_SWORDSMANSHIP } from "../../data/skills/index.js";

/**
 * Skills that provide melee attacks and can only be used during attack phase.
 * These differ from ranged/siege skills which can be used during ranged/siege or attack phases.
 */
const MELEE_ATTACK_SKILLS: readonly SkillId[] = [SKILL_ARYTHEA_HOT_SWORDSMANSHIP];

/**
 * Check if a melee attack skill can be used in the current combat phase.
 * Returns true only if in combat during the attack phase.
 */
export function canUseMeleeAttackSkill(state: GameState): boolean {
  return state.combat !== null && state.combat.phase === COMBAT_PHASE_ATTACK;
}

/**
 * Check if a skill ID is a melee attack skill.
 */
export function isMeleeAttackSkill(skillId: SkillId): boolean {
  return MELEE_ATTACK_SKILLS.includes(skillId);
}
