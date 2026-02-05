/**
 * Human-readable effect descriptions for UI display
 *
 * Uses a map-based dispatch pattern for extensibility and maintainability.
 */

import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_NOOP,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_PAY_MANA,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_TAKE_WOUND,
  EFFECT_DISCARD_WOUNDS,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_PLACE_SKILL_IN_CENTER,
  EFFECT_DISCARD_FOR_CRYSTAL,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import type { DiscardForCrystalEffect } from "../../types/cards.js";
import type {
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  GainManaEffect,
  DrawCardsEffect,
  ApplyModifierEffect,
  CompoundEffect,
  ChoiceEffect,
  CardBoostEffect,
  ResolveBoostTargetEffect,
  GainCrystalEffect,
  ChangeReputationEffect,
  ReadyUnitEffect,
  ManaDrawPickDieEffect,
  ManaDrawSetColorEffect,
  PayManaEffect,
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  TakeWoundEffect,
  DiscardWoundsEffect,
  TrackAttackDefeatFameEffect,
} from "../../types/effectTypes.js";
import { getCard } from "../validActions/cards/index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function for generating effect descriptions.
 * Each handler receives the effect and returns a human-readable string.
 */
type DescriptionHandler<T extends CardEffect = CardEffect> = (effect: T) => string;

/**
 * Effect type discriminator string
 */
type EffectType = CardEffect["type"];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a number to Roman numeral (1-4 range)
 */
function toRomanNumeral(n: number): string {
  const numerals: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
  };
  return numerals[n] ?? String(n);
}

/**
 * Format attack type based on combat type
 */
function formatAttackType(combatType?: string): string {
  if (combatType === COMBAT_TYPE_RANGED) return "Ranged Attack";
  if (combatType === COMBAT_TYPE_SIEGE) return "Siege Attack";
  return "Attack";
}

// ============================================================================
// DESCRIPTION HANDLERS
// ============================================================================

/**
 * Description handlers registry.
 * Maps effect types to their description generator functions.
 */
