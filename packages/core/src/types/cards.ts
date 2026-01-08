/**
 * Card definitions for Mage Knight
 */

import type { CardId, ManaColor, Element } from "@mage-knight/shared";
import type { ModifierEffect, ModifierDuration } from "./modifiers.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  MANA_ANY,
  type CombatType,
} from "./effectTypes.js";
import type { EffectCondition } from "./conditions.js";
import type { ScalingFactor } from "./scaling.js";

// === Card Types ===
export const DEED_CARD_TYPE_BASIC_ACTION = "basic_action" as const;
export const DEED_CARD_TYPE_ADVANCED_ACTION = "advanced_action" as const;
export const DEED_CARD_TYPE_SPELL = "spell" as const;
export const DEED_CARD_TYPE_ARTIFACT = "artifact" as const;
export const DEED_CARD_TYPE_WOUND = "wound" as const;

// === Card Categories (symbols in top-left corner of card art) ===
export const CARD_CATEGORY_MOVEMENT = "movement" as const; // foot symbol
export const CARD_CATEGORY_COMBAT = "combat" as const; // crossed swords symbol
export const CARD_CATEGORY_INFLUENCE = "influence" as const; // head symbol
export const CARD_CATEGORY_HEALING = "healing" as const; // hand symbol
export const CARD_CATEGORY_SPECIAL = "special" as const; // compass/star symbol

export type CardCategory =
  | typeof CARD_CATEGORY_MOVEMENT
  | typeof CARD_CATEGORY_COMBAT
  | typeof CARD_CATEGORY_INFLUENCE
  | typeof CARD_CATEGORY_HEALING
  | typeof CARD_CATEGORY_SPECIAL;

export type DeedCardType =
  | typeof DEED_CARD_TYPE_BASIC_ACTION
  | typeof DEED_CARD_TYPE_ADVANCED_ACTION
  | typeof DEED_CARD_TYPE_SPELL
  | typeof DEED_CARD_TYPE_ARTIFACT
  | typeof DEED_CARD_TYPE_WOUND;

export type { Element } from "@mage-knight/shared";

// === Card Effect Interfaces ===

export interface GainMoveEffect {
  readonly type: typeof EFFECT_GAIN_MOVE;
  readonly amount: number;
}

export interface GainInfluenceEffect {
  readonly type: typeof EFFECT_GAIN_INFLUENCE;
  readonly amount: number;
}

export interface GainAttackEffect {
  readonly type: typeof EFFECT_GAIN_ATTACK;
  readonly amount: number;
  readonly combatType: CombatType;
  readonly element?: Element; // undefined = physical
}

export interface GainBlockEffect {
  readonly type: typeof EFFECT_GAIN_BLOCK;
  readonly amount: number;
  readonly element?: Element; // undefined = physical
}

export interface GainHealingEffect {
  readonly type: typeof EFFECT_GAIN_HEALING;
  readonly amount: number;
}

export interface GainManaEffect {
  readonly type: typeof EFFECT_GAIN_MANA;
  readonly color: ManaColor | typeof MANA_ANY;
}

export interface DrawCardsEffect {
  readonly type: typeof EFFECT_DRAW_CARDS;
  readonly amount: number;
}

export interface ApplyModifierEffect {
  readonly type: typeof EFFECT_APPLY_MODIFIER;
  readonly modifier: ModifierEffect;
  readonly duration: ModifierDuration;
}

export interface CompoundEffect {
  readonly type: typeof EFFECT_COMPOUND;
  readonly effects: readonly CardEffect[];
}

export interface ChoiceEffect {
  readonly type: typeof EFFECT_CHOICE;
  readonly options: readonly CardEffect[];
}

export interface ConditionalEffect {
  readonly type: typeof EFFECT_CONDITIONAL;
  readonly condition: EffectCondition;
  readonly thenEffect: CardEffect;
  readonly elseEffect?: CardEffect;
}

/** Base effects that can be scaled (the ones that have an amount) */
export type ScalableBaseEffect =
  | GainAttackEffect
  | GainBlockEffect
  | GainMoveEffect
  | GainInfluenceEffect;

export interface ScalingEffect {
  readonly type: typeof EFFECT_SCALING;
  readonly baseEffect: ScalableBaseEffect;
  readonly scalingFactor: ScalingFactor;
  readonly amountPerUnit: number; // e.g., +2 per enemy
  readonly minimum?: number; // Floor value (default 0)
  readonly maximum?: number; // Cap (optional)
}

// Union of all card effects
export type CardEffect =
  | GainMoveEffect
  | GainInfluenceEffect
  | GainAttackEffect
  | GainBlockEffect
  | GainHealingEffect
  | GainManaEffect
  | DrawCardsEffect
  | ApplyModifierEffect
  | CompoundEffect
  | ChoiceEffect
  | ConditionalEffect
  | ScalingEffect;

// === Card Definition ===

export interface DeedCard {
  readonly id: CardId;
  readonly name: string;
  readonly cardType: DeedCardType;

  // Mana colors that can power this card's powered effect
  // Empty array means the card cannot be powered (e.g., wounds)
  // Most cards have a single color, but some advanced actions can be powered by multiple
  readonly poweredBy: readonly ManaColor[];

  // Card categories (symbols shown in top-left corner of card art)
  readonly categories: readonly CardCategory[];

  // Basic effect (play without mana)
  readonly basicEffect: CardEffect;

  // Powered effect (play with matching mana)
  readonly poweredEffect: CardEffect;

  // Sideways value (usually 1, wounds are 0)
  readonly sidewaysValue: number;
}
