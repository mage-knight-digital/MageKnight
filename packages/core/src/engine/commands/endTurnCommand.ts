/**
 * End turn command - handles ending a player's turn
 *
 * This command is irreversible and:
 * - Clears the command stack (no more undo)
 * - Expires "turn" duration modifiers
 * - Moves play area cards to discard
 * - Draws cards up to hand limit (no mid-round reshuffle)
 * - Resets turn state (hasMovedThisTurn, hasTakenActionThisTurn, movePoints, etc.)
 * - Advances to next player (or triggers round end if final turns complete)
 *
 * Round end is triggered when:
 * - End of round has been announced AND
 * - All other players have taken their final turn (playersWithFinalTurn is empty)
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { createEmptyCombatAccumulator } from "../../types/player.js";
import type { CardId, GameEvent } from "@mage-knight/shared";
import {
  TURN_ENDED,
  LEVEL_UP,
  LEVEL_UP_REWARDS_PENDING,
  COMMAND_SLOT_GAINED,
  getLevelUpType,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
} from "@mage-knight/shared";
import { expireModifiers } from "../modifiers.js";
import { EXPIRATION_TURN_END } from "../modifierConstants.js";
import { END_TURN_COMMAND } from "./commandTypes.js";
import { rerollDie } from "../mana/manaSource.js";
import { createEndRoundCommand } from "./endRoundCommand.js";
import { getEffectiveHandLimit } from "../helpers/handLimitHelpers.js";

export { END_TURN_COMMAND };

export interface EndTurnCommandParams {
  readonly playerId: string;
}

export function createEndTurnCommand(params: EndTurnCommandParams): Command {
  return {
    type: END_TURN_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Ending turn is irreversible

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

      // Step 1: Move play area cards to discard
      const playAreaCards = currentPlayer.playArea;
      const newDiscard = [...currentPlayer.discard, ...playAreaCards];
      const clearedPlayArea: readonly CardId[] = [];

      // Step 2: Draw up to effective hand limit (no mid-round reshuffle if deck empties)
      // Effective hand limit includes keep bonus when on/adjacent to owned keep
      const effectiveLimit = getEffectiveHandLimit(state, params.playerId);
      const currentHandSize = currentPlayer.hand.length;
      const cardsToDraw = Math.max(0, effectiveLimit - currentHandSize);

      const newHand: CardId[] = [...currentPlayer.hand];
      const newDeck: CardId[] = [...currentPlayer.deck];
      let cardsDrawn = 0;

      // Draw cards (stop if deck empties — no mid-round reshuffle)
      for (let i = 0; i < cardsToDraw && newDeck.length > 0; i++) {
        const drawnCard = newDeck.shift();
        if (drawnCard) {
          newHand.push(drawnCard);
          cardsDrawn++;
        }
      }

      // Reset current player's turn state with card flow updates
      const resetPlayer: Player = {
        ...currentPlayer,
        // Existing resets
        movePoints: 0,
        influencePoints: 0,
        hasMovedThisTurn: false,
        hasTakenActionThisTurn: false,
        hasCombattedThisTurn: false, // Reset combat flag for next turn
        pureMana: [],
        usedManaFromSource: false,
        usedDieId: null,
        manaUsedThisTurn: [], // Reset mana tracking for conditional effects
        // Card flow updates
        playArea: clearedPlayArea,
        hand: newHand,
        deck: newDeck,
        discard: newDiscard,
        // Reset combat accumulator
        combatAccumulator: createEmptyCombatAccumulator(),
      };

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = resetPlayer;

      // Reroll the used mana die if player used one this turn
      let updatedSource = state.source;
      let currentRng = state.rng;
      if (currentPlayer.usedDieId) {
        const { source: rerolledSource, rng: newRng } = rerollDie(
          state.source,
          currentPlayer.usedDieId,
          state.timeOfDay,
          currentRng
        );
        // Clear takenByPlayerId for the rerolled die
        const diceWithClearedTaken = rerolledSource.dice.map((die) =>
          die.id === currentPlayer.usedDieId
            ? { ...die, takenByPlayerId: null }
            : die
        );
        updatedSource = { dice: diceWithClearedTaken };
        currentRng = newRng;
      }

      // Expire turn-duration modifiers
      let newState = expireModifiers(
        { ...state, players: updatedPlayers, source: updatedSource, rng: currentRng },
        { type: EXPIRATION_TURN_END, playerId: params.playerId }
      );

      // Check if round end was announced and track final turns
      let updatedPlayersWithFinalTurn = [...state.playersWithFinalTurn];
      let shouldTriggerRoundEnd = false;

      if (state.endOfRoundAnnouncedBy !== null) {
        // Remove this player from the final turn list if they're on it
        updatedPlayersWithFinalTurn = updatedPlayersWithFinalTurn.filter(
          (id) => id !== params.playerId
        );

        // Round ends ONLY when ALL final turns are complete
        // The announcing player's END_TURN does NOT trigger round end
        // (they already forfeited their turn when announcing)
        if (updatedPlayersWithFinalTurn.length === 0) {
          shouldTriggerRoundEnd = true;
        }
      }

      newState = {
        ...newState,
        playersWithFinalTurn: updatedPlayersWithFinalTurn,
      };

      // Determine next player
      let nextPlayerId: string | null = null;

      if (shouldTriggerRoundEnd) {
        // Round is ending - no next player in current round
        nextPlayerId = null;
      } else {
        // Advance to next player
        const nextPlayerIndex =
          (state.currentPlayerIndex + 1) % state.turnOrder.length;
        nextPlayerId = state.turnOrder[nextPlayerIndex] ?? null;

        newState = {
          ...newState,
          currentPlayerIndex: nextPlayerIndex,
        };

        // Give next player their starting move points (TEMPORARY - should come from cards)
        if (nextPlayerId) {
          const nextPlayerIdx = newState.players.findIndex(
            (p) => p.id === nextPlayerId
          );
          if (nextPlayerIdx !== -1) {
            const nextPlayer = newState.players[nextPlayerIdx];
            if (nextPlayer) {
              const updatedNextPlayer: Player = {
                ...nextPlayer,
                movePoints: 4, // TEMPORARY
              };
              const players: Player[] = [...newState.players];
              players[nextPlayerIdx] = updatedNextPlayer;
              newState = { ...newState, players };
            }
          }
        }
      }

      const events: GameEvent[] = [
        {
          type: TURN_ENDED,
          playerId: params.playerId,
          nextPlayerId,
          cardsDiscarded: playAreaCards.length,
          cardsDrawn,
        },
      ];

      // Process pending level ups
      const currentPlayerInNewState = newState.players.find(
        (p) => p.id === params.playerId
      );
      if (
        currentPlayerInNewState &&
        currentPlayerInNewState.pendingLevelUps.length > 0
      ) {
        const levelUpEvents: GameEvent[] = [];
        let levelUpPlayer = { ...currentPlayerInNewState };
        const evenLevels: number[] = [];

        for (const newLevel of currentPlayerInNewState.pendingLevelUps) {
          const levelUpType = getLevelUpType(newLevel);
          const stats = LEVEL_STATS[newLevel];

          // Skip if no stats for this level (shouldn't happen in practice)
          if (!stats) {
            continue;
          }

          // Update base stats
          levelUpPlayer = {
            ...levelUpPlayer,
            level: newLevel,
            armor: stats.armor,
            handLimit: stats.handLimit,
            commandTokens: stats.commandSlots,
          };

          levelUpEvents.push({
            type: LEVEL_UP,
            playerId: params.playerId,
            oldLevel: newLevel - 1,
            newLevel,
            levelUpType,
          });

          if (levelUpType === LEVEL_UP_TYPE_ODD) {
            // Odd levels: immediate stat gains, no choices needed
            levelUpEvents.push({
              type: COMMAND_SLOT_GAINED,
              playerId: params.playerId,
              newTotal: stats.commandSlots,
            });
          } else {
            // Even levels: need player choice for skill + advanced action
            evenLevels.push(newLevel);
          }
        }

        // If there are even levels, emit a pending event for choices
        if (evenLevels.length > 0) {
          levelUpEvents.push({
            type: LEVEL_UP_REWARDS_PENDING,
            playerId: params.playerId,
            pendingLevels: evenLevels,
          });
        }

        // Clear pending level ups
        levelUpPlayer = {
          ...levelUpPlayer,
          pendingLevelUps: [],
        };

        // Update player in state
        const playerIdx = newState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const playersWithLevelUp: Player[] = [...newState.players];
        playersWithLevelUp[playerIdx] = levelUpPlayer;
        newState = { ...newState, players: playersWithLevelUp };

        // Add level up events
        events.push(...levelUpEvents);
      }

      // Trigger round end if all final turns are complete
      if (shouldTriggerRoundEnd) {
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
