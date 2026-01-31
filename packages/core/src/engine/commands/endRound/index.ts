/**
 * End Round Command
 *
 * Handles the round transition. This command is triggered automatically
 * after all final turns are complete.
 *
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
 *
 * @module commands/endRound
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  ROUND_ENDED,
  NEW_ROUND_STARTED,
  ROUND_PHASE_TACTICS_SELECTION,
} from "@mage-knight/shared";
import { END_ROUND_COMMAND } from "../commandTypes.js";
import { SYSTEM_PLAYER_ID } from "../../engineConstants.js";

import { checkGameEnd } from "./gameEnd.js";
import { processTimeTransition } from "./timeTransition.js";
import { processManaReset } from "./manaReset.js";
import { processOfferRefresh } from "./offerRefresh.js";
import { processPlayerRoundReset } from "./playerRoundReset.js";
import { processTacticsSetup } from "./tacticsSetup.js";

export { END_ROUND_COMMAND };

export function createEndRoundCommand(): Command {
  return {
    type: END_ROUND_COMMAND,
    playerId: SYSTEM_PLAYER_ID, // This is a system-triggered command
    isReversible: false, // Cannot undo round transitions

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];
      const oldRound = state.round;

      // 1. Check if game should end (round ends during final turns)
      const gameEndCheck = checkGameEnd(state, oldRound);
      if (gameEndCheck.gameEnded) {
        return {
          state: {
            ...state,
            ...gameEndCheck.state,
          },
          events: gameEndCheck.events,
        };
      }

      const newRound = oldRound + 1;

      // 2. Round ended event
      events.push({
        type: ROUND_ENDED,
        round: oldRound,
      });

      // 3. Toggle day/night and handle dawn effects
      const timeTransition = processTimeTransition(state);
      events.push(...timeTransition.events);

      // 4. Reset mana source (reroll all dice)
      const manaReset = processManaReset(
        state.players.length,
        timeTransition.newTime,
        state.rng
      );
      events.push(...manaReset.events);

      // 5. Refresh all offers (units, AAs, spells, monastery AAs)
      const offerRefresh = processOfferRefresh(
        state,
        timeTransition.updatedHexes,
        manaReset.rng
      );
      events.push(...offerRefresh.events);

      // 6. Reset all players (shuffle decks, draw hands, ready units)
      const playerReset = processPlayerRoundReset(state, offerRefresh.rng);
      events.push(...playerReset.events);

      // 7. New round started event
      events.push({
        type: NEW_ROUND_STARTED,
        roundNumber: newRound,
        timeOfDay: timeTransition.newTime,
      });

      // 8. Set up tactics selection phase
      const tacticsSetup = processTacticsSetup(
        state,
        playerReset.players,
        timeTransition.newTime
      );

      return {
        state: {
          ...state,
          round: newRound,
          timeOfDay: timeTransition.newTime,
          source: manaReset.source,
          players: playerReset.players,
          rng: playerReset.rng,
          // Updated decks and offers from refresh
          decks: offerRefresh.decks,
          offers: {
            ...state.offers,
            units: offerRefresh.unitOffer,
            advancedActions: offerRefresh.advancedActionOffer,
            spells: offerRefresh.spellOffer,
            monasteryAdvancedActions: offerRefresh.monasteryAdvancedActions,
          },
          // Updated map with revealed ruins tokens (at dawn)
          map: {
            ...state.map,
            hexes: timeTransition.updatedHexes,
          },
          // Reset round-end tracking
          endOfRoundAnnouncedBy: null,
          playersWithFinalTurn: [],
          // Clear any pending cooperative assault proposal
          pendingCooperativeAssault: null,
          // Initialize tactics selection phase
          roundPhase: ROUND_PHASE_TACTICS_SELECTION,
          availableTactics: tacticsSetup.availableTactics,
          removedTactics: tacticsSetup.removedTactics,
          dummyPlayerTactic: tacticsSetup.dummyPlayerTactic,
          tacticsSelectionOrder: tacticsSetup.tacticsSelectionOrder,
          currentTacticSelector: tacticsSetup.currentTacticSelector,
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
