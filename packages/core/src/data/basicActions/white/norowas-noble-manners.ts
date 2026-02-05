import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_NOROWAS_NOBLE_MANNERS } from "@mage-knight/shared";
import { influence } from "../helpers.js";
import { compound, fame, ifInInteraction, changeReputation } from "../../effectHelpers.js";

/**
 * Norowas's Noble Manners (replaces Promise)
 *
 * Basic: Influence 2. Fame +1 if used during interaction.
 * Powered (White): Influence 4. Fame +1 and Reputation +1 if used during interaction.
 */
export const NOROWAS_NOBLE_MANNERS: DeedCard = {
  id: CARD_NOROWAS_NOBLE_MANNERS,
  name: "Noble Manners",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  basicEffect: compound([
    influence(2),
    ifInInteraction(fame(1)),
  ]),
  poweredEffect: compound([
    influence(4),
    ifInInteraction(compound([fame(1), changeReputation(1)])),
  ]),
  sidewaysValue: 1,
};
