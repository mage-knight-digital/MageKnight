import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_HEALING, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_REGENERATION } from "@mage-knight/shared";
import { heal } from "../helpers.js";

export const REGENERATION: DeedCard = {
  id: CARD_REGENERATION,
  name: "Regeneration",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_HEALING],
  // Basic: Heal 1. Ready a Level I or II Unit you control.
  // Powered: Heal 2. Ready a Level I, II or III Unit you control.
  // TODO: Implement unit readying
  basicEffect: heal(1),
  poweredEffect: heal(2),
  sidewaysValue: 1,
};
