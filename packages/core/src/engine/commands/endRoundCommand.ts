/**
 * End Round command - handles the round transition
 *
 * This command is triggered automatically after all final turns are complete.
 * It handles:
 * - Round ended event
 * - Day/Night toggle
 * - Mana source reset (reroll all dice)
 * - Ready all units (including wounded)
 * - Reshuffle all players' cards and draw fresh hands
 * - Start new round event
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  ROUND_ENDED,
  NEW_ROUND_STARTED,
  TIME_OF_DAY_CHANGED,
  MANA_SOURCE_RESET,
  DECKS_RESHUFFLED,
  UNITS_READIED,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { createManaSource } from "../mana/manaSource.js";
import { readyAllUnits } from "../../types/unit.js";
import { shuffleWithRng, type RngState } from "../../utils/index.js";
import { END_ROUND_COMMAND } from "./commandTypes.js";
import { getEffectiveHandLimit } from "../helpers/handLimitHelpers.js";

export { END_ROUND_COMMAND };

export function createEndRoundCommand(): Command {
  return {
    type: END_ROUND_COMMAND,
    playerId: "system", // This is a system-triggered command
    isReversible: false, // Cannot undo round transitions

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];
      const oldRound = state.round;
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

      // 4. Process each player
      let currentRng: RngState = rngAfterSource;
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
          movePoints: 0,
          influencePoints: 0,
          pureMana: [],
          combatAccumulator: {
            attack: { normal: 0, ranged: 0, siege: 0 },
            block: 0,
          },
          // Reset skill cooldowns for new round
          skillCooldowns: {
            ...player.skillCooldowns,
            usedThisRound: [],
            usedThisTurn: [],
          },
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

      return {
        state: {
          ...state,
          round: newRound,
          timeOfDay: newTime,
          source: newSource,
          players: updatedPlayers,
          rng: currentRng,
          // Reset round-end tracking
          endOfRoundAnnouncedBy: null,
          playersWithFinalTurn: [],
          // Reset to first player (defer tactics for now)
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
