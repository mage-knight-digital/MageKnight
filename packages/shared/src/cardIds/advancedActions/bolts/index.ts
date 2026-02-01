/**
 * Bolt advanced action card IDs
 * These cards gain crystal (basic) / ranged attack (powered)
 */

export { CARD_FIRE_BOLT } from "./fireBolt.js";
export { CARD_ICE_BOLT } from "./iceBolt.js";
export { CARD_SWIFT_BOLT } from "./swiftBolt.js";
export { CARD_CRUSHING_BOLT } from "./crushingBolt.js";

import { CARD_FIRE_BOLT } from "./fireBolt.js";
import { CARD_ICE_BOLT } from "./iceBolt.js";
import { CARD_SWIFT_BOLT } from "./swiftBolt.js";
import { CARD_CRUSHING_BOLT } from "./crushingBolt.js";

export const BOLT_IDS = [
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_SWIFT_BOLT,
  CARD_CRUSHING_BOLT,
] as const;
