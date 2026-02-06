import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_HEROIC_TALE } from "@mage-knight/shared";
import { influence, compound } from "../helpers.js";
import { EFFECT_APPLY_RECRUITMENT_BONUS } from "../../../types/effectTypes.js";

export const HEROIC_TALE: DeedCard = {
  id: CARD_HEROIC_TALE,
  name: "Heroic Tale",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  // Basic: Influence 3. Reputation +1 for each Unit you recruit this turn.
  basicEffect: compound(
    influence(3),
    { type: EFFECT_APPLY_RECRUITMENT_BONUS, reputationPerRecruit: 1, famePerRecruit: 0 },
  ),
  // Powered: Influence 6. Fame +1 and Reputation +1 for each Unit you recruit this turn.
  poweredEffect: compound(
    influence(6),
    { type: EFFECT_APPLY_RECRUITMENT_BONUS, reputationPerRecruit: 1, famePerRecruit: 1 },
  ),
  sidewaysValue: 1,
};
