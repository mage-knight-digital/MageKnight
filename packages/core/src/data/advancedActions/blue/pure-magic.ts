import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_BLUE, CARD_PURE_MAGIC } from "@mage-knight/shared";
import { EFFECT_PURE_MAGIC } from "../../../types/effectTypes.js";

export const PURE_MAGIC: DeedCard = {
  id: CARD_PURE_MAGIC,
  name: "Pure Magic",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: When you play this, pay a mana. If you paid green, Move 4. If you paid white, Influence 4. If you paid blue, Block 4. If you paid red, Attack 4.
  // Powered: When you play this, pay a mana. If you paid green, Move 7. If you paid white, Influence 7. If you paid blue, Block 7. If you paid red, Attack 7.
  basicEffect: { type: EFFECT_PURE_MAGIC, value: 4 },
  poweredEffect: { type: EFFECT_PURE_MAGIC, value: 7 },
  sidewaysValue: 1,
};
