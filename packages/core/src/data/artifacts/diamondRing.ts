/**
 * Diamond Ring artifact
 * Card #06 (119/377)
 *
 * Basic: Gain white mana token and white crystal. Fame +1.
 * Powered (white, destroy): Endless white and black mana this turn.
 *          Fame +1 for each white Spell cast this turn.
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
import { CARD_DIAMOND_RING, MANA_WHITE, MANA_BLACK } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { fame } from "../effectHelpers.js";
// fame is used for basic effect
import type { EndlessManaModifier } from "../../types/modifiers.js";
import {
  EFFECT_ENDLESS_MANA,
  DURATION_TURN,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";

/**
 * Endless mana modifier for white and black mana.
 * Note: Black mana restrictions still apply (day/night rules).
 */
const endlessManaEffect: EndlessManaModifier = {
  type: EFFECT_ENDLESS_MANA,
  colors: [MANA_WHITE, MANA_BLACK],
};

const DIAMOND_RING: DeedCard = {
  id: CARD_DIAMOND_RING,
  name: "Diamond Ring",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      { type: EFFECT_GAIN_CRYSTAL, color: MANA_WHITE },
      fame(1),
    ],
  },
  poweredEffect: {
    type: EFFECT_APPLY_MODIFIER,
    modifier: endlessManaEffect,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    description: "Endless white and black mana this turn",
    // Note: Fame bonus for white spells cast is calculated at end of turn
    // via the Ring artifacts spell tracking system (see ringFameBonus.ts).
  },
  sidewaysValue: 2,
  destroyOnPowered: true,
};

export const DIAMOND_RING_CARDS: Record<CardId, DeedCard> = {
  [CARD_DIAMOND_RING]: DIAMOND_RING,
};
