/**
 * Spell card definitions for Mage Knight
 *
 * Spells require mana of their color to cast. Each spell has:
 * - Basic effect (can be played with just the card)
 * - Powered effect (requires spending mana of the spell's color)
 *
 * Note: This is an initial set of simple spells. More complex spells
 * will be added as the effect system expands.
 */

import type { DeedCard, CardEffect } from "../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_CHOICE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  COMBAT_TYPE_MELEE,
} from "../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_FIREBALL,
  CARD_FLAME_WALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_EXPOSE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "../types/modifierConstants.js";

// === Effect Helpers ===

function fireRangedAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_RANGED,
    element: ELEMENT_FIRE,
  };
}

function fireSiegeAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_SIEGE,
    element: ELEMENT_FIRE,
  };
}

function fireAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_MELEE,
    element: ELEMENT_FIRE,
  };
}

function fireBlock(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_BLOCK,
    amount,
    element: ELEMENT_FIRE,
  };
}

function iceRangedAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_RANGED,
    element: ELEMENT_ICE,
  };
}

function iceSiegeAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_SIEGE,
    element: ELEMENT_ICE,
  };
}

function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

function choice(options: readonly CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}

// === Spell Definitions ===

/**
 * Fireball (Red Spell #09)
 * Basic: Ranged Fire Attack 5
 * Powered: Take a Wound. Siege Fire Attack 8.
 *
 * Note: The "take a wound" cost is not yet implemented.
 * For now, powered just gives Siege Fire Attack 8.
 */
const FIREBALL: DeedCard = {
  id: CARD_FIREBALL,
  name: "Fireball",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_RED],
  basicEffect: fireRangedAttack(5),
  poweredEffect: fireSiegeAttack(8),
  sidewaysValue: 1,
};

/**
 * Flame Wall / Flame Wave (Red Spell #10)
 * Basic (Flame Wall): Fire Attack 5, or Fire Block 7
 * Powered (Flame Wave): Same choice, +2 per enemy
 *
 * Note: The scaling powered effect is not yet implemented.
 * For now, powered just gives the base values.
 */
const FLAME_WALL: DeedCard = {
  id: CARD_FLAME_WALL,
  name: "Flame Wall",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_RED],
  basicEffect: choice([fireAttack(5), fireBlock(7)]),
  poweredEffect: choice([fireAttack(5), fireBlock(7)]), // TODO: Add scaling
  sidewaysValue: 1,
};

/**
 * Snowstorm / Blizzard (Blue Spell #15)
 * Basic: Ranged Ice Attack 5
 * Powered: Take a Wound. Siege Ice Attack 8.
 *
 * Note: The "take a wound" cost is not yet implemented.
 */
const SNOWSTORM: DeedCard = {
  id: CARD_SNOWSTORM,
  name: "Snowstorm",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_BLUE],
  basicEffect: iceRangedAttack(5),
  poweredEffect: iceSiegeAttack(8),
  sidewaysValue: 1,
};

/**
 * Restoration / Rebirth (Green Spell #05)
 * Basic: Heal 3. If you are in a forest, Heal 5 instead.
 * Powered: Same + Ready up to 3 levels worth of Units (5 in forest)
 *
 * Note: Forest conditional and unit readying not yet implemented.
 * For now, just gives Heal 3 / Heal 5.
 */
const RESTORATION: DeedCard = {
  id: CARD_RESTORATION,
  name: "Restoration",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_HEALING],
  poweredBy: [MANA_GREEN],
  basicEffect: heal(3),
  poweredEffect: heal(5), // TODO: Add forest conditional and unit ready
  sidewaysValue: 1,
};

/**
 * Expose / Mass Expose (White Spell #19)
 * Basic: Target enemy loses all fortifications and resistances. Ranged Attack 2.
 * Powered: All enemies lose fortifications OR resistances. Ranged Attack 3.
 *
 * Note: The modifier removal is not yet implemented.
 * For now, just gives ranged attack.
 */
const EXPOSE: DeedCard = {
  id: CARD_EXPOSE,
  name: "Expose",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_WHITE],
  basicEffect: {
    type: EFFECT_GAIN_ATTACK,
    amount: 2,
    combatType: COMBAT_TYPE_RANGED,
  },
  poweredEffect: {
    type: EFFECT_GAIN_ATTACK,
    amount: 3,
    combatType: COMBAT_TYPE_RANGED,
  },
  sidewaysValue: 1,
};

// === Spell Registry ===

export const SPELL_CARDS: Record<CardId, DeedCard> = {
  [CARD_FIREBALL]: FIREBALL,
  [CARD_FLAME_WALL]: FLAME_WALL,
  [CARD_SNOWSTORM]: SNOWSTORM,
  [CARD_RESTORATION]: RESTORATION,
  [CARD_EXPOSE]: EXPOSE,
};

/**
 * Get a spell card definition by ID
 */
export function getSpellCard(id: CardId): DeedCard | undefined {
  return SPELL_CARDS[id];
}

/**
 * Get all spell card IDs
 */
export function getAllSpellCardIds(): CardId[] {
  return Object.keys(SPELL_CARDS) as CardId[];
}
