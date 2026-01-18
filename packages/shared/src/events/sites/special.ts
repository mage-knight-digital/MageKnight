/**
 * Special Site Events
 *
 * Events for special site types: Magical Glades and Deep Mines.
 *
 * @module events/sites/special
 */

import type { BasicManaColor, SpecialManaColor } from "../../ids.js";

// ============================================================================
// MAGICAL GLADE EVENTS
// ============================================================================

/**
 * Event type constant for glade wound discard.
 * @see GladeWoundDiscardedEvent
 */
export const GLADE_WOUND_DISCARDED = "GLADE_WOUND_DISCARDED" as const;

/**
 * Emitted when a wound is discarded at a Magical Glade.
 *
 * Magical Glades allow discarding wounds for healing.
 *
 * @remarks
 * - source indicates where the wound came from (hand or discard)
 * - Wound is removed from game (not just discarded)
 */
export interface GladeWoundDiscardedEvent {
  readonly type: typeof GLADE_WOUND_DISCARDED;
  /** ID of the player */
  readonly playerId: string;
  /** Where the wound was discarded from */
  readonly source: "hand" | "discard";
}

/**
 * Creates a GladeWoundDiscardedEvent.
 */
export function createGladeWoundDiscardedEvent(
  playerId: string,
  source: "hand" | "discard"
): GladeWoundDiscardedEvent {
  return {
    type: GLADE_WOUND_DISCARDED,
    playerId,
    source,
  };
}

/**
 * Event type constant for skipping glade wound.
 * @see GladeWoundSkippedEvent
 */
export const GLADE_WOUND_SKIPPED = "GLADE_WOUND_SKIPPED" as const;

/**
 * Emitted when a player skips wound healing at a glade.
 */
export interface GladeWoundSkippedEvent {
  readonly type: typeof GLADE_WOUND_SKIPPED;
  /** ID of the player who skipped */
  readonly playerId: string;
}

/**
 * Creates a GladeWoundSkippedEvent.
 */
export function createGladeWoundSkippedEvent(
  playerId: string
): GladeWoundSkippedEvent {
  return {
    type: GLADE_WOUND_SKIPPED,
    playerId,
  };
}

/**
 * Event type constant for glade mana gain.
 * @see GladeManaGainedEvent
 */
export const GLADE_MANA_GAINED = "GLADE_MANA_GAINED" as const;

/**
 * Emitted when mana is gained at a Magical Glade.
 *
 * Glades provide special mana colors (gold or black).
 */
export interface GladeManaGainedEvent {
  readonly type: typeof GLADE_MANA_GAINED;
  /** ID of the player */
  readonly playerId: string;
  /** Color of mana gained (gold or black) */
  readonly manaColor: SpecialManaColor;
}

/**
 * Creates a GladeManaGainedEvent.
 */
export function createGladeManaGainedEvent(
  playerId: string,
  manaColor: SpecialManaColor
): GladeManaGainedEvent {
  return {
    type: GLADE_MANA_GAINED,
    playerId,
    manaColor,
  };
}

// ============================================================================
// DEEP MINE EVENTS
// ============================================================================

/**
 * Event type constant for deep mine crystal gain.
 * @see DeepMineCrystalGainedEvent
 */
export const DEEP_MINE_CRYSTAL_GAINED = "DEEP_MINE_CRYSTAL_GAINED" as const;

/**
 * Emitted when a crystal is gained at a Deep Mine.
 *
 * Deep Mines provide basic color crystals.
 */
export interface DeepMineCrystalGainedEvent {
  readonly type: typeof DEEP_MINE_CRYSTAL_GAINED;
  /** ID of the player */
  readonly playerId: string;
  /** Color of crystal gained */
  readonly color: BasicManaColor;
}

/**
 * Creates a DeepMineCrystalGainedEvent.
 */
export function createDeepMineCrystalGainedEvent(
  playerId: string,
  color: BasicManaColor
): DeepMineCrystalGainedEvent {
  return {
    type: DEEP_MINE_CRYSTAL_GAINED,
    playerId,
    color,
  };
}
