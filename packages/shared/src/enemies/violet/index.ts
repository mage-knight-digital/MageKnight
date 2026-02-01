/**
 * Violet Enemy Definitions - Mage Tower Defenders
 *
 * Violet enemies defend mage towers. They are magical enemies
 * with elemental attacks and resistances. Fame ranges from 4-5.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_MONKS, MONKS } from "./monks.js";
export { ENEMY_ILLUSIONISTS, ILLUSIONISTS } from "./illusionists.js";
export { ENEMY_ICE_MAGES, ICE_MAGES } from "./ice-mages.js";
export { ENEMY_FIRE_MAGES, FIRE_MAGES } from "./fire-mages.js";
export { ENEMY_ICE_GOLEMS, ICE_GOLEMS } from "./ice-golems.js";
export { ENEMY_FIRE_GOLEMS, FIRE_GOLEMS } from "./fire-golems.js";
export { ENEMY_SORCERERS, SORCERERS } from "./sorcerers.js";
export { ENEMY_MAGIC_FAMILIARS, MAGIC_FAMILIARS } from "./magic-familiars.js";

// Import for aggregation
import { ENEMY_MONKS, MONKS } from "./monks.js";
import { ENEMY_ILLUSIONISTS, ILLUSIONISTS } from "./illusionists.js";
import { ENEMY_ICE_MAGES, ICE_MAGES } from "./ice-mages.js";
import { ENEMY_FIRE_MAGES, FIRE_MAGES } from "./fire-mages.js";
import { ENEMY_ICE_GOLEMS, ICE_GOLEMS } from "./ice-golems.js";
import { ENEMY_FIRE_GOLEMS, FIRE_GOLEMS } from "./fire-golems.js";
import { ENEMY_SORCERERS, SORCERERS } from "./sorcerers.js";
import { ENEMY_MAGIC_FAMILIARS, MAGIC_FAMILIARS } from "./magic-familiars.js";

/**
 * Union type of all violet (Mage Tower) enemy IDs
 */
export type VioletEnemyId =
  | typeof ENEMY_MONKS
  | typeof ENEMY_ILLUSIONISTS
  | typeof ENEMY_ICE_MAGES
  | typeof ENEMY_FIRE_MAGES
  | typeof ENEMY_ICE_GOLEMS
  | typeof ENEMY_FIRE_GOLEMS
  | typeof ENEMY_SORCERERS
  | typeof ENEMY_MAGIC_FAMILIARS;

/** All violet (Mage Tower) enemies */
export const VIOLET_ENEMIES: Record<VioletEnemyId, EnemyDefinition> = {
  [ENEMY_MONKS]: MONKS,
  [ENEMY_ILLUSIONISTS]: ILLUSIONISTS,
  [ENEMY_ICE_MAGES]: ICE_MAGES,
  [ENEMY_FIRE_MAGES]: FIRE_MAGES,
  [ENEMY_ICE_GOLEMS]: ICE_GOLEMS,
  [ENEMY_FIRE_GOLEMS]: FIRE_GOLEMS,
  [ENEMY_SORCERERS]: SORCERERS,
  [ENEMY_MAGIC_FAMILIARS]: MAGIC_FAMILIARS,
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_FIRE_MAGES directly
 */
export const ENEMY_FIRE_MAGE = ENEMY_FIRE_MAGES;

/**
 * @deprecated Use ENEMY_ICE_GOLEMS directly
 */
export const ENEMY_ICE_GOLEM = ENEMY_ICE_GOLEMS;

/**
 * @deprecated Use ENEMY_FIRE_GOLEMS directly
 */
export const ENEMY_FIRE_GOLEM = ENEMY_FIRE_GOLEMS;
