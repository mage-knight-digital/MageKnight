import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_MOVEMENT, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_COMPOUND,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_NOOP,
  EFFECT_PAY_MANA,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
} from "../../../types/modifierConstants.js";
import {
  MANA_WHITE,
  MANA_BLUE,
  CARD_SONG_OF_WIND,
  TERRAIN_PLAINS,
  TERRAIN_DESERT,
  TERRAIN_WASTELAND,
  TERRAIN_LAKE,
} from "@mage-knight/shared";

// Basic: Move 2. The Move cost of plains, deserts, and wastelands is reduced by 1, to a minimum of 0 this turn.
// Powered (White): Move 2. The Move cost of plains, deserts, and wastelands is reduced by 2, to a minimum of 0.
//   You may pay a blue mana to be able to travel through lakes for Move cost 0 this turn.
// Note: Lakes remain unsafe spaces — traversal only, not safe for ending turn.

export const SONG_OF_WIND: DeedCard = {
  id: CARD_SONG_OF_WIND,
  name: "Song of Wind",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_WHITE],
  categories: [CATEGORY_MOVEMENT],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 2 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_PLAINS,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Plains cost -1 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_DESERT,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Deserts cost -1 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_WASTELAND,
          amount: -1,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Wastelands cost -1 this turn",
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      { type: EFFECT_GAIN_MOVE, amount: 2 },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_PLAINS,
          amount: -2,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Plains cost -2 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_DESERT,
          amount: -2,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Deserts cost -2 this turn",
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_WASTELAND,
          amount: -2,
          minimum: 0,
        },
        duration: DURATION_TURN,
        description: "Wastelands cost -2 this turn",
      },
      {
        type: EFFECT_CHOICE,
        options: [
          { type: EFFECT_NOOP },
          {
            type: EFFECT_COMPOUND,
            effects: [
              { type: EFFECT_PAY_MANA, colors: [MANA_BLUE], amount: 1 },
              {
                type: EFFECT_APPLY_MODIFIER,
                modifier: {
                  type: EFFECT_TERRAIN_COST,
                  terrain: TERRAIN_LAKE,
                  amount: 0,
                  minimum: 0,
                  replaceCost: 0,
                },
                duration: DURATION_TURN,
                description: "Lakes cost 0 this turn",
              },
            ],
          },
        ],
      },
    ],
  },
  sidewaysValue: 1,
};
