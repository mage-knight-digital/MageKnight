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
  validateDamageRedirectTarget,
  validateUnitsCannotAbsorbDamage,
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

// Cumbersome ability validators
export {
  validateSpendCumbersomeInCombat,
  validateSpendCumbersomePhase,
  validateCumbersomeEnemy,
  validateHasMovePointsForCumbersome,
} from "./cumbersomeValidators.js";

// Heroes assault validators
export {
  validateHeroesPaymentInCombat,
  validateHeroesAssaultApplicable,
  validatePlayerHasHeroesUnits,
  validateHeroesInfluenceNotAlreadyPaid,
  validateHeroesInfluenceAvailable,
} from "./heroesAssaultValidators.js";

// Move-to-attack conversion validators (Agility card)
export {
  validateConversionInCombat,
  validateConversionPhase,
  validateConversionModifierActive,
  validateConversionAmount,
  validateConversionMovePoints,
} from "./conversionValidators.js";

// Influence-to-block conversion validators (Diplomacy card)
export {
  validateInfluenceConversionInCombat,
  validateInfluenceConversionPhase,
  validateInfluenceConversionModifierActive,
  validateInfluenceConversionAmount,
  validateInfluenceConversionInfluencePoints,
} from "./influenceConversionValidators.js";

// Thugs damage influence validators
export {
  validateThugsDamagePaymentInCombat,
  validateThugsDamageUnitIsThugs,
  validateThugsDamageInfluenceNotAlreadyPaid,
  validateThugsDamageInfluenceAvailable,
} from "./thugsDamageValidators.js";

// Attack target declaration validators
export {
  validateDeclareTargetsInCombat,
  validateDeclareTargetsPhase,
  validateNoTargetsDeclared,
  validateTargetsExistAndAlive,
  validateFinalizeInCombat,
  validateFinalizePhase,
  validateTargetsDeclared,
} from "./attackTargetValidators.js";
