import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_HEALING,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, CARD_REFRESHING_WALK } from "@mage-knight/shared";
import { move, heal, compound } from "../helpers.js";

export const REFRESHING_WALK: DeedCard = {
  id: CARD_REFRESHING_WALK,
  name: "Refreshing Walk",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT, CATEGORY_HEALING],
  // Basic: Move 2 and Heal 1. If played during combat, Move 2 only.
  // Powered: Move 4 and Heal 2. If played during combat, Move 4 only.
  // TODO: Implement combat context check
  basicEffect: compound(move(2), heal(1)),
  poweredEffect: compound(move(4), heal(2)),
  sidewaysValue: 1,
};
