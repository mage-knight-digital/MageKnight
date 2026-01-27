/**
 * Turn Command Factories
 *
 * Factory functions that translate turn lifecycle PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/turn
 *
 * @remarks Factories in this module:
 * - createEndTurnCommandFromAction - End the current player's turn
 * - createRestCommandFromAction - Rest to draw cards and optionally announce end of round
 * - createAnnounceEndOfRoundCommandFromAction - Announce end of round
 */

import type { CommandFactory } from "./types.js";
import { REST_ACTION, ANNOUNCE_END_OF_ROUND_ACTION } from "@mage-knight/shared";
import { createEndTurnCommand } from "../endTurn/index.js";
import { createRestCommand } from "../restCommand.js";
import { createAnnounceEndOfRoundCommand } from "../announceEndOfRoundCommand.js";

/**
 * End turn command factory.
 * Creates a command to end the current player's turn.
 */
export const createEndTurnCommandFromAction: CommandFactory = (
  _state,
  playerId,
  _action
) => {
  return createEndTurnCommand({ playerId });
};

/**
 * Rest command factory.
 * Creates a command to rest, drawing cards and optionally announcing end of round.
 */
export const createRestCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== REST_ACTION) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  return createRestCommand({
    playerId,
    restType: action.restType,
    discardCardIds: action.discardCardIds,
    announceEndOfRound: action.announceEndOfRound ?? false,
    previousHand: [...player.hand],
    previousDiscard: [...player.discard],
    previousPlayedCardFromHand: player.playedCardFromHandThisTurn,
  });
};

/**
 * Announce end of round command factory.
 * Creates a command to announce that this player wants to end the round.
 */
export const createAnnounceEndOfRoundCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ANNOUNCE_END_OF_ROUND_ACTION) return null;
  return createAnnounceEndOfRoundCommand({ playerId });
};
