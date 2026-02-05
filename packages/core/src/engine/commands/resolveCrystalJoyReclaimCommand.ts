/**
 * Resolve Crystal Joy card reclaim choice.
 *
 * When a player ends their turn after playing Crystal Joy (basic or powered),
 * they may optionally discard a card from their discard pile to return
 * Crystal Joy from the discard pile to their hand.
 *
 * - Basic version: Only non-wound cards can be discarded for reclaim
 * - Powered version: Any card (including wounds) can be discarded
 *
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import {
  CARD_GOLDYX_CRYSTAL_JOY,
  CARD_RECLAIMED,
  CRYSTAL_JOY_RECLAIM_SKIPPED,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_CRYSTAL_JOY_RECLAIM_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurn/index.js";
import { getCard } from "../validActions/cards/index.js";
import { isCardEligibleForReclaim } from "../rules/crystalJoyReclaim.js";

export { RESOLVE_CRYSTAL_JOY_RECLAIM_COMMAND };

export interface ResolveCrystalJoyReclaimCommandParams {
  readonly playerId: string;
  readonly cardId?: CardId; // Card to discard for reclaim, undefined = skip reclaim
}

export function createResolveCrystalJoyReclaimCommand(
  params: ResolveCrystalJoyReclaimCommandParams
): Command {
  return {
    type: RESOLVE_CRYSTAL_JOY_RECLAIM_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingCrystalJoyReclaim) {
        throw new Error("No pending Crystal Joy reclaim");
      }

      const events: GameEvent[] = [];
      let updatedPlayer: Player = {
        ...player,
        pendingCrystalJoyReclaim: undefined,
      };

      // If cardId is provided, process the reclaim
      if (params.cardId) {
        // Find the card in discard pile
        const discardIndex = player.discard.indexOf(params.cardId);
        if (discardIndex === -1) {
          throw new Error(`Card ${params.cardId} not found in discard pile`);
        }

        // Verify the card is eligible for reclaim (based on version)
        const card = getCard(params.cardId);
        if (!card) {
          throw new Error(`Card not found: ${params.cardId}`);
        }

        const version = player.pendingCrystalJoyReclaim.version;
        if (!isCardEligibleForReclaim(card, version)) {
          throw new Error(
            `Card ${params.cardId} not eligible for ${version} Crystal Joy reclaim`
          );
        }

        // Remove the discarded card from discard pile
        const newDiscard = [
          ...player.discard.slice(0, discardIndex),
          ...player.discard.slice(discardIndex + 1),
        ];

        // Add Crystal Joy to hand
        const newHand = [...player.hand, CARD_GOLDYX_CRYSTAL_JOY];

        updatedPlayer = {
          ...updatedPlayer,
          discard: newDiscard,
          hand: newHand,
        };

        events.push({
          type: CARD_RECLAIMED,
          playerId: params.playerId,
          cardId: CARD_GOLDYX_CRYSTAL_JOY,
          source: "crystal_joy",
        });
      } else {
        // Player chose not to reclaim
        events.push({
          type: CRYSTAL_JOY_RECLAIM_SKIPPED,
          playerId: params.playerId,
        });
      }

      // Update player in state
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === params.playerId ? updatedPlayer : p
        ),
      };

      // Now execute the end turn command to complete turn ending
      // Skip the Crystal Joy reclaim check since we just resolved it
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipCrystalJoyReclaim: true,
      });
      const endTurnResult = endTurnCommand.execute(newState);

      return {
        state: endTurnResult.state,
        events: [...events, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_CRYSTAL_JOY_RECLAIM");
    },
  };
}
