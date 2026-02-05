/**
 * Unit validators - validates unit recruitment and activation
 *
 * Split into focused modules:
 * - recruitmentValidators: Command slots, influence, site requirements
 * - activationValidators: Ability usage, phase matching, combat rules
 */

export {
  validateReputationNotX,
  validateCommandSlots,
  validateInfluenceCost,
  validateAtRecruitmentSite,
  validateUnitTypeMatchesSite,
  validateHeroesThugsExclusion,
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
  validateHeroesAssaultRestriction,
} from "./activationValidators.js";
