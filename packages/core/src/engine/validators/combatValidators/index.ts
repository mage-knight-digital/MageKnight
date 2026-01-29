/**
 * Combat validators - validates combat actions and state
 *
 * Split into focused modules:
 * - stateValidators: Combat entry/exit, one combat per turn
 * - phaseValidators: Phase-specific rules and transitions
 * - targetValidators: Enemy targeting validation
 * - fortificationValidators: Fortification and siege rules
 * - attackAssignmentValidators: Incremental attack assignment
 * - blockAssignmentValidators: Incremental block assignment
 */

// State validators
export {
  validateNotAlreadyInCombat,
  validateIsInCombat,
  validateOneCombatPerTurn,
} from "./stateValidators.js";

// Phase validators
export {
  validateBlockPhase,
  validateAttackPhase,
  validateAttackType,
  validateAssignDamagePhase,
  validateDamageAssignedBeforeLeaving,
} from "./phaseValidators.js";

// Target validators
export {
  validateBlockTargetEnemy,
  validateAssignDamageTargetEnemy,
  validateAttackTargets,
  validateAssassinationTarget,
} from "./targetValidators.js";

// Fortification validators
export {
  getFortificationLevel,
  validateFortification,
  validateHasSiegeAttack,
} from "./fortificationValidators.js";

// Attack assignment validators
export {
  validateAssignAttackInCombat,
  validateAssignAttackPhase,
  validateAssignAttackTargetEnemy,
  validateUnassignAttackTargetEnemy,
  validateHasAvailableAttack,
  validateHasAssignedToUnassign,
  validateAssignAttackTypeForPhase,
  validateAssignAttackFortification,
} from "./attackAssignmentValidators.js";

// Block assignment validators
export {
  validateAssignBlockInCombat,
  validateAssignBlockPhase,
  validateAssignBlockTargetEnemy,
  validateUnassignBlockTargetEnemy,
  validateHasAvailableBlock,
  validateHasAssignedBlockToUnassign,
} from "./blockAssignmentValidators.js";
