/**
 * Unit validators routing - RECRUIT_UNIT, ACTIVATE_UNIT
 */

import type { ValidatorRegistry } from "./types.js";
import {
  RECRUIT_UNIT_ACTION,
  ACTIVATE_UNIT_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
} from "../choiceValidators.js";

import {
  validateMustAnnounceEndOfRound,
} from "../roundValidators.js";

import {
  validateCommandSlots,
  validateInfluenceCost,
  validateUnitExists,
  validateUnitCanActivate,
  validateAtRecruitmentSite,
  validateUnitTypeMatchesSite,
  validateAbilityIndex,
  validateAbilityMatchesPhase,
  validateSiegeRequirement,
  validateCombatRequiredForAbility,
  validateUnitsAllowedInCombat,
} from "../units/index.js";

export const unitValidatorRegistry: ValidatorRegistry = {
  [RECRUIT_UNIT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateCommandSlots,
    validateInfluenceCost,
    validateAtRecruitmentSite,
    validateUnitTypeMatchesSite,
  ],
  [ACTIVATE_UNIT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateUnitExists,
    validateUnitCanActivate,
    validateAbilityIndex,
    validateCombatRequiredForAbility, // Combat abilities require being in combat
    validateUnitsAllowedInCombat, // Dungeon/Tomb: units cannot be used
    validateAbilityMatchesPhase, // Ability type must match combat phase
    validateSiegeRequirement, // Ranged can't hit fortified in ranged phase
  ],
};
