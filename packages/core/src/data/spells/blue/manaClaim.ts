/**
 * Mana Claim / Mana Curse (Blue Spell #110)
 *
 * Basic (Mana Claim): Take a mana die of a basic color from the Source
 * and keep it in your play area until end of round. Choose one:
 * - Gain 3 mana tokens of that color THIS turn, OR
 * - Gain 1 mana token of that color EACH turn for remainder of round
 *
 * Powered (Mana Curse): Same as basic effect. In addition, until end of
 * round: each time another player uses one or more mana of that color on
 * their turn (from any source), they take a Wound. Each player can get
 * only one Wound per turn this way.
 *
 * Interactive spell — removed in friendly game mode since the curse
 * directly affects other players.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_BLUE, MANA_BLACK, CARD_MANA_CLAIM } from "@mage-knight/shared";
import {
  EFFECT_MANA_CLAIM,
  EFFECT_MANA_CURSE,
} from "../../../types/effectTypes.js";

export const MANA_CLAIM: DeedCard = {
  id: CARD_MANA_CLAIM,
  name: "Mana Claim",
  poweredName: "Mana Curse",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_BLUE],
  basicEffect: {
    type: EFFECT_MANA_CLAIM,
  },
  poweredEffect: {
    type: EFFECT_MANA_CURSE,
  },
  sidewaysValue: 1,
  interactive: true,
};
