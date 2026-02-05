/**
 * Combat options computation for ValidActions.
 *
 * Computes what combat actions are valid based on the current combat phase.
 * Includes incremental attack assignment fields for RANGED_SIEGE and ATTACK phases.
 *
 * This module is split into domain-specific files:
 * - combatHelpers.ts - Shared utility functions (resistances, elemental calc)
 * - combatAttack.ts - Attack pool computation and RANGED_SIEGE/ATTACK phases
 * - combatBlock.ts - Block pool computation and BLOCK phase
 * - combatDamage.ts - Damage assignment computation and ASSIGN_DAMAGE phase
 */

import type { CombatOptions, ThugsDamagePaymentOption } from "@mage-knight/shared";
import { getUnit } from "@mage-knight/shared";
import type { CombatState, EnemyAssignments } from "../../types/combat.js";
import type { CombatEnemy } from "../../types/combat.js";
import { isEnemyAssignedToPlayer } from "../helpers/cooperativeAssaultHelpers.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { HEROES_ASSAULT_INFLUENCE_COST } from "../commands/combat/payHeroesAssaultInfluenceCommand.js";
import { THUGS_DAMAGE_INFLUENCE_COST } from "../commands/combat/payThugsDamageInfluenceCommand.js";

// Import from domain-specific modules
import { computeAttackPhaseOptions } from "./combatAttack.js";
import { computeBlockPhaseOptions } from "./combatBlock.js";
import { getDamageAssignmentOptions, canEndAssignDamagePhase } from "./combatDamage.js";

// Re-export all domain functions for backwards compatibility
export * from "./combatHelpers.js";
export * from "./combatAttack.js";
export * from "./combatBlock.js";
export * from "./combatDamage.js";

// ============================================================================
// Heroes Assault Influence Options
// ============================================================================

/**
 * Computes Heroes assault influence options for CombatOptions.
 *
 * Heroes units cannot use abilities during fortified site assaults unless
 * 2 Influence is paid once per combat. This function determines:
 * - Whether the payment option is applicable (fortified site assault)
 * - Whether payment has already been made
 * - Whether the player can afford to pay
 *
 * @returns Object with Heroes assault influence fields to merge into CombatOptions
 */
function getHeroesAssaultInfluenceOptions(
  combat: CombatState,
  player: Player | undefined
): Pick<
  CombatOptions,
  | "canPayHeroesAssaultInfluence"
  | "heroesAssaultInfluenceCost"
  | "heroesAssaultInfluencePaid"
> {
  // Only applicable for fortified site assaults (not defense or dungeons)
  const isApplicable =
    combat.isAtFortifiedSite && combat.assaultOrigin !== null;

  if (!isApplicable) {
    // Not a fortified site assault - don't include these fields
    return {};
  }

  const alreadyPaid = combat.paidHeroesAssaultInfluence;
  const canAfford =
    player !== undefined &&
    player.influencePoints >= HEROES_ASSAULT_INFLUENCE_COST;

  return {
    canPayHeroesAssaultInfluence: !alreadyPaid && canAfford,
    heroesAssaultInfluenceCost: HEROES_ASSAULT_INFLUENCE_COST,
    heroesAssaultInfluencePaid: alreadyPaid,
  };
}

// ============================================================================
// Thugs Damage Influence Payment Options
// ============================================================================

/**
 * Computes Thugs damage influence payment options for CombatOptions.
 *
 * Thugs units require 2 Influence payment before damage can be assigned to them.
 * This function checks all player units for Thugs that need payment.
 *
 * @returns Array of payment options (empty if no Thugs units present)
 */
