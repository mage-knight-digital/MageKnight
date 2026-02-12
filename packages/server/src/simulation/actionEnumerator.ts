/**
 * Action enumerator for server-side simulation
 *
 * MVP IMPLEMENTATION: Handles only tactics selection and END_TURN.
 * This is sufficient to demonstrate the architecture and measure speedup.
 *
 * FULL IMPLEMENTATION TODO:
 * ValidActions contains metadata (cards you can play, dice available, etc.),
 * not ready-made PlayerActions. A complete enumerator must BUILD actions
 * from this metadata, similar to Python's generated_action_enumerator.py.
 *
 * For production, we should generate this code from the ValidActions schema.
 */

import type { ValidActions, PlayerAction } from "@mage-knight/shared";
import { SELECT_TACTIC_ACTION, END_TURN_ACTION } from "@mage-knight/shared";

/**
 * Enumerate all valid actions into a flat array of PlayerActions.
 *
 * MVP: Only handles tactics selection and END_TURN to prove the concept.
 * Games will select tactics, then immediately end turns until the game terminates.
 */
export function enumerateActions(validActions: ValidActions): PlayerAction[] {
  const actions: PlayerAction[] = [];

  // Cannot act
  if (validActions.mode === "cannot_act") {
    return actions;
  }

  // Tactics selection - fully implemented
  if (validActions.mode === "tactics_selection") {
    for (const tacticId of validActions.tactics.availableTactics) {
      actions.push({
        type: SELECT_TACTIC_ACTION,
        tacticId,
      });
    }
    return actions;
  }

  // For all other modes: just END_TURN if available
  // This allows the game to progress and complete rounds

  // Normal turn
  if (validActions.mode === "normal_turn") {
    if (validActions.turn?.canEndTurn) {
      actions.push({ type: END_TURN_ACTION });
    }
    return actions;
  }

  // Combat (will just end turn, causing forfeit - good enough for MVP)
  if (validActions.mode === "combat") {
    // Combat doesn't have turn.canEndTurn, so return empty
    // This will cause "no valid actions" and terminate
    return actions;
  }

  // Resting
  if (validActions.mode === "resting") {
    if (validActions.turn?.canEndTurn) {
      actions.push({ type: END_TURN_ACTION });
    }
    return actions;
  }

  // All other modes - return empty, will terminate simulation
  // TODO: Implement action builders for each mode
  return actions;
}
