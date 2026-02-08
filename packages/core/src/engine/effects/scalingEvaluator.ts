/**
 * Evaluates scaling factors to determine bonus multipliers for scaling effects
 */

import type { GameState } from "../../state/GameState.js";
import type { ScalingFactor } from "../../types/scaling.js";
import {
  SCALING_PER_ENEMY,
  SCALING_PER_WOUND_IN_HAND,
  SCALING_PER_WOUND_THIS_COMBAT,
  SCALING_PER_UNIT,
  SCALING_PER_CRYSTAL_COLOR,
  SCALING_PER_EMPTY_COMMAND_TOKEN,
  SCALING_PER_WOUND_TOTAL,
  SCALING_PER_ENEMY_BLOCKED,
} from "../../types/scaling.js";
import type { UnitFilter } from "../../types/scaling.js";
import type { PlayerUnit } from "../../types/unit.js";
import { CARD_WOUND, UNIT_STATE_READY, UNIT_STATE_SPENT } from "@mage-knight/shared";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { isEnemyAssignedToPlayer } from "../helpers/cooperativeAssaultHelpers.js";
import { isEnemyFullyBlocked } from "../combat/enemyAttackHelpers.js";

/**
 * Evaluates a scaling factor and returns the count to multiply by.
 *
 * @param state - The current game state
 * @param playerId - The player whose perspective to evaluate from
 * @param factor - The scaling factor to evaluate
 * @returns The count (e.g., number of enemies, wounds, units)
 */
export function evaluateScalingFactor(
  state: GameState,
  playerId: string,
  factor: ScalingFactor
): number {
  const player = getPlayerById(state, playerId);
  if (!player) return 0;

  switch (factor.type) {
    case SCALING_PER_ENEMY: {
      // Count undefeated, non-summoned enemies assigned to this player
      if (!state.combat) return 0;
      return state.combat.enemies.filter((e) =>
        !e.isDefeated &&
        !e.summonedByInstanceId &&
        isEnemyAssignedToPlayer(state.combat?.enemyAssignments, playerId, e.instanceId)
      ).length;
    }

    case SCALING_PER_WOUND_IN_HAND: {
      // Count wounds in player's hand
      return player.hand.filter((c) => c === CARD_WOUND).length;
    }

    case SCALING_PER_WOUND_THIS_COMBAT: {
      if (!state.combat) return 0;
      return state.combat.woundsThisCombat;
    }

    case SCALING_PER_UNIT: {
      // Count player's units, optionally filtered
      return countUnitsWithFilter(player.units, factor.filter);
    }

    case SCALING_PER_CRYSTAL_COLOR: {
      // Count number of different crystal colors the player has (0-4)
      let count = 0;
      if (player.crystals.red > 0) count++;
      if (player.crystals.blue > 0) count++;
      if (player.crystals.green > 0) count++;
      if (player.crystals.white > 0) count++;
      return count;
    }

    case SCALING_PER_EMPTY_COMMAND_TOKEN: {
      // Count empty command token slots
      // Command tokens = max units player can have
      // Empty = commandTokens - current unit count
      const usedSlots = player.units.length;
      return Math.max(0, player.commandTokens - usedSlots);
    }

    case SCALING_PER_WOUND_TOTAL: {
      // Count wounds in hand + wounded units
      const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;
      const woundedUnits = player.units.filter((u) => u.wounded).length;
      return woundsInHand + woundedUnits;
    }

    case SCALING_PER_ENEMY_BLOCKED: {
      // Count enemies that are fully blocked this combat (all attacks blocked).
      // Multi-attack enemies only count when ALL attacks are blocked.
      if (!state.combat) return 0;
      return state.combat.enemies.filter((e) =>
        isEnemyFullyBlocked(e) &&
        !e.summonedByInstanceId &&
        isEnemyAssignedToPlayer(state.combat?.enemyAssignments, playerId, e.instanceId)
      ).length;
    }

    default: {
      // Exhaustiveness check
      const _exhaustiveCheck: never = factor;
      return _exhaustiveCheck;
    }
  }
}

/**
 * Count units matching the optional filter criteria.
 */
function countUnitsWithFilter(
  units: readonly PlayerUnit[],
  filter?: UnitFilter
): number {
  if (!filter) {
    // Default: count non-wounded units (backwards compatible)
    return units.filter((u) => !u.wounded).length;
  }

  return units.filter((unit) => {
    // Check wound status if specified
    if (filter.wounded !== undefined && unit.wounded !== filter.wounded) {
      return false;
    }

    // Check unit state if specified
    if (filter.state !== undefined) {
      const targetState = filter.state === "ready" ? UNIT_STATE_READY : UNIT_STATE_SPENT;
      if (unit.state !== targetState) {
        return false;
      }
    }

    // Check max level if specified
    // Note: Would need to look up unit definition for level
    // For now, we'll skip level filtering as it requires UNITS lookup
    // TODO: Add level filtering when needed

    return true;
  }).length;
}
