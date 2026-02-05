/**
 * Brown Enemy Definitions - Dungeon Monsters
 *
 * Brown enemies are found in dungeons and tombs. They are generally
 * stronger than surface enemies and often have special abilities.
 * Dungeons prevent unit participation and gold mana usage.
 */

import type { EnemyDefinition } from "../types.js";

// Re-export individual enemies
export { ENEMY_AIR_ELEMENTAL, AIR_ELEMENTAL } from "./air-elemental.js";
export { ENEMY_EARTH_ELEMENTAL, EARTH_ELEMENTAL } from "./earth-elemental.js";
export { ENEMY_BLOOD_DEMON, BLOOD_DEMON } from "./blood-demon.js";
export { ENEMY_MINOTAUR, MINOTAUR } from "./minotaur.js";
export { ENEMY_GARGOYLE, GARGOYLE } from "./gargoyle.js";
export { ENEMY_MEDUSA, MEDUSA } from "./medusa.js";
export { ENEMY_CRYPT_WORM, CRYPT_WORM } from "./crypt-worm.js";
export { ENEMY_WEREWOLF, WEREWOLF } from "./werewolf.js";
export { ENEMY_SHADOW, SHADOW } from "./shadow.js";
export { ENEMY_FIRE_ELEMENTAL, FIRE_ELEMENTAL } from "./fire-elemental.js";
export { ENEMY_MUMMY, MUMMY } from "./mummy.js";
export { ENEMY_HYDRA, HYDRA } from "./hydra.js";
export { ENEMY_MANTICORE, MANTICORE } from "./manticore.js";
export { ENEMY_WATER_ELEMENTAL, WATER_ELEMENTAL } from "./water-elemental.js";
export { ENEMY_VAMPIRE, VAMPIRE } from "./vampire.js";
export { ENEMY_PAIN_WRAITH, PAIN_WRAITH } from "./pain-wraith.js";

// Import for aggregation
import { ENEMY_AIR_ELEMENTAL, AIR_ELEMENTAL } from "./air-elemental.js";
import { ENEMY_EARTH_ELEMENTAL, EARTH_ELEMENTAL } from "./earth-elemental.js";
import { ENEMY_BLOOD_DEMON, BLOOD_DEMON } from "./blood-demon.js";
import { ENEMY_MINOTAUR, MINOTAUR } from "./minotaur.js";
import { ENEMY_GARGOYLE, GARGOYLE } from "./gargoyle.js";
import { ENEMY_MEDUSA, MEDUSA } from "./medusa.js";
import { ENEMY_CRYPT_WORM, CRYPT_WORM } from "./crypt-worm.js";
import { ENEMY_WEREWOLF, WEREWOLF } from "./werewolf.js";
import { ENEMY_SHADOW, SHADOW } from "./shadow.js";
import { ENEMY_FIRE_ELEMENTAL, FIRE_ELEMENTAL } from "./fire-elemental.js";
import { ENEMY_MUMMY, MUMMY } from "./mummy.js";
import { ENEMY_HYDRA, HYDRA } from "./hydra.js";
import { ENEMY_MANTICORE, MANTICORE } from "./manticore.js";
import { ENEMY_WATER_ELEMENTAL, WATER_ELEMENTAL } from "./water-elemental.js";
import { ENEMY_VAMPIRE, VAMPIRE } from "./vampire.js";
import { ENEMY_PAIN_WRAITH, PAIN_WRAITH } from "./pain-wraith.js";

/**
 * Union type of all brown (Dungeon monster) enemy IDs
 */
export type BrownEnemyId =
  | typeof ENEMY_AIR_ELEMENTAL
  | typeof ENEMY_EARTH_ELEMENTAL
  | typeof ENEMY_BLOOD_DEMON
  | typeof ENEMY_MINOTAUR
  | typeof ENEMY_GARGOYLE
  | typeof ENEMY_MEDUSA
  | typeof ENEMY_CRYPT_WORM
  | typeof ENEMY_WEREWOLF
  | typeof ENEMY_SHADOW
  | typeof ENEMY_FIRE_ELEMENTAL
  | typeof ENEMY_MUMMY
  | typeof ENEMY_HYDRA
  | typeof ENEMY_MANTICORE
  | typeof ENEMY_WATER_ELEMENTAL
  | typeof ENEMY_VAMPIRE
  | typeof ENEMY_PAIN_WRAITH;

/** All brown (Dungeon monster) enemies */
export const BROWN_ENEMIES: Record<BrownEnemyId, EnemyDefinition> = {
  [ENEMY_AIR_ELEMENTAL]: AIR_ELEMENTAL,
  [ENEMY_EARTH_ELEMENTAL]: EARTH_ELEMENTAL,
  [ENEMY_BLOOD_DEMON]: BLOOD_DEMON,
  [ENEMY_MINOTAUR]: MINOTAUR,
  [ENEMY_GARGOYLE]: GARGOYLE,
  [ENEMY_MEDUSA]: MEDUSA,
  [ENEMY_CRYPT_WORM]: CRYPT_WORM,
  [ENEMY_WEREWOLF]: WEREWOLF,
  [ENEMY_SHADOW]: SHADOW,
  [ENEMY_FIRE_ELEMENTAL]: FIRE_ELEMENTAL,
  [ENEMY_MUMMY]: MUMMY,
  [ENEMY_HYDRA]: HYDRA,
  [ENEMY_MANTICORE]: MANTICORE,
  [ENEMY_WATER_ELEMENTAL]: WATER_ELEMENTAL,
  [ENEMY_VAMPIRE]: VAMPIRE,
  [ENEMY_PAIN_WRAITH]: PAIN_WRAITH,
};
