/**
 * Unit activation validators
 *
 * Validates unit activation and ability usage:
 * - Unit existence and state (ready, not wounded)
 * - Ability index and phase matching
 * - Combat requirements and restrictions
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  ACTIVATE_UNIT_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  getUnit,
  UNIT_STATE_READY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
} from "@mage-knight/shared";
import {
  PLAYER_NOT_FOUND,
  UNIT_NOT_FOUND,
  UNIT_NOT_READY,
  UNIT_IS_WOUNDED,
  UNIT_WOUNDED_NO_DAMAGE,
  UNIT_USED_RESISTANCE,
  INVALID_ABILITY_INDEX,
  WRONG_PHASE_FOR_ABILITY,
  NON_COMBAT_ABILITY,
  PASSIVE_ABILITY,
  SIEGE_REQUIRED,
  NOT_IN_COMBAT,
  UNITS_NOT_ALLOWED,
} from "../validationCodes.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../../types/combat.js";

/**
 * Check unit exists and belongs to player
 */
export function validateUnitExists(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) {
    return invalid(UNIT_NOT_FOUND, "Unit not found");
  }

  return valid();
}

/**
 * Check unit can be activated (ready and not wounded)
 */
export function validateUnitCanActivate(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return invalid(UNIT_NOT_FOUND, "Unit not found");

  if (unit.state !== UNIT_STATE_READY) {
    return invalid(UNIT_NOT_READY, "Unit is not ready");
  }

  if (unit.wounded) {
    return invalid(UNIT_IS_WOUNDED, "Wounded units cannot be activated");
  }

  return valid();
}

/**
 * Validate unit can receive damage (not wounded, not used resistance this combat)
 *
 * Per rulebook: wounded units cannot absorb additional damage, and units that
 * absorbed damage via resistance cannot absorb again until the next round.
 */
export function validateUnitCanReceiveDamage(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  // If no assignments provided, all damage goes to hero (no unit validation needed)
  if (!action.assignments) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  for (const assignment of action.assignments) {
    if (assignment.target !== DAMAGE_TARGET_UNIT) continue;

    const unit = player.units.find(
      (u) => u.instanceId === assignment.unitInstanceId
    );
    if (!unit) {
      return invalid(
        UNIT_NOT_FOUND,
        `Unit ${assignment.unitInstanceId} not found`
      );
    }

    if (unit.wounded) {
      return invalid(
        UNIT_WOUNDED_NO_DAMAGE,
        "Cannot assign damage to a wounded unit"
      );
    }

    if (unit.usedResistanceThisCombat) {
      return invalid(
        UNIT_USED_RESISTANCE,
        "Cannot assign damage to a unit that already absorbed damage this combat"
      );
    }
  }

  return valid();
}

/**
 * Validate the ability index is valid for the unit
 */
export function validateAbilityIndex(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return invalid(UNIT_NOT_FOUND, "Unit not found");

  const unitDef = getUnit(unit.unitId);
  const ability = unitDef.abilities[action.abilityIndex];

  if (!ability) {
    return invalid(
      INVALID_ABILITY_INDEX,
      `Invalid ability index: ${action.abilityIndex}`
    );
  }

  return valid();
}

/**
 * Validate ability matches current combat phase
 *
 * Combat abilities can only be used during appropriate phases:
 * - Ranged/Siege: Ranged & Siege phase or Attack phase
 * - Block: Block phase
 * - Attack: Attack phase
 */
