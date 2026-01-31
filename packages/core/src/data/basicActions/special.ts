/**
 * Special basic action cards (wound and multi-color cards)
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_WOUND,
} from "../../types/cards.js";
import { EFFECT_GAIN_MOVE } from "../../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_WOUND,
  CARD_GOLDYX_CRYSTAL_JOY,
} from "@mage-knight/shared";
import { drawCards } from "./helpers.js";

// === Wound Card ===

/**
 * Wound card - not a real action card, clogs your hand
 */
export const WOUND: DeedCard = {
  id: CARD_WOUND,
  name: "Wound",
  cardType: DEED_CARD_TYPE_WOUND,
  poweredBy: [],
  categories: [], // Wounds have no category symbols
  basicEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
  poweredEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
  sidewaysValue: 0,
};

// === Multi-Color Cards ===

/**
 * Goldyx's Crystal Joy (replaces Crystallize)
 * Can be powered by any basic mana color
 */
export const GOLDYX_CRYSTAL_JOY: DeedCard = {
  id: CARD_GOLDYX_CRYSTAL_JOY,
  name: "Crystal Joy",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  // Can be powered by any basic mana color
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Pay mana, gain crystal. At end of turn, may discard non-Wound to return to hand
  // Powered: (same as basic)
  // Note: Crystal manipulation not modeled - placeholder
  basicEffect: drawCards(0), // Placeholder
  poweredEffect: drawCards(0), // Placeholder
  sidewaysValue: 1,
};

/** All special basic action cards (wound and multi-color) */
export const SPECIAL_BASIC_ACTIONS = {
  [CARD_WOUND]: WOUND,
  [CARD_GOLDYX_CRYSTAL_JOY]: GOLDYX_CRYSTAL_JOY,
} as const;
