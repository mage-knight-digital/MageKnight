/**
 * Unit action validator registry
 * Handles RECRUIT_UNIT_ACTION and ACTIVATE_UNIT_ACTION
 */

import type { Validator } from "../types.js";
import { RECRUIT_UNIT_ACTION, ACTIVATE_UNIT_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Unit validators
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

export const unitRegistry: Record<string, Validator[]> = {
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
