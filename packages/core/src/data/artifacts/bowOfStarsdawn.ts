/**
 * Bow of Starsdawn artifact
 * Card #16 (303/377)
 *
 * Basic: Discard any number of cards. Ranged Attack 2 per card discarded.
 *        Fame +1 for each enemy defeated in current combat phase.
 * Powered (any color, destroy): Each Ranged Attack is doubled OR becomes Siege
 *        of same element. May also double Siege Attacks (become Ranged).
 *        Does NOT include basic effect's discard ability.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_DISCARD_FOR_ATTACK,
  COMBAT_TYPE_RANGED,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_BOW_ATTACK_TRANSFORMATION,
  EFFECT_BOW_PHASE_FAME_TRACKING,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";
import {
  CARD_BOW_OF_STARSDAWN,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BOW_OF_STARSDAWN: DeedCard = {
  id: CARD_BOW_OF_STARSDAWN,
  name: "Bow of Starsdawn",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Discard any number of non-wound cards for Ranged Attack +2 each
      {
        type: EFFECT_DISCARD_FOR_ATTACK,
        attackPerCard: 2,
        combatType: COMBAT_TYPE_RANGED,
      },
      // Fame +1 per enemy defeated in current combat phase
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_BOW_PHASE_FAME_TRACKING,
          famePerEnemy: 1,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        description: "Fame +1 per enemy defeated this phase",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_BOW_ATTACK_TRANSFORMATION },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    description: "Ranged Attacks doubled or become Siege; Siege doubled but become Ranged",
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const BOW_OF_STARSDAWN_CARDS: Record<CardId, DeedCard> = {
  [CARD_BOW_OF_STARSDAWN]: BOW_OF_STARSDAWN,
};
