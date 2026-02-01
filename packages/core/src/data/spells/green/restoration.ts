/**
 * Restoration / Rebirth (Green Spell #05)
 * Basic: Heal 3. If you are in a forest, Heal 5 instead.
 * Powered: Same + Ready up to 3 levels worth of Units (5 in forest)
 *
 * Note: Forest conditional and unit readying not yet implemented.
 * For now, just gives Heal 3 / Heal 5.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLACK, CARD_RESTORATION } from "@mage-knight/shared";
import { heal } from "../helpers.js";

export const RESTORATION: DeedCard = {
  id: CARD_RESTORATION,
  name: "Restoration",
  poweredName: "Rebirth",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_HEALING],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: heal(3),
  poweredEffect: heal(5), // TODO: Add forest conditional and unit ready
  sidewaysValue: 1,
};
