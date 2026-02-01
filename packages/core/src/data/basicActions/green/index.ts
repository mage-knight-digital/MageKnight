/**
 * Green-powered basic action cards (powered by green mana)
 */

import {
  CARD_MARCH,
  CARD_TRANQUILITY,
  CARD_CONCENTRATION,
  CARD_GOLDYX_WILL_FOCUS,
  CARD_NOROWAS_REJUVENATE,
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_BRAEVALAR_DRUIDIC_PATHS,
} from "@mage-knight/shared";

// Re-export individual cards
export { MARCH } from "./march.js";
export { TRANQUILITY } from "./tranquility.js";
export { CONCENTRATION } from "./concentration.js";
export { GOLDYX_WILL_FOCUS } from "./goldyx-will-focus.js";
export { NOROWAS_REJUVENATE } from "./norowas-rejuvenate.js";
export { KRANG_SAVAGE_HARVESTING } from "./krang-savage-harvesting.js";
export { BRAEVALAR_DRUIDIC_PATHS } from "./braevalar-druidic-paths.js";

// Import for aggregation
import { MARCH } from "./march.js";
import { TRANQUILITY } from "./tranquility.js";
import { CONCENTRATION } from "./concentration.js";
import { GOLDYX_WILL_FOCUS } from "./goldyx-will-focus.js";
import { NOROWAS_REJUVENATE } from "./norowas-rejuvenate.js";
import { KRANG_SAVAGE_HARVESTING } from "./krang-savage-harvesting.js";
import { BRAEVALAR_DRUIDIC_PATHS } from "./braevalar-druidic-paths.js";

/** All green-powered basic action cards */
export const GREEN_BASIC_ACTIONS = {
  [CARD_MARCH]: MARCH,
  [CARD_TRANQUILITY]: TRANQUILITY,
  [CARD_CONCENTRATION]: CONCENTRATION,
  [CARD_GOLDYX_WILL_FOCUS]: GOLDYX_WILL_FOCUS,
  [CARD_NOROWAS_REJUVENATE]: NOROWAS_REJUVENATE,
  [CARD_KRANG_SAVAGE_HARVESTING]: KRANG_SAVAGE_HARVESTING,
  [CARD_BRAEVALAR_DRUIDIC_PATHS]: BRAEVALAR_DRUIDIC_PATHS,
} as const;
