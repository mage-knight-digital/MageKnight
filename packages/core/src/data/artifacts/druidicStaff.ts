/**
 * Druidic Staff artifact
 * Card #21 (308/377)
 *
 * Basic: Discard a card. Based on color get:
 *        White: Move up to 2 revealed spaces to safe space (special movement)
 *        Blue: Get 2 crystals of one color
 *        Red: Ready level III or lower unit
 *        Green: Heal 3
 *        Artifact/no color: No effect (card is still discarded)
 *
 * Powered (any color, destroy): Choose two different options from above (no discard).
 *
 * FAQ S1: Cannot use white (movement) after the Action portion of your turn has begun.
 * FAQ S2: White movement can pass through impassable terrain, rampaging enemies, fortified sites.
 * FAQ S3: Cannot Ready a Unit (red) or Heal 3 (green) during Combat.
 * FAQ S4: Choose two DIFFERENT options. Both resolve immediately (except Heal points banked).
 * FAQ S5: During Combat, ONLY the blue option (crystals) is allowed.
 * FAQ S6: Discarding an Artifact gives nothing (artifacts have no action color).
 */

import type { DeedCard, CardEffect } from "../../types/cards.js";
import {
  CATEGORY_HEALING,
  CATEGORY_SPECIAL,
  CATEGORY_MOVEMENT,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_GAIN_HEALING,
  EFFECT_READY_UNIT,
  EFFECT_CHOICE,
  EFFECT_APPLY_MODIFIER,
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
} from "../../types/effectTypes.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import {
  CARD_DRUIDIC_STAFF,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { discardCostByColorAllowNoColor } from "../basicActions/helpers.js";

// === Individual Option Effects ===

/**
 * White option: Move up to 2 revealed spaces to a safe space.
 * Can move through impassable terrain, rampaging enemies, and fortified sites.
 * Does not provoke rampaging enemies.
 *
 * Implementation: Move 2 with all terrain costing 1 (each space = 1 move point),
 * plus ignore rampaging provocation. The "safe space" end requirement is enforced
 * by the movement system (player must end on a valid safe space).
 */
const whiteEffect: CardEffect = {
  type: EFFECT_COMPOUND,
  effects: [
    { type: EFFECT_GAIN_MOVE, amount: 2 },
    // All terrain costs 1 (each revealed space = 1 move point, including impassable)
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
      description: "All terrain costs 1",
    },
    // Does not provoke rampaging enemies
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_IGNORE_RAMPAGING_PROVOKE,
      },
      duration: DURATION_TURN,
      description: "Does not provoke rampaging enemies",
    },
  ],
};

/**
 * Blue option: Get 2 crystals of any one color.
 * Player chooses the color, then gains 2 crystals of that color.
 */
const blueEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: [
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_RED },
      ],
    },
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_BLUE },
      ],
    },
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_GREEN },
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_GREEN },
      ],
    },
    {
      type: EFFECT_COMPOUND,
      effects: [
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_WHITE },
        { type: EFFECT_GAIN_CRYSTAL, color: MANA_WHITE },
      ],
    },
  ],
};

/** Red option: Ready a unit of level 3 or lower. */
const redEffect: CardEffect = { type: EFFECT_READY_UNIT, maxLevel: 3 };

/** Green option: Heal 3. */
const greenEffect: CardEffect = { type: EFFECT_GAIN_HEALING, amount: 3 };

// === Powered Effect: Choose Two Different Options ===
// Generate all 6 unique pairs of the 4 options as compound effects.
// Each pair is a compound that resolves both effects in sequence.

const poweredOptions: { label: string; effects: CardEffect[] }[] = [
  { label: "White + Blue", effects: [whiteEffect, blueEffect] },
  { label: "White + Red", effects: [whiteEffect, redEffect] },
  { label: "White + Green", effects: [whiteEffect, greenEffect] },
  { label: "Blue + Red", effects: [blueEffect, redEffect] },
  { label: "Blue + Green", effects: [blueEffect, greenEffect] },
  { label: "Red + Green", effects: [redEffect, greenEffect] },
];

const poweredEffect: CardEffect = {
  type: EFFECT_CHOICE,
  options: poweredOptions.map(({ effects }) => ({
    type: EFFECT_COMPOUND as typeof EFFECT_COMPOUND,
    effects,
  })),
};

// === Card Definition ===

const DRUIDIC_STAFF: DeedCard = {
  id: CARD_DRUIDIC_STAFF,
  name: "Druidic Staff",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_HEALING, CATEGORY_SPECIAL, CATEGORY_MOVEMENT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: discardCostByColorAllowNoColor(1, {
    [CARD_COLOR_WHITE]: whiteEffect,
    [CARD_COLOR_BLUE]: blueEffect,
    [CARD_COLOR_RED]: redEffect,
    [CARD_COLOR_GREEN]: greenEffect,
  }),
  poweredEffect,
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const DRUIDIC_STAFF_CARDS: Record<CardId, DeedCard> = {
  [CARD_DRUIDIC_STAFF]: DRUIDIC_STAFF,
};
