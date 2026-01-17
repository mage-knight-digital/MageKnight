/**
 * Offer Events
 *
 * Events related to the offer (market) system where players can acquire
 * new units, advanced actions, and spells.
 *
 * @module events/offers
 *
 * @remarks Offer System Overview
 * - Three offer types: Units, Advanced Actions, Spells
 * - Offers refresh at specific times (round end, empty offer)
 * - Units require influence to recruit
 * - Cards require specific conditions to acquire
 *
 * @example Offer Flow
 * ```
 * Round Start:
 *   OFFER_REFRESHED (units offer replenished)
 *
 * Player Acquisition:
 *   OFFER_CARD_TAKEN (unit recruited or card gained)
 *
 * Offer Empty:
 *   OFFER_REFRESHED (new cards added)
 * ```
 */

import type { CardId } from "../ids.js";
import type { UnitId } from "../units.js";
import {
  OFFER_TYPE_ADVANCED_ACTIONS,
  OFFER_TYPE_SPELLS,
  OFFER_TYPE_UNITS,
} from "../valueConstants.js";

// ============================================================================
// OFFER_REFRESHED
// ============================================================================

/**
 * Event type constant for offer refresh.
 * @see OfferRefreshedEvent
 */
export const OFFER_REFRESHED = "OFFER_REFRESHED" as const;

/**
 * Emitted when an offer is refreshed with new cards.
 *
 * Offers are refreshed at round boundaries or when depleted.
 *
 * @remarks
 * - offerType indicates which offer was refreshed
 * - Units offer typically refreshes each round
 * - Card offers may persist longer
 *
 * @example
 * ```typescript
 * if (event.type === OFFER_REFRESHED) {
 *   refreshOfferDisplay(event.offerType);
 * }
 * ```
 */
export interface OfferRefreshedEvent {
  readonly type: typeof OFFER_REFRESHED;
  /** Type of offer that was refreshed */
  readonly offerType:
    | typeof OFFER_TYPE_UNITS
    | typeof OFFER_TYPE_ADVANCED_ACTIONS
    | typeof OFFER_TYPE_SPELLS;
}

/**
 * Creates an OfferRefreshedEvent.
 */
export function createOfferRefreshedEvent(
  offerType: OfferRefreshedEvent["offerType"]
): OfferRefreshedEvent {
  return {
    type: OFFER_REFRESHED,
    offerType,
  };
}

// ============================================================================
// OFFER_CARD_TAKEN
// ============================================================================

/**
 * Event type constant for taking from offer.
 * @see OfferCardTakenEvent
 */
export const OFFER_CARD_TAKEN = "OFFER_CARD_TAKEN" as const;

/**
 * Emitted when a card or unit is taken from an offer.
 *
 * This is a discriminated union based on offer type.
 *
 * @remarks
 * - For units: includes unitId
 * - For cards: includes cardId
 * - Removes item from the offer
 * - May trigger OFFER_REFRESHED if offer becomes empty
 *
 * @example
 * ```typescript
 * if (event.type === OFFER_CARD_TAKEN) {
 *   if (event.offerType === OFFER_TYPE_UNITS) {
 *     removeUnitFromOffer(event.unitId);
 *   } else {
 *     removeCardFromOffer(event.cardId);
 *   }
 * }
 * ```
 */
export type OfferCardTakenEvent =
  | {
      readonly type: typeof OFFER_CARD_TAKEN;
      readonly offerType: typeof OFFER_TYPE_UNITS;
      readonly unitId: UnitId;
    }
  | {
      readonly type: typeof OFFER_CARD_TAKEN;
      readonly offerType:
        | typeof OFFER_TYPE_ADVANCED_ACTIONS
        | typeof OFFER_TYPE_SPELLS;
      readonly cardId: CardId;
    };

/**
 * Creates an OfferCardTakenEvent for a unit.
 */
export function createOfferUnitTakenEvent(unitId: UnitId): OfferCardTakenEvent {
  return {
    type: OFFER_CARD_TAKEN,
    offerType: OFFER_TYPE_UNITS,
    unitId,
  };
}

/**
 * Creates an OfferCardTakenEvent for a card.
 */
export function createOfferCardTakenEvent(
  offerType: typeof OFFER_TYPE_ADVANCED_ACTIONS | typeof OFFER_TYPE_SPELLS,
  cardId: CardId
): OfferCardTakenEvent {
  return {
    type: OFFER_CARD_TAKEN,
    offerType,
    cardId,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for OfferRefreshedEvent.
 */
export function isOfferRefreshedEvent(event: {
  type: string;
}): event is OfferRefreshedEvent {
  return event.type === OFFER_REFRESHED;
}

/**
 * Type guard for OfferCardTakenEvent.
 */
export function isOfferCardTakenEvent(event: {
  type: string;
}): event is OfferCardTakenEvent {
  return event.type === OFFER_CARD_TAKEN;
}

/**
 * Type guard for unit offer taken event.
 */
export function isUnitOfferTaken(
  event: OfferCardTakenEvent
): event is OfferCardTakenEvent & { offerType: typeof OFFER_TYPE_UNITS } {
  return event.offerType === OFFER_TYPE_UNITS;
}

/**
 * Type guard for card offer taken event.
 */
export function isCardOfferTaken(
  event: OfferCardTakenEvent
): event is OfferCardTakenEvent & {
  offerType: typeof OFFER_TYPE_ADVANCED_ACTIONS | typeof OFFER_TYPE_SPELLS;
} {
  return (
    event.offerType === OFFER_TYPE_ADVANCED_ACTIONS ||
    event.offerType === OFFER_TYPE_SPELLS
  );
}

/**
 * Check if an event is any offer-related event.
 */
export function isOfferEvent(event: { type: string }): boolean {
  return [OFFER_REFRESHED, OFFER_CARD_TAKEN].includes(
    event.type as typeof OFFER_REFRESHED
  );
}
