/**
 * Meditation spell rules.
 *
 * Pure functions for determining Meditation/Trance eligibility and parameters.
 */

import type { Player } from "../../types/player.js";

/**
 * Get the number of cards to select from discard for Meditation.
 * Returns min(2, discard.length).
 */
export function getMeditationSelectCount(player: Player): number {
  return Math.min(2, player.discard.length);
}

/**
 * Check if Meditation can be played (requires at least 1 card in discard).
 */
export function canPlayMeditation(player: Player): boolean {
  return player.discard.length > 0;
}
