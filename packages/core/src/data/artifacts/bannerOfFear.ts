/**
 * Banner of Fear artifact
 * Card #01 (114/377)
 *
 * Basic: Assign to a Unit. During Block phase, spend Unit to cancel
 *        one enemy attack. Fame +1.
 * Powered (Any): Up to 3 enemies do not attack this combat. Destroy artifact.
 *
 * FAQ:
 * - Cancel != Block (Elusive armor still applies)
 * - Only cancels ONE attack from multi-attack enemies
 * - Cannot use if unit is wounded
 * - Cannot use against Arcane Immune enemies
 * - Can re-use if unit is re-readied (tied to unit ready state, not once-per-round)
 * - Does NOT work against Volkare
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_NOOP, EFFECT_SELECT_COMBAT_ENEMY } from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";
import { CARD_BANNER_OF_FEAR, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BANNER_OF_FEAR: DeedCard = {
  id: CARD_BANNER_OF_FEAR,
  name: "Banner of Fear",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER, CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  // Basic: assign to unit (cancel attack handled by banner system, not card effect)
  basicEffect: { type: EFFECT_NOOP },
  // Powered: Up to 3 enemies do not attack this combat
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    excludeArcaneImmune: true,
    maxTargets: 3,
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
  sidewaysValue: 0,
  destroyOnPowered: true,
};

export const BANNER_OF_FEAR_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_FEAR]: BANNER_OF_FEAR,
};
