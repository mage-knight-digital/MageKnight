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
} from "../turnValidators.js";

import {
  validateNoChoicePending,
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
  validateOneCombatPerTurn,
  validateAssassinationTarget,
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
};
