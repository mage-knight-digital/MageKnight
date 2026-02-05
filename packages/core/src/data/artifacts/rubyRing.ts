/**
 * Ruby Ring artifact
 * Card #04 (117/377)
 *
 * Basic: Gain red mana token and red crystal. Fame +1.
 * Powered (red, destroy): Endless red and black mana this turn.
 *          Fame +1 for each red Spell cast this turn.
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
import { CARD_RUBY_RING, MANA_RED, MANA_BLACK } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { fame } from "../effectHelpers.js";
import type { EndlessManaModifier } from "../../types/modifiers.js";
import {
  EFFECT_ENDLESS_MANA,
  DURATION_TURN,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";

/**
 * Endless mana modifier for red and black mana.
 * Note: Black mana restrictions still apply (day/night rules).
 */
const endlessManaEffect: EndlessManaModifier = {
  type: EFFECT_ENDLESS_MANA,
  colors: [MANA_RED, MANA_BLACK],
};

const RUBY_RING: DeedCard = {
  id: CARD_RUBY_RING,
  name: "Ruby Ring",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_RED],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
      { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
      fame(1),
    ],
  },
  poweredEffect: {
    type: EFFECT_APPLY_MODIFIER,
    modifier: endlessManaEffect,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    description: "Endless red and black mana this turn",
    // Note: Fame bonus for red spells cast is calculated at end of turn
    // via the Ring artifacts spell tracking system (see ringFameBonus.ts).
  },
  sidewaysValue: 2,
  destroyOnPowered: true,
};

export const RUBY_RING_CARDS: Record<CardId, DeedCard> = {
  [CARD_RUBY_RING]: RUBY_RING,
};
