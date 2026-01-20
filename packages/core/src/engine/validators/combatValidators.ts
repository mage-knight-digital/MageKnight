/**
 * Combat validators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, AttackType, AttackElement } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ABILITY_FORTIFIED,
  ABILITY_UNFORTIFIED,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import { createEmptyPendingDamage } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { doesEnemyAttackThisCombat } from "../modifiers.js";
import {
  ALREADY_IN_COMBAT,
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_BLOCKED,
  ENEMY_ALREADY_DEFEATED,
  INVALID_ATTACK_TYPE,
  DAMAGE_NOT_ASSIGNED,
  FORTIFIED_NEEDS_SIEGE,
  NO_SIEGE_ATTACK_ACCUMULATED,
  ALREADY_COMBATTED,
  INSUFFICIENT_ATTACK,
  NOTHING_TO_UNASSIGN,
  INVALID_ASSIGNMENT_AMOUNT,
} from "./validationCodes.js";
import type { AccumulatedAttack, ElementalAttackValues } from "../../types/player.js";
import { getTotalElementalValue } from "../../types/player.js";

// Must not already be in combat
export function validateNotAlreadyInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_COMBAT_ACTION) return valid();

  if (state.combat !== null) {
    return invalid(ALREADY_IN_COMBAT, "Already in combat");
  }

  return valid();
}

// Must be in combat
export function validateIsInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const combatActions = [
    END_COMBAT_PHASE_ACTION,
    DECLARE_BLOCK_ACTION,
    DECLARE_ATTACK_ACTION,
    ASSIGN_DAMAGE_ACTION,
  ];

  if (!combatActions.includes(action.type as typeof combatActions[number])) {
    return valid();
  }

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

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

  const validPhases = [COMBAT_PHASE_RANGED_SIEGE, COMBAT_PHASE_ATTACK];
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

// Target enemy must exist and not be defeated (for block)
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

  return valid();
}

// Target enemy must exist and not be blocked/defeated (for assign damage)
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
  const unprocessedEnemies = state.combat.enemies.filter(
    (e) =>
      !e.isDefeated &&
      !e.isBlocked &&
      !e.damageAssigned &&
      doesEnemyAttackThisCombat(state, e.instanceId)
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

/**
 * Calculate fortification level for an enemy.
 * Returns 0 (not fortified), 1 (site or ability), or 2 (double fortified)
 *
 * Rules:
 * - Site fortification comes from Keeps, Mage Towers, Cities
 * - Enemy ability fortification from ABILITY_FORTIFIED
 * - ABILITY_UNFORTIFIED negates site fortification (e.g., Summoned enemies)
 * - Double fortified = site + ability (requires 2 Siege attacks)
 * - Provoked rampaging enemies (isRequiredForConquest: false) do NOT get site fortification
 */
export function getFortificationLevel(
  enemy: CombatEnemy,
  isAtFortifiedSite: boolean
): number {
  const hasAbilityFortified = enemy.definition.abilities.includes(ABILITY_FORTIFIED);
  const hasUnfortified = enemy.definition.abilities.includes(ABILITY_UNFORTIFIED);

  // Site fortification only applies to site defenders (isRequiredForConquest: true)
  // Provoked rampaging enemies do NOT get site fortification per rulebook
  const isSiteDefender = enemy.isRequiredForConquest;

  // ABILITY_UNFORTIFIED negates site fortification
  const effectiveSiteFortification = isAtFortifiedSite && isSiteDefender && !hasUnfortified;

  let level = 0;
  if (effectiveSiteFortification) level += 1;
  if (hasAbilityFortified) level += 1;

  return level;
}

