/**
 * Banner of Glory artifact
 * Card #00 (113/377)
 *
 * Basic: Assign to a Unit. Unit gets Armor +1 and +1 to attacks/blocks.
 *        Fame +1 whenever Unit attacks or blocks.
 * Powered (Red): All Units get Armor +1 and +1 to attacks/blocks this turn.
 *          Fame +1 for each Unit that attacks or blocks.
 *          Artifact is destroyed after use.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_APPLY_MODIFIER, EFFECT_COMPOUND, EFFECT_NOOP } from "../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_UNIT_ARMOR_BONUS,
  EFFECT_UNIT_BLOCK_BONUS,
  EFFECT_BANNER_GLORY_FAME_TRACKING,
  SCOPE_ALL_UNITS,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";
import { CARD_BANNER_OF_GLORY, MANA_RED } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BANNER_OF_GLORY: DeedCard = {
  id: CARD_BANNER_OF_GLORY,
  name: "Banner of Glory",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER],
  poweredBy: [MANA_RED],
  // Basic: assign to unit (handled by banner system, not card effect)
  basicEffect: { type: EFFECT_NOOP },
  // Powered: all units get Armor +1, +1 attack/block tack-on, Fame +1 per unit that attacks/blocks
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // +1 armor to all units this turn
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_UNIT_ARMOR_BONUS, amount: 1 },
        duration: DURATION_TURN,
        scope: { type: SCOPE_ALL_UNITS },
        description: "All units get Armor +1",
      },
      // +1 attack to all units this turn (tack-on, requires base attack)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_UNIT_ATTACK_BONUS, amount: 1 },
        duration: DURATION_TURN,
        scope: { type: SCOPE_ALL_UNITS },
        description: "All units get +1 to attacks",
      },
      // +1 block to all units this turn (tack-on, requires base block)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_UNIT_BLOCK_BONUS, amount: 1 },
        duration: DURATION_TURN,
        scope: { type: SCOPE_ALL_UNITS },
        description: "All units get +1 to blocks",
      },
      // Fame +1 per unit that attacks or blocks this turn (tracked by modifier)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        description: "Fame +1 per unit that attacks or blocks",
      },
    ],
  },
  sidewaysValue: 0,
  destroyOnPowered: true,
};

export const BANNER_OF_GLORY_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_GLORY]: BANNER_OF_GLORY,
};
