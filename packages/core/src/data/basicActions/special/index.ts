/**
 * Special basic action cards (wound and multi-color cards)
 */

import { CARD_WOUND, CARD_GOLDYX_CRYSTAL_JOY } from "@mage-knight/shared";

// Re-export individual cards
export { WOUND } from "./wound.js";
export { GOLDYX_CRYSTAL_JOY } from "./goldyx-crystal-joy.js";

// Import for aggregation
import { WOUND } from "./wound.js";
import { GOLDYX_CRYSTAL_JOY } from "./goldyx-crystal-joy.js";

/** All special basic action cards (wound and multi-color) */
export const SPECIAL_BASIC_ACTIONS = {
  [CARD_WOUND]: WOUND,
  [CARD_GOLDYX_CRYSTAL_JOY]: GOLDYX_CRYSTAL_JOY,
} as const;
