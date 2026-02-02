/**
 * Sword of Justice artifact
 * Card #08 (121/377)
 *
 * Basic: Discard any number of cards. Attack 3 per card discarded.
 *        Fame +1 for each enemy defeated this turn.
 * Powered: Double all physical attacks in Attack phase.
 *          Enemies lose physical resistance. Fame +1 per enemy defeated.
 *          Artifact is destroyed after use.
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
  EFFECT_FAME_PER_ENEMY_DEFEATED,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_DOUBLE_PHYSICAL_ATTACKS,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  SCOPE_ALL_ENEMIES,
  SCOPE_SELF,
} from "../../types/modifierConstants.js";
import { CARD_SWORD_OF_JUSTICE, MANA_RED } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const SWORD_OF_JUSTICE: DeedCard = {
  id: CARD_SWORD_OF_JUSTICE,
  name: "Sword of Justice",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_RED],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      {
        type: EFFECT_DISCARD_FOR_ATTACK,
        attackPerCard: 3,
        combatType: COMBAT_TYPE_MELEE,
      },
      {
        type: EFFECT_FAME_PER_ENEMY_DEFEATED,
        famePerEnemy: 1,
        excludeSummoned: false,
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      // Double all physical attacks during Attack Phase
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_DOUBLE_PHYSICAL_ATTACKS },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        description: "Double physical attacks",
      },
      // All enemies lose physical resistance (except Arcane Immune)
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        description: "Enemies lose physical resistance",
      },
      // Fame +1 per enemy defeated this turn
      {
        type: EFFECT_FAME_PER_ENEMY_DEFEATED,
        famePerEnemy: 1,
        excludeSummoned: false,
      },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const SWORD_OF_JUSTICE_CARDS: Record<CardId, DeedCard> = {
  [CARD_SWORD_OF_JUSTICE]: SWORD_OF_JUSTICE,
};
