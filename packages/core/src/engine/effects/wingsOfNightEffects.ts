/**
 * Wings of Night Effect Resolution
 *
 * Handles the powered effect of Wings of Wind spell:
 * - EFFECT_WINGS_OF_NIGHT: Entry point, finds eligible enemies, generates selection
 * - EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET: Applies skip-attack, deducts move cost, chains
 *
 * Multi-target with scaling move cost:
 * - 1st enemy: free (0 move)
 * - 2nd enemy: 1 move point
 * - 3rd enemy: 2 move points
 * - 4th enemy: 3 move points
 * - etc. (total for N enemies = 0 + 1 + 2 + ... + (N-1))
 *
 * Arcane Immune enemies cannot be targeted.
 *
 * @module effects/wingsOfNightEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import { ABILITY_ARCANE_IMMUNITY } from "@mage-knight/shared";
import type {
  WingsOfNightEffect,
  ResolveWingsOfNightTargetEffect,
  CardEffect,
  NoopEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import {
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/index.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicEffects.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

// ============================================================================
// WINGS OF NIGHT (Entry Point)
// ============================================================================

/**
 * Entry point for Wings of Night multi-target skip-attack.
 * Finds eligible enemies (non-defeated, non-arcane-immune) and generates selection.
 * First target is free; additional targets cost increasing move points.
 */
function handleWingsOfNight(
  state: GameState,
  playerId: string,
  _effect: WingsOfNightEffect,
  alreadyTargeted: readonly string[] = [],
  targetCount: number = 0
): EffectResolutionResult {
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  // Calculate move cost for the next target
  const nextMoveCost = targetCount; // 0 for first, 1 for second, 2 for third, etc.

  // Check if player has enough move points for the next target
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, description: "Player not found" };
  }

  // If not the first target, check move points
  if (targetCount > 0 && player.movePoints < nextMoveCost) {
    return {
      state,
      description: `Not enough move points for another target (need ${nextMoveCost})`,
    };
  }

  // Get eligible enemies: alive, not arcane immune, not already targeted
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    if (e.isDefeated) return false;
    if (alreadyTargeted.includes(e.instanceId)) return false;
    if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    return true;
  });

  if (eligibleEnemies.length === 0) {
    if (targetCount === 0) {
      return {
        state,
        description: "No valid enemy targets (all Arcane Immune or defeated)",
      };
    }
    return {
      state,
      description: `Targeted ${targetCount} enemies (no more valid targets)`,
    };
  }

  // Generate choice options: one per eligible enemy
  const choiceOptions: CardEffect[] = eligibleEnemies.map((enemy) => ({
    type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    moveCost: nextMoveCost,
    targetCount: targetCount + 1,
  } as ResolveWingsOfNightTargetEffect));

  // If at least one target already selected, add "Done" option
  if (targetCount > 0) {
    choiceOptions.push({ type: EFFECT_NOOP } as NoopEffect);
  }

  const costDescription = targetCount === 0
    ? "free"
    : `costs ${nextMoveCost} Move`;

  return {
    state,
    description: `Select enemy (${costDescription})${targetCount > 0 ? " or Done" : ""}`,
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE WINGS OF NIGHT TARGET
// ============================================================================

/**
 * Resolve a selected enemy target for Wings of Night.
 * Applies SKIP_ATTACK modifier, deducts move cost, then chains back for more targets.
 */
function handleResolveWingsOfNightTarget(
  state: GameState,
  playerId: string,
  effect: ResolveWingsOfNightTargetEffect,
  sourceCardId?: string
): EffectResolutionResult {
  if (!state.combat) {
    return { state, description: "Not in combat" };
  }

  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Verify the enemy exists and is eligible
  const enemy = state.combat.enemies.find(
    (e) => e.instanceId === effect.enemyInstanceId
  );
  if (!enemy) {
    return { state, description: "Enemy not found" };
  }

  // Deduct move cost
  let currentState = state;
  if (effect.moveCost > 0) {
    if (player.movePoints < effect.moveCost) {
      return { state, description: "Not enough move points" };
    }
    const updatedPlayer = {
      ...player,
      movePoints: player.movePoints - effect.moveCost,
    };
    currentState = updatePlayer(currentState, playerIndex, updatedPlayer);
  }

  // Apply SKIP_ATTACK modifier to the enemy
  currentState = addModifier(currentState, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "wings_of_wind") as CardId,
      playerId,
    },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
    effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
    createdAtRound: currentState.round,
    createdByPlayerId: playerId,
  });

  const costStr = effect.moveCost > 0 ? ` (spent ${effect.moveCost} Move)` : "";

  // Collect already targeted enemies
  const alreadyTargeted: string[] = [];
  // Reconstruct from current combat modifiers: enemies with SKIP_ATTACK from this card
  for (const mod of currentState.activeModifiers) {
    if (
      mod.effect.type === EFFECT_ENEMY_SKIP_ATTACK &&
      mod.scope.type === SCOPE_ONE_ENEMY &&
      mod.source.type === SOURCE_CARD &&
      mod.createdByPlayerId === playerId
    ) {
      alreadyTargeted.push(mod.scope.enemyId);
    }
  }

  // Chain back for more targets
  const continuationResult = handleWingsOfNight(
    currentState,
    playerId,
    { type: EFFECT_WINGS_OF_NIGHT },
    alreadyTargeted,
    effect.targetCount
  );

  // If no more targets available, return base result
  if (!continuationResult.requiresChoice) {
    return {
      state: currentState,
      description: `${effect.enemyName} does not attack${costStr}`,
    };
  }

  return {
    state: currentState,
    description: `${effect.enemyName} does not attack${costStr}`,
    requiresChoice: continuationResult.requiresChoice,
    dynamicChoiceOptions: continuationResult.dynamicChoiceOptions,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Wings of Night effect handlers with the effect registry.
 */
export function registerWingsOfNightEffects(): void {
  registerEffect(EFFECT_WINGS_OF_NIGHT, (state, playerId, effect) => {
    return handleWingsOfNight(state, playerId, effect as WingsOfNightEffect);
  });

  registerEffect(EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET, (state, playerId, effect, sourceCardId) => {
    return handleResolveWingsOfNightTarget(
      state,
      playerId,
      effect as ResolveWingsOfNightTargetEffect,
      sourceCardId
    );
  });
}
