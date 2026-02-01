/**
 * Night tactic card definitions
 */

import {
  TACTIC_FROM_THE_DUSK,
  TACTIC_LONG_NIGHT,
  TACTIC_MANA_SEARCH,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_PREPARATION,
  TACTIC_SPARING_POWER,
} from "@mage-knight/shared";

// Re-export individual tactic cards
export { FROM_THE_DUSK } from "./fromTheDusk.js";
export { LONG_NIGHT } from "./longNight.js";
export { MANA_SEARCH } from "./manaSearch.js";
export { MIDNIGHT_MEDITATION } from "./midnightMeditation.js";
export { PREPARATION } from "./preparation.js";
export { SPARING_POWER } from "./sparingPower.js";

// Import for aggregation
import { FROM_THE_DUSK } from "./fromTheDusk.js";
import { LONG_NIGHT } from "./longNight.js";
import { MANA_SEARCH } from "./manaSearch.js";
import { MIDNIGHT_MEDITATION } from "./midnightMeditation.js";
import { PREPARATION } from "./preparation.js";
import { SPARING_POWER } from "./sparingPower.js";

/** All night tactic cards */
export const NIGHT_TACTICS = {
  [TACTIC_FROM_THE_DUSK]: FROM_THE_DUSK,
  [TACTIC_LONG_NIGHT]: LONG_NIGHT,
  [TACTIC_MANA_SEARCH]: MANA_SEARCH,
  [TACTIC_MIDNIGHT_MEDITATION]: MIDNIGHT_MEDITATION,
  [TACTIC_PREPARATION]: PREPARATION,
  [TACTIC_SPARING_POWER]: SPARING_POWER,
} as const;
