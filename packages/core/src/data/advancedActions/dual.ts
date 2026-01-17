/**
 * Dual-Color Advanced Action Cards
 *
 * Dual-color cards can be powered by either of two mana colors,
 * making them more flexible but often with unique or situational effects.
 *
 * @module data/advancedActions/dual
 *
 * @remarks Cards in this module:
 * - Rush of Adrenaline (Green/Red) - Wound-triggered card draw
 * - Chilling Stare (Blue/White) - Influence or enemy attack cancellation
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_GREEN,
  MANA_RED,
  MANA_BLUE,
  MANA_WHITE,
  CARD_RUSH_OF_ADRENALINE,
  CARD_CHILLING_STARE,
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  block,
  influence,
  heal,
  choice,
} from "./helpers.js";

/**
 * Dual-color advanced action card definitions.
 *
 * These cards offer flexibility in powering (two mana colors work)
 * but often have specialized or situational effects.
 */
export const DUAL_ADVANCED_ACTIONS = {
  [CARD_RUSH_OF_ADRENALINE]: {
    id: CARD_RUSH_OF_ADRENALINE,
    name: "Rush of Adrenaline",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN, MANA_RED], // Can be powered by green OR red
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: For each of the first three Wounds you take to your hand this turn, draw a card.
    // Powered: After taking the first Wound to your hand this turn, throw it away and draw a card. For each of the next three Wounds you take, draw a card.
    // TODO: Implement wound-triggered card draw
    basicEffect: heal(1),
    poweredEffect: heal(2),
    sidewaysValue: 1,
  },

  [CARD_CHILLING_STARE]: {
    id: CARD_CHILLING_STARE,
    name: "Chilling Stare",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE, MANA_WHITE], // Can be powered by blue OR white
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Influence 3, or a chosen enemy attack loses all attack abilities (but not its color).
    // Powered: Influence 5, or a chosen enemy does not attack this turn.
    // TODO: Implement enemy attack cancellation
    basicEffect: choice(influence(3), block(3)),
    poweredEffect: choice(influence(5), block(5)),
    sidewaysValue: 1,
  },
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
