/**
 * Return interactive skill validators
 *
 * Validates that a player can return an interactive skill from the center:
 * - Skill is currently in center (has active center modifiers)
 * - Player is not the owner of the skill
 */

import type { Validator } from "./types.js";
import { MANA_GREEN, type ReturnInteractiveSkillAction } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  SKILL_NOT_IN_CENTER,
  CANNOT_RETURN_OWN_SKILL,
  PLAYER_NOT_FOUND,
  ALREADY_ACTED,
  MUST_COMPLETE_REST,
} from "./validationCodes.js";
import {
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import {
  SKILL_GOLDYX_SOURCE_OPENING,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_KRANG_ARCANE_DISGUISE,
} from "../../data/skills/index.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

function isShamanicRitualFlipBack(skillId: string): boolean {
  return skillId === SKILL_KRANG_SHAMANIC_RITUAL;
}

function isArcaneDisguiseFlipBack(skillId: string): boolean {
  return skillId === SKILL_KRANG_ARCANE_DISGUISE;
}

/**
 * Validates that the skill is currently in the center (has center modifiers).
 */
export const validateSkillInCenter: Validator = (state, _playerId, action) => {
  const returnAction = action as ReturnInteractiveSkillAction;
  if (
    isShamanicRitualFlipBack(returnAction.skillId) ||
    isArcaneDisguiseFlipBack(returnAction.skillId)
  ) {
    const player = getPlayerById(state, _playerId);
    if (!player) {
      return invalid(PLAYER_NOT_FOUND, "Player not found");
    }

    const skillId = returnAction.skillId;
    if (player.skills.includes(skillId) && player.skillFlipState.flippedSkills.includes(skillId)) {
      return valid();
    }

    return invalid(
      SKILL_NOT_IN_CENTER,
      `${skillId} is not face-down and cannot be flipped back`
    );
  }

  const centerModifier = state.activeModifiers.find(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === returnAction.skillId
  );

  if (!centerModifier) {
    return invalid(
      SKILL_NOT_IN_CENTER,
      `Skill ${returnAction.skillId} is not in the center`
    );
  }

  return valid();
};

/**
 * Validates that the player is not the owner of the skill.
 * Only other players can return a skill from the center.
 *
 * Exception: In solo mode, Source Opening allows the owner to return
 * their own skill on their next turn (per FAQ S1).
 */
export const validateNotOwnSkill: Validator = (state, playerId, action) => {
  const returnAction = action as ReturnInteractiveSkillAction;
  if (
    isShamanicRitualFlipBack(returnAction.skillId) ||
    isArcaneDisguiseFlipBack(returnAction.skillId)
  ) {
    return valid();
  }

  const centerModifier = state.activeModifiers.find(
    (m) =>
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === returnAction.skillId
  );

  if (
    centerModifier &&
    centerModifier.source.type === SOURCE_SKILL &&
    centerModifier.source.playerId === playerId
  ) {
    // Solo mode exception: Source Opening can be returned by owner (S1)
    const isSolo = state.players.length === 1;
    if (isSolo && returnAction.skillId === SKILL_GOLDYX_SOURCE_OPENING) {
      return valid();
    }

    return invalid(
      CANNOT_RETURN_OWN_SKILL,
      "You cannot return your own skill from the center"
    );
  }

  return valid();
};

/**
 * Validates Shamanic Ritual's special flip-back constraints:
 * - Spending your action (cannot already have taken action)
 * - Cannot flip back while resting
 */
export const validateShamanicRitualFlipBack: Validator = (
  state,
  playerId,
  action
) => {
  const returnAction = action as ReturnInteractiveSkillAction;
  if (!isShamanicRitualFlipBack(returnAction.skillId)) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.isResting) {
    return invalid(
      MUST_COMPLETE_REST,
      "Cannot flip back Shamanic Ritual while resting"
    );
  }

  if (player.hasTakenActionThisTurn) {
    return invalid(
      ALREADY_ACTED,
      "Flipping back Shamanic Ritual uses your action for this turn"
    );
  }

  return valid();
};

/**
 * Validates Arcane Disguise's flip-back constraints:
 * - Skill is face-down on owner (checked by validateSkillInCenter)
 * - Owner must pay one green mana token
 * - Does not consume action, so no hasTakenActionThisTurn checks
 */
export const validateArcaneDisguiseFlipBack: Validator = (
  state,
  playerId,
  action
) => {
  const returnAction = action as ReturnInteractiveSkillAction;
  if (!isArcaneDisguiseFlipBack(returnAction.skillId)) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pureMana.some((token) => token.color === MANA_GREEN)) {
    return invalid(
      SKILL_NOT_IN_CENTER,
      "Arcane Disguise flip-back requires 1 green mana token"
    );
  }

  return valid();
};
