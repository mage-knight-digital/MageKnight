/**
 * Flight - Goldyx Skill
 * @module data/skills/goldyx/flight
 *
 * Once a round: Flip this to move to an adjacent space for free,
 * or to move two spaces for 2 Move points. You must end this move
 * in a safe space. This move does not provoke rampaging enemies.
 *
 * Flight ignores terrain costs entirely — you can fly over mountains,
 * lakes, and unconquered fortified sites. However, you cannot END
 * on an unsafe space (lake, mountain without Mountain Lore, etc.).
 *
 * Space Bending interaction (FAQ Q1):
 * - Option 1: free move extends to 1-2 spaces (Space Bending doubles adjacency)
 * - Option 2: up to 4 spaces for 2 Move (each space can be "bent")
 * Both interactions work naturally via the modifier system.
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import {
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
} from "../../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  EFFECT_TERRAIN_COST,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_FLIGHT = "goldyx_flight" as SkillId;

/**
 * Shared flight modifiers applied by both options:
 * - All terrain costs replaced (mountains, lakes become passable)
 * - Ignore rampaging enemy provocation
 *
 * Note: We do NOT add terrain-safe modifiers for mountains/lakes.
 * The player can fly OVER them but cannot END on them (unless they
 * have other abilities like Mountain Lore that mark them safe).
 */
const flightIgnoreRampaging = {
  type: EFFECT_APPLY_MODIFIER,
  modifier: {
    type: EFFECT_RULE_OVERRIDE,
    rule: RULE_IGNORE_RAMPAGING_PROVOKE,
  },
  duration: DURATION_TURN,
  description: "Flight does not provoke rampaging enemies",
} as const;

/**
 * Option 1: Move 1 space for free.
 * All terrain costs 0, so even mountains and lakes are traversable.
 * Grant exactly 1 move point (enough for 1 space at cost 0).
 */
const flightFreeMove = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_COST,
        terrain: TERRAIN_ALL,
        amount: 0,
        minimum: 0,
        replaceCost: 0,
      },
      duration: DURATION_TURN,
      description: "Flight: all terrain free",
    },
    flightIgnoreRampaging,
    { type: EFFECT_GAIN_MOVE, amount: 1 },
  ],
} as const;

/**
 * Option 2: Move up to 2 spaces for 2 Move points.
 * All terrain costs 1 per space, so 2 spaces = 2 Move.
 * Grant exactly 2 move points.
 *
 * With Space Bending active, each "space" can be bent to 2,
 * allowing up to 4 spaces for 2 Move points (FAQ Q1).
 */
const flightExtendedMove = {
  type: EFFECT_COMPOUND,
  effects: [
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_TERRAIN_COST,
        terrain: TERRAIN_ALL,
        amount: 0,
        minimum: 0,
        replaceCost: 1,
      },
      duration: DURATION_TURN,
      description: "Flight: all terrain costs 1",
    },
    flightIgnoreRampaging,
    { type: EFFECT_GAIN_MOVE, amount: 2 },
  ],
} as const;

/**
 * Flight skill effect: choice between free adjacent move or extended move.
 */
const flightEffect = {
  type: EFFECT_CHOICE,
  options: [flightFreeMove, flightExtendedMove],
} as const;

export const flight: SkillDefinition = {
  id: SKILL_GOLDYX_FLIGHT,
  name: "Flight",
  heroId: "goldyx",
  description: "Flip to move to adjacent space free, or 2 spaces for 2 Move",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  effect: flightEffect,
  categories: [CATEGORY_MOVEMENT],
};
