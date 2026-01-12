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
 * - Handles scenario-triggered final turns (e.g., city revealed in First Reconnaissance)
 *
 * Round end is triggered when:
 * - End of round has been announced AND
 * - All other players have taken their final turn (playersWithFinalTurn is empty)
 *
 * Game end is triggered when:
 * - Scenario end was triggered (scenarioEndTriggered = true) AND
 * - All final turns are complete (finalTurnsRemaining = 0)
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { createEmptyCombatAccumulator } from "../../types/player.js";
import type { CardId, GameEvent, BasicManaColor } from "@mage-knight/shared";
import {
  TURN_ENDED,
  LEVEL_UP,
  LEVEL_UP_REWARDS_PENDING,
  COMMAND_SLOT_GAINED,
  GAME_ENDED,
  CRYSTAL_GAINED,
  getLevelUpType,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
  TURN_START_MOVE_POINTS,
  TACTIC_SPARING_POWER,
  hexKey,
} from "@mage-knight/shared";
import { SiteType, mineColorToBasicManaColor } from "../../types/map.js";
import { expireModifiers } from "../modifiers.js";
import { EXPIRATION_TURN_END } from "../modifierConstants.js";
import { END_TURN_COMMAND } from "./commandTypes.js";
import { rerollDie } from "../mana/manaSource.js";
import { createEndRoundCommand } from "./endRoundCommand.js";
import { createAnnounceEndOfRoundCommand } from "./announceEndOfRoundCommand.js";
import { getEndTurnDrawLimit } from "../helpers/handLimitHelpers.js";

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

      // If deck and hand are both empty, player MUST announce end of round
      // Auto-convert END_TURN to ANNOUNCE_END_OF_ROUND
      // (Only if end of round hasn't already been announced)
      if (
        currentPlayer.deck.length === 0 &&
        currentPlayer.hand.length === 0 &&
        state.endOfRoundAnnouncedBy === null
      ) {
        return createAnnounceEndOfRoundCommand({ playerId: params.playerId }).execute(state);
      }

      // Crystal Mine check: If player ends turn on a mine, gain a crystal of that color
      // Max 3 crystals per color - if already at max, no crystal gained
      const MAX_CRYSTALS_PER_COLOR = 3;
      let crystalMineEvents: GameEvent[] = [];
      let playerWithCrystal = currentPlayer;
      if (currentPlayer.position) {
        const hex = state.map.hexes[hexKey(currentPlayer.position)];
        if (hex?.site?.type === SiteType.Mine && hex.site.mineColor) {
          const manaColor: BasicManaColor = mineColorToBasicManaColor(hex.site.mineColor);
          const currentCount = currentPlayer.crystals[manaColor];
          // Only grant crystal if under the max
          if (currentCount < MAX_CRYSTALS_PER_COLOR) {
            playerWithCrystal = {
              ...currentPlayer,
              crystals: {
                ...currentPlayer.crystals,
                [manaColor]: currentCount + 1,
              },
            };
            crystalMineEvents = [{
              type: CRYSTAL_GAINED,
              playerId: params.playerId,
              color: manaColor,
              source: "crystal_mine",
            }];
          }
        }
      }

      // Step 1: Move play area cards to discard
      const playAreaCards = currentPlayer.playArea;
      const newDiscard = [...currentPlayer.discard, ...playAreaCards];
      const clearedPlayArea: readonly CardId[] = [];

      // Step 2: Draw up to effective hand limit (no mid-round reshuffle if deck empties)
      // Effective hand limit includes keep bonus + Planning tactic bonus
      const currentHandSize = currentPlayer.hand.length;
      const effectiveLimit = getEndTurnDrawLimit(state, params.playerId, currentHandSize);
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
      // Use playerWithCrystal to include any crystal gained from mines
      const resetPlayer: Player = {
        ...playerWithCrystal,
        // Existing resets
        movePoints: 0,
        influencePoints: 0,
        hasMovedThisTurn: false,
        hasTakenActionThisTurn: false,
        hasCombattedThisTurn: false, // Reset combat flag for next turn
        pureMana: [],
        usedManaFromSource: false,
        usedDieIds: [],
        manaDrawDieIds: [], // Reset Mana Draw/Mana Pull dice tracking
        manaUsedThisTurn: [], // Reset mana tracking for conditional effects
        // Card flow updates
        playArea: clearedPlayArea,
        hand: newHand,
        deck: newDeck,
        discard: newDiscard,
        // Reset combat accumulator
        combatAccumulator: createEmptyCombatAccumulator(),
        // Reset per-turn tactic state (but preserve round-persistent state like storedManaDie)
        tacticState: {
          ...currentPlayer.tacticState,
          manaStealUsedThisTurn: false, // Reset so they can use it next turn if not used this turn
          manaSearchUsedThisTurn: false, // Also reset Mana Search
        },
      };

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = resetPlayer;

      // Reroll dice that were used for powering cards this turn
      let updatedSource = state.source;
      let currentRng = state.rng;
      if (currentPlayer.usedDieIds.length > 0) {
        const usedDieIdSet = new Set(currentPlayer.usedDieIds);
        // Reroll each used die
        for (const dieId of currentPlayer.usedDieIds) {
          const { source: rerolledSource, rng: newRng } = rerollDie(
            updatedSource,
            dieId,
            state.timeOfDay,
            currentRng
          );
          updatedSource = rerolledSource;
          currentRng = newRng;
        }
        // Clear takenByPlayerId for all used dice
        const diceWithClearedTaken = updatedSource.dice.map((die) =>
          usedDieIdSet.has(die.id)
            ? { ...die, takenByPlayerId: null }
            : die
        );
        updatedSource = { dice: diceWithClearedTaken };
      }

      // Handle Mana Draw/Mana Pull dice: return them WITHOUT rerolling (keep their set colors)
      if (currentPlayer.manaDrawDieIds.length > 0) {
        // Just clear the takenByPlayerId for each, don't reroll
        const manaDrawDieIdSet = new Set(currentPlayer.manaDrawDieIds);
        const diceWithManaDrawCleared = updatedSource.dice.map((die) =>
          manaDrawDieIdSet.has(die.id)
            ? { ...die, takenByPlayerId: null }
            : die
        );
        updatedSource = { dice: diceWithManaDrawCleared };
      }

      // Handle Mana Steal: If the stolen die was used this turn, reroll and return it to source
      if (currentPlayer.tacticState.manaStealUsedThisTurn) {
        const storedDie = currentPlayer.tacticState.storedManaDie;
        if (storedDie) {
          // Reroll the die and return it to source
          const { source: rerolledSource, rng: newRng } = rerollDie(
            updatedSource,
            storedDie.dieId,
            state.timeOfDay,
            currentRng
          );
          updatedSource = rerolledSource;
          currentRng = newRng;

          // Clear the takenByPlayerId on the die (return it to source)
          const diceWithStolenCleared = updatedSource.dice.map((die) =>
            die.id === storedDie.dieId
              ? { ...die, takenByPlayerId: null }
              : die
          );
          updatedSource = { dice: diceWithStolenCleared };

          // Clear the stored die from the player (it's been returned)
          const playerIdx = updatedPlayers.findIndex(
            (p) => p.id === params.playerId
          );
          if (playerIdx !== -1) {
            const playerToUpdate = updatedPlayers[playerIdx];
            if (playerToUpdate) {
              // Destructure to omit storedManaDie (exactOptionalPropertyTypes prevents assigning undefined)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { storedManaDie: _, ...restTacticState } = playerToUpdate.tacticState;
              updatedPlayers[playerIdx] = {
                ...playerToUpdate,
                tacticState: {
                  ...restTacticState,
                  manaStealUsedThisTurn: false,
                },
              };
            }
          }
        }
      }

      // Also clear any dice that are still marked as taken by this player
      // (safety net for any edge cases)
      // BUT exclude the Mana Steal stored die - it persists across turns until used or round ends
      const storedManaStealDieId = resetPlayer.tacticState.storedManaDie?.dieId;
      const diceWithAllCleared = updatedSource.dice.map((die) =>
        die.takenByPlayerId === params.playerId && die.id !== storedManaStealDieId
          ? { ...die, takenByPlayerId: null }
          : die
      );
      if (diceWithAllCleared.some((d, i) => d !== updatedSource.dice[i])) {
        updatedSource = { dice: diceWithAllCleared };
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

      // Handle scenario-triggered final turns (e.g., city revealed)
      let updatedFinalTurnsRemaining = state.finalTurnsRemaining;
      let shouldTriggerGameEnd = false;

      if (state.scenarioEndTriggered && updatedFinalTurnsRemaining !== null) {
        updatedFinalTurnsRemaining = updatedFinalTurnsRemaining - 1;

        if (updatedFinalTurnsRemaining <= 0) {
          shouldTriggerGameEnd = true;
        }
      }

      newState = {
        ...newState,
        playersWithFinalTurn: updatedPlayersWithFinalTurn,
        finalTurnsRemaining: updatedFinalTurnsRemaining,
      };

      // Check if current player has "The Right Moment" extra turn pending
      const currentPlayerAfterReset = newState.players.find(
        (p) => p.id === params.playerId
      );
      const hasExtraTurnPending =
        currentPlayerAfterReset?.tacticState?.extraTurnPending === true;

      // Determine next player
      let nextPlayerId: string | null = null;

      if (shouldTriggerRoundEnd) {
        // Round is ending - no next player in current round
        nextPlayerId = null;
      } else if (hasExtraTurnPending) {
        // The Right Moment: Same player takes another turn
        nextPlayerId = params.playerId;

        // Clear the extra turn pending flag and reset per-turn tactic state
        const playerIdx = newState.players.findIndex(
          (p) => p.id === params.playerId
        );
        if (playerIdx !== -1) {
          const playerWithClearedExtra = newState.players[playerIdx];
          if (playerWithClearedExtra) {
            const updatedPlayer: Player = {
              ...playerWithClearedExtra,
              movePoints: TURN_START_MOVE_POINTS,
              tacticState: {
                ...playerWithClearedExtra.tacticState,
                extraTurnPending: false,
                manaSearchUsedThisTurn: false, // Reset for new turn
              },
            };
            const players: Player[] = [...newState.players];
            players[playerIdx] = updatedPlayer;
            newState = { ...newState, players };
          }
        }
        // Don't change currentPlayerIndex - same player continues
      } else {
        // Advance to next player
        const nextPlayerIndex =
          (state.currentPlayerIndex + 1) % state.turnOrder.length;
        nextPlayerId = state.turnOrder[nextPlayerIndex] ?? null;

        newState = {
          ...newState,
          currentPlayerIndex: nextPlayerIndex,
        };

        // Give next player their starting move points and reset per-turn tactic state
        if (nextPlayerId) {
          const nextPlayerIdx = newState.players.findIndex(
            (p) => p.id === nextPlayerId
          );
          if (nextPlayerIdx !== -1) {
            const nextPlayer = newState.players[nextPlayerIdx];
            if (nextPlayer) {
              // Check if Sparing Power before-turn decision is needed
              const needsSparingPowerDecision =
                nextPlayer.selectedTactic === TACTIC_SPARING_POWER &&
                !nextPlayer.tacticFlipped;

              const updatedNextPlayer: Player = {
                ...nextPlayer,
                movePoints: TURN_START_MOVE_POINTS,
                // Reset per-turn tactic state (e.g., Mana Search)
                tacticState: {
                  ...nextPlayer.tacticState,
                  manaSearchUsedThisTurn: false,
                },
                // Set before-turn pending for Sparing Power
                beforeTurnTacticPending: needsSparingPowerDecision,
                pendingTacticDecision: needsSparingPowerDecision
                  ? { type: TACTIC_SPARING_POWER }
                  : nextPlayer.pendingTacticDecision,
              };
              const players: Player[] = [...newState.players];
              players[nextPlayerIdx] = updatedNextPlayer;
              newState = { ...newState, players };
            }
          }
        }
      }

      const events: GameEvent[] = [
        // Crystal mine events come first (gain crystal before turn ends)
        ...crystalMineEvents,
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

      // Trigger game end if scenario final turns are complete
      if (shouldTriggerGameEnd) {
        // Calculate final scores (simplified - just fame for now)
        const finalScores = newState.players.map((p) => ({
          playerId: p.id,
          score: p.fame,
        }));

        // Sort by score descending
        finalScores.sort((a, b) => b.score - a.score);

        // Determine winner (highest score)
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
