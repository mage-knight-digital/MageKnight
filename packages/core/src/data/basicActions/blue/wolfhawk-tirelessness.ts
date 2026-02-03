import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import { DURATION_TURN, EFFECT_MOVEMENT_CARD_BONUS } from "../../../types/modifierConstants.js";
import { MANA_BLUE, CARD_WOLFHAWK_TIRELESSNESS } from "@mage-knight/shared";
import { compound, move } from "../helpers.js";

/**
 * Wolfhawk's Tirelessness (replaces Stamina)
 */
export const WOLFHAWK_TIRELESSNESS: DeedCard = {
  id: CARD_WOLFHAWK_TIRELESSNESS,
  name: "Tirelessness",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: compound(move(2), {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_MOVEMENT_CARD_BONUS, amount: 1, remaining: 1 },
    duration: DURATION_TURN,
    description: "Next movement card gets +1 Move this turn",
  }),
  poweredEffect: compound(move(4), {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_MOVEMENT_CARD_BONUS, amount: 1 },
    duration: DURATION_TURN,
    description: "Each other movement card gets +1 Move this turn",
  }),
  sidewaysValue: 1,
};
