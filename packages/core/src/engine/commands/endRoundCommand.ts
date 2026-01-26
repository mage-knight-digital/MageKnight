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
  OFFER_TYPE_ADVANCED_ACTIONS,
  OFFER_TYPE_SPELLS,
  TACTIC_REMOVAL_ALL_USED,
} from "@mage-knight/shared";
import { createManaSource } from "../mana/manaSource.js";
import { readyAllUnits } from "../../types/unit.js";
import { shuffleWithRng, type RngState } from "../../utils/index.js";
import { END_ROUND_COMMAND } from "./commandTypes.js";
import { getEffectiveHandLimit } from "../helpers/handLimitHelpers.js";
import { refreshUnitOffer } from "../../data/unitDeckSetup.js";
import { refreshAdvancedActionOffer } from "../../data/advancedActionDeckSetup.js";
import { refreshSpellOffer } from "../../data/spellDeckSetup.js";
import { CORE_TILE_ID_PREFIX, SYSTEM_PLAYER_ID } from "../engineConstants.js";
import { revealRuinsToken } from "../helpers/ruinsTokenHelpers.js";
import { countUnburnedMonasteries } from "../helpers/monasteryHelpers.js";
import type { HexState } from "../../types/map.js";

/**
 * Check if any core tile has been revealed on the map.
 * Core tiles have IDs starting with "core_" or are in the Core* enum values.
 */
function hasCoreTileRevealed(state: GameState): boolean {
  for (const tile of state.map.tiles) {
    if (tile.revealed && tile.tileId.startsWith(CORE_TILE_ID_PREFIX)) {
      return true;
    }
  }
  return false;
}

export { END_ROUND_COMMAND };

export function createEndRoundCommand(): Command {
  return {
    type: END_ROUND_COMMAND,
    playerId: SYSTEM_PLAYER_ID, // This is a system-triggered command
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

      // 2b. Reveal any face-down ruins tokens at dawn (Night → Day)
      let updatedHexes = state.map.hexes;
      if (newTime === TIME_OF_DAY_DAY) {
        const hexEntries = Object.entries(state.map.hexes);
        let hasUnrevealedRuins = false;

        for (const [, hex] of hexEntries) {
          if (hex.ruinsToken && !hex.ruinsToken.isRevealed) {
            hasUnrevealedRuins = true;
            break;
          }
        }

        if (hasUnrevealedRuins) {
          updatedHexes = {};
          for (const [key, hex] of hexEntries) {
            if (hex.ruinsToken && !hex.ruinsToken.isRevealed) {
              updatedHexes[key] = {
                ...hex,
                ruinsToken: revealRuinsToken(hex.ruinsToken),
              } as HexState;
            } else {
              updatedHexes[key] = hex;
            }
          }
        }
      }

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

      // 4b. Refresh Advanced Action offer
      const { offer: refreshedAAOffer, deck: refreshedAADeck } =
        refreshAdvancedActionOffer(
          state.offers.advancedActions,
          refreshedDecks.advancedActions
        );

      events.push({
        type: OFFER_REFRESHED,
        offerType: OFFER_TYPE_ADVANCED_ACTIONS,
      });

      // 4c. Refresh Spell offer
      const { offer: refreshedSpellOffer, deck: refreshedSpellDeck } =
        refreshSpellOffer(state.offers.spells, refreshedDecks.spells);

      events.push({
        type: OFFER_REFRESHED,
        offerType: OFFER_TYPE_SPELLS,
      });

      // 4d. Refresh Monastery AA offer
      // Per rulebook: "If there are some Advanced Action cards in the Unit offer,
      // put them to the bottom of the Advanced Action deck."
      // Then: "If there are any monasteries on the map, add one Advanced Action
      // card to the Unit offer for each monastery that has not been burned."

      // Return old monastery AAs to bottom of AA deck
      let currentAADeck = [...refreshedAADeck];
      for (const oldAA of state.offers.monasteryAdvancedActions) {
        currentAADeck.push(oldAA);
      }

      // Count unburned monasteries on the map
      const hexArray = Object.values(updatedHexes);
      const unburnedMonasteryCount = countUnburnedMonasteries(hexArray);

      // Draw new monastery AAs (one per unburned monastery)
      const newMonasteryAAs: CardId[] = [];
      for (let i = 0; i < unburnedMonasteryCount && currentAADeck.length > 0; i++) {
        const [drawnAA, ...remainingDeck] = currentAADeck;
        if (drawnAA !== undefined) {
          newMonasteryAAs.push(drawnAA);
          currentAADeck = remainingDeck;
        }
      }

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
          usedDieIds: [],
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
          tacticState: {},
          pendingTacticDecision: null,
          beforeTurnTacticPending: false,
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

      // 6. Collect tactics used this round and update removedTactics
      const usedTacticsThisRound: TacticId[] = [];
      for (const player of state.players) {
        if (player.selectedTactic !== null) {
          usedTacticsThisRound.push(player.selectedTactic);
        }
      }
      if (state.dummyPlayerTactic !== null) {
        usedTacticsThisRound.push(state.dummyPlayerTactic);
      }

      // Update removed tactics based on scenario config
      let updatedRemovedTactics = [...state.removedTactics];
      if (state.scenarioConfig.tacticRemovalMode === TACTIC_REMOVAL_ALL_USED) {
        // Solo mode: All used tactics are removed from the game
        updatedRemovedTactics = [...updatedRemovedTactics, ...usedTacticsThisRound];
      }
      // Note: TACTIC_REMOVAL_VOTE_ONE (co-op) would require a separate phase - not implemented yet

      // 7. Set up tactics selection phase
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

      // Get tactics for the new time of day, filtering out removed ones
      const allTacticsForTime = getTacticsForTimeOfDay(newTime);
      const availableTactics: readonly TacticId[] = allTacticsForTime.filter(
        (t) => !updatedRemovedTactics.includes(t)
      );
      const firstSelector = tacticsSelectionOrder[0] ?? null;

      return {
        state: {
          ...state,
          round: newRound,
          timeOfDay: newTime,
          source: newSource,
          players: updatedPlayers,
          rng: currentRng,
          // Updated decks and offers from unit/AA/spell/monastery refresh
          decks: {
            ...refreshedDecks,
            advancedActions: currentAADeck,
            spells: refreshedSpellDeck,
          },
          offers: {
            ...state.offers,
            units: refreshedUnitOffer,
            advancedActions: refreshedAAOffer,
            spells: refreshedSpellOffer,
            monasteryAdvancedActions: newMonasteryAAs,
          },
          // Updated map with revealed ruins tokens (at dawn)
          map: {
            ...state.map,
            hexes: updatedHexes,
          },
          // Reset round-end tracking
          endOfRoundAnnouncedBy: null,
          playersWithFinalTurn: [],
          // Initialize tactics selection phase
          roundPhase: ROUND_PHASE_TACTICS_SELECTION,
          availableTactics,
          removedTactics: updatedRemovedTactics,
          dummyPlayerTactic: null, // Reset for new round
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
