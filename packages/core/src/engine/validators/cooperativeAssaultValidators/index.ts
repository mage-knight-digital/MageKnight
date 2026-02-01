/**
 * Cooperative assault validators - validates cooperative assault actions
 *
 * Split into focused modules:
 * - proposeValidators: Initiator, game state, invitee, and distribution validation
 * - responseValidators: Response to proposal validation
 * - cancelValidators: Cancel proposal validation
 * - helpers: Shared helper functions (city adjacency, non-wound cards)
 */

// Propose validators - initiator state
export {
  validateInitiatorAdjacentToCity,
  validateInitiatorNotActed,
  validateInitiatorTokenNotFlipped,
  validateNoOtherPlayerOnSpace,
} from "./proposeValidators.js";

// Propose validators - game state
export {
  validateEndOfRoundNotAnnounced,
  validateScenarioNotFulfilled,
} from "./proposeValidators.js";

// Propose validators - invitees
export {
  validateInviteesAdjacentToCity,
  validateInviteesTokensNotFlipped,
  validateInviteesHaveCards,
} from "./proposeValidators.js";

// Propose validators - distribution
export {
  validateAtLeastOneInvitee,
  validateEnemyDistribution,
} from "./proposeValidators.js";

// Response validators
export {
  validateProposalExists,
  validatePlayerIsInvitee,
  validatePlayerNotResponded,
} from "./responseValidators.js";

// Cancel validators
export {
  validateProposalExistsForCancel,
  validatePlayerIsInitiator,
} from "./cancelValidators.js";
