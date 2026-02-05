/**
 * Resolve Artifact Crystal Color Command
 *
 * Handles player selection of crystal color after discarding an artifact
 * for Savage Harvesting. This is the second step when an artifact is discarded.
 *
 * Flow:
 * 1. Player discarded an artifact via RESOLVE_DISCARD_FOR_CRYSTAL
 * 2. pendingDiscardForCrystal has awaitingColorChoice=true
 * 3. Player sends RESOLVE_ARTIFACT_CRYSTAL_COLOR with chosen color
 * 4. Gain crystal, clear pending state
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { BasicManaColor } from "@mage-knight/shared";
import type { Player, PendingDiscardForCrystal, Crystals } from "../../types/player.js";
import { RESOLVE_ARTIFACT_CRYSTAL_COLOR_COMMAND } from "./commandTypes.js";

export { RESOLVE_ARTIFACT_CRYSTAL_COLOR_COMMAND };

export interface ResolveArtifactCrystalColorCommandParams {
  readonly playerId: string;
  /** Crystal color to gain */
  readonly color: BasicManaColor;
}

export function createResolveArtifactCrystalColorCommand(
  params: ResolveArtifactCrystalColorCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDiscardForCrystal: PendingDiscardForCrystal | null = null;
  let previousCrystals: Crystals | null = null;

  return {
    type: RESOLVE_ARTIFACT_CRYSTAL_COLOR_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Part of normal card play flow

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingDiscardForCrystal) {
        throw new Error("No pending discard-for-crystal to resolve");
      }

      const pending = player.pendingDiscardForCrystal;

      if (!pending.awaitingColorChoice) {
        throw new Error(
          "Not awaiting color choice - card must be discarded first"
        );
      }

      if (!pending.discardedCardId) {
        throw new Error("No card was discarded - invalid state");
      }

      // Store for undo
      previousPendingDiscardForCrystal = pending;
      previousCrystals = player.crystals;

      // Grant crystal of chosen color (capped at 3)
      const updatedCrystals = addCrystal(player.crystals, params.color);

      // Clear pending state
      const updatedPlayer: Player = {
        ...player,
        crystals: updatedCrystals,
        pendingDiscardForCrystal: null,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      // Restore previous state
      const restoredPlayer: Player = {
        ...player,
        crystals: previousCrystals ?? player.crystals,
        pendingDiscardForCrystal: previousPendingDiscardForCrystal,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? restoredPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Add a crystal of the specified color (capped at 3)
 */
function addCrystal(crystals: Crystals, color: BasicManaColor): Crystals {
  const current = crystals[color];
  if (current >= 3) {
    // Already at max - return unchanged
    return crystals;
  }
  return {
    ...crystals,
    [color]: current + 1,
  };
}
