/**
 * Combat target validators
 *
 * Validators for enemy targeting in combat actions.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
} from "@mage-knight/shared";
import {
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_BLOCKED,
  ENEMY_ALREADY_DEFEATED,
  SUMMONER_HIDDEN,
  ASSASSINATION_REQUIRES_HERO_TARGET,
  INVALID_ATTACK_INDEX,
  ATTACK_ALREADY_BLOCKED,
  ATTACK_DAMAGE_ALREADY_ASSIGNED,
  DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET,
  INSUFFICIENT_BLOCK,
  UNITS_CANNOT_ABSORB_DAMAGE,
} from "../validationCodes.js";
import { isAssassinationActive, getDamageRedirectUnit, cannotAssignDamageToUnits } from "../../rules/combatTargeting.js";
import {
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
  isEnemyFullyBlocked,
  findFirstUnblockedAttack,
  findFirstUnassignedAttack,
} from "../../combat/enemyAttackHelpers.js";
import { getBlockDeclarationStatus } from "../../rules/combatBlocking.js";

// Target enemy must exist and not be defeated (for block)
// Also excludes hidden summoners (summoners that have summoned an enemy)
// For multi-attack enemies, validates the specific attack being blocked
export function validateBlockTargetEnemy(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.targetEnemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, "Target enemy is already defeated");
  }

  // Cannot target hidden summoners - must block the summoned enemy instead
  if (enemy.isSummonerHidden) {
    return invalid(
      SUMMONER_HIDDEN,
      "Cannot target summoner while their summoned enemy is active"
    );
  }

  // Get attack index (auto-resolve to first unblocked for multi-attack enemies)
  const attackIndex = action.attackIndex ?? findFirstUnblockedAttack(enemy);
  const attackCount = getEnemyAttackCount(enemy);

  // Validate attack index is in range
  if (attackIndex < 0 || attackIndex >= attackCount) {
    return invalid(
      INVALID_ATTACK_INDEX,
      `Invalid attack index ${attackIndex}: enemy has ${attackCount} attack(s)`
    );
  }

  // Check if this specific attack is already blocked
  if (isAttackBlocked(enemy, attackIndex)) {
    if (attackCount > 1) {
      return invalid(
        ATTACK_ALREADY_BLOCKED,
        `Attack ${attackIndex + 1} of ${enemy.definition.name} is already blocked`
      );
    }
    return invalid(ENEMY_ALREADY_BLOCKED, "Target enemy is already blocked");
  }

  // If all attacks are blocked, the enemy is fully blocked
  if (isEnemyFullyBlocked(enemy)) {
    return invalid(ENEMY_ALREADY_BLOCKED, "All attacks on this enemy are already blocked");
  }

  const declarationStatus = getBlockDeclarationStatus(
    state,
    playerId,
    enemy,
    action.attackIndex
  );
  if (!declarationStatus.canDeclare) {
    return invalid(
      INSUFFICIENT_BLOCK,
      `Insufficient block: need ${declarationStatus.requiredBlock}, have ${declarationStatus.availableEffectiveBlock}`
    );
  }

  return valid();
}

// Target enemy must exist and not be blocked/defeated (for assign damage)
// Also excludes hidden summoners (summoners that have summoned an enemy)
// For multi-attack enemies, validates the specific attack's damage assignment
export function validateAssignDamageTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, "Target enemy is already defeated");
  }

  // Cannot assign damage from hidden summoners - damage comes from summoned enemy instead
  if (enemy.isSummonerHidden) {
    return invalid(
      SUMMONER_HIDDEN,
      "Summoner is hidden while their summoned enemy is active"
    );
  }

  // Get attack index (auto-resolve to first unassigned for multi-attack enemies)
  const attackIndex = action.attackIndex ?? findFirstUnassignedAttack(enemy);
  const attackCount = getEnemyAttackCount(enemy);

  // Validate attack index is in range
  if (attackIndex < 0 || attackIndex >= attackCount) {
    return invalid(
      INVALID_ATTACK_INDEX,
      `Invalid attack index ${attackIndex}: enemy has ${attackCount} attack(s)`
    );
  }

  // Check if this specific attack is blocked (no damage to assign)
  if (isAttackBlocked(enemy, attackIndex)) {
    if (attackCount > 1) {
      return invalid(
        ATTACK_ALREADY_BLOCKED,
        `Attack ${attackIndex + 1} of ${enemy.definition.name} is blocked, no damage to assign`
      );
    }
    return invalid(ENEMY_ALREADY_BLOCKED, "Enemy is blocked, no damage to assign");
  }

  // Check if damage is already assigned for this attack
  if (isAttackDamageAssigned(enemy, attackIndex)) {
    if (attackCount > 1) {
      return invalid(
        ATTACK_DAMAGE_ALREADY_ASSIGNED,
        `Damage for attack ${attackIndex + 1} of ${enemy.definition.name} is already assigned`
      );
    }
    return invalid(
      ATTACK_DAMAGE_ALREADY_ASSIGNED,
      "Damage for this enemy is already assigned"
    );
  }

  return valid();
}

// Attack targets must exist and not be defeated
export function validateAttackTargets(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  for (const targetId of action.targetEnemyInstanceIds) {
    const enemy = state.combat?.enemies.find((e) => e.instanceId === targetId);

    if (!enemy) {
      return invalid(ENEMY_NOT_FOUND, `Target enemy not found: ${targetId}`);
    }

    if (enemy.isDefeated) {
      return invalid(
        ENEMY_ALREADY_DEFEATED,
        `Target enemy is already defeated: ${enemy.definition.name}`
      );
    }
  }

  return valid();
}

// Assassination ability: damage must be assigned to hero, not units
export function validateAssassinationTarget(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    // Enemy validation is handled by validateAssignDamageTargetEnemy
    return valid();
  }

  if (!isAssassinationActive(state, playerId, enemy)) {
    return valid();
  }

  // Check if any damage is being assigned to units
  const assignments = action.assignments ?? [];
  const hasUnitTarget = assignments.some(
    (assignment) => assignment.target === DAMAGE_TARGET_UNIT
  );

  if (hasUnitTarget) {
    return invalid(
      ASSASSINATION_REQUIRES_HERO_TARGET,
      `${enemy.definition.name} has Assassination: damage must be assigned to hero, not units`
    );
  }

  return valid();
}

// Damage redirect (Taunt): damage must be assigned to the redirect unit, not hero or other units
export function validateDamageRedirectTarget(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  const redirectUnitId = getDamageRedirectUnit(state, playerId, action.enemyInstanceId);
  if (!redirectUnitId) {
    return valid(); // No active redirect for this enemy
  }

  const assignments = action.assignments ?? [];

  // All damage must go to the redirect unit (no hero damage, no other units)
  for (const assignment of assignments) {
    if (assignment.target === DAMAGE_TARGET_HERO) {
      return invalid(
        DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET,
        "Damage must be assigned to the taunting unit first"
      );
    }
    if (assignment.target === DAMAGE_TARGET_UNIT && assignment.unitInstanceId !== redirectUnitId) {
      return invalid(
        DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET,
        "Damage must be assigned to the taunting unit first"
      );
    }
  }

  return valid();
}

// Into the Heat: units cannot absorb damage when rule is active
export function validateUnitsCannotAbsorbDamage(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  if (!cannotAssignDamageToUnits(state, playerId)) {
    return valid();
  }

  // Check if any damage is being assigned to units
  const assignments = action.assignments ?? [];
  const hasUnitTarget = assignments.some(
    (assignment) => assignment.target === DAMAGE_TARGET_UNIT
  );

  if (hasUnitTarget) {
    return invalid(
      UNITS_CANNOT_ABSORB_DAMAGE,
      "Cannot assign damage to units this combat (Into the Heat)"
    );
  }

  return valid();
}
