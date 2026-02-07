/**
 * Mind Read / Mind Steal (White Spell #111)
 *
 * Basic (Mind Read): Choose a color. Gain a crystal of the chosen color.
 * Each other player must discard a Spell or Action card of that color from
 * their hand, or reveal their hand to show they have none.
 *
 * Powered (Mind Steal): Same as basic. In addition, you may permanently
 * steal one of the Action cards (NOT Spells) discarded this way and put
 * it into your hand.
 *
 * Interactive spell — removed in friendly game mode since it directly
 * affects other players' hands.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_WHITE, MANA_BLACK, CARD_MIND_READ } from "@mage-knight/shared";
import {
  EFFECT_MIND_READ,
  EFFECT_MIND_STEAL,
} from "../../../types/effectTypes.js";

export const MIND_READ: DeedCard = {
  id: CARD_MIND_READ,
  name: "Mind Read",
  poweredName: "Mind Steal",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_MIND_READ,
  },
  poweredEffect: {
    type: EFFECT_MIND_STEAL,
  },
  sidewaysValue: 1,
  interactive: true,
};
