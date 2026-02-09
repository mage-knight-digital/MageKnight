/**
 * Card boost effect helpers
 *
 * Card Boost (Concentration card) allows playing another Action card
 * with a bonus applied to its powered effect values.
 *
 * Flow:
 * 1. EFFECT_CARD_BOOST: Find eligible cards, generate choice options
 * 2. Player chooses a card
 * 3. EFFECT_RESOLVE_BOOST_TARGET: Play card, apply bonus, resolve powered effect
 *
 * Note: The actual case handlers remain in resolveEffect.ts because
 * EFFECT_RESOLVE_BOOST_TARGET needs to call resolveEffect recursively.
 * This file contains the pure helper functions.
 */

import type { Player } from "../../types/player.js";
import type { DeedCard, CardEffect, ScalableBaseEffect, ResolveBoostTargetEffect } from "../../types/cards.js";
import { DEED_CARD_TYPE_BASIC_ACTION, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../types/cards.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { getCard } from "../helpers/cardLookup.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_ATTACK_WITH_DEFEAT_BONUS,
} from "../../types/effectTypes.js";

/**
 * Get cards from player's hand that are eligible for boosting.
 * Eligible: Basic Action and Advanced Action cards (not wounds, spells, artifacts).
 */
export function getEligibleBoostTargets(player: Player): DeedCard[] {
  const eligibleCards: DeedCard[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    // Only action cards can be boosted (not spells, artifacts, or wounds)
    if (
      card.cardType === DEED_CARD_TYPE_BASIC_ACTION ||
      card.cardType === DEED_CARD_TYPE_ADVANCED_ACTION
    ) {
      // Wounds have cardType basic_action but id is CARD_WOUND
      if (cardId !== CARD_WOUND) {
        eligibleCards.push(card);
      }
    }
  }

  return eligibleCards;
}

/**
 * Generate dynamic choice options for card boost.
 * Creates one ResolveBoostTargetEffect per eligible card.
 */
export function generateBoostChoiceOptions(
  eligibleCards: DeedCard[],
  bonus: number
): ResolveBoostTargetEffect[] {
  return eligibleCards.map((card) => ({
    type: EFFECT_RESOLVE_BOOST_TARGET,
    targetCardId: card.id,
    bonus,
  }));
}

/**
 * Apply a bonus to an effect's amount (for Move, Influence, Attack, Block).
 * Recursively applies to compound/choice/conditional/scaling effects.
 * Other effect types (heal, draw, mana) are returned unchanged.
 */
export function addBonusToEffect(effect: CardEffect, bonus: number): CardEffect {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
    case EFFECT_GAIN_INFLUENCE:
      return { ...effect, amount: effect.amount + bonus };

    case EFFECT_GAIN_ATTACK:
    case EFFECT_GAIN_BLOCK:
      return { ...effect, amount: effect.amount + bonus };

    case EFFECT_TRACK_ATTACK_DEFEAT_FAME:
    case EFFECT_ATTACK_WITH_DEFEAT_BONUS:
      return { ...effect, amount: effect.amount + bonus };

    case EFFECT_CHOICE:
      return {
        ...effect,
        options: effect.options.map((e) => addBonusToEffect(e, bonus)),
      };

    case EFFECT_COMPOUND:
      return {
        ...effect,
        effects: effect.effects.map((e) => addBonusToEffect(e, bonus)),
      };

    case EFFECT_CONDITIONAL: {
      const result = {
        ...effect,
        thenEffect: addBonusToEffect(effect.thenEffect, bonus),
      };
      if (effect.elseEffect) {
        return { ...result, elseEffect: addBonusToEffect(effect.elseEffect, bonus) };
      }
      return result;
    }

    case EFFECT_SCALING:
      // Apply bonus to the base effect of a scaling effect
      return {
        ...effect,
        baseEffect: addBonusToEffect(effect.baseEffect, bonus) as ScalableBaseEffect,
      };

    // Other effects (heal, draw, mana, etc.) are unchanged
    default:
      return effect;
  }
}
