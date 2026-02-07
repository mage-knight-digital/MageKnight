import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_INFLUENCE, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { MANA_WHITE, CARD_NOROWAS_NOBLE_MANNERS } from "@mage-knight/shared";
import { influence } from "../helpers.js";
import { compound, interactionBonus } from "../../effectHelpers.js";

/**
 * Norowas's Noble Manners (replaces Promise)
 *
 * Basic: Influence 2. Fame +1 on next interaction this turn.
 * Powered (White): Influence 4. Fame +1 and Reputation +1 on next interaction this turn.
 *
 * The interaction bonus is deferred — a modifier is added when the card is played,
 * and the bonus triggers (and is consumed) when the player actually interacts
 * (recruits, heals, buys a spell).
 */
export const NOROWAS_NOBLE_MANNERS: DeedCard = {
  id: CARD_NOROWAS_NOBLE_MANNERS,
  name: "Noble Manners",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE],
  basicEffect: compound([
    influence(2),
    interactionBonus(1, 0),
  ]),
  poweredEffect: compound([
    influence(4),
    interactionBonus(1, 1),
  ]),
  sidewaysValue: 1,
};
