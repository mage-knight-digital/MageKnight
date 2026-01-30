/**
 * Turn Advancement for End Turn
 *
 * Handles determining the next player, tracking final turns,
 * and setting up the next player's turn state.
 *
 * @module commands/endTurn/turnAdvancement
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, SpecialManaColor } from "@mage-knight/shared";
import {
  hexKey,
  TURN_START_MOVE_POINTS,
  TACTIC_SPARING_POWER,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  MANA_TOKEN_SOURCE_SITE,
  GLADE_MANA_GAINED,
} from "@mage-knight/shared";
import { SiteType } from "../../../types/map.js";
import type { NextPlayerResult, NextPlayerSetupResult } from "./types.js";

/**
 * Determine what happens after the current player's turn ends.
 * Tracks final turns and determines next player.
 */
export function determineNextPlayer(
  state: GameState,
  playerId: string
): NextPlayerResult {
  let playersWithFinalTurn = [...state.playersWithFinalTurn];
  let shouldTriggerRoundEnd = false;
  let shouldTriggerGameEnd = false;
  let finalTurnsRemaining = state.finalTurnsRemaining;

  // Track final turns after round end announced
  if (state.endOfRoundAnnouncedBy !== null) {
    playersWithFinalTurn = playersWithFinalTurn.filter((id) => id !== playerId);
    if (playersWithFinalTurn.length === 0) {
      shouldTriggerRoundEnd = true;
    }
  }

  // Handle scenario-triggered final turns
  if (state.scenarioEndTriggered && finalTurnsRemaining !== null) {
    finalTurnsRemaining = finalTurnsRemaining - 1;
    if (finalTurnsRemaining <= 0) {
      shouldTriggerGameEnd = true;
    }
  }

  // Check for extra turn (The Right Moment tactic)
  const currentPlayer = state.players.find((p) => p.id === playerId);
  const hasExtraTurnPending = currentPlayer?.tacticState?.extraTurnPending === true;

  let nextPlayerId: string | null = null;
  let currentPlayerIndex = state.currentPlayerIndex;

  if (shouldTriggerRoundEnd) {
    nextPlayerId = null;
  } else if (hasExtraTurnPending) {
    nextPlayerId = playerId;
  } else {
    const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
    nextPlayerId = state.turnOrder[nextPlayerIndex] ?? null;
    currentPlayerIndex = nextPlayerIndex;
  }

  return {
    nextPlayerId,
    currentPlayerIndex,
    shouldTriggerRoundEnd,
    shouldTriggerGameEnd,
    playersWithFinalTurn,
    finalTurnsRemaining,
  };
}

/**
 * Set up the next player for their turn.
 * Grants starting move points, checks for Magical Glade mana,
 * and handles Sparing Power tactic decision.
 */
export function setupNextPlayer(
  state: GameState,
  nextPlayerId: string,
  isExtraTurn: boolean,
  currentPlayerId: string
): NextPlayerSetupResult {
  const players = [...state.players];
  let gladeManaEvent: GameEvent | null = null;

  if (isExtraTurn) {
    // Same player takes extra turn - clear pending flag
    const playerIdx = players.findIndex((p) => p.id === currentPlayerId);
    if (playerIdx !== -1) {
      const player = players[playerIdx];
      if (player) {
        const gladeResult = checkMagicalGladeMana(state, player);
        gladeManaEvent = gladeResult.event;

        players[playerIdx] = {
          ...player,
          movePoints: TURN_START_MOVE_POINTS,
          tacticState: {
            ...player.tacticState,
            extraTurnPending: false,
            manaSearchUsedThisTurn: false,
          },
          pureMana: gladeResult.manaToken
            ? [...player.pureMana, gladeResult.manaToken]
            : player.pureMana,
        };
      }
    }
  } else {
    // Advance to next player
    const nextPlayerIdx = players.findIndex((p) => p.id === nextPlayerId);
    if (nextPlayerIdx !== -1) {
      const nextPlayer = players[nextPlayerIdx];
      if (nextPlayer) {
        const needsSparingPowerDecision =
          nextPlayer.selectedTactic === TACTIC_SPARING_POWER &&
          !nextPlayer.tacticFlipped;

        const gladeResult = checkMagicalGladeMana(state, nextPlayer);
        gladeManaEvent = gladeResult.event;

        players[nextPlayerIdx] = {
          ...nextPlayer,
          movePoints: TURN_START_MOVE_POINTS,
          tacticState: {
            ...nextPlayer.tacticState,
            manaSearchUsedThisTurn: false,
          },
          beforeTurnTacticPending: needsSparingPowerDecision,
          pendingTacticDecision: needsSparingPowerDecision
            ? { type: TACTIC_SPARING_POWER }
            : nextPlayer.pendingTacticDecision,
          pureMana: gladeResult.manaToken
            ? [...nextPlayer.pureMana, gladeResult.manaToken]
            : nextPlayer.pureMana,
        };
      }
    }
  }

  return { players, gladeManaEvent };
}

/**
 * Check if player is on a Magical Glade and should receive mana at turn start.
 *
 * Note: If the glade requires liberation (Shades of Tezla scenarios),
 * mana is blocked until the glade is liberated.
 */
function checkMagicalGladeMana(
  state: GameState,
  player: Player
): {
  manaToken: { color: SpecialManaColor; source: typeof MANA_TOKEN_SOURCE_SITE } | null;
  event: GameEvent | null;
} {
  if (!player.position) {
    return { manaToken: null, event: null };
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (hex?.site?.type !== SiteType.MagicalGlade) {
    return { manaToken: null, event: null };
  }

  // If glade requires liberation and isn't liberated, block mana
  if (hex.site.requiresLiberation && !hex.site.isLiberated) {
    return { manaToken: null, event: null };
  }

  const manaColor: SpecialManaColor =
    state.timeOfDay === TIME_OF_DAY_DAY ? MANA_GOLD : MANA_BLACK;

  return {
    manaToken: { color: manaColor, source: MANA_TOKEN_SOURCE_SITE },
    event: {
      type: GLADE_MANA_GAINED,
      playerId: player.id,
      manaColor,
    },
  };
}