// Fortified enemies can only be attacked with Siege in Ranged/Siege phase
export function validateFortification(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  // Only applies in Ranged/Siege phase
  if (state.combat?.phase !== COMBAT_PHASE_RANGED_SIEGE) return valid();

  // Get target enemies
  const targetIds = action.targetEnemyInstanceIds;
  const targets = state.combat.enemies.filter((e) =>
    targetIds.includes(e.instanceId)
  );

  // Check if any target is fortified (level > 0)
  const isAtFortifiedSite = state.combat.isAtFortifiedSite;
  const fortifiedTargets = targets.filter(
    (e) => getFortificationLevel(e, isAtFortifiedSite) > 0
  );
  if (fortifiedTargets.length === 0) return valid();

  // Fortified enemies require Siege attack in Ranged/Siege phase
  // Ranged attacks won't work, only Siege
  if (action.attackType !== COMBAT_TYPE_SIEGE) {
    const names = fortifiedTargets.map((e) => e.definition.name).join(", ");
    return invalid(
      FORTIFIED_NEEDS_SIEGE,
      `Fortified enemies (${names}) can only be attacked with Siege in Ranged/Siege phase`
    );
  }

  return valid();
}

// When attacking fortified enemies with siege type, player must have siege attack accumulated
export function validateHasSiegeAttack(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  // Only applies when using siege attack type
  if (action.attackType !== COMBAT_TYPE_SIEGE) return valid();

  // Find the player
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  // Calculate total siege attack (base + elemental)
  const siegeBase = player.combatAccumulator.attack.siege;
  const siegeElemental = getTotalElementalValue(
    player.combatAccumulator.attack.siegeElements
  );
  const totalSiege = siegeBase + siegeElemental;

  if (totalSiege <= 0) {
    return invalid(
      NO_SIEGE_ATTACK_ACCUMULATED,
      "Cannot use Siege attack type without any accumulated Siege attack"
    );
  }

  return valid();
}

// Can only have one combat per turn
export function validateOneCombatPerTurn(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_COMBAT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  if (player.hasCombattedThisTurn) {
    return invalid(ALREADY_COMBATTED, "You can only have one combat per turn");
  }

  return valid();
}

// ============================================================================
// Incremental Attack Assignment Validators
// ============================================================================

/**
 * Get the available amount for a specific attack type and element.
 * Available = accumulated - assigned
 */
function getAvailableAttack(
  attack: AccumulatedAttack,
  assigned: AccumulatedAttack,
  attackType: AttackType,
  element: AttackElement
): number {
  let accumulated = 0;
  let alreadyAssigned = 0;

  const getElementalValue = (elements: ElementalAttackValues, el: AttackElement): number => {
    switch (el) {
      case ATTACK_ELEMENT_FIRE:
        return elements.fire;
      case ATTACK_ELEMENT_ICE:
        return elements.ice;
      case ATTACK_ELEMENT_COLD_FIRE:
        return elements.coldFire;
      default:
        return elements.physical;
    }
  };

  switch (attackType) {
    case ATTACK_TYPE_RANGED:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.ranged
          : getElementalValue(attack.rangedElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.ranged
          : getElementalValue(assigned.rangedElements, element);
      break;
    case ATTACK_TYPE_SIEGE:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.siege
          : getElementalValue(attack.siegeElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.siege
          : getElementalValue(assigned.siegeElements, element);
      break;
    case ATTACK_TYPE_MELEE:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.normal
          : getElementalValue(attack.normalElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.normal
          : getElementalValue(assigned.normalElements, element);
      break;
  }

  return accumulated - alreadyAssigned;
}

/**
 * Get the currently assigned amount for a specific element to a specific enemy.
 */
function getAssignedToEnemy(
  state: GameState,
  enemyInstanceId: string,
  element: AttackElement
): number {
  const pending = state.combat?.pendingDamage[enemyInstanceId] ?? createEmptyPendingDamage();

  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return pending.fire;
    case ATTACK_ELEMENT_ICE:
      return pending.ice;
    case ATTACK_ELEMENT_COLD_FIRE:
      return pending.coldFire;
    default:
      return pending.physical;
  }
}

// Assign/Unassign attack must be in combat
export function validateAssignAttackInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const assignmentActions = [ASSIGN_ATTACK_ACTION, UNASSIGN_ATTACK_ACTION];

  if (!assignmentActions.includes(action.type as typeof ASSIGN_ATTACK_ACTION)) {
    return valid();
  }

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

// Assign/Unassign attack only in Ranged/Siege or Attack phases
export function validateAssignAttackPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const assignmentActions = [ASSIGN_ATTACK_ACTION, UNASSIGN_ATTACK_ACTION];

  if (!assignmentActions.includes(action.type as typeof ASSIGN_ATTACK_ACTION)) {
    return valid();
  }

  const validPhases = [COMBAT_PHASE_RANGED_SIEGE, COMBAT_PHASE_ATTACK];
  if (
    !validPhases.includes(state.combat?.phase as typeof COMBAT_PHASE_RANGED_SIEGE)
  ) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only assign/unassign attacks during Ranged/Siege or Attack phase"
    );
  }

  return valid();
}

