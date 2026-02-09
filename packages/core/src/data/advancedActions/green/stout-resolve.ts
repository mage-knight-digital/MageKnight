import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_INFLUENCE,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../../types/cards.js";
import { MANA_GREEN, CARD_STOUT_RESOLVE } from "@mage-knight/shared";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_DISCARD_FOR_BONUS,
  COMBAT_TYPE_MELEE,
} from "../../../types/effectTypes.js";
import type { CardEffect } from "../../../types/cards.js";

const BASIC_CHOICE_OPTIONS: readonly CardEffect[] = [
  { type: EFFECT_GAIN_MOVE, amount: 2 },
  { type: EFFECT_GAIN_INFLUENCE, amount: 2 },
  { type: EFFECT_GAIN_ATTACK, amount: 2, combatType: COMBAT_TYPE_MELEE },
  { type: EFFECT_GAIN_BLOCK, amount: 2 },
];

const POWERED_CHOICE_OPTIONS: readonly CardEffect[] = [
  { type: EFFECT_GAIN_MOVE, amount: 3 },
  { type: EFFECT_GAIN_INFLUENCE, amount: 3 },
  { type: EFFECT_GAIN_ATTACK, amount: 3, combatType: COMBAT_TYPE_MELEE },
  { type: EFFECT_GAIN_BLOCK, amount: 3 },
];

export const STOUT_RESOLVE: DeedCard = {
  id: CARD_STOUT_RESOLVE,
  name: "Stout Resolve",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT, CATEGORY_INFLUENCE, CATEGORY_COMBAT],
  // Basic: Move 2, Influence 2, Attack 2 or Block 2. You may discard a Wound to increase the effect by 1.
  basicEffect: {
    type: EFFECT_DISCARD_FOR_BONUS,
    choiceOptions: BASIC_CHOICE_OPTIONS,
    bonusPerCard: 1,
    maxDiscards: 1,
    discardFilter: "wound_only",
  },
  // Powered: Move 3, Influence 3, Attack 3 or Block 3. You may discard any number of cards, including one Wound, to increase the effect by 2 for each.
  poweredEffect: {
    type: EFFECT_DISCARD_FOR_BONUS,
    choiceOptions: POWERED_CHOICE_OPTIONS,
    bonusPerCard: 2,
    maxDiscards: Infinity,
    discardFilter: "any_max_one_wound",
  },
  sidewaysValue: 1,
};
