/**
 * Turn Lifecycle Events
 *
 * Events for turn start, end, and end-of-round announcement.
 *
 * @module events/lifecycle/turn
 */

// ============================================================================
// TURN_STARTED
// ============================================================================

/**
 * Event type constant for turn start.
 * @see TurnStartedEvent
 */
export const TURN_STARTED = "TURN_STARTED" as const;

/**
 * Emitted when a player's turn begins.
 *
 * The active player can now take actions: play cards, move, enter combat,
 * interact with sites, etc.
 *
 * @remarks
 * - Only one player is active at a time
 * - Turn order determined by tactics selection each round
 * - Triggers: Previous player's TURN_ENDED or ROUND_STARTED
 *
 * @example Updating active player indicator
 * ```typescript
 * if (event.type === TURN_STARTED) {
 *   highlightActivePlayer(event.playerIndex);
 *   enableActionsFor(event.playerIndex);
 * }
 * ```
 */
export interface TurnStartedEvent {
  readonly type: typeof TURN_STARTED;
  /** Index of the active player (0-indexed) */
  readonly playerIndex: number;
}

/**
 * Creates a TurnStartedEvent.
 *
 * @param playerIndex - Index of the player whose turn is starting
 * @returns A new TurnStartedEvent
 */
export function createTurnStartedEvent(playerIndex: number): TurnStartedEvent {
  return {
    type: TURN_STARTED,
    playerIndex,
  };
}

/**
 * Type guard for TurnStartedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TurnStartedEvent
 */
export function isTurnStartedEvent(event: {
  type: string;
}): event is TurnStartedEvent {
  return event.type === TURN_STARTED;
}

// ============================================================================
// TURN_ENDED
// ============================================================================

/**
 * Event type constant for turn end.
 * @see TurnEndedEvent
 */
export const TURN_ENDED = "TURN_ENDED" as const;

/**
 * Emitted when a player's turn ends.
 *
 * Includes cleanup information: cards moved from play area to discard,
 * and cards drawn up to hand limit.
 *
 * @remarks
 * - nextPlayerId is null if this was the last turn of the round
 * - Card cleanup happens automatically
 * - Triggers: END_TURN_ACTION from active player
 * - Related: May trigger ROUND_ENDED if last player in round
 *
 * @example Handling turn end
 * ```typescript
 * if (event.type === TURN_ENDED) {
 *   clearPlayArea(event.playerId);
 *   if (event.nextPlayerId) {
 *     showNextPlayerNotice(event.nextPlayerId);
 *   } else {
 *     showRoundEndNotice();
 *   }
 * }
 * ```
 */
export interface TurnEndedEvent {
  readonly type: typeof TURN_ENDED;
  /** ID of the player whose turn ended */
  readonly playerId: string;
  /** ID of next player, or null if round is ending */
  readonly nextPlayerId: string | null;
  /** Number of cards moved from play area to discard */
  readonly cardsDiscarded: number;
  /** Number of cards drawn up to hand limit */
  readonly cardsDrawn: number;
}

/**
 * Creates a TurnEndedEvent.
 *
 * @param playerId - ID of player whose turn ended
 * @param nextPlayerId - ID of next player, or null if round ending
 * @param cardsDiscarded - Cards moved to discard pile
 * @param cardsDrawn - Cards drawn to refill hand
 * @returns A new TurnEndedEvent
 */
export function createTurnEndedEvent(
  playerId: string,
  nextPlayerId: string | null,
  cardsDiscarded: number,
  cardsDrawn: number
): TurnEndedEvent {
  return {
    type: TURN_ENDED,
    playerId,
    nextPlayerId,
    cardsDiscarded,
    cardsDrawn,
  };
}

/**
 * Type guard for TurnEndedEvent.
 *
 * @param event - Any game event
 * @returns True if the event is a TurnEndedEvent
 */
export function isTurnEndedEvent(event: {
  type: string;
}): event is TurnEndedEvent {
  return event.type === TURN_ENDED;
}

// ============================================================================
// END_OF_ROUND_ANNOUNCED
// ============================================================================

/**
 * Event type constant for end of round announcement.
 * @see EndOfRoundAnnouncedEvent
 */
export const END_OF_ROUND_ANNOUNCED = "END_OF_ROUND_ANNOUNCED" as const;

/**
 * Emitted when a player announces the end of round (typically via rest).
 *
 * Once announced, remaining players get one more turn each before
 * the round ends.
 *
 * @remarks
 * - Usually triggered by PLAYER_RESTED with announcedEndOfRound: true
 * - Other players know the round is about to end
 * - Cannot be undone once announced
 *
 * @example
 * ```typescript
 * if (event.type === END_OF_ROUND_ANNOUNCED) {
 *   showEndOfRoundWarning();
 *   highlightLastTurnIndicator();
 * }
 * ```
 */
export interface EndOfRoundAnnouncedEvent {
  readonly type: typeof END_OF_ROUND_ANNOUNCED;
  /** ID of the player who announced the end */
  readonly playerId: string;
}

/**
 * Creates an EndOfRoundAnnouncedEvent.
 *
 * @param playerId - ID of player who announced
 * @returns A new EndOfRoundAnnouncedEvent
 */
export function createEndOfRoundAnnouncedEvent(
  playerId: string
): EndOfRoundAnnouncedEvent {
  return {
    type: END_OF_ROUND_ANNOUNCED,
    playerId,
  };
}
