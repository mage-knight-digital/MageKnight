/**
 * Wound lockout rules.
 *
 * When a player's hand is all wounds and they have no "escape hatch" skills
 * (skills that draw cards), they are effectively stuck. This module provides
 * the shared rule logic used by both validators and validActions to restrict
 * actions to: slow recovery, end turn, announce end of round, undo, and skills.
 *
 * Escape hatch skills (skills that can draw cards when hand is all wounds):
 * - Motivation (all hero variants) — draw 2 cards, once per round (flip)
 * - I Feel No Pain (Tovak) — discard 1 wound + draw 1, once per turn
 * - Regenerate (Krang/Braevalar) — pay mana + discard wound, conditionally draw 1
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { isHandAllWounds } from "./turnStructure.js";
import { isSkillFaceUp } from "./skillPhasing.js";
import {
  ALL_MOTIVATION_SKILLS,
  isMotivationCooldownActive,
} from "./motivation.js";
import {
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
} from "../../data/skills/index.js";
import { canActivateRegenerate } from "../commands/skills/regenerateEffect.js";

/**
 * All Regenerate skill IDs across heroes.
 */
const ALL_REGENERATE_SKILLS = [
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
] as const;

/**
 * Check if the player has an activatable card-drawing escape hatch skill.
 *
 * Returns true if ANY of the following skills is currently activatable:
 * - Motivation (any hero variant): player has it, face-up, motivation cooldown not active
 * - I Feel No Pain (Tovak): player has it, face-up, not on turn cooldown, not in combat, has wound in hand
 * - Regenerate (Krang/Braevalar): player has it, face-up, not on turn cooldown, canActivateRegenerate passes
 */
export function hasCardDrawEscapeHatch(
  state: GameState,
  player: Player
): boolean {
  // Check Motivation skills
  if (!isMotivationCooldownActive(player)) {
    for (const skillId of ALL_MOTIVATION_SKILLS) {
      if (
        player.skills.includes(skillId) &&
        isSkillFaceUp(player, skillId)
      ) {
        return true;
      }
    }
  }

  // Check I Feel No Pain (Tovak) — once per turn, requires wound in hand, not in combat
  if (
    player.skills.includes(SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    isSkillFaceUp(player, SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    !player.skillCooldowns.usedThisTurn.includes(SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    state.combat === null &&
    player.hand.some((c) => c === CARD_WOUND)
  ) {
    return true;
  }

  // Check Regenerate (Braevalar/Krang) — once per turn, requires wound + mana
  for (const skillId of ALL_REGENERATE_SKILLS) {
    if (
      player.skills.includes(skillId) &&
      isSkillFaceUp(player, skillId) &&
      !player.skillCooldowns.usedThisTurn.includes(skillId) &&
      canActivateRegenerate(state, player)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the player is locked into slow recovery.
 *
 * A player is locked when their hand is all wounds AND they have no
 * activatable card-drawing escape hatch skill.
 */
export function isLockedIntoSlowRecovery(
  state: GameState,
  player: Player
): boolean {
  return isHandAllWounds(player) && !hasCardDrawEscapeHatch(state, player);
}
