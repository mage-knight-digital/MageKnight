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
  MANA_ANY,
  type CombatType,
  type CardColor,
} from "./effectTypes.js";

// === Card Types ===
export const DEED_CARD_TYPE_BASIC_ACTION = "basic_action" as const;
export const DEED_CARD_TYPE_ADVANCED_ACTION = "advanced_action" as const;
export const DEED_CARD_TYPE_SPELL = "spell" as const;
export const DEED_CARD_TYPE_ARTIFACT = "artifact" as const;
export const DEED_CARD_TYPE_WOUND = "wound" as const;

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
  | ChoiceEffect;

// === Card Definition ===

export interface DeedCard {
  readonly id: CardId;
  readonly name: string;
  readonly color: CardColor;
  readonly cardType: DeedCardType;

  // Basic effect (play without mana)
  readonly basicEffect: CardEffect;

  // Powered effect (play with matching mana)
  readonly poweredEffect: CardEffect;

  // Sideways value (usually 1, wounds are 0)
  readonly sidewaysValue: number;
}