function getThugsDamagePaymentOptions(
  combat: CombatState,
  player: Player | undefined
): readonly ThugsDamagePaymentOption[] {
  if (!player || !combat.unitsAllowed) return [];

  const options: ThugsDamagePaymentOption[] = [];

  for (const unit of player.units) {
    const unitDef = getUnit(unit.unitId);
    if ((unitDef.damageInfluenceCost ?? 0) <= 0) continue;

    // Skip wounded units (can't assign damage anyway)
    if (unit.wounded) continue;

    const alreadyPaid = combat.paidThugsDamageInfluence[unit.instanceId] ?? false;
    const canAfford = player.influencePoints >= THUGS_DAMAGE_INFLUENCE_COST;

    options.push({
      unitInstanceId: unit.instanceId,
      unitName: unitDef.name,
      cost: THUGS_DAMAGE_INFLUENCE_COST,
      canAfford: !alreadyPaid && canAfford,
      alreadyPaid,
    });
  }

  return options;
}

// ============================================================================
// Enemy Assignment Filtering (for Cooperative Assaults)
// ============================================================================

/**
 * Filter enemies to only those assigned to a specific player.
 * For cooperative assaults, each player can only see/target their assigned enemies.
 * Returns all enemies if no assignments exist (standard single-player combat).
 *
 * @param enemies - All enemies in combat
 * @param enemyAssignments - Map of player IDs to assigned enemy instance IDs
 * @param playerId - The player to filter for
 */
function filterEnemiesByAssignment(
  enemies: readonly CombatEnemy[],
  enemyAssignments: EnemyAssignments | undefined,
  playerId: string
): readonly CombatEnemy[] {
  if (!enemyAssignments) {
    return enemies; // No assignments = standard combat, all enemies visible
  }
  return enemies.filter((enemy) =>
    isEnemyAssignedToPlayer(enemyAssignments, playerId, enemy.instanceId)
  );
}

// ============================================================================
// Main getCombatOptions function
// ============================================================================

/**
 * Get combat options for the current player.
 * Returns null if not in combat.
 *
 * For cooperative assaults, filters enemies to only those assigned to the current player.
 * Each player can only see/target their assigned enemies.
 *
 * @param state - Full game state, needed to query modifiers for effective enemy stats
 */
export function getCombatOptions(state: GameState): CombatOptions | null {
  const combat = state.combat;
  if (!combat) return null;

  const { phase } = combat;

  // Get current player for accumulator access
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  // Filter enemies for cooperative assaults - player can only target their assigned enemies
  const visibleEnemies = filterEnemiesByAssignment(
    combat.enemies,
    combat.enemyAssignments,
    currentPlayerId ?? ""
  );

  // Create a filtered combat state for phase computations
  const filteredCombat: CombatState = {
    ...combat,
    enemies: visibleEnemies,
  };

  // Get Heroes assault influence options (applicable to all phases during fortified assaults)
  const heroesAssaultOptions = getHeroesAssaultInfluenceOptions(
    combat,
    currentPlayer
  );

  // Get Thugs damage payment options (applicable during ASSIGN_DAMAGE phase)
  const thugsDamageOptions = getThugsDamagePaymentOptions(combat, currentPlayer);

  // Compute phase-specific options
  let baseOptions: CombatOptions;
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      baseOptions = computeAttackPhaseOptions(state, filteredCombat, currentPlayer, true);
      break;

    case COMBAT_PHASE_BLOCK:
      baseOptions = computeBlockPhaseOptions(state, filteredCombat, currentPlayer);
      break;

    case COMBAT_PHASE_ASSIGN_DAMAGE:
      baseOptions = {
        phase,
        canEndPhase: canEndAssignDamagePhase(state, visibleEnemies),
        damageAssignments: getDamageAssignmentOptions(state, visibleEnemies),
      };
      break;

    case COMBAT_PHASE_ATTACK:
      baseOptions = computeAttackPhaseOptions(state, filteredCombat, currentPlayer, false);
      break;

    default:
      baseOptions = {
        phase,
        canEndPhase: true,
      };
  }

  // Merge Heroes assault options and Thugs damage options if applicable
  return {
    ...baseOptions,
    ...heroesAssaultOptions,
    ...(thugsDamageOptions.length > 0
      ? { thugsDamagePaymentOptions: thugsDamageOptions }
      : {}),
  };
}

// NOTE: getAttackOptions was removed. Phase 3 will add computation for
// incremental attack assignment (availableAttack, enemies, assignableAttacks, unassignableAttacks).
