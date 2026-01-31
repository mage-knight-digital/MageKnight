/**
 * Skill valid actions computation.
 *
 * Determines which skills a player can use in the current game state.
 * Handles both normal skill usage and out-of-turn skills (like Motivation).
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillOptions, UsableSkill, SkillId } from "@mage-knight/shared";
import {
  GAME_PHASE_ROUND,
  ROUND_PHASE_PLAYER_TURNS,
  ROUND_PHASE_TACTICS_SELECTION,
} from "@mage-knight/shared";
import {
  getSkillDefinition,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_ONCE_PER_TURN,
} from "../../data/skills/index.js";

/**
 * Check if a skill is on cooldown.
 */
function isSkillOnCooldown(
  player: Player,
  skillId: SkillId,
  usageType: string
): boolean {
  const cooldowns = player.skillCooldowns;

  // Check if locked until next turn (Motivation lockout)
  if (cooldowns.activeUntilNextTurn.includes(skillId)) {
    return true;
  }

  // Check usage-based cooldowns
  if (usageType === SKILL_USAGE_ONCE_PER_ROUND && cooldowns.usedThisRound.includes(skillId)) {
    return true;
  }

  if (usageType === SKILL_USAGE_ONCE_PER_TURN && cooldowns.usedThisTurn.includes(skillId)) {
    return true;
  }

  return false;
}

/**
 * Get skill options for a player during their own turn.
 * This includes all skills with effects that aren't on cooldown.
 *
 * @param state - Current game state
 * @param player - The player to get skill options for
 * @param inCombat - Whether the player is in combat
 */
export function getSkillOptions(
  state: GameState,
  player: Player,
  inCombat: boolean
): SkillOptions | undefined {
  // Can't use skills during tactics selection
  if (
    state.phase === GAME_PHASE_ROUND &&
    state.roundPhase === ROUND_PHASE_TACTICS_SELECTION
  ) {
    return undefined;
  }

  const usableSkills: UsableSkill[] = [];

  for (const skillId of player.skills) {
    const skill = getSkillDefinition(skillId);
    if (!skill) continue;

    // Skip skills without effects (passive skills)
    if (!skill.effect) continue;

    // Check combat restriction
    if (inCombat && !skill.canUseInCombat) continue;

    // Check cooldown
    if (isSkillOnCooldown(player, skillId, skill.usageType)) continue;

    usableSkills.push({
      skillId,
      name: skill.name,
      description: skill.description,
    });
  }

  if (usableSkills.length === 0) {
    return undefined;
  }

  return { usableSkills };
}

/**
 * Get out-of-turn skill options for a player.
 * Only returns skills that can be used on other players' turns.
 *
 * @param state - Current game state
 * @param player - The player to get skill options for
 * @param inCombat - Whether combat is active
 */
export function getOutOfTurnSkillOptions(
  state: GameState,
  player: Player,
  inCombat: boolean
): SkillOptions | undefined {
  // Can only use out-of-turn skills during player turns phase
  if (
    state.phase !== GAME_PHASE_ROUND ||
    state.roundPhase !== ROUND_PHASE_PLAYER_TURNS
  ) {
    return undefined;
  }

  const usableSkills: UsableSkill[] = [];

  for (const skillId of player.skills) {
    const skill = getSkillDefinition(skillId);
    if (!skill) continue;

    // Skip skills without effects (passive skills)
    if (!skill.effect) continue;

    // Only include skills that can be used out of turn
    if (!skill.canUseOutOfTurn) continue;

    // Check combat restriction
    if (inCombat && !skill.canUseInCombat) continue;

    // Check cooldown
    if (isSkillOnCooldown(player, skillId, skill.usageType)) continue;

    usableSkills.push({
      skillId,
      name: skill.name,
      description: skill.description,
    });
  }

  if (usableSkills.length === 0) {
    return undefined;
  }

  return { usableSkills };
}
