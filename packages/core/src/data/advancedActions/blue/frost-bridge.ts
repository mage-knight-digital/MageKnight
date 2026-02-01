import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_FROST_BRIDGE } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const FROST_BRIDGE: DeedCard = {
  id: CARD_FROST_BRIDGE,
  name: "Frost Bridge",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. The Move cost of swamps is reduced to 1 this turn.
  // Powered: Move 4. You are able to travel through lakes, and the Move cost of lakes and swamps is reduced to 1 this turn.
  // TODO: Implement terrain cost modifier
  basicEffect: move(2),
  poweredEffect: move(4),
  sidewaysValue: 1,
};
