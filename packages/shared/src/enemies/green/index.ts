/**
 * Green Enemy Definitions - Marauding Orcs
 *
 * Green enemies are roaming orc bands found in the countryside.
 * They range from fame 1-4 and are generally the weakest enemies.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_DIGGERS, DIGGERS } from "./diggers.js";
export { ENEMY_PROWLERS, PROWLERS } from "./prowlers.js";
export { ENEMY_CURSED_HAGS, CURSED_HAGS } from "./cursed-hags.js";
export { ENEMY_WOLF_RIDERS, WOLF_RIDERS } from "./wolf-riders.js";
export { ENEMY_IRONCLADS, IRONCLADS } from "./ironclads.js";
export { ENEMY_ORC_SUMMONERS, ORC_SUMMONERS } from "./orc-summoners.js";
export { ENEMY_CENTAUR_OUTRIDERS, CENTAUR_OUTRIDERS } from "./centaur-outriders.js";
export { ENEMY_ORC_SKIRMISHERS, ORC_SKIRMISHERS } from "./orc-skirmishers.js";
export { ENEMY_ORC_WAR_BEASTS, ORC_WAR_BEASTS } from "./orc-war-beasts.js";
export { ENEMY_SKELETAL_WARRIORS, SKELETAL_WARRIORS } from "./skeletal-warriors.js";
export { ENEMY_SHROUDED_NECROMANCERS, SHROUDED_NECROMANCERS } from "./shrouded-necromancers.js";

// Import for aggregation
import { ENEMY_DIGGERS, DIGGERS } from "./diggers.js";
import { ENEMY_PROWLERS, PROWLERS } from "./prowlers.js";
import { ENEMY_CURSED_HAGS, CURSED_HAGS } from "./cursed-hags.js";
import { ENEMY_WOLF_RIDERS, WOLF_RIDERS } from "./wolf-riders.js";
import { ENEMY_IRONCLADS, IRONCLADS } from "./ironclads.js";
import { ENEMY_ORC_SUMMONERS, ORC_SUMMONERS } from "./orc-summoners.js";
import { ENEMY_CENTAUR_OUTRIDERS, CENTAUR_OUTRIDERS } from "./centaur-outriders.js";
import { ENEMY_ORC_SKIRMISHERS, ORC_SKIRMISHERS } from "./orc-skirmishers.js";
import { ENEMY_ORC_WAR_BEASTS, ORC_WAR_BEASTS } from "./orc-war-beasts.js";
import { ENEMY_SKELETAL_WARRIORS, SKELETAL_WARRIORS } from "./skeletal-warriors.js";
import { ENEMY_SHROUDED_NECROMANCERS, SHROUDED_NECROMANCERS } from "./shrouded-necromancers.js";

/**
 * Union type of all green (Marauding Orc) enemy IDs
 */
export type GreenEnemyId =
  | typeof ENEMY_DIGGERS
  | typeof ENEMY_PROWLERS
  | typeof ENEMY_CURSED_HAGS
  | typeof ENEMY_WOLF_RIDERS
  | typeof ENEMY_IRONCLADS
  | typeof ENEMY_ORC_SUMMONERS
  | typeof ENEMY_CENTAUR_OUTRIDERS
  | typeof ENEMY_ORC_SKIRMISHERS
  | typeof ENEMY_ORC_WAR_BEASTS
  | typeof ENEMY_SKELETAL_WARRIORS
  | typeof ENEMY_SHROUDED_NECROMANCERS;

/** All green (Marauding Orc) enemies */
export const GREEN_ENEMIES: Record<GreenEnemyId, EnemyDefinition> = {
  [ENEMY_DIGGERS]: DIGGERS,
  [ENEMY_PROWLERS]: PROWLERS,
  [ENEMY_CURSED_HAGS]: CURSED_HAGS,
  [ENEMY_WOLF_RIDERS]: WOLF_RIDERS,
  [ENEMY_IRONCLADS]: IRONCLADS,
  [ENEMY_ORC_SUMMONERS]: ORC_SUMMONERS,
  [ENEMY_CENTAUR_OUTRIDERS]: CENTAUR_OUTRIDERS,
  [ENEMY_ORC_SKIRMISHERS]: ORC_SKIRMISHERS,
  [ENEMY_ORC_WAR_BEASTS]: ORC_WAR_BEASTS,
  [ENEMY_SKELETAL_WARRIORS]: SKELETAL_WARRIORS,
  [ENEMY_SHROUDED_NECROMANCERS]: SHROUDED_NECROMANCERS,
};

// =============================================================================
// TEST ALIASES (backward-compatible for tests)
// =============================================================================

/**
 * @deprecated Use ENEMY_DIGGERS directly
 */
export const ENEMY_ORC = ENEMY_DIGGERS;
