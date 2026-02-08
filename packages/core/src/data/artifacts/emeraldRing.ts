/**
 * Emerald Ring artifact
 * Card #07 (120/377)
 *
 * Basic: Gain green mana token and green crystal. Fame +1.
 * Powered (green, destroy): Endless green and black mana this turn.
 *          Fame +1 for each green Spell cast this turn.
 *
 * FAQ S1: Black mana restrictions still apply (day/night rules for when black can be used).
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MANA,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_APPLY_MODIFIER,
} from "../../types/effectTypes.js";
import {
  CARD_EMERALD_RING,
  MANA_GREEN,
  MANA_BLACK,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { fame } from "../effectHelpers.js";
import type { EndlessManaModifier } from "../../types/modifiers.js";
import {
  EFFECT_ENDLESS_MANA,
  DURATION_TURN,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";

/**
 * Endless mana modifier for green and black mana.
 * Note: Black mana restrictions still apply (day/night rules).
 */
const endlessManaEffect: EndlessManaModifier = {
  type: EFFECT_ENDLESS_MANA,
  colors: [MANA_GREEN, MANA_BLACK],
};

const EMERALD_RING: DeedCard = {
  id: CARD_EMERALD_RING,
  name: "Emerald Ring",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_GREEN],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_CRYSTAL, color: MANA_GREEN },
      fame(1),
    ],
  },
  poweredEffect: {
    type: EFFECT_APPLY_MODIFIER,
    modifier: endlessManaEffect,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    description: "Endless green and black mana this turn",
    // Note: Fame bonus for green spells cast is calculated at end of turn
    // via the Ring artifacts spell tracking system (see ringFameBonus.ts).
  },
  sidewaysValue: 2,
  destroyOnPowered: true,
};

export const EMERALD_RING_CARDS: Record<CardId, DeedCard> = {
  [CARD_EMERALD_RING]: EMERALD_RING,
};
