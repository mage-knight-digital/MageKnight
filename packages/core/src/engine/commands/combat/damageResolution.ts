/**
 * Damage resolution utilities for combat phase transitions.
 *
 * Handles:
 * - Calculating effective damage after applying resistances
 * - Resolving pending damage against enemies
 * - Clearing combat state between phases
 * - Applying fame and reputation changes from defeated enemies
 */

import type { GameEvent } from "@mage-knight/shared";
import {
  getLevelsCrossed,
  createEnemyDefeatedEvent,
  createReputationChangedEvent,
  REPUTATION_REASON_DEFEAT_ENEMY,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "@mage-knight/shared";
import type {
  CombatState,
  CombatEnemy,
  PendingElementalDamage,
} from "../../../types/combat.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player, CombatAccumulator } from "../../../types/player.js";
import {
  createEmptyAccumulatedAttack,
  createEmptyElementalValues,
} from "../../../types/player.js";
import { isAttackResisted, type Resistances } from "../../combat/elementalCalc.js";

// ============================================================================
// Pending Damage Resolution
// ============================================================================

/**
 * Get enemy resistances from their definition.
 */
function getEnemyResistances(enemy: CombatEnemy): Resistances {
  return enemy.definition.resistances;
}

/**
 * Calculate effective damage after applying resistances.
 */
function calculateEffectiveDamage(
  pending: PendingElementalDamage,
  resistances: Resistances
): number {
  let total = 0;

  // Physical damage
  if (pending.physical > 0) {
    total += isAttackResisted("physical", resistances)
      ? Math.floor(pending.physical / 2)
      : pending.physical;
  }

  // Fire damage
  if (pending.fire > 0) {
    total += isAttackResisted("fire", resistances)
      ? Math.floor(pending.fire / 2)
      : pending.fire;
  }

  // Ice damage
  if (pending.ice > 0) {
    total += isAttackResisted("ice", resistances)
      ? Math.floor(pending.ice / 2)
      : pending.ice;
  }

  // Cold Fire damage
  if (pending.coldFire > 0) {
    total += isAttackResisted("cold_fire", resistances)
      ? Math.floor(pending.coldFire / 2)
      : pending.coldFire;
  }

  return total;
}

/**
 * Result of resolving pending damage for combat.
 */
export interface ResolvePendingDamageResult {
  /** Updated enemies with isDefeated flags set */
  enemies: readonly CombatEnemy[];
  /** Total fame gained from defeating enemies */
  fameGained: number;
  /** Total reputation penalty from defeating enemies with reputationPenalty */
  reputationPenalty: number;
  /** Total reputation bonus from defeating enemies with reputationBonus */
  reputationBonus: number;
  /** Events for defeated enemies */
  events: readonly GameEvent[];
}

/**
 * Resolve all pending damage against enemies.
 * Returns updated enemy list with defeated enemies marked.
 */
export function resolvePendingDamage(
  combat: CombatState,
  _playerId: string
): ResolvePendingDamageResult {
  const events: GameEvent[] = [];
  let fameGained = 0;
  let reputationPenalty = 0;
  let reputationBonus = 0;

  const updatedEnemies = combat.enemies.map((enemy) => {
    // Skip already defeated enemies
    if (enemy.isDefeated) return enemy;

    // Get pending damage for this enemy
    const pending = combat.pendingDamage[enemy.instanceId];
    if (!pending) return enemy;

    // Calculate effective damage
    const resistances = getEnemyResistances(enemy);
    const effectiveDamage = calculateEffectiveDamage(pending, resistances);

    // Check if enemy is defeated
    if (effectiveDamage >= enemy.definition.armor) {
      const fame = enemy.definition.fame;
      fameGained += fame;
      events.push(createEnemyDefeatedEvent(enemy.instanceId, enemy.definition.name, fame));

      // Track reputation changes from defeated enemies
      if (enemy.definition.reputationPenalty) {
        reputationPenalty += enemy.definition.reputationPenalty;
      }
      if (enemy.definition.reputationBonus) {
        reputationBonus += enemy.definition.reputationBonus;
      }

      return {
        ...enemy,
        isDefeated: true,
      };
    }

    return enemy;
  });

  return {
    enemies: updatedEnemies,
    fameGained,
    reputationPenalty,
    reputationBonus,
    events,
  };
}

/**
 * Clear pending damage and assigned attack from combat and player state.
 */
export function clearPendingAndAssigned(
  state: GameState,
  playerId: string
): GameState {
  // Clear combat pending damage
  const updatedCombat = state.combat
    ? {
        ...state.combat,
        pendingDamage: {},
      }
    : null;

  // Clear player's assigned attack
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { ...state, combat: updatedCombat };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { ...state, combat: updatedCombat };
  }

  const updatedAccumulator: CombatAccumulator = {
    ...player.combatAccumulator,
    assignedAttack: createEmptyAccumulatedAttack(),
  };

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: updatedAccumulator,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    combat: updatedCombat,
    players: updatedPlayers,
  };
}

