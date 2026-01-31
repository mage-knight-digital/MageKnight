/**
 * White spell card definitions
 *
 * White spells are powered by BLACK + WHITE mana.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_SELECT_COMBAT_ENEMY,
  COMBAT_TYPE_RANGED,
} from "../../types/effectTypes.js";
import {
  MANA_WHITE,
  MANA_BLACK,
  CARD_EXPOSE,
  CARD_WHIRLWIND,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

/**
 * Expose / Mass Expose (White Spell #19)
 * Basic: Target enemy loses all fortifications and resistances. Ranged Attack 2.
 * Powered: All enemies lose fortifications OR resistances. Ranged Attack 3.
 *
 * Note: The modifier removal is not yet implemented.
 * For now, just gives ranged attack.
 */
const EXPOSE: DeedCard = {
  id: CARD_EXPOSE,
  name: "Expose",
  poweredName: "Mass Expose",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_GAIN_ATTACK,
    amount: 2,
    combatType: COMBAT_TYPE_RANGED,
  },
  poweredEffect: {
    type: EFFECT_GAIN_ATTACK,
    amount: 3,
    combatType: COMBAT_TYPE_RANGED,
  },
  sidewaysValue: 1,
};

/**
 * Whirlwind / Tornado (White Spell #22)
 * Basic: Target enemy does not attack.
 * Powered (Tornado): Defeat target enemy. Can only be played in Attack phase.
 */
const WHIRLWIND: DeedCard = {
  id: CARD_WHIRLWIND,
  name: "Whirlwind",
  poweredName: "Tornado",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_BLACK, MANA_WHITE],
  basicEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [
        {
          modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
          duration: DURATION_COMBAT,
          description: "Target enemy does not attack",
        },
      ],
    },
  },
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: { defeat: true },
    requiredPhase: COMBAT_PHASE_ATTACK,
  },
  sidewaysValue: 1,
};

export const WHITE_SPELLS: Record<CardId, DeedCard> = {
  [CARD_WHIRLWIND]: WHIRLWIND,
  [CARD_EXPOSE]: EXPOSE,
};
