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
  validateHeroesThugsExclusion,
  validateAbilityIndex,
  validateAbilityMatchesPhase,
  validateSiegeRequirement,
  validateCombatRequiredForAbility,
  validateUnitsAllowedInCombat,
  validateUnitAbilityManaCost,
  validateHeroesAssaultRestriction,
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
    validateHeroesThugsExclusion, // Heroes/Thugs cannot be recruited in same interaction
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
    validateHeroesAssaultRestriction, // Heroes need 2 Influence paid in fortified assaults
    validateAbilityMatchesPhase, // Ability type must match combat phase
    validateSiegeRequirement, // Ranged can't hit fortified in ranged phase
    validateUnitAbilityManaCost, // Validate mana source if ability has mana cost
  ],
};
