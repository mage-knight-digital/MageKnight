/**
 * Cooperative assault validators routing - PROPOSE, RESPOND, CANCEL
 */

import type { ValidatorRegistry } from "./types.js";
import {
  PROPOSE_COOPERATIVE_ASSAULT_ACTION,
  RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
  CANCEL_COOPERATIVE_PROPOSAL_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
} from "../choiceValidators.js";

import {
  validateInitiatorAdjacentToCity,
  validateEndOfRoundNotAnnounced,
  validateScenarioNotFulfilled,
  validateInitiatorNotActed,
  validateInitiatorTokenNotFlipped,
  validateNoOtherPlayerOnSpace,
  validateAtLeastOneInvitee,
  validateInviteesAdjacentToCity,
  validateInviteesTokensNotFlipped,
  validateInviteesHaveCards,
  validateEnemyDistribution,
  validateProposalExists,
  validatePlayerIsInvitee,
  validatePlayerNotResponded,
  validateProposalExistsForCancel,
  validatePlayerIsInitiator,
} from "../cooperativeAssaultValidators.js";

export const cooperativeValidatorRegistry: ValidatorRegistry = {
  [PROPOSE_COOPERATIVE_ASSAULT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateInitiatorAdjacentToCity,
    validateEndOfRoundNotAnnounced,
    validateScenarioNotFulfilled,
    validateInitiatorNotActed,
    validateInitiatorTokenNotFlipped,
    validateNoOtherPlayerOnSpace,
    validateAtLeastOneInvitee,
    validateInviteesAdjacentToCity,
    validateInviteesTokensNotFlipped,
    validateInviteesHaveCards,
    validateEnemyDistribution,
  ],
  [RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION]: [
    // Note: Any player can respond regardless of whose turn it is
    validateProposalExists,
    validatePlayerIsInvitee,
    validatePlayerNotResponded,
  ],
  [CANCEL_COOPERATIVE_PROPOSAL_ACTION]: [
    // Note: Initiator can cancel regardless of whose turn it is
    validateProposalExistsForCancel,
    validatePlayerIsInitiator,
  ],
};
