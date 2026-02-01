/**
 * Green-powered advanced action cards (powered by green mana)
 */

import {
  CARD_REFRESHING_WALK,
  CARD_PATH_FINDING,
  CARD_REGENERATION,
  CARD_IN_NEED,
  CARD_AMBUSH,
  CARD_TRAINING,
  CARD_STOUT_RESOLVE,
  CARD_FORCE_OF_NATURE,
  CARD_MOUNTAIN_LORE,
  CARD_POWER_OF_CRYSTALS,
  CARD_CRUSHING_BOLT,
} from "@mage-knight/shared";

// Re-export individual cards
export { REFRESHING_WALK } from "./refreshing-walk.js";
export { PATH_FINDING } from "./path-finding.js";
export { REGENERATION } from "./regeneration.js";
export { IN_NEED } from "./in-need.js";
export { AMBUSH } from "./ambush.js";
export { TRAINING } from "./training.js";
export { STOUT_RESOLVE } from "./stout-resolve.js";
export { FORCE_OF_NATURE } from "./force-of-nature.js";
export { MOUNTAIN_LORE } from "./mountain-lore.js";
export { POWER_OF_CRYSTALS } from "./power-of-crystals.js";
export { CRUSHING_BOLT } from "./crushing-bolt.js";

// Import for aggregation
import { REFRESHING_WALK } from "./refreshing-walk.js";
import { PATH_FINDING } from "./path-finding.js";
import { REGENERATION } from "./regeneration.js";
import { IN_NEED } from "./in-need.js";
import { AMBUSH } from "./ambush.js";
import { TRAINING } from "./training.js";
import { STOUT_RESOLVE } from "./stout-resolve.js";
import { FORCE_OF_NATURE } from "./force-of-nature.js";
import { MOUNTAIN_LORE } from "./mountain-lore.js";
import { POWER_OF_CRYSTALS } from "./power-of-crystals.js";
import { CRUSHING_BOLT } from "./crushing-bolt.js";

/** All green-powered advanced action cards */
export const GREEN_ADVANCED_ACTIONS = {
  [CARD_REFRESHING_WALK]: REFRESHING_WALK,
  [CARD_PATH_FINDING]: PATH_FINDING,
  [CARD_REGENERATION]: REGENERATION,
  [CARD_IN_NEED]: IN_NEED,
  [CARD_AMBUSH]: AMBUSH,
  [CARD_TRAINING]: TRAINING,
  [CARD_STOUT_RESOLVE]: STOUT_RESOLVE,
  [CARD_FORCE_OF_NATURE]: FORCE_OF_NATURE,
  [CARD_MOUNTAIN_LORE]: MOUNTAIN_LORE,
  [CARD_POWER_OF_CRYSTALS]: POWER_OF_CRYSTALS,
  [CARD_CRUSHING_BOLT]: CRUSHING_BOLT,
} as const;
