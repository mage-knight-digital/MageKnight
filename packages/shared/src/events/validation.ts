/**
 * Validation Events
 *
 * Events related to action validation. When a player attempts an
 * invalid action, this event explains why it was rejected.
 *
 * @module events/validation
 *
 * @remarks Validation System Overview
 * - All player actions are validated before execution
 * - Invalid actions emit INVALID_ACTION instead of executing
 * - Reason field explains what went wrong
 * - Client should display error to user
 *
 * @example Validation Flow
 * ```
 * Player sends action:
 *   └─► Server validates action
 *         ├─► If valid: Execute and emit result events
 *         └─► If invalid: Emit INVALID_ACTION with reason
 * ```
 */

// ============================================================================
// INVALID_ACTION
// ============================================================================

/**
 * Event type constant for invalid action.
 * @see InvalidActionEvent
 */
export const INVALID_ACTION = "INVALID_ACTION" as const;

/**
 * Emitted when a player attempts an invalid action.
 *
 * The action was rejected and not executed.
 *
 * @remarks
 * - actionType identifies what action was attempted
 * - reason explains why it was invalid
 * - No state change occurred
 * - Client should show error message to player
 *
 * @example
 * ```typescript
 * if (event.type === INVALID_ACTION) {
 *   showErrorMessage(`Cannot ${event.actionType}: ${event.reason}`);
 * }
 * ```
 */
export interface InvalidActionEvent {
  readonly type: typeof INVALID_ACTION;
  /** ID of the player who attempted the action */
  readonly playerId: string;
  /** Type of action attempted (e.g., "MOVE", "PLAY_CARD") */
  readonly actionType: string;
  /** Human-readable explanation of why action was invalid */
  readonly reason: string;
}

/**
 * Creates an InvalidActionEvent.
 *
 * @param playerId - ID of the player
 * @param actionType - Type of action attempted
 * @param reason - Why the action was invalid
 * @returns A new InvalidActionEvent
 *
 * @example
 * const event = createInvalidActionEvent(
 *   "player1",
 *   "MOVE",
 *   "Insufficient movement points"
 * );
 */
export function createInvalidActionEvent(
  playerId: string,
  actionType: string,
  reason: string
): InvalidActionEvent {
  return {
    type: INVALID_ACTION,
    playerId,
    actionType,
    reason,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for InvalidActionEvent.
 */
export function isInvalidActionEvent(event: {
  type: string;
}): event is InvalidActionEvent {
  return event.type === INVALID_ACTION;
}

/**
 * Check if an event is any validation-related event.
 */
export function isValidationEvent(event: { type: string }): boolean {
  return event.type === INVALID_ACTION;
}
