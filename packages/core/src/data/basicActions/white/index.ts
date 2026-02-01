/**
 * White-powered basic action cards (powered by white mana)
 */

import {
  CARD_SWIFTNESS,
  CARD_PROMISE,
  CARD_MANA_DRAW,
  CARD_ARYTHEA_MANA_PULL,
  CARD_NOROWAS_NOBLE_MANNERS,
} from "@mage-knight/shared";

// Re-export individual cards
export { SWIFTNESS } from "./swiftness.js";
export { PROMISE } from "./promise.js";
export { MANA_DRAW } from "./mana-draw.js";
export { ARYTHEA_MANA_PULL } from "./arythea-mana-pull.js";
export { NOROWAS_NOBLE_MANNERS } from "./norowas-noble-manners.js";

// Import for aggregation
import { SWIFTNESS } from "./swiftness.js";
import { PROMISE } from "./promise.js";
import { MANA_DRAW } from "./mana-draw.js";
import { ARYTHEA_MANA_PULL } from "./arythea-mana-pull.js";
import { NOROWAS_NOBLE_MANNERS } from "./norowas-noble-manners.js";

/** All white-powered basic action cards */
export const WHITE_BASIC_ACTIONS = {
  [CARD_SWIFTNESS]: SWIFTNESS,
  [CARD_PROMISE]: PROMISE,
  [CARD_MANA_DRAW]: MANA_DRAW,
  [CARD_ARYTHEA_MANA_PULL]: ARYTHEA_MANA_PULL,
  [CARD_NOROWAS_NOBLE_MANNERS]: NOROWAS_NOBLE_MANNERS,
} as const;
