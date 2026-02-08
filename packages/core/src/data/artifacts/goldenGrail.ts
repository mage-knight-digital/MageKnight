/**
 * Golden Grail artifact
 * Card #12 (125/377)
 *
 * Basic: Heal 2. Fame +1 for each point of Healing from this card spent this turn.
 * Powered (any color, destroy): Heal 6. Draw a card each time you Heal a Wound from hand this turn.
 *
 * FAQ S1: Fame is per healing POINT spent, not per wound removed.
 *   - Heal level II unit (costs 2 healing) with Heal 2 → Fame +2
 *   - Only Grail's contribution counts, not other healing sources
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_COMPOUND, EFFECT_GAIN_HEALING, EFFECT_APPLY_MODIFIER } from "../../types/effectTypes.js";
import {
  DURATION_TURN,
  SCOPE_SELF,
  EFFECT_GOLDEN_GRAIL_FAME_TRACKING,
  EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL,
} from "../../types/modifierConstants.js";
import { CARD_GOLDEN_GRAIL, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const GOLDEN_GRAIL: DeedCard = {
  id: CARD_GOLDEN_GRAIL,
  name: "Golden Grail",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_HEALING],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Modifier FIRST so it's active when the immediate healing resolves
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_GOLDEN_GRAIL_FAME_TRACKING,
          remainingHealingPoints: 2,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        description: "Fame +1 per healing point from Golden Grail spent this turn",
      },
      { type: EFFECT_GAIN_HEALING, amount: 2 },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Modifier FIRST so it's active when the immediate healing resolves
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        description: "Draw a card each time you heal a wound from hand this turn",
      },
      { type: EFFECT_GAIN_HEALING, amount: 6 },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const GOLDEN_GRAIL_CARDS: Record<CardId, DeedCard> = {
  [CARD_GOLDEN_GRAIL]: GOLDEN_GRAIL,
};
