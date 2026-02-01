/**
 * Flame Wall / Flame Wave (Red Spell #10)
 * Basic (Flame Wall): Fire Attack 5, or Fire Block 7
 * Powered (Flame Wave): Same choice, +2 per enemy
 *
 * Note: The scaling powered effect is not yet implemented.
 * For now, powered just gives the base values.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_RED, MANA_BLACK, CARD_FLAME_WALL } from "@mage-knight/shared";
import { fireAttack, fireBlock, choice } from "../helpers.js";

export const FLAME_WALL: DeedCard = {
  id: CARD_FLAME_WALL,
  name: "Flame Wall",
  poweredName: "Flame Wave",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  poweredEffect: choice([fireAttack(5), fireBlock(7)]), // TODO: Add scaling
  sidewaysValue: 1,
};
