/**
 * Cooperative assault action validator registry
 * Handles PROPOSE_COOPERATIVE_ASSAULT_ACTION, RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION, CANCEL_COOPERATIVE_PROPOSAL_ACTION
 */

import type { Validator } from "../types.js";
import {
  PROPOSE_COOPERATIVE_ASSAULT_ACTION,
  RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
  CANCEL_COOPERATIVE_PROPOSAL_ACTION,
} from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Cooperative assault validators
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
} from "../cooperativeAssaultValidators/index.js";

export const cooperativeRegistry: Record<string, Validator[]> = {
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
