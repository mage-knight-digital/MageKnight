/**
 * Blue-powered basic action cards (powered by blue mana)
 */

import {
  CARD_DETERMINATION,
  CARD_STAMINA,
  CARD_CRYSTALLIZE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
} from "@mage-knight/shared";

// Re-export individual cards
export { DETERMINATION } from "./determination.js";
export { STAMINA } from "./stamina.js";
export { CRYSTALLIZE } from "./crystallize.js";
export { TOVAK_COLD_TOUGHNESS } from "./tovak-cold-toughness.js";
export { WOLFHAWK_SWIFT_REFLEXES } from "./wolfhawk-swift-reflexes.js";
export { WOLFHAWK_TIRELESSNESS } from "./wolfhawk-tirelessness.js";
export { BRAEVALAR_ONE_WITH_THE_LAND } from "./braevalar-one-with-the-land.js";

// Import for aggregation
import { DETERMINATION } from "./determination.js";
import { STAMINA } from "./stamina.js";
import { CRYSTALLIZE } from "./crystallize.js";
import { TOVAK_COLD_TOUGHNESS } from "./tovak-cold-toughness.js";
import { WOLFHAWK_SWIFT_REFLEXES } from "./wolfhawk-swift-reflexes.js";
import { WOLFHAWK_TIRELESSNESS } from "./wolfhawk-tirelessness.js";
import { BRAEVALAR_ONE_WITH_THE_LAND } from "./braevalar-one-with-the-land.js";

/** All blue-powered basic action cards */
export const BLUE_BASIC_ACTIONS = {
  [CARD_DETERMINATION]: DETERMINATION,
  [CARD_STAMINA]: STAMINA,
  [CARD_CRYSTALLIZE]: CRYSTALLIZE,
  [CARD_TOVAK_COLD_TOUGHNESS]: TOVAK_COLD_TOUGHNESS,
  [CARD_WOLFHAWK_SWIFT_REFLEXES]: WOLFHAWK_SWIFT_REFLEXES,
  [CARD_WOLFHAWK_TIRELESSNESS]: WOLFHAWK_TIRELESSNESS,
  [CARD_BRAEVALAR_ONE_WITH_THE_LAND]: BRAEVALAR_ONE_WITH_THE_LAND,
} as const;
