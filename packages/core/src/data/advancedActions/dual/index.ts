/**
 * Dual-color advanced action cards (can be powered by either of two mana colors)
 */

import {
  CARD_RUSH_OF_ADRENALINE,
  CARD_CHILLING_STARE,
} from "@mage-knight/shared";

// Re-export individual cards
export { RUSH_OF_ADRENALINE } from "./rush-of-adrenaline.js";
export { CHILLING_STARE } from "./chilling-stare.js";

// Import for aggregation
import { RUSH_OF_ADRENALINE } from "./rush-of-adrenaline.js";
import { CHILLING_STARE } from "./chilling-stare.js";

/** All dual-color advanced action cards */
export const DUAL_ADVANCED_ACTIONS = {
  [CARD_RUSH_OF_ADRENALINE]: RUSH_OF_ADRENALINE,
  [CARD_CHILLING_STARE]: CHILLING_STARE,
} as const;
