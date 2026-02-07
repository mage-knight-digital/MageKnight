/**
 * Resolve Banner of Protection wound removal choice.
 *
 * When a player activates Banner of Protection's powered effect during their
 * turn, at end of turn they may throw away all wounds received this turn.
 *
 * "Received this turn" includes:
 * - Wounds added to hand (combat damage, self-wound effects)
 * - Wounds added to discard (Poisonous, effect-based)
 *
 * Does NOT include wounds drawn from deck or wounds on units.
 *
 * After resolving this choice (remove or skip), the turn ends.
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  BANNER_PROTECTION_WOUNDS_REMOVED,
  BANNER_PROTECTION_SKIPPED,
  CARD_WOUND,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_BANNER_PROTECTION_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurn/index.js";

export { RESOLVE_BANNER_PROTECTION_COMMAND };

export interface ResolveBannerProtectionCommandParams {
  readonly playerId: string;
  readonly removeAll: boolean; // true = throw away all received wounds, false = skip
}

export function createResolveBannerProtectionCommand(
  params: ResolveBannerProtectionCommandParams
): Command {
  return {
    type: RESOLVE_BANNER_PROTECTION_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingBannerProtectionChoice) {
        throw new Error("No pending Banner of Protection choice");
      }

      const events: GameEvent[] = [];
      let updatedPlayer: Player = {
        ...player,
        pendingBannerProtectionChoice: false,
      };

      if (params.removeAll) {
        const { hand: woundsFromHand, discard: woundsFromDiscard } =
          player.woundsReceivedThisTurn;

        // Remove received wounds from hand
        let newHand = [...updatedPlayer.hand];
        let removedFromHand = 0;
        for (let i = 0; i < woundsFromHand; i++) {
          const woundIndex = newHand.indexOf(CARD_WOUND);
          if (woundIndex !== -1) {
            newHand = [
              ...newHand.slice(0, woundIndex),
              ...newHand.slice(woundIndex + 1),
            ];
            removedFromHand++;
          }
        }

        // Remove received wounds from discard
        let newDiscard = [...updatedPlayer.discard];
        let removedFromDiscard = 0;
        for (let i = 0; i < woundsFromDiscard; i++) {
          const woundIndex = newDiscard.indexOf(CARD_WOUND);
          if (woundIndex !== -1) {
            newDiscard = [
              ...newDiscard.slice(0, woundIndex),
              ...newDiscard.slice(woundIndex + 1),
            ];
            removedFromDiscard++;
          }
        }

        updatedPlayer = {
          ...updatedPlayer,
          hand: newHand,
          discard: newDiscard,
        };

        // Return removed wounds to the wound pile
        const totalRemoved = removedFromHand + removedFromDiscard;
        let newWoundPileCount = state.woundPileCount;
        if (newWoundPileCount !== null && totalRemoved > 0) {
          newWoundPileCount = newWoundPileCount + totalRemoved;
        }

        // Update wound pile in state before continuing
        state = {
          ...state,
          woundPileCount: newWoundPileCount,
        };

        if (removedFromHand > 0 || removedFromDiscard > 0) {
          events.push({
            type: BANNER_PROTECTION_WOUNDS_REMOVED,
            playerId: params.playerId,
            fromHand: removedFromHand,
            fromDiscard: removedFromDiscard,
          });
        }
      } else {
        events.push({
          type: BANNER_PROTECTION_SKIPPED,
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
      // Skip the banner protection check since we just resolved it
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipBannerProtection: true,
      });
      const endTurnResult = endTurnCommand.execute(newState);

      return {
        state: endTurnResult.state,
        events: [...events, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_BANNER_PROTECTION");
    },
  };
}
