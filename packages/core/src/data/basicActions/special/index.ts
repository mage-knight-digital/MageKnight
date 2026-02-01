/**
 * Special basic action cards (wound card)
 */

import { CARD_WOUND } from "@mage-knight/shared";

// Re-export individual cards
export { WOUND } from "./wound.js";

// Import for aggregation
import { WOUND } from "./wound.js";

/** All special basic action cards */
export const SPECIAL_BASIC_ACTIONS = {
  [CARD_WOUND]: WOUND,
} as const;
