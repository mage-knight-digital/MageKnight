/**
 * Site Interaction Events
 *
 * Events for safe site interactions (villages, monasteries, etc.).
 *
 * @module events/sites/interaction
 */

// ============================================================================
// INTERACTION_STARTED
// ============================================================================

/**
 * Event type constant for starting site interaction.
 * @see InteractionStartedEvent
 */
export const INTERACTION_STARTED = "INTERACTION_STARTED" as const;

/**
 * Emitted when a player begins interacting with a safe site.
 *
 * Safe sites (villages, monasteries) offer services.
 *
 * @remarks
 * - influenceAvailable is how much influence player can spend
 * - Services available depend on site type
 * - No combat required
 *
 * @example
 * ```typescript
 * if (event.type === INTERACTION_STARTED) {
 *   showSiteInteractionMenu(event.siteType);
 *   displayAvailableInfluence(event.influenceAvailable);
 * }
 * ```
 */
export interface InteractionStartedEvent {
  readonly type: typeof INTERACTION_STARTED;
  /** ID of the interacting player */
  readonly playerId: string;
  /** Type of site being interacted with */
  readonly siteType: string;
  /** Influence available for purchases */
  readonly influenceAvailable: number;
}

/**
 * Creates an InteractionStartedEvent.
 */
export function createInteractionStartedEvent(
  playerId: string,
  siteType: string,
  influenceAvailable: number
): InteractionStartedEvent {
  return {
    type: INTERACTION_STARTED,
    playerId,
    siteType,
    influenceAvailable,
  };
}

/**
 * Type guard for InteractionStartedEvent.
 */
export function isInteractionStartedEvent(event: {
  type: string;
}): event is InteractionStartedEvent {
  return event.type === INTERACTION_STARTED;
}

// ============================================================================
// HEALING_PURCHASED
// ============================================================================

/**
 * Event type constant for purchasing healing.
 * @see HealingPurchasedEvent
 */
export const HEALING_PURCHASED = "HEALING_PURCHASED" as const;

/**
 * Emitted when a player purchases healing at a site.
 *
 * Wounds are healed in exchange for influence.
 *
 * @remarks
 * - healingPoints is the healing purchased
 * - woundsHealed is how many wounds were actually healed
 * - influenceCost is the influence spent
 *
 * @example
 * ```typescript
 * if (event.type === HEALING_PURCHASED) {
 *   healWounds(event.playerId, event.woundsHealed);
 *   deductInfluence(event.influenceCost);
 * }
 * ```
 */
export interface HealingPurchasedEvent {
  readonly type: typeof HEALING_PURCHASED;
  /** ID of the player who purchased healing */
  readonly playerId: string;
  /** Healing points purchased */
  readonly healingPoints: number;
  /** Influence spent */
  readonly influenceCost: number;
  /** Wounds actually healed */
  readonly woundsHealed: number;
}

/**
 * Creates a HealingPurchasedEvent.
 */
export function createHealingPurchasedEvent(
  playerId: string,
  healingPoints: number,
  influenceCost: number,
  woundsHealed: number
): HealingPurchasedEvent {
  return {
    type: HEALING_PURCHASED,
    playerId,
    healingPoints,
    influenceCost,
    woundsHealed,
  };
}

// ============================================================================
// INTERACTION_COMPLETED
// ============================================================================

/**
 * Event type constant for completing interaction.
 * @see InteractionCompletedEvent
 */
export const INTERACTION_COMPLETED = "INTERACTION_COMPLETED" as const;

/**
 * Emitted when site interaction is completed.
 *
 * Player is done interacting with the safe site.
 *
 * @remarks
 * - Follows INTERACTION_STARTED
 * - Player can now take other actions
 *
 * @example
 * ```typescript
 * if (event.type === INTERACTION_COMPLETED) {
 *   hideSiteInteractionMenu();
 *   enableNormalActions();
 * }
 * ```
 */
export interface InteractionCompletedEvent {
  readonly type: typeof INTERACTION_COMPLETED;
  /** ID of the player who completed interaction */
  readonly playerId: string;
  /** Type of site interaction completed */
  readonly siteType: string;
}

/**
 * Creates an InteractionCompletedEvent.
 */
export function createInteractionCompletedEvent(
  playerId: string,
  siteType: string
): InteractionCompletedEvent {
  return {
    type: INTERACTION_COMPLETED,
    playerId,
    siteType,
  };
}
