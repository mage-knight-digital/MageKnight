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
} from "../../types/modifiers.js";
import {
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  SIDEWAYS_CONDITION_NO_MANA_USED,
  SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
} from "../modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";

/**
 * Get effective sideways card value for a player.
 */
export function getEffectiveSidewaysValue(
  state: GameState,
  playerId: string,
  isWound: boolean,
  manaUsedThisTurn: boolean,
  manaColorMatchesCard?: boolean
): number {
  const baseValue = 1;

  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_SIDEWAYS_VALUE)
    .map((m) => m.effect as SidewaysValueModifier);

  let bestValue = baseValue;

  for (const mod of modifiers) {
    // Check if this modifier applies
    if (isWound && !mod.forWounds) continue;

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
