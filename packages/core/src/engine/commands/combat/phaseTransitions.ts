/**
 * Combat phase transition handling module
 *
 * Handles transitions between combat phases:
 * RANGED_SIEGE -> BLOCK -> ASSIGN_DAMAGE -> ATTACK
 */

import type { CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import { COMBAT_PHASE_CHANGED } from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
  type CombatState,
} from "../../../types/combat.js";
import { createEmptyElementalValues } from "../../../types/player.js";

import {
  resolvePendingDamage,
  clearPendingAndAssigned,
  clearPendingBlock,
} from "./damageResolution.js";

import {
  resolveSummons,
  discardSummonedEnemies,
} from "./summonedEnemyHandling.js";

import { applyDefeatedEnemyRewards } from "./combatEndHandlers.js";

// ============================================================================
// Phase State Machine
// ============================================================================

/**
 * Get the next combat phase, or null if combat should end.
 */
export function getNextPhase(current: CombatPhase): CombatPhase | null {
  switch (current) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return COMBAT_PHASE_BLOCK;
    case COMBAT_PHASE_BLOCK:
      return COMBAT_PHASE_ASSIGN_DAMAGE;
    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return COMBAT_PHASE_ATTACK;
    case COMBAT_PHASE_ATTACK:
      return null; // Combat ends
  }
}

// ============================================================================
// Phase Transition Handling
// ============================================================================

/**
 * Handle transitioning from one combat phase to the next.
 */
export function handlePhaseTransition(
  state: GameState,
  playerId: string,
  currentPhase: CombatPhase,
  nextPhase: CombatPhase
): CommandResult {
  if (!state.combat) {
    throw new Error("Not in combat");
  }

  let updatedCombat: CombatState = {
    ...state.combat,
    phase: nextPhase,
    attacksThisPhase: 0,
  };
  let updatedState = state;
  const phaseEvents: GameEvent[] = [];

  // When transitioning from RANGED_SIEGE to BLOCK, resolve pending damage and summons
  if (
    currentPhase === COMBAT_PHASE_RANGED_SIEGE &&
    nextPhase === COMBAT_PHASE_BLOCK
  ) {
    const result = handleRangedSiegeToBlock(updatedState, updatedCombat, playerId);
    updatedState = result.state;
    updatedCombat = result.combat;
    phaseEvents.push(...result.events);
  }

  // When transitioning from BLOCK to ASSIGN_DAMAGE:
  // - Clear any uncommitted pending block (it's lost if not used)
  // - Calculate if all damage was blocked (for conditional effects like Burning Shield)
  if (
    currentPhase === COMBAT_PHASE_BLOCK &&
    nextPhase === COMBAT_PHASE_ASSIGN_DAMAGE
  ) {
    const result = handleBlockToAssignDamage(updatedState, updatedCombat, playerId);
    updatedState = result.state;
    updatedCombat = result.combat;
  }

  // When transitioning from ASSIGN_DAMAGE to ATTACK:
  // - Discard all summoned enemies (they grant no fame)
  // - Restore original summoners (unhide them)
  if (
    currentPhase === COMBAT_PHASE_ASSIGN_DAMAGE &&
    nextPhase === COMBAT_PHASE_ATTACK
  ) {
    const result = handleAssignDamageToAttack(updatedState, updatedCombat);
    updatedState = result.state;
    updatedCombat = result.combat;
    phaseEvents.push(...result.events);
  }

  return {
    state: { ...updatedState, combat: updatedCombat },
    events: [
      ...phaseEvents,
      {
        type: COMBAT_PHASE_CHANGED,
        previousPhase: currentPhase,
        newPhase: nextPhase,
      },
    ],
  };
}

/**
 * Handle transition from RANGED_SIEGE to BLOCK phase.
 * Resolves pending damage and activates summon abilities.
 */