/**
 * Clear pending block and assigned block from combat and player state.
 * Called when transitioning from BLOCK phase - any uncommitted block is lost.
 */
export function clearPendingBlock(state: GameState, playerId: string): GameState {
  // Clear combat pending block
  const updatedCombat = state.combat
    ? {
        ...state.combat,
        pendingBlock: {},
      }
    : null;

  // Clear player's assigned block tracking
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { ...state, combat: updatedCombat };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { ...state, combat: updatedCombat };
  }

  const updatedAccumulator: CombatAccumulator = {
    ...player.combatAccumulator,
    assignedBlock: 0,
    assignedBlockElements: createEmptyElementalValues(),
  };

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: updatedAccumulator,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    combat: updatedCombat,
    players: updatedPlayers,
  };
}

/**
 * Apply fame gained from defeated enemies to a player.
 * Also handles level-up tracking when fame thresholds are crossed.
 */
export function applyFameToPlayer(
  state: GameState,
  playerId: string,
  fameGained: number
): GameState {
  if (fameGained <= 0) {
    return state;
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return state;
  }

  const player = state.players[playerIndex];
  if (!player) {
    return state;
  }

  // Check for level ups when fame changes
  const oldFame = player.fame;
  const newFame = oldFame + fameGained;
  const levelsCrossed = getLevelsCrossed(oldFame, newFame);

  const updatedPlayer: Player = {
    ...player,
    fame: newFame,
    pendingLevelUps: [...player.pendingLevelUps, ...levelsCrossed],
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    players: updatedPlayers,
  };
}

/**
 * Result of applying reputation change to a player.
 */
export interface ApplyReputationChangeResult {
  /** Updated game state */
  state: GameState;
  /** Events for reputation change */
  events: readonly GameEvent[];
}

/**
 * Apply reputation change from defeated enemies to a player.
 * Handles both bonuses (positive change) and penalties (negative change).
 * Reputation is clamped to -7 minimum and +7 maximum.
 */
export function applyReputationChange(
  state: GameState,
  playerId: string,
  bonus: number,
  penalty: number
): ApplyReputationChangeResult {
  const netChange = bonus - penalty;
  if (netChange === 0) {
    return { state, events: [] };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, events: [] };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { state, events: [] };
  }

  const oldReputation = player.reputation;
  const newReputation = Math.max(
    MIN_REPUTATION,
    Math.min(MAX_REPUTATION, oldReputation + netChange)
  );

  // Don't emit event if reputation didn't actually change (hit floor/ceiling)
  if (newReputation === oldReputation) {
    return { state, events: [] };
  }

  const updatedPlayer: Player = {
    ...player,
    reputation: newReputation,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  const events: GameEvent[] = [
    createReputationChangedEvent(
      playerId,
      newReputation - oldReputation, // actual delta (may differ from netChange due to clamping)
      newReputation,
      REPUTATION_REASON_DEFEAT_ENEMY
    ),
  ];

  return {
    state: {
      ...state,
      players: updatedPlayers,
    },
    events,
  };
}
