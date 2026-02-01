import type { DeedCard } from "../../../types/cards.js";
import { DEED_CARD_TYPE_WOUND } from "../../../types/cards.js";
import { EFFECT_GAIN_MOVE } from "../../../types/effectTypes.js";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Wound card - not a real action card, clogs your hand
 */
export const WOUND: DeedCard = {
  id: CARD_WOUND,
  name: "Wound",
  cardType: DEED_CARD_TYPE_WOUND,
  poweredBy: [],
  categories: [], // Wounds have no category symbols
  basicEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
  poweredEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
  sidewaysValue: 0,
};
