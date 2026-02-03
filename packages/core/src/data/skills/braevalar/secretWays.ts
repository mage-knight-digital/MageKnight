/**
 * Secret Ways - Braevalar Skill
 * @module data/skills/braevalar/secretWays
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_BLUE, TERRAIN_LAKE, TERRAIN_MOUNTAIN } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_NOOP,
  EFFECT_PAY_MANA,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_SAFE,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_SECRET_WAYS = "braevalar_secret_ways" as SkillId;

const secretWaysEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 1 },
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
                replaceCost: 2,
              },
              duration: DURATION_TURN,
              description: "Lakes cost 2",
            },
            {
              type: EFFECT_APPLY_MODIFIER,
              modifier: {
                type: EFFECT_TERRAIN_SAFE,
                terrain: TERRAIN_LAKE,
              },
              duration: DURATION_TURN,
              description: "Lakes are safe spaces this turn",
            },
          ],
        },
      ],
    },
  ],
} as const;

export const secretWays: SkillDefinition = {
  id: SKILL_BRAEVALAR_SECRET_WAYS,
  name: "Secret Ways",
  heroId: "braevalar",
  description: "Move 1. Mountains 5 Move. Blue mana: lakes 2 Move",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: secretWaysEffect,
  passiveModifiers: [
    {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_MOUNTAIN,
      amount: 0,
      minimum: 0,
      replaceCost: 5,
    },
    {
      type: EFFECT_TERRAIN_SAFE,
      terrain: TERRAIN_MOUNTAIN,
    },
  ],
  categories: [CATEGORY_MOVEMENT],
};
