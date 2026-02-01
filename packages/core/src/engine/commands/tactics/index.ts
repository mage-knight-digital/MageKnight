/**
 * Tactic decision command exports
 */

// Main command
export {
  createResolveTacticDecisionCommand,
  RESOLVE_TACTIC_DECISION_COMMAND,
  type ResolveTacticDecisionCommandArgs,
} from "./resolveTacticDecisionCommand.js";

// Shared helpers (for use by selectTacticCommand)
export { calculateTurnOrder, handlePhaseTransitionAfterDecision } from "./helpers.js";

// Types
export type {
  TacticResolutionResult,
  TacticValidator,
  TacticResolver,
} from "./types.js";

// Individual handlers (for testing)
export {
  validateRethink,
  resolveRethink,
  isRethinkDecision,
} from "./handlers/rethink.js";

export {
  validateSparingPower,
  resolveSparingPower,
  isSparingPowerDecision,
  type SparingPowerDecision,
} from "./handlers/sparingPower.js";

export {
  validateManaSteal,
  resolveManaSteal,
  isManaStealDecision,
  type ManaStealDecision,
} from "./handlers/manaSteal.js";

export {
  validatePreparation,
  resolvePreparation,
  isPreparationDecision,
  type PreparationDecision,
} from "./handlers/preparation.js";

export {
  validateMidnightMeditation,
  resolveMidnightMeditation,
  isMidnightMeditationDecision,
  type MidnightMeditationDecision,
} from "./handlers/midnightMeditation.js";
