/**
 * Mana Dice Events
 *
 * Events for taking, using, and returning mana dice from the shared source.
 *
 * @module events/mana/dice
 */

import type { ManaColor } from "../../ids.js";

// ============================================================================
// MANA_DIE_TAKEN
// ============================================================================

/**
 * Event type constant for taking a mana die.
 * @see ManaDieTakenEvent
 */
export const MANA_DIE_TAKEN = "MANA_DIE_TAKEN" as const;

/**
 * Emitted when a player takes a die from the mana source.
 *
 * The die's color becomes available as a mana token for the player.
 *
 * @remarks
 * - Die remains in source but marked as taken
 * - Player gains a token of the die's color
 * - Die returns to source at round end
 * - Triggers: Mana Draw tactic, certain card effects
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_TAKEN) {
 *   markDieAsTaken(event.dieId);
 *   addManaToken(event.playerId, event.color);
 * }
 * ```
 */
export interface ManaDieTakenEvent {
  readonly type: typeof MANA_DIE_TAKEN;
  /** ID of the player who took the die */
  readonly playerId: string;
  /** ID of the die taken */
  readonly dieId: string;
  /** Color of the die */
  readonly color: ManaColor;
}

/**
 * Creates a ManaDieTakenEvent.
 */
export function createManaDieTakenEvent(
  playerId: string,
  dieId: string,
  color: ManaColor
): ManaDieTakenEvent {
  return {
    type: MANA_DIE_TAKEN,
    playerId,
    dieId,
    color,
  };
}

/**
 * Type guard for ManaDieTakenEvent.
 */
export function isManaDieTakenEvent(event: {
  type: string;
}): event is ManaDieTakenEvent {
  return event.type === MANA_DIE_TAKEN;
}

// ============================================================================
// MANA_DIE_RETURNED
// ============================================================================

/**
 * Event type constant for returning a mana die.
 * @see ManaDieReturnedEvent
 */
export const MANA_DIE_RETURNED = "MANA_DIE_RETURNED" as const;

/**
 * Emitted when a mana die is returned to the source.
 *
 * The die is rerolled and gets a new color.
 *
 * @remarks
 * - Occurs at end of round typically
 * - newColor is the result of the reroll
 * - Die becomes available for next round
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_RETURNED) {
 *   returnDieToSource(event.dieId);
 *   setDieColor(event.dieId, event.newColor);
 * }
 * ```
 */
export interface ManaDieReturnedEvent {
  readonly type: typeof MANA_DIE_RETURNED;
  /** ID of the returned die */
  readonly dieId: string;
  /** New color after reroll */
  readonly newColor: ManaColor;
}

/**
 * Creates a ManaDieReturnedEvent.
 */
export function createManaDieReturnedEvent(
  dieId: string,
  newColor: ManaColor
): ManaDieReturnedEvent {
  return {
    type: MANA_DIE_RETURNED,
    dieId,
    newColor,
  };
}

// ============================================================================
// MANA_DIE_USED
// ============================================================================

/**
 * Event type constant for using mana from a die.
 * @see ManaDieUsedEvent
 */
export const MANA_DIE_USED = "MANA_DIE_USED" as const;

/**
 * Emitted when mana from a taken die is spent.
 *
 * The mana token from the die is consumed for powering a card.
 *
 * @remarks
 * - Token is consumed, die stays claimed
 * - Used to power card effects
 * - Triggers: PLAY_CARD_ACTION with powered: true
 *
 * @example
 * ```typescript
 * if (event.type === MANA_DIE_USED) {
 *   consumeManaToken(event.playerId, event.color);
 *   highlightPoweredCard();
 * }
 * ```
 */
export interface ManaDieUsedEvent {
  readonly type: typeof MANA_DIE_USED;
  /** ID of the player who used the mana */
  readonly playerId: string;
  /** ID of the die the mana came from */
  readonly dieId: string;
  /** Color of mana used */
  readonly color: ManaColor;
}

/**
 * Creates a ManaDieUsedEvent.
 */
export function createManaDieUsedEvent(
  playerId: string,
  dieId: string,
  color: ManaColor
): ManaDieUsedEvent {
  return {
    type: MANA_DIE_USED,
    playerId,
    dieId,
    color,
  };
}
