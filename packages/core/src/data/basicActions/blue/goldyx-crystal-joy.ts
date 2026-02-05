import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_GOLDYX_CRYSTAL_JOY,
} from "@mage-knight/shared";
import { convertManaToCrystal, gainCrystal, choice } from "../helpers.js";

/**
 * Goldyx's Crystal Joy (replaces Crystallize)
 * Can be powered by any basic mana color
 *
 * Basic: Pay a mana token of any basic color to gain a crystal of that color.
 *        At end of turn, may discard a non-wound card to return this card to hand.
 *
 * Powered: Gain a crystal of any basic color (no mana cost).
 *          At end of turn, may discard any card (including wounds) to return this card to hand.
 *
 * Reclaim mechanic: Tracked via pendingCrystalJoyReclaim flag which is set after
 * the card is played, checked during end-of-turn sequence, and resolved via
 * RESOLVE_CRYSTAL_JOY_RECLAIM action.
 */
export const GOLDYX_CRYSTAL_JOY: DeedCard = {
  id: CARD_GOLDYX_CRYSTAL_JOY,
  name: "Crystal Joy",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  // Can be powered by any basic mana color
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Pay mana to gain crystal (reuses Crystallize logic)
  basicEffect: convertManaToCrystal(),
  // Powered: Free choice of any crystal color
  poweredEffect: choice(
    gainCrystal(MANA_RED),
    gainCrystal(MANA_BLUE),
    gainCrystal(MANA_GREEN),
    gainCrystal(MANA_WHITE)
  ),
  sidewaysValue: 1,
};
