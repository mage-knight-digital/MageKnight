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

// ============================================================================
// CRYSTAL JOY EVENTS
// ============================================================================

/**
 * Event type constant for card reclaimed (Crystal Joy).
 * @see CardReclaimedEvent
 */
export const CARD_RECLAIMED = "CARD_RECLAIMED" as const;

/**
 * Emitted when a card is reclaimed (Crystal Joy end-of-turn reclaim).
 *
 * Crystal Joy allows discarding a card to return Joy to hand at end of turn.
 */
export interface CardReclaimedEvent {
  readonly type: typeof CARD_RECLAIMED;
  /** ID of the player */
  readonly playerId: string;
  /** Card that was reclaimed (should be Crystal Joy) */
  readonly cardId: string;
  /** Source of the reclaim (should be 'crystal_joy') */
  readonly source: string;
}

/**
 * Creates a CardReclaimedEvent.
 */
export function createCardReclaimedEvent(
  playerId: string,
  cardId: string,
  source: string
): CardReclaimedEvent {
  return {
    type: CARD_RECLAIMED,
    playerId,
    cardId,
    source,
  };
}

/**
 * Event type constant for skipping crystal joy reclaim.
 * @see CrystalJoyReclaimSkippedEvent
 */
export const CRYSTAL_JOY_RECLAIM_SKIPPED = "CRYSTAL_JOY_RECLAIM_SKIPPED" as const;

/**
 * Emitted when a player skips reclaiming Crystal Joy.
 */
export interface CrystalJoyReclaimSkippedEvent {
  readonly type: typeof CRYSTAL_JOY_RECLAIM_SKIPPED;
  /** ID of the player who skipped */
  readonly playerId: string;
}

/**
 * Creates a CrystalJoyReclaimSkippedEvent.
 */
export function createCrystalJoyReclaimSkippedEvent(
  playerId: string
): CrystalJoyReclaimSkippedEvent {
  return {
    type: CRYSTAL_JOY_RECLAIM_SKIPPED,
    playerId,
  };
}

// ============================================================================
// STEADY TEMPO EVENTS
// ============================================================================

/**
 * Event type constant for Steady Tempo deck placement.
 * @see SteadyTempoPlacedEvent
 */
export const STEADY_TEMPO_PLACED = "STEADY_TEMPO_PLACED" as const;

/**
 * Emitted when Steady Tempo is placed back into the deed deck at end of turn.
 */
export interface SteadyTempoPlacedEvent {
  readonly type: typeof STEADY_TEMPO_PLACED;
  /** ID of the player */
  readonly playerId: string;
  /** Where the card was placed: "top" (powered) or "bottom" (basic) */
  readonly position: "top" | "bottom";
}

/**
 * Event type constant for skipping Steady Tempo placement.
 * @see SteadyTempoPlacementSkippedEvent
 */
export const STEADY_TEMPO_PLACEMENT_SKIPPED = "STEADY_TEMPO_PLACEMENT_SKIPPED" as const;

/**
 * Emitted when a player skips placing Steady Tempo back into their deck.
 */
export interface SteadyTempoPlacementSkippedEvent {
  readonly type: typeof STEADY_TEMPO_PLACEMENT_SKIPPED;
  /** ID of the player who skipped */
  readonly playerId: string;
}

// ============================================================================
// BANNER OF PROTECTION EVENTS
// ============================================================================

/**
 * Event type constant for Banner of Protection wound removal.
 * @see BannerProtectionWoundsRemovedEvent
 */
export const BANNER_PROTECTION_WOUNDS_REMOVED = "BANNER_PROTECTION_WOUNDS_REMOVED" as const;

/**
 * Emitted when wounds are thrown away via Banner of Protection at end of turn.
 */
export interface BannerProtectionWoundsRemovedEvent {
  readonly type: typeof BANNER_PROTECTION_WOUNDS_REMOVED;
  /** ID of the player */
  readonly playerId: string;
  /** Number of wounds removed from hand */
  readonly fromHand: number;
  /** Number of wounds removed from discard */
  readonly fromDiscard: number;
}

/**
 * Event type constant for skipping Banner of Protection wound removal.
 * @see BannerProtectionSkippedEvent
 */
export const BANNER_PROTECTION_SKIPPED = "BANNER_PROTECTION_SKIPPED" as const;

/**
 * Emitted when a player skips Banner of Protection wound removal.
 */
export interface BannerProtectionSkippedEvent {
  readonly type: typeof BANNER_PROTECTION_SKIPPED;
  /** ID of the player who skipped */
  readonly playerId: string;
}
