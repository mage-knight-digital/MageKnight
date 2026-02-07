/**
 * Combat action validator registry
 * Handles all combat-related actions including:
 * - ENTER_COMBAT_ACTION, CHALLENGE_RAMPAGING_ACTION
 * - END_COMBAT_PHASE_ACTION
 * - DECLARE_BLOCK_ACTION, DECLARE_ATTACK_ACTION
 * - ASSIGN_DAMAGE_ACTION
 * - ASSIGN_ATTACK_ACTION, UNASSIGN_ATTACK_ACTION
 * - ASSIGN_BLOCK_ACTION, UNASSIGN_BLOCK_ACTION
 * - CONVERT_MOVE_TO_ATTACK_ACTION
 */

import type { Validator } from "../types.js";
import {
  ENTER_COMBAT_ACTION,
  CHALLENGE_RAMPAGING_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  ASSIGN_BLOCK_ACTION,
  UNASSIGN_BLOCK_ACTION,
  SPEND_MOVE_ON_CUMBERSOME_ACTION,
  PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
  CONVERT_MOVE_TO_ATTACK_ACTION,
  PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
} from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
} from "../turnValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Rest validators
import { validateNotRestingForCombat } from "../restValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

// Combat validators
import {
  validateNotAlreadyInCombat,
  validateIsInCombat,
  validateBlockPhase,
  validateAttackPhase,
  validateAttackType,
  validateAssignDamagePhase,
  validateBlockTargetEnemy,
  validateAssignDamageTargetEnemy,
  validateAttackTargets,
  validateDamageAssignedBeforeLeaving,
  validateFortification,
  validateHasSiegeAttack,
  validateOneCombatPerTurn,
  validateAssassinationTarget,
  validateDamageRedirectTarget,
  validateUnitsCannotAbsorbDamage,
  // Incremental attack assignment validators
  validateAssignAttackInCombat,
  validateAssignAttackPhase,
  validateAssignAttackTargetEnemy,
  validateUnassignAttackTargetEnemy,
  validateHasAvailableAttack,
  validateHasAssignedToUnassign,
  validateAssignAttackTypeForPhase,
  validateAssignAttackFortification,
  // Incremental block assignment validators
  validateAssignBlockInCombat,
  validateAssignBlockPhase,
  validateAssignBlockTargetEnemy,
  validateUnassignBlockTargetEnemy,
  validateHasAvailableBlock,
  validateHasAssignedBlockToUnassign,
  // Cumbersome ability validators
  validateSpendCumbersomeInCombat,
  validateSpendCumbersomePhase,
  validateCumbersomeEnemy,
  validateHasMovePointsForCumbersome,
  // Heroes assault validators
  validateHeroesPaymentInCombat,
  validateHeroesAssaultApplicable,
  validateHeroesInfluenceNotAlreadyPaid,
  validateHeroesInfluenceAvailable,
  // Move-to-attack conversion validators (Agility card)
  validateConversionInCombat,
  validateConversionPhase,
  validateConversionModifierActive,
  validateConversionAmount,
  validateConversionMovePoints,
  // Thugs damage influence validators
  validateThugsDamagePaymentInCombat,
  validateThugsDamageUnitIsThugs,
  validateThugsDamageInfluenceNotAlreadyPaid,
  validateThugsDamageInfluenceAvailable,
} from "../combatValidators/index.js";

// Challenge rampaging validators
import {
  validateChallengePlayerOnMap,
  validateNotInCombat as validateChallengeNotInCombat,
  validateNoCombatThisTurn,
  validateAdjacentToTarget,
  validateTargetHasRampagingEnemies,
} from "../challengeValidators.js";

// Unit validators
import { validateUnitCanReceiveDamage } from "../units/index.js";

export const combatRegistry: Record<string, Validator[]> = {
  [ENTER_COMBAT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForCombat, // Cannot enter combat while resting (FAQ S3)
    validateNotAlreadyInCombat,
    validateOneCombatPerTurn, // Can only have one combat per turn
  ],
  [CHALLENGE_RAMPAGING_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForCombat, // Cannot challenge while resting (FAQ S3)
    validateChallengePlayerOnMap,
    validateChallengeNotInCombat, // Can't challenge while in combat
    validateNoCombatThisTurn, // One combat per turn rule
    validateAdjacentToTarget,
    validateTargetHasRampagingEnemies,
  ],
  [END_COMBAT_PHASE_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateDamageAssignedBeforeLeaving,
  ],
  [DECLARE_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateBlockPhase,
    validateBlockTargetEnemy,
  ],
  [DECLARE_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateAttackPhase,
    validateAttackType,
    validateFortification,
    validateHasSiegeAttack, // Must have siege attack accumulated to use siege type
    validateAttackTargets,
  ],
  [ASSIGN_DAMAGE_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateAssignDamagePhase,
    validateAssignDamageTargetEnemy,
    validateAssassinationTarget,
    validateDamageRedirectTarget,
    validateUnitsCannotAbsorbDamage,
    validateUnitCanReceiveDamage,
  ],
  // Incremental attack assignment actions
  [ASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateAssignAttackTargetEnemy,
    validateHasAvailableAttack,
    validateAssignAttackTypeForPhase,
    validateAssignAttackFortification,
  ],
  [UNASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateUnassignAttackTargetEnemy,
    validateHasAssignedToUnassign,
  ],
  // Incremental block assignment actions
  [ASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateAssignBlockTargetEnemy,
    validateHasAvailableBlock,
  ],
  [UNASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateUnassignBlockTargetEnemy,
    validateHasAssignedBlockToUnassign,
  ],
  // Cumbersome ability action
  [SPEND_MOVE_ON_CUMBERSOME_ACTION]: [
    validateIsPlayersTurn,
    validateSpendCumbersomeInCombat,
    validateSpendCumbersomePhase,
    validateCumbersomeEnemy,
    validateHasMovePointsForCumbersome,
  ],
  // Heroes assault influence payment action
  [PAY_HEROES_ASSAULT_INFLUENCE_ACTION]: [
    validateIsPlayersTurn,
    validateHeroesPaymentInCombat,
    validateHeroesAssaultApplicable,
    validateHeroesInfluenceNotAlreadyPaid,
    validateHeroesInfluenceAvailable,
  ],
  // Move-to-attack conversion action (Agility card)
  [CONVERT_MOVE_TO_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateConversionInCombat,
    validateConversionPhase,
    validateConversionModifierActive,
    validateConversionAmount,
    validateConversionMovePoints,
  ],
  // Thugs damage influence payment action
  [PAY_THUGS_DAMAGE_INFLUENCE_ACTION]: [
    validateIsPlayersTurn,
    validateThugsDamagePaymentInCombat,
    validateThugsDamageUnitIsThugs,
    validateThugsDamageInfluenceNotAlreadyPaid,
    validateThugsDamageInfluenceAvailable,
  ],
};
