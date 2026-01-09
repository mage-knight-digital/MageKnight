/**
 * End Round command - handles the round transition
 *
 * This command is triggered automatically after all final turns are complete.
 * It handles:
 * - Check if scenario end was triggered (game ends immediately if round ends during final turns)
 * - Round ended event
 * - Day/Night toggle
 * - Mana source reset (reroll all dice)
 * - Ready all units (including wounded)
 * - Reshuffle all players' cards and draw fresh hands
 * - Refresh unit offer
 * - Start new round event
 *
 * Rulebook: "If the Round ends during this [final turns], the game ends immediately."
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { createEmptyCombatAccumulator } from "../../types/player.js";
import type { GameEvent, CardId, TacticId } from "@mage-knight/shared";
import {
  ROUND_ENDED,
  NEW_ROUND_STARTED,
  TIME_OF_DAY_CHANGED,
  MANA_SOURCE_RESET,
  DECKS_RESHUFFLED,
  UNITS_READIED,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  GAME_ENDED,
  ROUND_PHASE_TACTICS_SELECTION,
  getTacticsForTimeOfDay,
  OFFER_REFRESHED,
  OFFER_TYPE_UNITS,
} from "@mage-knight/shared";
import { createManaSource } from "../mana/manaSource.js";
import { readyAllUnits } from "../../types/unit.js";
import { shuffleWithRng, type RngState } from "../../utils/index.js";
import { END_ROUND_COMMAND } from "./commandTypes.js";
import { getEffectiveHandLimit } from "../helpers/handLimitHelpers.js";
import { refreshUnitOffer } from "../../data/unitDeckSetup.js";

/**
 * Check if any core tile has been revealed on the map.
 * Core tiles have IDs starting with "core_" or are in the Core* enum values.
 */
function hasCoreTileRevealed(state: GameState): boolean {
  for (const tile of state.map.tiles) {
    if (tile.revealed && tile.tileId.startsWith("core_")) {
      return true;
    }
  }
  return false;
}

export { END_ROUND_COMMAND };