// Target enemy must exist and not be defeated (for assign attack)
export function validateAssignAttackTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, "Target enemy is already defeated");
  }

  return valid();
}

// Target enemy must exist (for unassign attack - can unassign even from defeated enemy during undo)
export function validateUnassignAttackTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_ATTACK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  return valid();
}

// Validate player has enough available attack to assign
export function validateHasAvailableAttack(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  const available = getAvailableAttack(
    player.combatAccumulator.attack,
    player.combatAccumulator.assignedAttack,
    action.attackType,
    action.element
  );

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Assignment amount must be positive");
  }

  if (action.amount > available) {
    return invalid(
      INSUFFICIENT_ATTACK,
      `Insufficient ${action.element} ${action.attackType} attack: need ${action.amount}, have ${available}`
    );
  }

  return valid();
}

// Validate there's enough assigned to unassign
export function validateHasAssignedToUnassign(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_ATTACK_ACTION) return valid();

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Unassignment amount must be positive");
  }

  const currentlyAssigned = getAssignedToEnemy(
    state,
    action.enemyInstanceId,
    action.element
  );

  if (action.amount > currentlyAssigned) {
    return invalid(
      NOTHING_TO_UNASSIGN,
      `Cannot unassign ${action.amount} ${action.element}: only ${currentlyAssigned} assigned to this enemy`
    );
  }

  return valid();
}

// In Ranged/Siege phase, only ranged/siege attacks can be assigned
export function validateAssignAttackTypeForPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const isRangedSiegePhase = state.combat?.phase === COMBAT_PHASE_RANGED_SIEGE;
  const isRangedOrSiege =
    action.attackType === ATTACK_TYPE_RANGED ||
    action.attackType === ATTACK_TYPE_SIEGE;

  // In Ranged/Siege phase, only ranged/siege attacks allowed
  if (isRangedSiegePhase && !isRangedOrSiege) {
    return invalid(
      INVALID_ATTACK_TYPE,
      "Only Ranged or Siege attacks can be assigned in Ranged/Siege phase"
    );
  }

  return valid();
}

// In Ranged/Siege phase, fortified enemies can only receive siege attacks
export function validateAssignAttackFortification(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  // Only applies in Ranged/Siege phase
  if (state.combat?.phase !== COMBAT_PHASE_RANGED_SIEGE) return valid();

  const enemy = state.combat.enemies.find((e) => e.instanceId === action.enemyInstanceId);
  if (!enemy) return valid();

  const isAtFortifiedSite = state.combat.isAtFortifiedSite;
  const fortificationLevel = getFortificationLevel(enemy, isAtFortifiedSite);

  if (fortificationLevel > 0 && action.attackType !== ATTACK_TYPE_SIEGE) {
    return invalid(
      FORTIFIED_NEEDS_SIEGE,
      `Fortified enemy (${enemy.definition.name}) can only receive Siege attacks in Ranged/Siege phase`
    );
  }

  return valid();
}
