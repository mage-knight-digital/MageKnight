/**
 * Card definitions for Mage Knight
 */

import type { CardId, ManaColor, BasicManaColor, Element } from "@mage-knight/shared";
import type { ModifierEffect, ModifierDuration, ModifierScope } from "./modifiers.js";
import type { CombatPhase } from "./combat.js";
import type { SourceDieId } from "./mana.js";
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
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_TAKE_WOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
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

export interface ChangeReputationEffect {
  readonly type: typeof EFFECT_CHANGE_REPUTATION;
  readonly amount: number; // positive = gain, negative = lose
}

export interface GainCrystalEffect {
  readonly type: typeof EFFECT_GAIN_CRYSTAL;
  readonly color: BasicManaColor; // red, blue, green, white only
}

/**
 * Convert a mana token to a crystal of the same color.
 * Player chooses which mana token to spend, gains crystal of that color.
 * Used by Crystallize basic effect.
 */
export interface ConvertManaToCrystalEffect {
  readonly type: typeof EFFECT_CONVERT_MANA_TO_CRYSTAL;
}

/**
 * Internal: Final resolution for crystallize - consume token and gain crystal.
 * Generated as dynamic choice options by ConvertManaToCrystalEffect.
 */
export interface CrystallizeColorEffect {
  readonly type: typeof EFFECT_CRYSTALLIZE_COLOR;
  readonly color: BasicManaColor;
}

/**
 * Card boost effect - play another Action card with free powered effect + bonus.
 * Used by Concentration (bonus: 2) and Will Focus (bonus: 3).
 * Triggers a choice from eligible hand cards, then resolves the target's powered effect.
 */
export interface CardBoostEffect {
  readonly type: typeof EFFECT_CARD_BOOST;
  readonly bonus: number; // +2 for Concentration, +3 for Will Focus
}

/**
 * Internal effect used during card boost resolution.
 * Generated dynamically as choice options - one per eligible card in hand.
 * When selected, moves target card to play area and resolves its boosted powered effect.
 */
export interface ResolveBoostTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_BOOST_TARGET;
  readonly targetCardId: CardId;
  readonly bonus: number;
}

/**
 * Ready a unit of a given max level.
 * Used by Rejuvenate, Song of Wind, Herbalists, etc.
 * - maxLevel 1: "Ready a level I unit"
 * - maxLevel 2: "Ready a level I or II unit"
 * - maxLevel 3: "Ready a level I, II, or III unit"
 * - maxLevel 4: "Ready any unit"
 *
 * Targets Spent units only (can't ready an already-ready unit).
 * Wound status is irrelevant - units can be readied whether wounded or not.
 */
export interface ReadyUnitEffect {
  readonly type: typeof EFFECT_READY_UNIT;
  readonly maxLevel: 1 | 2 | 3 | 4;
}

/**
 * Mana Draw/Mana Pull powered effect entry point.
 * Parameterized to handle both cards:
 * - Mana Draw: diceCount=1, tokensPerDie=2 (1 die, 2 tokens same color)
 * - Mana Pull: diceCount=2, tokensPerDie=1 (2 dice, 1 token each)
 *
 * Dice are returned at end of turn WITHOUT rerolling (keep chosen colors).
 */
export interface ManaDrawPoweredEffect {
  readonly type: typeof EFFECT_MANA_DRAW_POWERED;
  readonly diceCount: 1 | 2;
  readonly tokensPerDie: 1 | 2;
}

/**
 * Internal: Player has selected which die to take.
 * Triggers color selection (red, blue, green, white).
 * Tracks already-selected dice for multi-die effects like Mana Pull.
 */
export interface ManaDrawPickDieEffect {
  readonly type: typeof EFFECT_MANA_DRAW_PICK_DIE;
  readonly dieId: SourceDieId;
  /** Current color of the die (for display purposes) */
  readonly dieColor: ManaColor;
  /** Remaining dice to select after this one (for Mana Pull) */
  readonly remainingDiceToSelect: number;
  /** Tokens to grant per die */
  readonly tokensPerDie: 1 | 2;
  /** Die IDs already selected in this effect chain */
  readonly alreadySelectedDieIds: readonly SourceDieId[];
}