const descriptionHandlers: Partial<Record<EffectType, DescriptionHandler>> = {
  [EFFECT_GAIN_MOVE]: (effect) => {
    const e = effect as GainMoveEffect;
    return `Move ${e.amount}`;
  },

  [EFFECT_GAIN_INFLUENCE]: (effect) => {
    const e = effect as GainInfluenceEffect;
    return `Influence ${e.amount}`;
  },

  [EFFECT_GAIN_ATTACK]: (effect) => {
    const e = effect as GainAttackEffect;
    return `${formatAttackType(e.combatType)} ${e.amount}`;
  },

  [EFFECT_GAIN_BLOCK]: (effect) => {
    const e = effect as GainBlockEffect;
    if (e.element) {
      const elementName = e.element.charAt(0).toUpperCase() + e.element.slice(1);
      return `${elementName} Block ${e.amount}`;
    }
    return `Block ${e.amount}`;
  },

  [EFFECT_GAIN_HEALING]: (effect) => {
    const e = effect as GainHealingEffect;
    return `Healing ${e.amount}`;
  },

  [EFFECT_GAIN_MANA]: (effect) => {
    const e = effect as GainManaEffect;
    return `Gain ${e.color} mana`;
  },

  [EFFECT_DRAW_CARDS]: (effect) => {
    const e = effect as DrawCardsEffect;
    return e.amount === 1 ? "Draw 1 card" : `Draw ${e.amount} cards`;
  },

  [EFFECT_NOOP]: () => "No additional effect",

  [EFFECT_APPLY_MODIFIER]: (effect) => {
    const e = effect as ApplyModifierEffect;
    return e.description ?? "Apply modifier";
  },

  [EFFECT_COMPOUND]: (effect) => {
    const e = effect as CompoundEffect;
    return e.effects.map(describeEffect).join(", ");
  },

  [EFFECT_CHOICE]: (effect) => {
    const e = effect as ChoiceEffect;
    return e.options.map(describeEffect).join(" OR ");
  },

  [EFFECT_CARD_BOOST]: (effect) => {
    const e = effect as CardBoostEffect;
    return `Boost another Action card (+${e.bonus})`;
  },

  [EFFECT_RESOLVE_BOOST_TARGET]: (effect) => {
    const e = effect as ResolveBoostTargetEffect;
    const targetCard = getCard(e.targetCardId);
    const cardName = targetCard?.name ?? e.targetCardId;
    return `Boost ${cardName} (+${e.bonus})`;
  },

  [EFFECT_GAIN_CRYSTAL]: (effect) => {
    const e = effect as GainCrystalEffect;
    return `Gain ${e.color} crystal`;
  },

  [EFFECT_CONVERT_MANA_TO_CRYSTAL]: () => "Convert mana to crystal",

  [EFFECT_CHANGE_REPUTATION]: (effect) => {
    const e = effect as ChangeReputationEffect;
    return e.amount >= 0 ? `Reputation +${e.amount}` : `Reputation ${e.amount}`;
  },

  [EFFECT_READY_UNIT]: (effect) => {
    const e = effect as ReadyUnitEffect;
    const levels = Array.from({ length: e.maxLevel }, (_, i) => toRomanNumeral(i + 1)).join("/");
    return `Ready a Level ${levels} Unit`;
  },

  [EFFECT_MANA_DRAW_POWERED]: () => "Take a die, set its color, gain 2 mana",

  [EFFECT_MANA_DRAW_PICK_DIE]: (effect) => {
    const e = effect as ManaDrawPickDieEffect;
    return `Take ${e.dieColor} die`;
  },

  [EFFECT_MANA_DRAW_SET_COLOR]: (effect) => {
    const e = effect as ManaDrawSetColorEffect;
    return `Set die to ${e.color}, gain 2 ${e.color} mana`;
  },

  [EFFECT_PAY_MANA]: (effect) => {
    const e = effect as PayManaEffect;
    const colorLabel = e.colors.length === 1 ? e.colors[0] : e.colors.join("/");
    return `Pay ${e.amount} ${colorLabel} mana`;
  },

  [EFFECT_SELECT_COMBAT_ENEMY]: (effect) => {
    const e = effect as SelectCombatEnemyEffect;
    return e.template.defeat ? "Defeat target enemy" : "Target an enemy";
  },

  [EFFECT_RESOLVE_COMBAT_ENEMY_TARGET]: (effect) => {
    const e = effect as ResolveCombatEnemyTargetEffect;
    if (e.template.defeat) {
      return `Defeat ${e.enemyName}`;
    }
    const modDescriptions = e.template.modifiers
      ?.map((m) => m.description)
      .filter((desc): desc is string => Boolean(desc))
      .map((desc) => desc.replace(/[Tt]arget enemy/g, e.enemyName))
      .join(", ");
    return modDescriptions || `Target ${e.enemyName}`;
  },

  [EFFECT_TERRAIN_BASED_BLOCK]: () => "Block (terrain cost, Fire/Ice)",

  [EFFECT_TAKE_WOUND]: (effect) => {
    const e = effect as TakeWoundEffect;
    return e.amount === 1 ? "Take 1 wound" : `Take ${e.amount} wounds`;
  },

  [EFFECT_DISCARD_WOUNDS]: (effect) => {
    const e = effect as DiscardWoundsEffect;
    return e.count === 1 ? "Discard 1 Wound" : `Discard ${e.count} Wounds`;
  },

  [EFFECT_PLACE_SKILL_IN_CENTER]: () => "Place skill in center",

  [EFFECT_TRACK_ATTACK_DEFEAT_FAME]: (effect) => {
    const e = effect as TrackAttackDefeatFameEffect;
    return `Fame +${e.fame} if this ${formatAttackType(e.combatType)} defeats an enemy`;
  },

  [EFFECT_DISCARD_FOR_CRYSTAL]: (effect) => {
    const e = effect as DiscardForCrystalEffect;
    return e.optional
      ? "Optionally discard a card to gain a crystal"
      : "Discard a card to gain a crystal";
  },
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert a card effect to a human-readable description.
 *
 * Used for:
 * - CHOICE_REQUIRED event options
 * - CHOICE_RESOLVED event effect description
 * - General effect logging
 */
export function describeEffect(effect: CardEffect): string {
  const handler = descriptionHandlers[effect.type];
  if (handler) {
    return handler(effect);
  }
  return "Unknown effect";
}
