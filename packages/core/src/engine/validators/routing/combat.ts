/**
 * Combat validators routing - combat-related actions
 */

import type { ValidatorRegistry } from "./types.js";
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
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateHasNotActed,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
  validateNoBlockingTacticDecisionPending,
} from "../choiceValidators.js";

import {
  validateNoPendingLevelUpRewards,
} from "../levelUpValidators.js";

import {
  validateMustAnnounceEndOfRound,
} from "../roundValidators.js";

import {
  validateNotRestingForCombat,
} from "../restValidators.js";

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
  validateAssassinationTarget,
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
} from "../combatValidators/index.js";

import {
  validateChallengePlayerOnMap,
  validateNotInCombat as validateChallengeNotInCombat,
  validateNoCombatThisTurn,
  validateAdjacentToTarget,
  validateTargetHasRampagingEnemies,
} from "../challengeValidators.js";

import {
  validateUnitCanReceiveDamage,
} from "../units/index.js";

export const combatValidatorRegistry: ValidatorRegistry = {
  [ENTER_COMBAT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotAlreadyInCombat,
  ],
  [CHALLENGE_RAMPAGING_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForCombat, // Cannot challenge while resting (FAQ S3)
    validateHasNotActed, // Challenge consumes action phase; disallow after rest/other action
    validateChallengeNotInCombat,
    validateNoCombatThisTurn,
    validateChallengePlayerOnMap,
    validateAdjacentToTarget,
    validateTargetHasRampagingEnemies,
  ],
  [END_COMBAT_PHASE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateIsInCombat,
    validateDamageAssignedBeforeLeaving,
  ],
  [DECLARE_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateIsInCombat,
    validateBlockPhase,
    validateBlockTargetEnemy,
    validateUnitsCannotAbsorbDamage, // Units cannot absorb damage in new block system
  ],
  [DECLARE_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateIsInCombat,
    validateAttackPhase,
    validateAttackType,
    validateFortification,
    validateHasSiegeAttack, // Non-siege attacks cannot target fortified enemies
    validateAttackTargets,
    validateAssassinationTarget, // Assassination only targets regular enemies
  ],
  [ASSIGN_DAMAGE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateIsInCombat,
    validateAssignDamagePhase,
    validateAssignDamageTargetEnemy,
    validateUnitCanReceiveDamage, // Validates unit exists and can receive damage
  ],
  // Incremental attack assignment
  [ASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateAssignAttackTargetEnemy,
    validateHasAvailableAttack,
    validateAssignAttackTypeForPhase,
    validateAssignAttackFortification,
  ],
  [UNASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateUnassignAttackTargetEnemy,
    validateHasAssignedToUnassign,
  ],
  // Incremental block assignment
  [ASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateAssignBlockTargetEnemy,
    validateHasAvailableBlock,
  ],
  [UNASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateUnassignBlockTargetEnemy,
    validateHasAssignedBlockToUnassign,
  ],
};