/**
 * Internal: Final resolution for one die - set color and gain tokens.
 * For multi-die effects, may chain to another die selection.
 */
export interface ManaDrawSetColorEffect {
  readonly type: typeof EFFECT_MANA_DRAW_SET_COLOR;
  readonly dieId: SourceDieId;
  readonly color: BasicManaColor; // red, blue, green, white only
  /** How many tokens to grant for this die */
  readonly tokensPerDie: 1 | 2;
  /** Remaining dice to select after this one (for Mana Pull) */
  readonly remainingDiceToSelect: number;
  /** Die IDs already selected in this effect chain (excluding current) */
  readonly alreadySelectedDieIds: readonly SourceDieId[];
}

/**
 * Take a wound - add wound card(s) to hand.
 * Used as a cost for powerful spell effects like Fireball and Snowstorm powered.
 * This is NOT combat damage - it bypasses armor and adds wounds directly.
 */
export interface TakeWoundEffect {
  readonly type: typeof EFFECT_TAKE_WOUND;
  readonly amount: number; // Number of wounds to take (usually 1)
}

export interface ApplyModifierEffect {
  readonly type: typeof EFFECT_APPLY_MODIFIER;
  readonly modifier: ModifierEffect;
  readonly duration: ModifierDuration;
  /** Scope for the modifier - defaults to SCOPE_SELF if not specified */
  readonly scope?: ModifierScope;
  /** Optional human-readable description for UI display */
  readonly description?: string;
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

// === Enemy Targeting Effects ===

/**
 * Declarative template for what happens to a targeted enemy.
 * Cleaner than nesting full CardEffect trees.
 */
export interface CombatEnemyTargetTemplate {
  /** Modifiers to apply to the target enemy */
  readonly modifiers?: readonly {
    readonly modifier: ModifierEffect;
    readonly duration: ModifierDuration;
    readonly description?: string;
  }[];
  /** If true, defeat the enemy immediately (for powered versions like Tornado) */
  readonly defeat?: boolean;
}

/**
 * Entry effect for selecting an enemy in combat.
 * Generates dynamicChoiceOptions with one option per eligible enemy.
 * Used by Tremor, Chill, Whirlwind spells.
 */
export interface SelectCombatEnemyEffect {
  readonly type: typeof EFFECT_SELECT_COMBAT_ENEMY;
  /** Template defining what happens to the selected enemy */
  readonly template: CombatEnemyTargetTemplate;
  /** Include defeated enemies as valid targets (default: false) */
  readonly includeDefeated?: boolean;
  /** If set, effect can only be used in this combat phase (e.g., Tornado = attack only) */
  readonly requiredPhase?: CombatPhase;
}

/**
 * Internal effect generated as a choice option after enemy selection.
 * Applies the template to the specific enemy.
 */
export interface ResolveCombatEnemyTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_COMBAT_ENEMY_TARGET;
  readonly enemyInstanceId: string;
  /** Stored for UI display without needing state lookup */
  readonly enemyName: string;
  readonly template: CombatEnemyTargetTemplate;
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
  | ChangeReputationEffect
  | GainCrystalEffect
  | ConvertManaToCrystalEffect
  | CrystallizeColorEffect
  | CardBoostEffect
  | ResolveBoostTargetEffect
  | ReadyUnitEffect
  | ManaDrawPoweredEffect
  | ManaDrawPickDieEffect
  | ManaDrawSetColorEffect
  | TakeWoundEffect
  | ApplyModifierEffect
  | CompoundEffect
  | ChoiceEffect
  | ConditionalEffect
  | ScalingEffect
  | SelectCombatEnemyEffect
  | ResolveCombatEnemyTargetEffect;

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