export function createEndRoundCommand(): Command {
  return {
    type: END_ROUND_COMMAND,
    playerId: "system", // This is a system-triggered command
    isReversible: false, // Cannot undo round transitions

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];
      const oldRound = state.round;

      // Check if we're in final turns (scenario end was triggered)
      // Rulebook: "If the Round ends during this [final turns], the game ends immediately."
      if (state.scenarioEndTriggered && state.finalTurnsRemaining !== null && state.finalTurnsRemaining > 0) {
        // Calculate final scores (simplified - just fame for now)
        const finalScores = state.players.map((p) => ({
          playerId: p.id,
          score: p.fame,
        }));

        // Sort by score descending
        finalScores.sort((a, b) => b.score - a.score);

        // Determine winner (highest score)
        const winningPlayerId = finalScores[0]?.playerId ?? null;

        events.push({
          type: ROUND_ENDED,
          round: oldRound,
        });

        events.push({
          type: GAME_ENDED,
          winningPlayerId,
          finalScores,
        });

        return {
          state: {
            ...state,
            finalTurnsRemaining: 0,
            gameEnded: true,
            winningPlayerId,
          },
          events,
        };
      }

      const newRound = oldRound + 1;

      // 1. Round ended event
      events.push({
        type: ROUND_ENDED,
        round: oldRound,
      });

      // 2. Toggle day/night
      const oldTime = state.timeOfDay;
      const newTime = oldTime === TIME_OF_DAY_DAY ? TIME_OF_DAY_NIGHT : TIME_OF_DAY_DAY;

      events.push({
        type: TIME_OF_DAY_CHANGED,
        from: oldTime,
        to: newTime,
      });

      // 3. Reset mana source (reroll all dice)
      const playerCount = state.players.length;
      const { source: newSource, rng: rngAfterSource } = createManaSource(
        playerCount,
        newTime,
        state.rng
      );

      events.push({
        type: MANA_SOURCE_RESET,
        diceCount: newSource.dice.length,
      });

      // 4. Refresh unit offer
      const coreTileRevealed = hasCoreTileRevealed(state);
      const {
        decks: refreshedDecks,
        unitOffer: refreshedUnitOffer,
        rng: rngAfterUnitRefresh,
      } = refreshUnitOffer(
        state.offers.units,
        state.decks,
        playerCount,
        coreTileRevealed,
        state.scenarioConfig.eliteUnitsEnabled,
        rngAfterSource
      );

      events.push({
        type: OFFER_REFRESHED,
        offerType: OFFER_TYPE_UNITS,
      });

      // 5. Process each player
      let currentRng: RngState = rngAfterUnitRefresh;
      const updatedPlayers: Player[] = [];

      for (const player of state.players) {
        // Ready all units (including wounded)
        const readiedUnits = readyAllUnits(player.units);

        // Shuffle all cards (hand + discard + play area + deck) into deck
        const allCards: CardId[] = [
          ...player.hand,
          ...player.discard,
          ...player.playArea,
          ...player.deck,
        ];

        const { result: shuffled, rng: rngAfterShuffle } = shuffleWithRng(
          allCards,
          currentRng
        );
        currentRng = rngAfterShuffle;

        // Draw up to effective hand limit (includes keep bonus when near owned keep)
        const effectiveLimit = getEffectiveHandLimit(state, player.id);
        const newHand = shuffled.slice(0, effectiveLimit);
        const newDeck = shuffled.slice(effectiveLimit);

        const updatedPlayer: Player = {
          ...player,
          units: readiedUnits,
          hand: newHand,
          deck: newDeck,
          discard: [],
          playArea: [],
          // Reset turn state
          hasTakenActionThisTurn: false,
          hasMovedThisTurn: false,
          usedManaFromSource: false,
          usedDieId: null,
          manaDrawDieIds: [],
          movePoints: 0,
          influencePoints: 0,
          pureMana: [],
          combatAccumulator: createEmptyCombatAccumulator(),
          // Reset skill cooldowns for new round
          skillCooldowns: {
            ...player.skillCooldowns,
            usedThisRound: [],
            usedThisTurn: [],
          },
          // Reset tactic selection for new round
          selectedTactic: null,
          tacticFlipped: false,
        };

        updatedPlayers.push(updatedPlayer);

        events.push({
          type: DECKS_RESHUFFLED,
          playerId: player.id,
          cardsInDeck: newDeck.length,
        });

        if (player.units.length > 0) {
          events.push({
            type: UNITS_READIED,
            playerId: player.id,
            unitCount: player.units.length,
          });
        }
      }

      // 5. New round started event
      events.push({
        type: NEW_ROUND_STARTED,
        roundNumber: newRound,
        timeOfDay: newTime,
      });

      // 6. Set up tactics selection phase
      // Selection order is based on Fame (lowest first)
      // Ties are broken by Round Order token position (current turn order)
      const tacticsSelectionOrder = [...updatedPlayers]
        .map((p, turnOrderIndex) => ({
          id: p.id,
          fame: p.fame,
          turnOrderIndex, // Position in turn order for tie-breaking
        }))
        .sort((a, b) => {
          // Sort by fame ascending (lowest fame picks first)
          if (a.fame !== b.fame) {
            return a.fame - b.fame;
          }
          // Tie-breaker: lower turn order position picks first
          return a.turnOrderIndex - b.turnOrderIndex;
        })
        .map((p) => p.id);
      const availableTactics: readonly TacticId[] = getTacticsForTimeOfDay(newTime);
      const firstSelector = tacticsSelectionOrder[0] ?? null;

      return {
        state: {
          ...state,
          round: newRound,
          timeOfDay: newTime,
          source: newSource,
          players: updatedPlayers,
          rng: currentRng,
          // Updated decks and offers from unit refresh
          decks: refreshedDecks,
          offers: {
            ...state.offers,
            units: refreshedUnitOffer,
          },
          // Reset round-end tracking
          endOfRoundAnnouncedBy: null,
          playersWithFinalTurn: [],
          // Initialize tactics selection phase
          roundPhase: ROUND_PHASE_TACTICS_SELECTION,
          availableTactics,
          tacticsSelectionOrder,
          currentTacticSelector: firstSelector,
          // Keep current turn order until tactics phase ends
          // (will be recalculated based on selected tactics)
          currentPlayerIndex: 0,
        },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_ROUND");
    },
  };
}
