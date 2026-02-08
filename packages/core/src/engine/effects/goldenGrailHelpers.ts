/**
 * Golden Grail helper functions
 *
 * Query and update functions for Golden Grail modifiers:
 * - Fame tracking: Awards Fame +1 per healing point from the Grail spent on hand wounds.
 * - Draw on heal: Draws a card each time a wound is healed from hand.
 */

import type { GameState } from "../../state/GameState.js";
import type { ActiveModifier, GoldenGrailFameTrackingModifier } from "../../types/modifiers.js";
import {
  EFFECT_GOLDEN_GRAIL_FAME_TRACKING,
  EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL,
} from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";

/**
 * Get the Golden Grail fame tracking modifier for a player, if active.
 * Returns the modifier and its index in activeModifiers for updating.
 */
export function getGoldenGrailFameTracker(
  state: GameState,
  playerId: string
): ActiveModifier | undefined {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.find(
    (m) => m.effect.type === EFFECT_GOLDEN_GRAIL_FAME_TRACKING
  );
}

/**
 * Calculate how many fame points the Golden Grail should award for wounds healed.
 * Returns the number of fame points (capped by the modifier's remaining healing points).
 */
export function calculateGrailFame(
  modifier: ActiveModifier,
  woundsHealed: number
): number {
  const effect = modifier.effect as GoldenGrailFameTrackingModifier;
  return Math.min(woundsHealed, effect.remainingHealingPoints);
}

/**
 * Update the Golden Grail fame tracking modifier after healing.
 * Decrements the remaining healing points by the fame awarded.
 */
export function updateGrailFameTracker(
  state: GameState,
  modifier: ActiveModifier,
  fameAwarded: number
): GameState {
  const effect = modifier.effect as GoldenGrailFameTrackingModifier;
  const newRemaining = effect.remainingHealingPoints - fameAwarded;

  if (newRemaining <= 0) {
    // Remove the modifier entirely — all healing points accounted for
    return {
      ...state,
      activeModifiers: state.activeModifiers.filter((m) => m.id !== modifier.id),
    };
  }

  // Update remaining healing points
  return {
    ...state,
    activeModifiers: state.activeModifiers.map((m) =>
      m.id === modifier.id
        ? {
            ...m,
            effect: {
              ...effect,
              remainingHealingPoints: newRemaining,
            },
          }
        : m
    ),
  };
}

/**
 * Check if the Golden Grail draw-on-heal modifier is active for a player.
 */
export function isGoldenGrailDrawOnHealActive(
  state: GameState,
  playerId: string
): boolean {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some(
    (m) => m.effect.type === EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL
  );
}
