/**
 * Flame Wall / Flame Wave (Red Spell #10)
 * Basic (Flame Wall): Fire Attack 5, or Fire Block 7
 * Powered (Flame Wave): Fire Attack 5 OR Fire Block 7, +2 per enemy
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_RED, MANA_BLACK, CARD_FLAME_WALL } from "@mage-knight/shared";
import { fireAttack, fireBlock, choice, fireAttackPerEnemy, fireBlockPerEnemy } from "../helpers.js";

export const FLAME_WALL: DeedCard = {
  id: CARD_FLAME_WALL,
  name: "Flame Wall",
  poweredName: "Flame Wave",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  poweredEffect: choice([
    fireAttackPerEnemy(5, 2),
    fireBlockPerEnemy(7, 2),
  ]),
  sidewaysValue: 1,
};