export function validateAbilityMatchesPhase(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  // If not in combat, ability phase check doesn't apply
  // (non-combat abilities like Move/Influence can be used outside combat)
  if (!state.combat) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return invalid(UNIT_NOT_FOUND, "Unit not found");

  const unitDef = getUnit(unit.unitId);
  const ability = unitDef.abilities[action.abilityIndex];
  if (!ability) return valid(); // Other validator handles

  const phase = state.combat.phase;

  switch (ability.type) {
    case UNIT_ABILITY_RANGED_ATTACK:
    case UNIT_ABILITY_SIEGE_ATTACK:
      // Valid in Ranged & Siege phase or Attack phase
      if (phase !== COMBAT_PHASE_RANGED_SIEGE && phase !== COMBAT_PHASE_ATTACK) {
        return invalid(
          WRONG_PHASE_FOR_ABILITY,
          "Ranged/Siege abilities can only be used in Ranged & Siege or Attack phase"
        );
      }
      break;

    case UNIT_ABILITY_BLOCK:
      if (phase !== COMBAT_PHASE_BLOCK) {
        return invalid(
          WRONG_PHASE_FOR_ABILITY,
          "Block abilities can only be used in Block phase"
        );
      }
      break;

    case UNIT_ABILITY_ATTACK:
      if (phase !== COMBAT_PHASE_ATTACK) {
        return invalid(
          WRONG_PHASE_FOR_ABILITY,
          "Attack abilities can only be used in Attack phase"
        );
      }
      break;

    case UNIT_ABILITY_SWIFT:
    case UNIT_ABILITY_BRUTAL:
    case UNIT_ABILITY_POISON:
    case UNIT_ABILITY_PARALYZE:
      return invalid(
        PASSIVE_ABILITY,
        "This is a passive ability that applies automatically when the unit attacks"
      );

    default:
      // Non-combat abilities (move, influence, heal) cannot be "activated"
      // for combat contributions
      return invalid(
        NON_COMBAT_ABILITY,
        "This ability cannot be used in combat"
      );
  }

  return valid();
}

/**
 * Validate siege is required for fortified enemies in ranged phase
 *
 * When attacking a fortified site in the Ranged & Siege phase,
 * only Siege attacks work - regular Ranged attacks bounce off walls.
 */
export function validateSiegeRequirement(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();
  if (!state.combat) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return valid();

  const unitDef = getUnit(unit.unitId);
  const ability = unitDef.abilities[action.abilityIndex];
  if (!ability) return valid();

  // In Ranged & Siege phase at fortified site, only Siege attacks work
  if (
    state.combat.phase === COMBAT_PHASE_RANGED_SIEGE &&
    state.combat.isAtFortifiedSite &&
    ability.type === UNIT_ABILITY_RANGED_ATTACK
  ) {
    return invalid(
      SIEGE_REQUIRED,
      "Only Siege attacks can be used against fortified enemies in Ranged & Siege phase"
    );
  }

  return valid();
}

/**
 * Check if unit activation requires being in combat
 *
 * Combat abilities (attack, block, ranged, siege) require active combat.
 * Non-combat abilities (move, influence, heal) can be used outside combat.
 */
export function validateCombatRequiredForAbility(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return invalid(UNIT_NOT_FOUND, "Unit not found");

  const unitDef = getUnit(unit.unitId);
  const ability = unitDef.abilities[action.abilityIndex];
  if (!ability) return valid(); // Other validator handles

  // Combat abilities require being in combat
  const combatAbilities: readonly string[] = [
    UNIT_ABILITY_ATTACK,
    UNIT_ABILITY_BLOCK,
    UNIT_ABILITY_RANGED_ATTACK,
    UNIT_ABILITY_SIEGE_ATTACK,
  ];

  if (combatAbilities.includes(ability.type) && !state.combat) {
    return invalid(
      NOT_IN_COMBAT,
      "Combat abilities can only be used during combat"
    );
  }

  return valid();
}

/**
 * Validate units are allowed in this combat
 *
 * Dungeons and Tombs have special rules: units cannot be activated.
 * The hero must fight alone.
 */
export function validateUnitsAllowedInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();
  if (!state.combat) return valid();

  if (!state.combat.unitsAllowed) {
    return invalid(
      UNITS_NOT_ALLOWED,
      "Units cannot be used in this combat (dungeon/tomb)"
    );
  }

  return valid();
}
