/**
 * Day tactic card definitions
 */

import {
  TACTIC_EARLY_BIRD,
  TACTIC_RETHINK,
  TACTIC_MANA_STEAL,
  TACTIC_PLANNING,
  TACTIC_GREAT_START,
  TACTIC_THE_RIGHT_MOMENT,
} from "@mage-knight/shared";

// Re-export individual tactic cards
export { EARLY_BIRD } from "./earlyBird.js";
export { RETHINK } from "./rethink.js";
export { MANA_STEAL } from "./manaSteal.js";
export { PLANNING } from "./planning.js";
export { GREAT_START } from "./greatStart.js";
export { THE_RIGHT_MOMENT } from "./theRightMoment.js";

// Import for aggregation
import { EARLY_BIRD } from "./earlyBird.js";
import { RETHINK } from "./rethink.js";
import { MANA_STEAL } from "./manaSteal.js";
import { PLANNING } from "./planning.js";
import { GREAT_START } from "./greatStart.js";
import { THE_RIGHT_MOMENT } from "./theRightMoment.js";

/** All day tactic cards */
export const DAY_TACTICS = {
  [TACTIC_EARLY_BIRD]: EARLY_BIRD,
  [TACTIC_RETHINK]: RETHINK,
  [TACTIC_MANA_STEAL]: MANA_STEAL,
  [TACTIC_PLANNING]: PLANNING,
  [TACTIC_GREAT_START]: GREAT_START,
  [TACTIC_THE_RIGHT_MOMENT]: THE_RIGHT_MOMENT,
} as const;
