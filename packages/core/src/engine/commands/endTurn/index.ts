/**
 * End Turn Command
 *
 * Handles ending a player's turn. This command is irreversible and:
 * - Clears the command stack (no more undo)
 * - Expires "turn" duration modifiers
 * - Moves play area cards to discard
 * - Draws cards up to hand limit (no mid-round reshuffle)
 * - Resets turn state (movePoints, mana, combat accumulator, etc.)
 * - Advances to next player (or triggers round end if final turns complete)
 *
 * @module commands/endTurn
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent } from "@mage-knight/shared";
import { TURN_ENDED, GAME_ENDED } from "@mage-knight/shared";
import { expireModifiers } from "../../modifiers.js";
import { EXPIRATION_TURN_END } from "../../modifierConstants.js";
import { END_TURN_COMMAND } from "../commandTypes.js";
import { createEndRoundCommand } from "../endRoundCommand.js";
import { createAnnounceEndOfRoundCommand } from "../announceEndOfRoundCommand.js";

import type { EndTurnCommandParams } from "./types.js";
import { checkMagicalGladeWound, processMineRewards } from "./siteChecks.js";
import { processCardFlow, getPlayAreaCardCount } from "./cardFlow.js";
import { createResetPlayer } from "./playerReset.js";
import { processDiceReturn } from "./diceManagement.js";
import { determineNextPlayer, setupNextPlayer } from "./turnAdvancement.js";
import { processLevelUps } from "./levelUp.js";

export { END_TURN_COMMAND };
export type { EndTurnCommandParams };

export function createEndTurnCommand(params: EndTurnCommandParams): Command {
  return {
    type: END_TURN_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      // Find current player
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const currentPlayer = state.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Check for Magical Glade wound discard opportunity
      const gladeCheck = checkMagicalGladeWound(
        state,
        currentPlayer,
        params.skipGladeWoundCheck ?? false
      );
      if (gladeCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? gladeCheck.player : p
            ),
          },
          events: [],
        };
      }

      // Auto-announce end of round if deck and hand are both empty
      if (
        currentPlayer.deck.length === 0 &&
        currentPlayer.hand.length === 0 &&
        state.endOfRoundAnnouncedBy === null
      ) {
        return createAnnounceEndOfRoundCommand({ playerId: params.playerId }).execute(state);
      }

      // Check for mine crystal rewards
      const mineCheck = processMineRewards(
        state,
        currentPlayer,
        params.skipDeepMineCheck ?? false
      );
      if (mineCheck.pendingChoice) {
        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? mineCheck.player : p
            ),
          },
          events: [],
        };
      }

      const playerWithCrystal = mineCheck.player;
      const crystalEvents = mineCheck.events;

      // Process card flow (play area to discard, draw cards)
      const playAreaCount = getPlayAreaCardCount(currentPlayer);
      const cardFlow = processCardFlow(state, currentPlayer);

      // Reset player state
      const resetPlayer = createResetPlayer(playerWithCrystal, cardFlow);

      // Update players array
      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = resetPlayer;

      // Process dice (reroll used, return mana draw, handle mana steal)
      const diceResult = processDiceReturn(state, currentPlayer, updatedPlayers);

      // Expire turn-duration modifiers
      let newState = expireModifiers(
        {
          ...state,
          players: diceResult.players,
          source: diceResult.source,
          rng: diceResult.rng,
        },
        { type: EXPIRATION_TURN_END, playerId: params.playerId }
      );

      // Determine next player and track final turns
      const nextPlayerResult = determineNextPlayer(newState, params.playerId);

      newState = {
        ...newState,
        playersWithFinalTurn: nextPlayerResult.playersWithFinalTurn,
        finalTurnsRemaining: nextPlayerResult.finalTurnsRemaining,
        currentPlayerIndex: nextPlayerResult.currentPlayerIndex,
      };

      // Set up next player if not ending round
      let gladeManaEvent: GameEvent | null = null;
      if (
        !nextPlayerResult.shouldTriggerRoundEnd &&
        nextPlayerResult.nextPlayerId
      ) {
        const currentPlayerAfterReset = newState.players.find(
          (p) => p.id === params.playerId
        );
        const isExtraTurn =
          currentPlayerAfterReset?.tacticState?.extraTurnPending === true;

        const setupResult = setupNextPlayer(
          newState,
          nextPlayerResult.nextPlayerId,
          isExtraTurn,
          params.playerId
        );
        newState = { ...newState, players: setupResult.players };
        gladeManaEvent = setupResult.gladeManaEvent;
      }

      // Build events
      const events: GameEvent[] = [
        ...crystalEvents,
        {
          type: TURN_ENDED,
          playerId: params.playerId,
          nextPlayerId: nextPlayerResult.nextPlayerId,
          cardsDiscarded: playAreaCount,
          cardsDrawn: cardFlow.cardsDrawn,
        },
        ...(gladeManaEvent ? [gladeManaEvent] : []),
      ];

      // Process pending level ups
      const playerForLevelUp = newState.players.find(
        (p) => p.id === params.playerId
      );
      if (playerForLevelUp && playerForLevelUp.pendingLevelUps.length > 0) {
        const levelUpResult = processLevelUps(playerForLevelUp, newState.rng);

        const playerIdx = newState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const playersWithLevelUp: Player[] = [...newState.players];
        playersWithLevelUp[playerIdx] = levelUpResult.player;
        newState = {
          ...newState,
          players: playersWithLevelUp,
          rng: levelUpResult.rng,
        };

        events.push(...levelUpResult.events);
      }

      // Trigger game end if scenario final turns complete
      if (nextPlayerResult.shouldTriggerGameEnd) {
        const finalScores = newState.players.map((p) => ({
          playerId: p.id,
          score: p.fame,
        }));
        finalScores.sort((a, b) => b.score - a.score);
        const winningPlayerId = finalScores[0]?.playerId ?? null;

        newState = {
          ...newState,
          gameEnded: true,
          winningPlayerId,
        };

        events.push({
          type: GAME_ENDED,
          winningPlayerId,
          finalScores,
        });

        return { state: newState, events };
      }

      // Trigger round end if all final turns complete
      if (nextPlayerResult.shouldTriggerRoundEnd) {
        const endRoundCommand = createEndRoundCommand();
        const roundEndResult = endRoundCommand.execute(newState);
        return {
          state: roundEndResult.state,
          events: [...events, ...roundEndResult.events],
        };
      }

      return { state: newState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_TURN");
    },
  };
}
