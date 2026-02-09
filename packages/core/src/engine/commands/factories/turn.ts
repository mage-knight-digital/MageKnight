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
 * - createDeclareRestCommandFromAction - Declare intent to rest (new two-phase rest)
 * - createCompleteRestCommandFromAction - Complete rest with discards (new two-phase rest)
 * - createAnnounceEndOfRoundCommandFromAction - Announce end of round
 */

import type { CommandFactory } from "./types.js";
import {
  REST_ACTION,
  ANNOUNCE_END_OF_ROUND_ACTION,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
  REST_TYPE_STANDARD,
  REST_TYPE_SLOW_RECOVERY,
} from "@mage-knight/shared";
import type { BasicActionCardId } from "@mage-knight/shared";
import { createEndTurnCommand } from "../endTurn/index.js";
import { createRestCommand } from "../restCommand.js";
import { createDeclareRestCommand } from "../declareRestCommand.js";
import { createCompleteRestCommand } from "../completeRestCommand.js";
import { createAnnounceEndOfRoundCommand } from "../announceEndOfRoundCommand.js";
import { getBasicActionCard } from "../../../data/basicActions/index.js";
import { DEED_CARD_TYPE_WOUND } from "../../../types/cards.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Helper to check if a card is a wound
 */
function isWoundCard(cardId: string): boolean {
  try {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    return card.cardType === DEED_CARD_TYPE_WOUND;
  } catch {
    return false;
  }
}

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

  const player = getPlayerById(state, playerId);
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

/**
 * Declare rest command factory (new two-phase rest).
 * Creates a command to enter the resting state.
 */
export const createDeclareRestCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DECLARE_REST_ACTION) return null;
  return createDeclareRestCommand({ playerId });
};

/**
 * Complete rest command factory (new two-phase rest).
 * Creates a command to complete the rest with discards.
 * Rest type is determined automatically based on hand state.
 */
export const createCompleteRestCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== COMPLETE_REST_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player) return null;

  // Determine rest type based on current hand state
  const hasNonWoundInHand = player.hand.some((cardId) => !isWoundCard(cardId));
  const restType = hasNonWoundInHand ? REST_TYPE_STANDARD : REST_TYPE_SLOW_RECOVERY;

  return createCompleteRestCommand({
    playerId,
    discardCardIds: action.discardCardIds,
    announceEndOfRound: action.announceEndOfRound ?? false,
    previousHand: [...player.hand],
    previousDiscard: [...player.discard],
    previousIsResting: player.isResting,
    previousFlippedSkills: [...player.skillFlipState.flippedSkills],
    restType,
  });
};
