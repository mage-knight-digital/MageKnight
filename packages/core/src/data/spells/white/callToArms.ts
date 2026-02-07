/**
 * Call to Arms / Call to Glory (White Spell)
 *
 * Basic (Call to Arms): Borrow a Unit ability from the Units Offer this turn.
 * - Use one ability of a Unit in the offer as if it were yours
 * - Cannot assign damage to the borrowed Unit
 * - Usable during combat (special effects icon)
 * - Excludes Magic Familiars and Delphana Masters
 *
 * Powered (Call to Glory): Recruit any Unit from the offer for free.
 * - If at Command limit, must disband first
 * - Excludes Magic Familiars and Delphana Masters
 * - No location restrictions
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_CALL_TO_ARMS,
  EFFECT_FREE_RECRUIT,
} from "../../../types/effectTypes.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  CARD_CALL_TO_ARMS,
} from "@mage-knight/shared";

export const CALL_TO_ARMS: DeedCard = {
  id: CARD_CALL_TO_ARMS,
  name: "Call to Arms",
  poweredName: "Call to Glory",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: { type: EFFECT_CALL_TO_ARMS },
  poweredEffect: { type: EFFECT_FREE_RECRUIT },
  sidewaysValue: 1,
};
