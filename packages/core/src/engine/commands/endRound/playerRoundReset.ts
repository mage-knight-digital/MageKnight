/**
 * Player Round Reset for End Round
 *
 * Handles resetting all players' state for the new round:
 * - Shuffle all cards into deck
 * - Draw fresh hands
 * - Ready all units
 * - Reset turn state
 *
 * @module commands/endRound/playerRoundReset
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import { createEmptyCombatAccumulator } from "../../../types/player.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import { DECKS_RESHUFFLED, UNITS_READIED } from "@mage-knight/shared";
import type { RngState } from "../../../utils/rng.js";
import { shuffleWithRng } from "../../../utils/rng.js";
import { readyAllUnits } from "../../../types/unit.js";
import { UNIT_MAGIC_FAMILIARS } from "@mage-knight/shared";
import { getEffectiveHandLimit } from "../../helpers/handLimitHelpers.js";
import { BANNERS_RESET } from "@mage-knight/shared";
import type { PlayerRoundResetResult } from "./types.js";

/**
 * Reset all players for the new round.
 * Shuffles decks, draws fresh hands, readies units, and resets turn state.
 */
export function processPlayerRoundReset(
  state: GameState,
  rng: RngState
): PlayerRoundResetResult {
  const events: GameEvent[] = [];
  let currentRng: RngState = rng;
  const updatedPlayers: Player[] = [];

  for (const player of state.players) {
    // Ready all units (including wounded)
    const readiedUnits = readyAllUnits(player.units);

    // Shuffle all cards (hand + discard + play area + deck + set-aside) into deck
    // Filter out removed cards (destroyed artifacts, etc.)
    const allCards: CardId[] = [
      ...player.hand,
      ...player.discard,
      ...player.playArea,
      ...player.deck,
      ...player.timeBendingSetAsideCards,
    ].filter((cardId) => !player.removedCards.includes(cardId));

    const { result: shuffled, rng: rngAfterShuffle } = shuffleWithRng(
      allCards,
      currentRng
    );
    currentRng = rngAfterShuffle;

    // Draw up to effective hand limit (includes keep bonus when near owned keep)
    const effectiveLimit = getEffectiveHandLimit(state, player.id);
    const newHand = shuffled.slice(0, effectiveLimit);
    const newDeck = shuffled.slice(effectiveLimit);

    // Check for Magic Familiars requiring maintenance
    const familiarsUnits = readiedUnits.filter(
      (u) => u.unitId === UNIT_MAGIC_FAMILIARS
    );

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
      pendingAttackDefeatFame: [],
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
      // Set maintenance pending for Magic Familiars
      pendingUnitMaintenance: familiarsUnits.length > 0
        ? familiarsUnits.map((u) => ({
            unitInstanceId: u.instanceId,
            unitId: u.unitId,
          }))
        : null,
      // Reset cooperative assault state for new round
      roundOrderTokenFlipped: false,
      // Reset Time Bending state for new round
      isTimeBentTurn: false,
      timeBendingSetAsideCards: [],
      // Reset banner usage for new round (banners stay attached)
      attachedBanners: player.attachedBanners.map((b) => ({
        ...b,
        isUsedThisRound: false,
      })),
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

    if (player.attachedBanners.length > 0) {
      events.push({
        type: BANNERS_RESET,
        playerId: player.id,
        bannerCount: player.attachedBanners.length,
      });
    }
  }

  return {
    players: updatedPlayers,
    rng: currentRng,
    events,
  };
}
