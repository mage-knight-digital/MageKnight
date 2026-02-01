import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_WHITE, CARD_PEACEFUL_MOMENT } from "@mage-knight/shared";
import { influence } from "../helpers.js";

export const PEACEFUL_MOMENT: DeedCard = {
  id: CARD_PEACEFUL_MOMENT,
  name: "Peaceful Moment",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_INFLUENCE, CATEGORY_SPECIAL],
  // Basic: Influence 3. You may play this as your action for the turn: if you do, you may get Heal 1 for each 2 Influence you spend.
  // Powered: Influence 6. You may play this as your action for the turn: if you do, you may get Heal 1 for each 2 Influence you spend and/or refresh a Unit by paying 2 Influence per level of the Unit.
  // TODO: Implement influence-to-heal conversion and unit refresh
  basicEffect: influence(3),
  poweredEffect: influence(6),
  sidewaysValue: 1,
};
