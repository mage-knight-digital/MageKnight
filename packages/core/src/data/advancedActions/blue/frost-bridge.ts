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
} from "../../../types/modifierConstants.js";
import {
  MANA_BLUE,
  CARD_FROST_BRIDGE,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
} from "@mage-knight/shared";

export const FROST_BRIDGE: DeedCard = {
  id: CARD_FROST_BRIDGE,
  name: "Frost Bridge",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT],
  // Basic: Move 2. The Move cost of swamps is reduced to 1 this turn.
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 2 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_SWAMP,
          amount: 0,
          minimum: 0,
          replaceCost: 1,
        },
        duration: DURATION_TURN,
        description: "Swamps cost 1 this turn",
      },
    ],
  },
  // Powered: Move 4. Travel through lakes. Lake + swamp cost reduced to 1.
  // Note: Lakes remain unsafe spaces — traversal only, not safe for ending turn.
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 4 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_LAKE,
          amount: 0,
          minimum: 0,
          replaceCost: 1,
        },
        duration: DURATION_TURN,
        description: "Lakes cost 1 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_SWAMP,
          amount: 0,
          minimum: 0,
          replaceCost: 1,
        },
        duration: DURATION_TURN,
        description: "Swamps cost 1 this turn",
      },
    ],
  },
  sidewaysValue: 1,
};
