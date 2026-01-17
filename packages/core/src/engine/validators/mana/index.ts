/**
 * Mana validators - validates mana powering of cards
 *
 * Split into focused modules:
 * - sourceValidators: Die, crystal, token availability
 * - rulesValidators: Color matching and time-of-day rules
 * - spellValidators: Spell-specific two-mana requirements
 */

export { validateManaAvailable, validateSingleManaSource } from "./sourceValidators.js";

export {
  validateManaColorMatch,
  validateManaTimeOfDay,
  validateManaDungeonTombRules,
  validateManaTimeOfDayWithDungeonOverride,
} from "./rulesValidators.js";

export {
  validateSpellManaRequirement,
  validateSpellBasicManaRequirement,
} from "./spellValidators.js";
