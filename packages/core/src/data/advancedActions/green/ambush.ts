import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER } from "../../../types/effectTypes.js";
import { DURATION_TURN, EFFECT_ATTACK_BLOCK_CARD_BONUS } from "../../../types/modifierConstants.js";
import { MANA_GREEN, CARD_AMBUSH } from "@mage-knight/shared";
import { compound, move } from "../helpers.js";

export const AMBUSH: DeedCard = {
  id: CARD_AMBUSH,
  name: "Ambush",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. Add +1 to your first Attack card of any type or +2 to your first Block card of any type, whichever you play first this turn.
  // Powered: Move 4. Add +2 to your first Attack card of any type or +4 to your first Block card of any type, whichever you play first this turn.
  basicEffect: compound(move(2), {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 1, blockBonus: 2 },
    duration: DURATION_TURN,
    description: "First Attack card gets +1 or first Block card gets +2",
  }),
  poweredEffect: compound(move(4), {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_ATTACK_BLOCK_CARD_BONUS, attackBonus: 2, blockBonus: 4 },
    duration: DURATION_TURN,
    description: "First Attack card gets +2 or first Block card gets +4",
  }),
  sidewaysValue: 1,
};
