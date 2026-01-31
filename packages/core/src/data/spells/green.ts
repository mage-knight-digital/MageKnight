/**
 * Green spell card definitions
 *
 * Green spells are powered by BLACK + GREEN mana.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import { MANA_GREEN, MANA_BLACK, CARD_RESTORATION } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { heal } from "./helpers.js";

/**
 * Restoration / Rebirth (Green Spell #05)
 * Basic: Heal 3. If you are in a forest, Heal 5 instead.
 * Powered: Same + Ready up to 3 levels worth of Units (5 in forest)
 *
 * Note: Forest conditional and unit readying not yet implemented.
 * For now, just gives Heal 3 / Heal 5.
 */
const RESTORATION: DeedCard = {
  id: CARD_RESTORATION,
  name: "Restoration",
  poweredName: "Rebirth",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_HEALING],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: heal(3),
  poweredEffect: heal(5), // TODO: Add forest conditional and unit ready
  sidewaysValue: 1,
};

export const GREEN_SPELLS: Record<CardId, DeedCard> = {
  [CARD_RESTORATION]: RESTORATION,
};
