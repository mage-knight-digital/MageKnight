/**
 * Effect Registry
 *
 * Map-based dispatch system for effect resolution. Each effect type can register
 * its handler, enabling modular addition of new effects without modifying the
 * central switch statement.
 *
 * @module effects/effectRegistry
 *
 * @remarks Architecture
 * - Effects are registered by their discriminator string (e.g., "gain_move")
 * - Registration happens when each module is imported
 * - The main resolveEffect() function looks up handlers from this registry
 * - Unregistered effects fall back to the switch statement (for safety during migration)
 *
 * @example Registering an effect
 * ```typescript
 * // In atomicEffects.ts
 * import { registerEffect } from './effectRegistry.js';
 *
 * registerEffect(EFFECT_GAIN_MOVE, (state, playerId, effect, sourceCardId) => {
 *   // Resolution logic
 *   return { state: newState, description: "Gained X Move" };
 * });
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function signature for effect resolution.
 * Matches the main resolveEffect signature for consistency.
 */
export type EffectHandler = (
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string
) => EffectResolutionResult;

/**
 * Effect type discriminator string (e.g., "gain_move", "compound")
 */
export type EffectType = CardEffect["type"];

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * The effect handler registry.
 * Maps effect type strings to their handler functions.
 */
const effectRegistry = new Map<EffectType, EffectHandler>();

/**
 * Register an effect handler for a specific effect type.
 *
 * @param effectType - The effect type discriminator (e.g., EFFECT_GAIN_MOVE)
 * @param handler - The handler function to call when this effect type is resolved
 *
 * @example
 * ```typescript
 * registerEffect(EFFECT_GAIN_MOVE, (state, playerId, effect, sourceCardId) => {
 *   const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
 *   const player = state.players[playerIndex];
 *   return applyGainMove(state, playerIndex, player, effect.amount);
 * });
 * ```
 */
export function registerEffect(effectType: EffectType, handler: EffectHandler): void {
  if (effectRegistry.has(effectType)) {
    throw new Error(`Effect type "${effectType}" is already registered`);
  }
  effectRegistry.set(effectType, handler);
}

/**
 * Get the handler for a specific effect type, if registered.
 *
 * @param effectType - The effect type discriminator
 * @returns The handler function, or undefined if not registered
 */
export function getEffectHandler(effectType: EffectType): EffectHandler | undefined {
  return effectRegistry.get(effectType);
}

/**
 * Check if an effect type has a registered handler.
 *
 * @param effectType - The effect type discriminator
 * @returns True if a handler is registered
 */
export function hasEffectHandler(effectType: EffectType): boolean {
  return effectRegistry.has(effectType);
}

/**
 * Get the count of registered effects (for debugging/testing).
 */
export function getRegisteredEffectCount(): number {
  return effectRegistry.size;
}

/**
 * Clear all registered effects (for testing only).
 * @internal
 */
export function clearRegistry(): void {
  effectRegistry.clear();
}
