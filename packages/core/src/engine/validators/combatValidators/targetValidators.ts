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
  ABILITY_ASSASSINATION,
  DAMAGE_TARGET_UNIT,
} from "@mage-knight/shared";
import {
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_BLOCKED,
  ENEMY_ALREADY_DEFEATED,
  SUMMONER_HIDDEN,
  ASSASSINATION_REQUIRES_HERO_TARGET,
} from "../validationCodes.js";
import { isAbilityNullified } from "../../modifiers.js";

// Target enemy must exist and not be defeated (for block)
// Also excludes hidden summoners (summoners that have summoned an enemy)
export function validateBlockTargetEnemy(
  state: GameState,
  _playerId: string,
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

  if (enemy.isBlocked) {
    return invalid(ENEMY_ALREADY_BLOCKED, "Target enemy is already blocked");
  }

  // Cannot target hidden summoners - must block the summoned enemy instead
  if (enemy.isSummonerHidden) {
    return invalid(
      SUMMONER_HIDDEN,
      "Cannot target summoner while their summoned enemy is active"
    );
  }

  return valid();
}

// Target enemy must exist and not be blocked/defeated (for assign damage)
// Also excludes hidden summoners (summoners that have summoned an enemy)
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

  if (enemy.isBlocked) {
    return invalid(ENEMY_ALREADY_BLOCKED, "Enemy is blocked, no damage to assign");
  }

  // Cannot assign damage from hidden summoners - damage comes from summoned enemy instead
  if (enemy.isSummonerHidden) {
    return invalid(
      SUMMONER_HIDDEN,
      "Summoner is hidden while their summoned enemy is active"
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

  // Check if enemy has Assassination ability
  const hasAssassination = enemy.definition.abilities.includes(ABILITY_ASSASSINATION);
  if (!hasAssassination) {
    return valid();
  }

  // Check if ability is nullified
  if (isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_ASSASSINATION)) {
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
