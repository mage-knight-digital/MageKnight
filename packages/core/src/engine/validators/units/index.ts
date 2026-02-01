/**
 * Unit validators - validates unit recruitment and activation
 *
 * Split into focused modules:
 * - recruitmentValidators: Command slots, influence, site requirements
 * - activationValidators: Ability usage, phase matching, combat rules
 */

export {
  validateCommandSlots,
  validateInfluenceCost,
  validateAtRecruitmentSite,
  validateUnitTypeMatchesSite,
} from "./recruitmentValidators.js";

export {
  validateUnitExists,
  validateUnitCanActivate,
  validateUnitCanReceiveDamage,
  validateAbilityIndex,
  validateAbilityMatchesPhase,
  validateSiegeRequirement,
  validateCombatRequiredForAbility,
  validateUnitsAllowedInCombat,
  validateUnitAbilityManaCost,
} from "./activationValidators.js";