export function handleRangedSiegeToBlock(
  state: GameState,
  combat: CombatState,
  playerId: string
): { state: GameState; combat: CombatState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  const damageResult = resolvePendingDamage(combat, playerId, state);
  events.push(...damageResult.events);

  let updatedCombat: CombatState = {
    ...combat,
    enemies: damageResult.enemies,
    fameGained: combat.fameGained + damageResult.fameGained,
    pendingDamage: {},
  };

  // Clear assigned attack from player
  let updatedState = clearPendingAndAssigned(
    { ...state, combat: updatedCombat },
    playerId
  );
  // Combat exists because we just passed it in
  if (!updatedState.combat) {
    throw new Error("Combat state unexpectedly cleared");
  }
  updatedCombat = updatedState.combat;

  // Apply fame and reputation rewards using consolidated helper
  const rewardsResult = applyDefeatedEnemyRewards(
    updatedState,
    playerId,
    damageResult
  );
  updatedState = rewardsResult.state;
  events.push(...rewardsResult.events);

  // Ranged/Siege attack points do not carry over into the Attack phase
  updatedState = clearRangedSiegeAttack(updatedState, playerId);

  // Update player's enemiesDefeatedThisTurn counter (for Sword of Justice fame bonus)
  if (damageResult.enemiesDefeatedCount > 0) {
    const playerIndex = updatedState.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      const player = updatedState.players[playerIndex];
      if (player) {
        const updatedPlayers = [...updatedState.players];
        updatedPlayers[playerIndex] = {
          ...player,
          enemiesDefeatedThisTurn: player.enemiesDefeatedThisTurn + damageResult.enemiesDefeatedCount,
        };
        updatedState = { ...updatedState, players: updatedPlayers };
      }
    }
  }

  // Resolve summon abilities - draw brown enemies for summoners
  const summonResult = resolveSummons(
    updatedState,
    updatedCombat,
    playerId
  );
  updatedState = summonResult.state;
  updatedCombat = summonResult.combat;
  events.push(...summonResult.events);

  return { state: updatedState, combat: updatedCombat, events };
}

function clearRangedSiegeAttack(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return state;
  }

  const player = state.players[playerIndex];
  if (!player) {
    return state;
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        ranged: 0,
        siege: 0,
        rangedElements: createEmptyElementalValues(),
        siegeElements: createEmptyElementalValues(),
      },
    },
  };

  return { ...state, players: updatedPlayers };
}

/**
 * Handle transition from BLOCK to ASSIGN_DAMAGE phase.
 * Clears uncommitted block and calculates if all damage was blocked.
 */
export function handleBlockToAssignDamage(
  state: GameState,
  combat: CombatState,
  playerId: string
): { state: GameState; combat: CombatState } {
  // Clear uncommitted pending block
  const updatedState = clearPendingBlock(
    { ...state, combat },
    playerId
  );
  if (!updatedState.combat) {
    throw new Error("Combat state unexpectedly cleared");
  }
  let updatedCombat = updatedState.combat;

  // All damage is blocked if every undefeated enemy is blocked
  const undefeatedEnemies = updatedCombat.enemies.filter(
    (e) => !e.isDefeated
  );
  const allBlocked =
    undefeatedEnemies.length === 0 ||
    undefeatedEnemies.every((e) => e.isBlocked);

  updatedCombat = {
    ...updatedCombat,
    allDamageBlockedThisPhase: allBlocked,
  };

  return { state: updatedState, combat: updatedCombat };
}

/**
 * Handle transition from ASSIGN_DAMAGE to ATTACK phase.
 * Discards summoned enemies and restores original summoners.
 */
export function handleAssignDamageToAttack(
  state: GameState,
  combat: CombatState
): { state: GameState; combat: CombatState; events: GameEvent[] } {
  const discardResult = discardSummonedEnemies(state, combat);
  return {
    state: discardResult.state,
    combat: discardResult.combat,
    events: [...discardResult.events],
  };
}
