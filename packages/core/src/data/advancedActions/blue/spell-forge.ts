import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_SPELL_FORGE } from "@mage-knight/shared";
import { gainCrystal } from "../helpers.js";

export const SPELL_FORGE: DeedCard = {
  id: CARD_SPELL_FORGE,
  name: "Spell Forge",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Gain one crystal to your Inventory of the same color as one of the Spell cards in the Spells offer.
  // Powered: Gain two crystals to your Inventory of the same colors as two different Spell cards in the Spells offer.
  // TODO: Implement spell offer interaction for crystal gain
  basicEffect: gainCrystal(MANA_BLUE),
  poweredEffect: gainCrystal(MANA_BLUE),
  sidewaysValue: 1,
};
