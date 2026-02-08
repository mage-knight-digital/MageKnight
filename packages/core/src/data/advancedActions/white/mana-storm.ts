import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_MANA_STORM } from "@mage-knight/shared";
import { EFFECT_MANA_STORM_BASIC, EFFECT_MANA_STORM_POWERED } from "../../../types/effectTypes.js";

export const MANA_STORM: DeedCard = {
  id: CARD_MANA_STORM,
  name: "Mana Storm",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_SPECIAL],
  // Basic: Choose a mana die in the Source that is showing a basic color. Gain a crystal of that color to your Inventory, then immediately reroll that die and return it to the Source.
  basicEffect: { type: EFFECT_MANA_STORM_BASIC },
  // Powered: Reroll all dice in the Source. You can use three extra dice from the Source, and you can use dice showing black or gold as mana of any basic color, regardless of the Round.
  poweredEffect: { type: EFFECT_MANA_STORM_POWERED },
  sidewaysValue: 1,
};
