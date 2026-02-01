/**
 * Red-powered basic action cards (powered by red mana)
 */

import {
  CARD_RAGE,
  CARD_THREATEN,
  CARD_IMPROVISATION,
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_TOVAK_INSTINCT,
  CARD_KRANG_RUTHLESS_COERCION,
} from "@mage-knight/shared";

// Re-export individual cards
export { RAGE } from "./rage.js";
export { THREATEN } from "./threaten.js";
export { IMPROVISATION } from "./improvisation.js";
export { ARYTHEA_BATTLE_VERSATILITY } from "./arythea-battle-versatility.js";
export { TOVAK_INSTINCT } from "./tovak-instinct.js";
export { KRANG_RUTHLESS_COERCION } from "./krang-ruthless-coercion.js";

// Import for aggregation
import { RAGE } from "./rage.js";
import { THREATEN } from "./threaten.js";
import { IMPROVISATION } from "./improvisation.js";
import { ARYTHEA_BATTLE_VERSATILITY } from "./arythea-battle-versatility.js";
import { TOVAK_INSTINCT } from "./tovak-instinct.js";
import { KRANG_RUTHLESS_COERCION } from "./krang-ruthless-coercion.js";

/** All red-powered basic action cards */
export const RED_BASIC_ACTIONS = {
  [CARD_RAGE]: RAGE,
  [CARD_THREATEN]: THREATEN,
  [CARD_IMPROVISATION]: IMPROVISATION,
  [CARD_ARYTHEA_BATTLE_VERSATILITY]: ARYTHEA_BATTLE_VERSATILITY,
  [CARD_TOVAK_INSTINCT]: TOVAK_INSTINCT,
  [CARD_KRANG_RUTHLESS_COERCION]: KRANG_RUTHLESS_COERCION,
} as const;
