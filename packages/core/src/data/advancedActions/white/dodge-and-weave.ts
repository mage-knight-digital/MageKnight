import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_DODGE_AND_WEAVE } from "@mage-knight/shared";
import { block } from "../helpers.js";

export const DODGE_AND_WEAVE: DeedCard = {
  id: CARD_DODGE_AND_WEAVE,
  name: "Dodge and Weave",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_COMBAT],
  // Basic: Reduce one enemy attack by 2. Gain Attack 1 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
  // Powered: Reduce one enemy attack by 4 or two attacks of one or two enemies by 2. Gain Attack 2 in the Attack phase if you did not add any Wounds to your hand in the previous combat phases.
  // TODO: Implement damage reduction and conditional attack bonus
  basicEffect: block(2),
  poweredEffect: block(4),
  sidewaysValue: 1,
};
