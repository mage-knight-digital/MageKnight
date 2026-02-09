import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_GREEN, CARD_MOUNTAIN_LORE } from "@mage-knight/shared";
import { TERRAIN_MOUNTAIN } from "@mage-knight/shared";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_MOUNTAIN_LORE_HAND_LIMIT,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_SAFE,
} from "../../../types/modifierConstants.js";

export const MOUNTAIN_LORE: DeedCard = {
  id: CARD_MOUNTAIN_LORE,
  name: "Mountain Lore",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 3. If you end your turn in hills, your Hand limit is higher by 1 the next time you draw cards.
  // Powered: Move 5. You can enter mountains at a Move cost of 5 and they are considered a safe space for you at the end of this turn. If you end your turn in mountains/hills, your Hand limit is higher by 2/1 the next time you draw cards.
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 3 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_MOUNTAIN_LORE_HAND_LIMIT,
          hillsBonus: 1,
          mountainBonus: 0,
        },
        duration: DURATION_TURN,
        description: "If ending turn in hills, hand limit +1 on next draw",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 5 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_MOUNTAIN,
          amount: 0,
          minimum: 0,
          replaceCost: 5,
        },
        duration: DURATION_TURN,
        description: "Mountains cost 5 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_SAFE,
          terrain: TERRAIN_MOUNTAIN,
        },
        duration: DURATION_TURN,
        description: "Mountains are safe spaces this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_MOUNTAIN_LORE_HAND_LIMIT,
          hillsBonus: 1,
          mountainBonus: 2,
        },
        duration: DURATION_TURN,
        description: "If ending turn in mountains/hills, hand limit +2/+1 on next draw",
      },
    ],
  },
  sidewaysValue: 1,
};
