/**
 * Mana Token Events
 *
 * Events for using temporary mana tokens from card effects.
 *
 * @module events/mana/tokens
 */

import type { ManaColor } from "../../ids.js";

// ============================================================================
// MANA_TOKEN_USED
// ============================================================================

/**
 * Event type constant for using a mana token.
 * @see ManaTokenUsedEvent
 */
export const MANA_TOKEN_USED = "MANA_TOKEN_USED" as const;

/**
 * Emitted when a temporary mana token is spent.
 *
 * Temporary tokens come from card effects (not from dice).
 *
 * @remarks
 * - Token is consumed
 * - Distinct from die-based mana
 * - Triggers: Powering cards with effect-generated mana
 *
 * @example
 * ```typescript
 * if (event.type === MANA_TOKEN_USED) {
 *   removeManaToken(event.playerId, event.color);
 * }
 * ```
 */
export interface ManaTokenUsedEvent {
  readonly type: typeof MANA_TOKEN_USED;
  /** ID of the player who used the token */
  readonly playerId: string;
  /** Color of mana used */
  readonly color: ManaColor;
}

/**
 * Creates a ManaTokenUsedEvent.
 */
export function createManaTokenUsedEvent(
  playerId: string,
  color: ManaColor
): ManaTokenUsedEvent {
  return {
    type: MANA_TOKEN_USED,
    playerId,
    color,
  };
}
