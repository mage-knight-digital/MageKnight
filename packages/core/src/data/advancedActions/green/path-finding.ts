import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_COMPOUND,
  EFFECT_APPLY_MODIFIER,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import {
  MANA_GREEN,
  CARD_PATH_FINDING,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
} from "@mage-knight/shared";
import type { CardEffect } from "../../../types/cards.js";

// Basic: Move 2. The Move cost of all terrains is reduced by 1, to a minimum of 2, this turn.
// Powered (Green): Move 4. The Move cost of all terrains is reduced to 2 this turn.
// Note: "all terrains" means passable terrains — lakes/mountains remain impassable.

const PASSABLE_TERRAINS = [
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
] as const;

function terrainReplaceCost(terrain: (typeof PASSABLE_TERRAINS)[number]): CardEffect {
  return {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_TERRAIN_COST,
      terrain,
      amount: 0,
      minimum: 0,
      replaceCost: 2,
    },
    duration: DURATION_TURN,
    description: `${terrain} costs 2 this turn`,
  };
}

export const PATH_FINDING: DeedCard = {
  id: CARD_PATH_FINDING,
  name: "Path Finding",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_GREEN],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 2 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
        },
        duration: DURATION_TURN,
        description: "All terrain costs -1 (min 2) this turn",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 4 },
      ...PASSABLE_TERRAINS.map(terrainReplaceCost),
    ],
  },
  sidewaysValue: 1,
};
