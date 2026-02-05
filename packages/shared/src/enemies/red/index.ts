/**
 * Red Enemy Definitions - Draconum (Dragons)
 *
 * Red enemies are the mighty Draconum - powerful dragons that
 * roam the land. They are the strongest enemies in the game,
 * with fame ranging from 6-9. Each dragon has unique elemental
 * attacks and resistances.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_SWAMP_DRAGON, SWAMP_DRAGON } from "./swamp-dragon.js";
export { ENEMY_FIRE_DRAGON, FIRE_DRAGON } from "./fire-dragon.js";
export { ENEMY_ICE_DRAGON, ICE_DRAGON } from "./ice-dragon.js";
export { ENEMY_HIGH_DRAGON, HIGH_DRAGON } from "./high-dragon.js";
export { ENEMY_DEATH_DRAGON, DEATH_DRAGON } from "./death-dragon.js";
export { ENEMY_LAVA_DRAGON, LAVA_DRAGON } from "./lava-dragon.js";
export { ENEMY_SAVAGE_DRAGON, SAVAGE_DRAGON } from "./savage-dragon.js";
export { ENEMY_DRAGON_SUMMONER, DRAGON_SUMMONER } from "./dragon-summoner.js";
export { ENEMY_LIGHTNING_DRAGON, LIGHTNING_DRAGON } from "./lightning-dragon.js";
export { ENEMY_STORM_DRAGON, STORM_DRAGON } from "./storm-dragon.js";

// Import for aggregation
import { ENEMY_SWAMP_DRAGON, SWAMP_DRAGON } from "./swamp-dragon.js";
import { ENEMY_FIRE_DRAGON, FIRE_DRAGON } from "./fire-dragon.js";
import { ENEMY_ICE_DRAGON, ICE_DRAGON } from "./ice-dragon.js";
import { ENEMY_HIGH_DRAGON, HIGH_DRAGON } from "./high-dragon.js";
import { ENEMY_DEATH_DRAGON, DEATH_DRAGON } from "./death-dragon.js";
import { ENEMY_LAVA_DRAGON, LAVA_DRAGON } from "./lava-dragon.js";
import { ENEMY_SAVAGE_DRAGON, SAVAGE_DRAGON } from "./savage-dragon.js";
import { ENEMY_DRAGON_SUMMONER, DRAGON_SUMMONER } from "./dragon-summoner.js";
import { ENEMY_LIGHTNING_DRAGON, LIGHTNING_DRAGON } from "./lightning-dragon.js";
import { ENEMY_STORM_DRAGON, STORM_DRAGON } from "./storm-dragon.js";

/**
 * Union type of all red (Draconum) enemy IDs
 */
export type RedEnemyId =
  | typeof ENEMY_SWAMP_DRAGON
  | typeof ENEMY_FIRE_DRAGON
  | typeof ENEMY_ICE_DRAGON
  | typeof ENEMY_HIGH_DRAGON
  | typeof ENEMY_DEATH_DRAGON
  | typeof ENEMY_LAVA_DRAGON
  | typeof ENEMY_SAVAGE_DRAGON
  | typeof ENEMY_DRAGON_SUMMONER
  | typeof ENEMY_LIGHTNING_DRAGON
  | typeof ENEMY_STORM_DRAGON;

/** All red (Draconum) enemies */
export const RED_ENEMIES: Record<RedEnemyId, EnemyDefinition> = {
  [ENEMY_SWAMP_DRAGON]: SWAMP_DRAGON,
  [ENEMY_FIRE_DRAGON]: FIRE_DRAGON,
  [ENEMY_ICE_DRAGON]: ICE_DRAGON,
  [ENEMY_HIGH_DRAGON]: HIGH_DRAGON,
  [ENEMY_DEATH_DRAGON]: DEATH_DRAGON,
  [ENEMY_LAVA_DRAGON]: LAVA_DRAGON,
  [ENEMY_SAVAGE_DRAGON]: SAVAGE_DRAGON,
  [ENEMY_DRAGON_SUMMONER]: DRAGON_SUMMONER,
  [ENEMY_LIGHTNING_DRAGON]: LIGHTNING_DRAGON,
  [ENEMY_STORM_DRAGON]: STORM_DRAGON,
};
