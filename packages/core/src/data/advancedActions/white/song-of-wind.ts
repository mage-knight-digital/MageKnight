import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_SONG_OF_WIND } from "@mage-knight/shared";
import { move } from "../helpers.js";

export const SONG_OF_WIND: DeedCard = {
  id: CARD_SONG_OF_WIND,
  name: "Song of Wind",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. The Move cost of plains, deserts, and wastelands is reduced by 1, to a minimum of 0 this turn.
  // Powered: Move 2. The Move cost of plains, deserts, and wastelands is reduced by 2, to a minimum of 0. You may pay a blue mana to be able to travel through lakes for Move cost 0 this turn.
  // TODO: Implement terrain cost modifier with optional blue mana lake travel
  basicEffect: move(2),
  poweredEffect: move(2),
  sidewaysValue: 1,
};
