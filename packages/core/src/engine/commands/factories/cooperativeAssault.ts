/**
 * Cooperative Assault Command Factories
 *
 * Factory functions that translate cooperative assault PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/cooperativeAssault
 *
 * @remarks Factories in this module:
 * - createProposeCooperativeAssaultCommandFromAction - Propose a cooperative assault
 * - createRespondToProposalCommandFromAction - Respond to a proposal
 * - createCancelProposalCommandFromAction - Cancel a proposal
 */

import type { CommandFactory } from "./types.js";
import {
  PROPOSE_COOPERATIVE_ASSAULT_ACTION,
  RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
  CANCEL_COOPERATIVE_PROPOSAL_ACTION,
} from "@mage-knight/shared";
import { createProposeCooperativeAssaultCommand } from "../cooperative/proposeCooperativeAssaultCommand.js";
import { createRespondToProposalCommand } from "../cooperative/respondToProposalCommand.js";
import { createCancelProposalCommand } from "../cooperative/cancelProposalCommand.js";

/**
 * Propose cooperative assault command factory.
 * Creates a command to propose a cooperative assault on a city.
 */
export const createProposeCooperativeAssaultCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== PROPOSE_COOPERATIVE_ASSAULT_ACTION) return null;

  return createProposeCooperativeAssaultCommand({
    playerId,
    targetCity: action.targetCity,
    invitedPlayerIds: action.invitedPlayerIds,
    distribution: action.distribution,
  });
};

/**
 * Respond to cooperative proposal command factory.
 * Creates a command to respond (accept/decline) to a pending proposal.
 */
export const createRespondToProposalCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION) return null;

  return createRespondToProposalCommand({
    playerId,
    response: action.response,
  });
};

/**
 * Cancel cooperative proposal command factory.
 * Creates a command to cancel a pending proposal (initiator only).
 */
export const createCancelProposalCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== CANCEL_COOPERATIVE_PROPOSAL_ACTION) return null;

  return createCancelProposalCommand({
    playerId,
  });
};
