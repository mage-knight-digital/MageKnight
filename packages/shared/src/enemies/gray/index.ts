/**
 * Gray Enemy Definitions - Keep Garrison
 *
 * Gray enemies defend keeps and are stronger than green orcs.
 * They range from fame 2-5 and represent trained human soldiers.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_CROSSBOWMEN, CROSSBOWMEN } from "./crossbowmen.js";
export { ENEMY_GUARDSMEN, GUARDSMEN } from "./guardsmen.js";
export { ENEMY_SWORDSMEN, SWORDSMEN } from "./swordsmen.js";
export { ENEMY_GOLEMS, GOLEMS } from "./golems.js";
export { ENEMY_HEROES, HEROES } from "./heroes.js";
export { ENEMY_THUGS_GRAY, THUGS_GRAY } from "./thugs-gray.js";

// Import for aggregation
import { ENEMY_CROSSBOWMEN, CROSSBOWMEN } from "./crossbowmen.js";
import { ENEMY_GUARDSMEN, GUARDSMEN } from "./guardsmen.js";
import { ENEMY_SWORDSMEN, SWORDSMEN } from "./swordsmen.js";
import { ENEMY_GOLEMS, GOLEMS } from "./golems.js";
import { ENEMY_HEROES, HEROES } from "./heroes.js";
import { ENEMY_THUGS_GRAY, THUGS_GRAY } from "./thugs-gray.js";

/**
 * Union type of all gray (Keep garrison) enemy IDs
 */
export type GrayEnemyId =
  | typeof ENEMY_CROSSBOWMEN
  | typeof ENEMY_GUARDSMEN
  | typeof ENEMY_SWORDSMEN
  | typeof ENEMY_GOLEMS
  | typeof ENEMY_HEROES
  | typeof ENEMY_THUGS_GRAY;

/** All gray (Keep garrison) enemies */
export const GRAY_ENEMIES: Record<GrayEnemyId, EnemyDefinition> = {
  [ENEMY_CROSSBOWMEN]: CROSSBOWMEN,
  [ENEMY_GUARDSMEN]: GUARDSMEN,
  [ENEMY_SWORDSMEN]: SWORDSMEN,
  [ENEMY_GOLEMS]: GOLEMS,
  [ENEMY_HEROES]: HEROES,
  [ENEMY_THUGS_GRAY]: THUGS_GRAY,
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_GUARDSMEN directly
 */
export const ENEMY_WOLF = ENEMY_GUARDSMEN;
