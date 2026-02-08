/**
 * Return interactive skill validators
 *
 * Validates that a player can return an interactive skill from the center:
 * - Skill is currently in center (has active center modifiers)
 * - Player is not the owner of the skill
 */

import type { Validator } from "./types.js";
import type { ReturnInteractiveSkillAction } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  SKILL_NOT_IN_CENTER,
  CANNOT_RETURN_OWN_SKILL,
} from "./validationCodes.js";
import {
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import { SKILL_GOLDYX_SOURCE_OPENING } from "../../data/skills/index.js";

/**
 * Validates that the skill is currently in the center (has center modifiers).
 */
export const validateSkillInCenter: Validator = (state, _playerId, action) => {
  const returnAction = action as ReturnInteractiveSkillAction;

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
