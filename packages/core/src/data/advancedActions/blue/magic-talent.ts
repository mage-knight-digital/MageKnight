import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_BLUE, CARD_MAGIC_TALENT } from "@mage-knight/shared";
import {
  EFFECT_MAGIC_TALENT_BASIC,
  EFFECT_MAGIC_TALENT_POWERED,
} from "../../../types/effectTypes.js";

export const MAGIC_TALENT: DeedCard = {
  id: CARD_MAGIC_TALENT,
  name: "Magic Talent",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_SPECIAL],
  basicEffect: { type: EFFECT_MAGIC_TALENT_BASIC },
  poweredEffect: { type: EFFECT_MAGIC_TALENT_POWERED },
  sidewaysValue: 1,
};
