/**
 * Modifier system - barrel export
 *
 * Re-exports all modifier functions for backward compatibility.
 * Individual modules can be imported directly for more targeted imports.
 */

// Query helpers (foundation layer)
export {
  getModifiersOfType,
  getModifiersForPlayer,
  getModifiersForEnemy,
  hasArcaneImmunity,
  getEndlessManaColors,
  hasEndlessMana,
} from "./queries.js";

// Combat effective values
export {
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
  getEffectiveCombatBonus,
  isAbilityNullified,
  doesEnemyAttackThisCombat,
  areResistancesRemoved,
  isPhysicalResistanceRemoved,
  isPhysicalAttackDoubled,
  getBaseArmorForPhase,
} from "./combat.js";

// Terrain effective values
export {
  getEffectiveTerrainCost,
  isTerrainSafe,
  getProhibitedTerrains,
  isTerrainProhibited,
} from "./terrain.js";

// Unit effective values
export { getEffectiveUnitResistances, getUnitAttackBonus, getUnitBlockBonus } from "./units.js";

// Card values
export { getEffectiveSidewaysValue, isRuleActive, consumeMovementCardBonus } from "./cardValues.js";

// Lifecycle
export {
  addModifier,
  removeModifier,
  expireModifiers,
  type ExpirationTrigger,
} from "./lifecycle.js";
