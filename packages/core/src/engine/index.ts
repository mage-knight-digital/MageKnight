/**
 * Game engine functions
 *
 * This module contains the core game logic including:
 * - Modifier management and effective value calculations
 * - (Future) Action processing, combat resolution, etc.
 */

// Modifier system
export type { ExpirationTrigger } from "./modifiers.js";
export {
  // Query helpers
  getModifiersOfType,
  getModifiersForPlayer,
  getModifiersForEnemy,
  // Effective value calculations
  getEffectiveTerrainCost,
  getEffectiveSidewaysValue,
  isRuleActive,
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
  // Lifecycle
  addModifier,
  removeModifier,
  expireModifiers,
} from "./modifiers.js";
