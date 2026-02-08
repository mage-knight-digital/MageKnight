import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_SPELL_FORGE } from "@mage-knight/shared";
import {
  EFFECT_SPELL_FORGE_BASIC,
  EFFECT_SPELL_FORGE_POWERED,
} from "../../../types/effectTypes.js";

export const SPELL_FORGE: DeedCard = {
  id: CARD_SPELL_FORGE,
  name: "Spell Forge",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Gain one crystal to your Inventory of the same color as one of the Spell cards in the Spells offer.
  basicEffect: { type: EFFECT_SPELL_FORGE_BASIC },
  // Powered: Gain two crystals to your Inventory of the same colors as two different Spell cards in the Spells offer.
  poweredEffect: { type: EFFECT_SPELL_FORGE_POWERED },
  sidewaysValue: 1,
};
