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
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CHANGE_REPUTATION,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { getCard } from "../validActions/cards.js";

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

    case EFFECT_CARD_BOOST:
      return `Boost another Action card (+${effect.bonus})`;

    case EFFECT_RESOLVE_BOOST_TARGET: {
      const targetCard = getCard(effect.targetCardId);
      const cardName = targetCard?.name ?? effect.targetCardId;
      return `Boost ${cardName} (+${effect.bonus})`;
    }

    case EFFECT_GAIN_CRYSTAL:
      return `Gain ${effect.color} crystal`;

    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
      return "Convert mana to crystal";

    case EFFECT_CHANGE_REPUTATION: {
      if (effect.amount >= 0) {
        return `Reputation +${effect.amount}`;
      }
      return `Reputation ${effect.amount}`;
    }

    default:
      return "Unknown effect";
  }
}
