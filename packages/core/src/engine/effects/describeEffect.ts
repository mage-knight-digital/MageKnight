/**
 * Human-readable effect descriptions for UI display
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
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";

/**
 * Convert a card effect to a human-readable description.
 *
 * Used for:
 * - CHOICE_REQUIRED event options
 * - CHOICE_RESOLVED event effect description
 * - General effect logging
 */
export function describeEffect(effect: CardEffect): string {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return `Move ${effect.amount}`;

    case EFFECT_GAIN_INFLUENCE:
      return `Influence ${effect.amount}`;

    case EFFECT_GAIN_ATTACK: {
      const attackType =
        effect.combatType === COMBAT_TYPE_RANGED
          ? "Ranged Attack"
          : effect.combatType === COMBAT_TYPE_SIEGE
            ? "Siege Attack"
            : "Attack";
      return `${attackType} ${effect.amount}`;
    }

    case EFFECT_GAIN_BLOCK:
      return `Block ${effect.amount}`;

    case EFFECT_GAIN_HEALING:
      return `Healing ${effect.amount}`;

    case EFFECT_GAIN_MANA:
      return `Gain ${effect.color} mana`;

    case EFFECT_DRAW_CARDS:
      return effect.amount === 1
        ? "Draw 1 card"
        : `Draw ${effect.amount} cards`;

    case EFFECT_APPLY_MODIFIER:
      return "Apply modifier";

    case EFFECT_COMPOUND: {
      const descriptions = effect.effects.map(describeEffect);
      return descriptions.join(", ");
    }

    case EFFECT_CHOICE: {
      const optionDescriptions = effect.options.map(describeEffect);
      return optionDescriptions.join(" OR ");
    }

    default:
      return "Unknown effect";
  }
}
