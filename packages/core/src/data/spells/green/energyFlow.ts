/**
 * Energy Flow / Energy Steal (Green Spell #12)
 *
 * Basic (Energy Flow): Ready a Unit. If you do, you may spend one Unit
 * of level 2 or less in each other player's Unit area.
 *
 * Powered (Energy Steal): Ready a Unit. If you do, that Unit also gets
 * healed, and you may spend one Unit of level 3 or less in each other
 * player's Unit area.
 *
 * Interactive spell — removed in friendly game mode since it directly
 * affects other players' units.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLACK, CARD_ENERGY_FLOW } from "@mage-knight/shared";
import { EFFECT_ENERGY_FLOW } from "../../../types/effectTypes.js";

export const ENERGY_FLOW: DeedCard = {
  id: CARD_ENERGY_FLOW,
  name: "Energy Flow",
  poweredName: "Energy Steal",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_HEALING],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: {
    type: EFFECT_ENERGY_FLOW,
    spendMaxLevel: 2,
    healReadiedUnit: false,
  },
  poweredEffect: {
    type: EFFECT_ENERGY_FLOW,
    spendMaxLevel: 3,
    healReadiedUnit: true,
  },
  sidewaysValue: 1,
  interactive: true,
};
