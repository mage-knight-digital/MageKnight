/**
 * Card value modifier effective value calculations
 *
 * Functions for calculating effective sideways card values and
 * checking active rule overrides.
 */

import type { GameState } from "../../state/GameState.js";
import type {
  SidewaysValueModifier,
  RuleOverrideModifier,
  MovementCardBonusModifier,
} from "../../types/modifiers.js";
import type { DeedCardType } from "../../types/cards.js";
import {
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  EFFECT_MOVEMENT_CARD_BONUS,
  SIDEWAYS_CONDITION_NO_MANA_USED,
  SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
} from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";

/**
 * Get effective sideways card value for a player.
 */
export function getEffectiveSidewaysValue(
  state: GameState,
  playerId: string,
  isWound: boolean,
  manaUsedThisTurn: boolean,
  manaColorMatchesCard?: boolean,
  cardType?: DeedCardType
): number {
  const baseValue = 1;

  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_SIDEWAYS_VALUE)
    .map((m) => m.effect as SidewaysValueModifier);

  let bestValue = baseValue;

  for (const mod of modifiers) {
    // Check if this modifier applies to the card type
    // forWounds=false: only applies to non-wound cards
    // forWounds=true: only applies to wound cards
    if (isWound && !mod.forWounds) continue;
    if (!isWound && mod.forWounds) continue;

    // Check card type filter (e.g., AA/Spell/Artifact only)
    if (mod.forCardTypes && cardType && !mod.forCardTypes.includes(cardType)) {
      continue;
    }

    if (mod.condition === SIDEWAYS_CONDITION_NO_MANA_USED && manaUsedThisTurn)
      continue;

    if (
      mod.condition === SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR &&
      !manaColorMatchesCard
    )
      continue;

    bestValue = Math.max(bestValue, mod.newValue);
  }

  return bestValue;
}

/**
 * Check if a rule override is active for a player.
 */
export function isRuleActive(
  state: GameState,
  playerId: string,
  rule: RuleOverrideModifier["rule"]
): boolean {
  return getModifiersForPlayer(state, playerId).some(
    (m) => m.effect.type === EFFECT_RULE_OVERRIDE && m.effect.rule === rule
  );
}

/**
 * Count how many instances of a rule override are active for a player.
 * Used when multiple stacked modifiers of the same rule have cumulative effect
 * (e.g., Mana Storm grants 3 extra source dice via 3 RULE_EXTRA_SOURCE_DIE modifiers).
 */
export function countRuleActive(
  state: GameState,
  playerId: string,
  rule: RuleOverrideModifier["rule"]
): number {
  return getModifiersForPlayer(state, playerId).filter(
    (m) => m.effect.type === EFFECT_RULE_OVERRIDE && m.effect.rule === rule
  ).length;
}

/**
 * Consume active movement card bonus modifiers for a player.
 * Returns the total bonus and updated state (modifiers decremented/removed).
 */
export function consumeMovementCardBonus(
  state: GameState,
  playerId: string,
  eligibleModifierIds?: ReadonlySet<string>
): { state: GameState; bonus: number } {
  const applicableModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_MOVEMENT_CARD_BONUS)
    .filter((m) => (eligibleModifierIds ? eligibleModifierIds.has(m.id) : true));

  if (applicableModifiers.length === 0) {
    return { state, bonus: 0 };
  }

  let bonus = 0;
  for (const modifier of applicableModifiers) {
    const effect = modifier.effect as MovementCardBonusModifier;
    if (effect.remaining !== undefined && effect.remaining <= 0) {
      continue;
    }
    bonus += effect.amount;
  }

  if (bonus === 0) {
    return { state, bonus: 0 };
  }

  const applicableIds = new Set(applicableModifiers.map((m) => m.id));
  const updatedActiveModifiers = state.activeModifiers.flatMap((modifier) => {
    if (!applicableIds.has(modifier.id)) {
      return [modifier];
    }

    const effect = modifier.effect as MovementCardBonusModifier;
    if (effect.remaining === undefined) {
      return [modifier];
    }

    if (effect.remaining <= 1) {
      return [];
    }

    return [
      {
        ...modifier,
        effect: { ...effect, remaining: effect.remaining - 1 },
      },
    ];
  });

  return {
    state: { ...state, activeModifiers: updatedActiveModifiers },
    bonus,
  };
}
