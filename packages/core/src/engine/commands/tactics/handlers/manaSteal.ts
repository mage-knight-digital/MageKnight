/**
 * Mana Steal tactic handler (Day 3)
 *
 * Reserve a basic color die from the source for your exclusive use this round.
 */

import type { GameState } from "../../../../state/GameState.js";
import type { Player } from "../../../../types/player.js";
import type { GameEvent, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import {
  TACTIC_DECISION_MANA_STEAL,
  BASIC_MANA_COLORS,
} from "@mage-knight/shared";
import type { TacticResolutionResult } from "../types.js";

/**
 * Type for Mana Steal decision
 */
export type ManaStealDecision = Extract<
  ResolveTacticDecisionPayload,
  { type: typeof TACTIC_DECISION_MANA_STEAL }
>;

/**
 * Validate Mana Steal decision
 */
export function validateManaSteal(
  state: GameState,
  _player: Player,
  decision: ManaStealDecision
): string | null {
  const die = state.source.dice.find((d) => d.id === decision.dieId);

  if (!die) {
    return `Die ${decision.dieId} not found in source`;
  }

  if (die.takenByPlayerId !== null) {
    return `Die ${decision.dieId} is already taken`;
  }

  if (die.isDepleted) {
    return `Cannot steal depleted die`;
  }

  if (!BASIC_MANA_COLORS.includes(die.color as typeof BASIC_MANA_COLORS[number])) {
    return `Can only steal basic color dice (red, blue, green, white)`;
  }

  return null;
}

/**
 * Resolve Mana Steal decision
 *
 * Mark the die as taken by this player and store the die info in tactic state.
 */
export function resolveManaSteal(
  state: GameState,
  player: Player,
  decision: ManaStealDecision
): TacticResolutionResult {
  const events: GameEvent[] = [];
  const die = state.source.dice.find((d) => d.id === decision.dieId);

  if (!die) {
    // This shouldn't happen if validation passed, but handle gracefully
    return { updatedState: state, events };
  }

  // Mark the die as taken by this player in the source
  const updatedDice = state.source.dice.map((d) =>
    d.id === decision.dieId ? { ...d, takenByPlayerId: player.id } : d
  );

  // Store the die info in the player's tactic state
  const updatedPlayers: Player[] = state.players.map((p) =>
    p.id === player.id
      ? {
          ...p,
          tacticState: {
            ...p.tacticState,
            storedManaDie: {
              dieId: die.id,
              color: die.color,
            },
          },
          pendingTacticDecision: null,
        }
      : p
  );

  const updatedState = {
    ...state,
    source: { dice: updatedDice },
    players: updatedPlayers,
  };

  return { updatedState, events };
}

/**
 * Type guard to check if a decision is a Mana Steal decision
 */
export function isManaStealDecision(
  decision: { type: string }
): decision is ManaStealDecision {
  return decision.type === TACTIC_DECISION_MANA_STEAL;
}
