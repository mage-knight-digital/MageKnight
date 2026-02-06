/**
 * Burning Shield / Exploding Shield (Red Spell #08)
 *
 * Basic (Burning Shield):
 *   Fire Block 4. If this card is used as part of a successful block,
 *   you may use it during your Attack phase as Fire Attack 4.
 *   Fire Attack bypasses Fire Resistance and Arcane Immunity.
 *   Can target any enemy, not just the blocked one.
 *
 * Powered (Exploding Shield):
 *   Fire Block 4. If this card is used as part of a successful block,
 *   destroy the blocked enemy.
 *   Fire Resistant/Arcane Immune enemies are NOT destroyed, but Fire Block still works.
 *   Blocking ONE attack of a multi-attack enemy destroys the whole enemy.
 *   Summoned monsters: destroying them grants no fame.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_BLOCK,
  EFFECT_APPLY_MODIFIER,
} from "../../../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLACK,
  CARD_BURNING_SHIELD,
} from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  ELEMENT_FIRE,
  EFFECT_BURNING_SHIELD_ACTIVE,
} from "../../../types/modifierConstants.js";

export const BURNING_SHIELD: DeedCard = {
  id: CARD_BURNING_SHIELD,
  name: "Burning Shield",
  poweredName: "Exploding Shield",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Fire Block 4
      {
        type: EFFECT_GAIN_BLOCK,
        amount: 4,
        element: ELEMENT_FIRE,
      },
      // Track that Burning Shield is active (basic mode = grants Fire Attack on successful block)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_BURNING_SHIELD_ACTIVE,
          mode: "attack",
          blockValue: 4,
          attackValue: 4,
        },
        duration: DURATION_COMBAT,
        description: "On successful block: Fire Attack 4 in Attack phase",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Fire Block 4
      {
        type: EFFECT_GAIN_BLOCK,
        amount: 4,
        element: ELEMENT_FIRE,
      },
      // Track that Exploding Shield is active (powered mode = destroys blocked enemy)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_BURNING_SHIELD_ACTIVE,
          mode: "destroy",
          blockValue: 4,
          attackValue: 0,
        },
        duration: DURATION_COMBAT,
        description: "On successful block: destroy blocked enemy",
      },
    ],
  },
  sidewaysValue: 1,
};
