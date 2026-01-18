/**
 * Crystal Events
 *
 * Events for gaining, using, and converting mana crystals.
 *
 * @module events/mana/crystals
 */

import type { ManaColor } from "../../ids.js";

// ============================================================================
// CRYSTAL_GAINED
// ============================================================================

/**
 * Event type constant for gaining a crystal.
 * @see CrystalGainedEvent
 */
export const CRYSTAL_GAINED = "CRYSTAL_GAINED" as const;

/**
 * Emitted when a player gains a mana crystal.
 *
 * Crystals are permanent mana storage (max 3 per color).
 *
 * @remarks
 * - Crystals persist across turns
 * - Max 3 crystals per color
 * - Can be converted to tokens when needed
 * - source indicates where crystal came from
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_GAINED) {
 *   addCrystal(event.playerId, event.color);
 *   showCrystalGainedAnimation(event.source);
 * }
 * ```
 */
export interface CrystalGainedEvent {
  readonly type: typeof CRYSTAL_GAINED;
  /** ID of the player who gained the crystal */
  readonly playerId: string;
  /** Color of the crystal */
  readonly color: ManaColor;
  /** Source of the crystal (e.g., "mine", "card_effect") */
  readonly source: string;
}

/**
 * Creates a CrystalGainedEvent.
 */
export function createCrystalGainedEvent(
  playerId: string,
  color: ManaColor,
  source: string
): CrystalGainedEvent {
  return {
    type: CRYSTAL_GAINED,
    playerId,
    color,
    source,
  };
}

/**
 * Type guard for CrystalGainedEvent.
 */
export function isCrystalGainedEvent(event: {
  type: string;
}): event is CrystalGainedEvent {
  return event.type === CRYSTAL_GAINED;
}

// ============================================================================
// CRYSTAL_USED
// ============================================================================

/**
 * Event type constant for using a crystal.
 * @see CrystalUsedEvent
 */
export const CRYSTAL_USED = "CRYSTAL_USED" as const;

/**
 * Emitted when a mana crystal is consumed.
 *
 * The crystal is permanently consumed for its mana.
 *
 * @remarks
 * - Crystal is removed from player's inventory
 * - Provides one mana of the crystal's color
 * - Irreversible action
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_USED) {
 *   removeCrystal(event.playerId, event.color);
 * }
 * ```
 */
export interface CrystalUsedEvent {
  readonly type: typeof CRYSTAL_USED;
  /** ID of the player who used the crystal */
  readonly playerId: string;
  /** Color of the crystal used */
  readonly color: ManaColor;
}

/**
 * Creates a CrystalUsedEvent.
 */
export function createCrystalUsedEvent(
  playerId: string,
  color: ManaColor
): CrystalUsedEvent {
  return {
    type: CRYSTAL_USED,
    playerId,
    color,
  };
}

/**
 * Type guard for CrystalUsedEvent.
 */
export function isCrystalUsedEvent(event: {
  type: string;
}): event is CrystalUsedEvent {
  return event.type === CRYSTAL_USED;
}

// ============================================================================
// CRYSTAL_CONVERTED
// ============================================================================

/**
 * Event type constant for crystal conversion.
 * @see CrystalConvertedEvent
 */
export const CRYSTAL_CONVERTED = "CRYSTAL_CONVERTED" as const;

/**
 * Emitted when a mana token is converted to a crystal for storage.
 *
 * Allows saving mana for later turns.
 *
 * @remarks
 * - Token is consumed, crystal is gained
 * - Subject to 3 crystal per color limit
 * - Can be done at any time during turn
 *
 * @example
 * ```typescript
 * if (event.type === CRYSTAL_CONVERTED) {
 *   removeManaToken(event.playerId, event.color);
 *   addCrystal(event.playerId, event.color);
 * }
 * ```
 */
export interface CrystalConvertedEvent {
  readonly type: typeof CRYSTAL_CONVERTED;
  /** ID of the player who converted */
  readonly playerId: string;
  /** Color of the mana/crystal */
  readonly color: ManaColor;
}

/**
 * Creates a CrystalConvertedEvent.
 */
export function createCrystalConvertedEvent(
  playerId: string,
  color: ManaColor
): CrystalConvertedEvent {
  return {
    type: CRYSTAL_CONVERTED,
    playerId,
    color,
  };
}
