import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_MAGIC_TALENT } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const MAGIC_TALENT: DeedCard = {
  id: CARD_MAGIC_TALENT,
  name: "Magic Talent",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Discard a card of any color. You may play one Spell card of the same color in the Spells offer this turn as if it were in your hand. That card remains in the Spells offer.
  // Powered: When you play this, pay a mana of any color. Gain a Spell card of that color from the Spells Offer and put it in your discard pile.
  // TODO: Implement spell offer interaction
  basicEffect: influence(2),
  poweredEffect: influence(4),
  sidewaysValue: 1,
};
