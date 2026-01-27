/**
 * Combat phase validators
 *
 * Validators for phase-specific rules and transitions.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  END_COMBAT_PHASE_ACTION,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../../types/combat.js";
import { doesEnemyAttackThisCombat, getEffectiveEnemyAttack } from "../../modifiers.js";
import {
  WRONG_COMBAT_PHASE,
  INVALID_ATTACK_TYPE,
  DAMAGE_NOT_ASSIGNED,
} from "../validationCodes.js";

// Block only allowed in Block phase
export function validateBlockPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_ACTION) return valid();

  if (state.combat?.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(WRONG_COMBAT_PHASE, "Can only block during Block phase");
  }

  return valid();
}

// Attack allowed in Ranged/Siege and Attack phases
export function validateAttackPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  const validPhases = [COMBAT_PHASE_RANGED_SIEGE, "attack"];
  if (
    !validPhases.includes(
      state.combat?.phase as typeof COMBAT_PHASE_RANGED_SIEGE
    )
  ) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only attack during Ranged/Siege or Attack phase"
    );
  }

  return valid();
}

// Ranged/Siege attacks only in Ranged/Siege phase (but all types allowed in Attack phase)
// Per rulebook: "You can combine any Attacks: Ranged, Siege or regular."
export function validateAttackType(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  const isRangedSiegePhase = state.combat?.phase === COMBAT_PHASE_RANGED_SIEGE;
  const isRangedOrSiege =
    action.attackType === COMBAT_TYPE_RANGED ||
    action.attackType === COMBAT_TYPE_SIEGE;

  // In Ranged/Siege phase, only ranged/siege attacks allowed
  if (isRangedSiegePhase && !isRangedOrSiege) {
    return invalid(
      INVALID_ATTACK_TYPE,
      "Only Ranged or Siege attacks allowed in Ranged/Siege phase"
    );
  }

  // In Attack phase, ALL attack types are allowed (ranged, siege, and melee)

  return valid();
}

// Assign damage only in Assign Damage phase
export function validateAssignDamagePhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  if (state.combat?.phase !== COMBAT_PHASE_ASSIGN_DAMAGE) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only assign damage during Assign Damage phase"
    );
  }

  return valid();
}

// Cannot leave Assign Damage phase without assigning damage from all unblocked enemies
export function validateDamageAssignedBeforeLeaving(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== END_COMBAT_PHASE_ACTION) return valid();

  // Only check when leaving Assign Damage phase
  if (state.combat?.phase !== COMBAT_PHASE_ASSIGN_DAMAGE) return valid();

  // Find enemies that need damage assigned:
  // - not blocked, not defeated, not already assigned
  // - AND they actually attack this combat (not affected by Chill/Whirlwind)
  // - AND not a hidden summoner (their summoned enemy deals damage instead)
  // - AND have effective attack > 0 (no damage to assign from 0-attack enemies)
  const unprocessedEnemies = state.combat.enemies.filter(
    (e) =>
      !e.isDefeated &&
      !e.isBlocked &&
      !e.damageAssigned &&
      !e.isSummonerHidden &&
      doesEnemyAttackThisCombat(state, e.instanceId) &&
      getEffectiveEnemyAttack(state, e.instanceId, e.definition.attack) > 0
  );

  if (unprocessedEnemies.length > 0) {
    const names = unprocessedEnemies.map((e) => e.definition.name).join(", ");
    return invalid(
      DAMAGE_NOT_ASSIGNED,
      `Must assign damage from all unblocked enemies before advancing: ${names}`
    );
  }

  return valid();
}
