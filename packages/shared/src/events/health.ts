/**
 * Health Events
 *
 * Events related to wounds and healing. Wounds are damage that persists
 * as cards in the player's hand, limiting their options.
 *
 * @module events/health
 *
 * @remarks Wound System Overview
 * - Wounds are cards added to the player's hand
 * - Wounds cannot be played (they clog your hand)
 * - Wounds can be healed (removed from game) or discarded (go to discard pile)
 * - Too many wounds = knockout
 *
 * @example Health Flow
 * ```
 * Combat Damage:
 *   DAMAGE_ASSIGNED
 *     └─► WOUND_RECEIVED (for each wound)
 *
 * Healing:
 *   HEALING_PURCHASED (at villages/monasteries)
 *     └─► WOUND_HEALED (for each wound healed)
 *
 * Rest (not healing):
 *   PLAYER_RESTED
 *     └─► Wounds go to discard (still exist, will return)
 * ```
 */

import { WOUND_TARGET_HERO } from "../valueConstants.js";

// ============================================================================
// WOUND_RECEIVED
// ============================================================================

/**
 * Event type constant for receiving a wound.
 * @see WoundReceivedEvent
 */
export const WOUND_RECEIVED = "WOUND_RECEIVED" as const;

/**
 * Emitted when a player or unit receives a wound.
 *
 * Wounds are damage cards that occupy hand space.
 *
 * @remarks
 * - target can be "hero" or a unit index
 * - Hero wounds go to hand as wound cards
 * - Unit wounds mark the unit as wounded
 * - source indicates what caused the wound
 * - Triggers: Combat damage, poison effects, etc.
 *
 * @example
 * ```typescript
 * if (event.type === WOUND_RECEIVED) {
 *   if (event.target === WOUND_TARGET_HERO) {
 *     addWoundCardToHand(event.playerId);
 *   } else {
 *     markUnitAsWounded(event.target.unit);
 *   }
 *   showDamageAnimation(event.source);
 * }
 * ```
 */
export interface WoundReceivedEvent {
  readonly type: typeof WOUND_RECEIVED;
  /** ID of the player receiving the wound */
  readonly playerId: string;
  /** Target of the wound: hero or unit index */
  readonly target: typeof WOUND_TARGET_HERO | { readonly unit: number };
  /** Source of the wound (e.g., "orc_attack", "poison") */
  readonly source: string;
}

/**
 * Creates a WoundReceivedEvent.
 *
 * @param playerId - ID of the player
 * @param target - Who receives the wound
 * @param source - What caused the wound
 * @returns A new WoundReceivedEvent
 */
export function createWoundReceivedEvent(
  playerId: string,
  target: WoundReceivedEvent["target"],
  source: string
): WoundReceivedEvent {
  return {
    type: WOUND_RECEIVED,
    playerId,
    target,
    source,
  };
}

// ============================================================================
// WOUND_HEALED
// ============================================================================

/**
 * Event type constant for healing a wound.
 * @see WoundHealedEvent
 */
export const WOUND_HEALED = "WOUND_HEALED" as const;

/**
 * Emitted when a wound is healed (removed from game).
 *
 * Healed wounds are removed permanently, unlike discarded wounds.
 *
 * @remarks
 * - Healing removes the wound from the game entirely
 * - Discarding only moves wound to discard pile (it comes back)
 * - Healing requires healing points (from sites, cards, etc.)
 * - Triggers: HEALING_PURCHASED, healing card effects
 *
 * @example
 * ```typescript
 * if (event.type === WOUND_HEALED) {
 *   if (event.target === WOUND_TARGET_HERO) {
 *     removeWoundCardFromHand(event.playerId);
 *   } else {
 *     markUnitAsHealed(event.target.unit);
 *   }
 *   showHealingAnimation();
 * }
 * ```
 */
export interface WoundHealedEvent {
  readonly type: typeof WOUND_HEALED;
  /** ID of the player being healed */
  readonly playerId: string;
  /** Target of the healing: hero or unit index */
  readonly target: typeof WOUND_TARGET_HERO | { readonly unit: number };
}

/**
 * Creates a WoundHealedEvent.
 *
 * @param playerId - ID of the player
 * @param target - Who is being healed
 * @returns A new WoundHealedEvent
 */
export function createWoundHealedEvent(
  playerId: string,
  target: WoundHealedEvent["target"]
): WoundHealedEvent {
  return {
    type: WOUND_HEALED,
    playerId,
    target,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for WoundReceivedEvent.
 */
export function isWoundReceivedEvent(event: {
  type: string;
}): event is WoundReceivedEvent {
  return event.type === WOUND_RECEIVED;
}

/**
 * Type guard for WoundHealedEvent.
 */
export function isWoundHealedEvent(event: {
  type: string;
}): event is WoundHealedEvent {
  return event.type === WOUND_HEALED;
}

/**
 * Check if an event is any health-related event.
 */
export function isHealthEvent(event: { type: string }): boolean {
  return [WOUND_RECEIVED, WOUND_HEALED].includes(
    event.type as typeof WOUND_RECEIVED
  );
}

/**
 * Check if a wound target is the hero.
 *
 * @param target - The wound target
 * @returns True if the target is the hero
 */
export function isHeroWound(
  target: typeof WOUND_TARGET_HERO | { readonly unit: number }
): target is typeof WOUND_TARGET_HERO {
  return target === WOUND_TARGET_HERO;
}

/**
 * Check if a wound target is a unit.
 *
 * @param target - The wound target
 * @returns True if the target is a unit
 */
export function isUnitWound(
  target: typeof WOUND_TARGET_HERO | { readonly unit: number }
): target is { readonly unit: number } {
  return typeof target === "object" && "unit" in target;
}
