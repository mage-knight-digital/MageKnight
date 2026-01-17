/**
 * Undo Events
 *
 * Events related to the undo system. Players can undo actions back to the
 * last checkpoint (irreversible action).
 *
 * @module events/undo
 *
 * @remarks Undo System Overview
 * - Reversible actions: card plays, movement (before exploration)
 * - Irreversible actions: tile exploration, combat entry, RNG operations
 * - Undo works back to last checkpoint
 * - Checkpoints are set automatically on irreversible actions
 *
 * @example Undo Flow
 * ```
 * Reversible action:
 *   CARD_PLAYED → can undo → CARD_PLAY_UNDONE
 *   PLAYER_MOVED → can undo → MOVE_UNDONE
 *
 * Irreversible action:
 *   TILE_EXPLORED → UNDO_CHECKPOINT_SET
 *     └─► Previous actions can no longer be undone
 *
 * Undo attempt:
 *   If successful → CARD_PLAY_UNDONE or MOVE_UNDONE
 *   If failed → UNDO_FAILED (with reason)
 * ```
 */

import type { CardId } from "../ids.js";
import type { HexCoord } from "../hex.js";
import {
  UNDO_FAILED_CHECKPOINT_REACHED,
  UNDO_FAILED_NOTHING_TO_UNDO,
  UNDO_FAILED_NOT_YOUR_TURN,
} from "../valueConstants.js";

// ============================================================================
// CARD_PLAY_UNDONE
// ============================================================================

/**
 * Event type constant for card play undo.
 * @see CardPlayUndoneEvent
 */
export const CARD_PLAY_UNDONE = "CARD_PLAY_UNDONE" as const;

/**
 * Emitted when a card play is undone.
 *
 * The card returns to the player's hand.
 *
 * @remarks
 * - Card moves from play area back to hand
 * - Any mana spent is restored
 * - Effects are reversed
 * - Triggers: UNDO_ACTION when last action was PLAY_CARD
 *
 * @example
 * ```typescript
 * if (event.type === CARD_PLAY_UNDONE) {
 *   returnCardToHand(event.playerId, event.cardId);
 *   restoreSpentMana();
 * }
 * ```
 */
export interface CardPlayUndoneEvent {
  readonly type: typeof CARD_PLAY_UNDONE;
  /** ID of the player whose card was undone */
  readonly playerId: string;
  /** ID of the card that was undone */
  readonly cardId: CardId;
}

/**
 * Creates a CardPlayUndoneEvent.
 */
export function createCardPlayUndoneEvent(
  playerId: string,
  cardId: CardId
): CardPlayUndoneEvent {
  return {
    type: CARD_PLAY_UNDONE,
    playerId,
    cardId,
  };
}

// ============================================================================
// MOVE_UNDONE
// ============================================================================

/**
 * Event type constant for move undo.
 * @see MoveUndoneEvent
 */
export const MOVE_UNDONE = "MOVE_UNDONE" as const;

/**
 * Emitted when a movement is undone.
 *
 * The player returns to their previous position.
 *
 * @remarks
 * - from/to are reversed (player was at 'to', now at 'from')
 * - Move points are restored
 * - Triggers: UNDO_ACTION when last action was MOVE
 *
 * @example
 * ```typescript
 * if (event.type === MOVE_UNDONE) {
 *   // Note: from is where they WERE, to is where they return
 *   movePlayerTo(event.playerId, event.to);
 * }
 * ```
 */
export interface MoveUndoneEvent {
  readonly type: typeof MOVE_UNDONE;
  /** ID of the player whose move was undone */
  readonly playerId: string;
  /** Position the player was at (being undone from) */
  readonly from: HexCoord;
  /** Position the player returns to */
  readonly to: HexCoord;
}

/**
 * Creates a MoveUndoneEvent.
 */
export function createMoveUndoneEvent(
  playerId: string,
  from: HexCoord,
  to: HexCoord
): MoveUndoneEvent {
  return {
    type: MOVE_UNDONE,
    playerId,
    from,
    to,
  };
}

// ============================================================================
// UNDO_FAILED
// ============================================================================

/**
 * Event type constant for undo failure.
 * @see UndoFailedEvent
 */
export const UNDO_FAILED = "UNDO_FAILED" as const;

/**
 * Emitted when an undo attempt fails.
 *
 * Provides the reason why undo was not possible.
 *
 * @remarks
 * - NOTHING_TO_UNDO: No actions to undo
 * - CHECKPOINT_REACHED: Last action was irreversible
 * - NOT_YOUR_TURN: Cannot undo other player's actions
 *
 * @example
 * ```typescript
 * if (event.type === UNDO_FAILED) {
 *   switch (event.reason) {
 *     case UNDO_FAILED_NOTHING_TO_UNDO:
 *       showMessage("Nothing to undo");
 *       break;
 *     case UNDO_FAILED_CHECKPOINT_REACHED:
 *       showMessage("Cannot undo past this point");
 *       break;
 *     case UNDO_FAILED_NOT_YOUR_TURN:
 *       showMessage("Not your turn");
 *       break;
 *   }
 * }
 * ```
 */
export interface UndoFailedEvent {
  readonly type: typeof UNDO_FAILED;
  /** ID of the player who attempted undo */
  readonly playerId: string;
  /** Reason the undo failed */
  readonly reason:
    | typeof UNDO_FAILED_NOTHING_TO_UNDO
    | typeof UNDO_FAILED_CHECKPOINT_REACHED
    | typeof UNDO_FAILED_NOT_YOUR_TURN;
}

/**
 * Creates an UndoFailedEvent.
 */
export function createUndoFailedEvent(
  playerId: string,
  reason: UndoFailedEvent["reason"]
): UndoFailedEvent {
  return {
    type: UNDO_FAILED,
    playerId,
    reason,
  };
}

// ============================================================================
// UNDO_CHECKPOINT_SET
// ============================================================================

/**
 * Event type constant for undo checkpoint.
 * @see UndoCheckpointSetEvent
 */
export const UNDO_CHECKPOINT_SET = "UNDO_CHECKPOINT_SET" as const;

/**
 * Emitted when an undo checkpoint is set.
 *
 * Actions before this point can no longer be undone.
 *
 * @remarks
 * - Triggered by irreversible actions (exploration, combat, RNG)
 * - reason explains what caused the checkpoint
 * - Client should update undo button availability
 *
 * @example
 * ```typescript
 * if (event.type === UNDO_CHECKPOINT_SET) {
 *   disableUndoForPreviousActions();
 *   logCheckpointReason(event.reason);
 * }
 * ```
 */
export interface UndoCheckpointSetEvent {
  readonly type: typeof UNDO_CHECKPOINT_SET;
  /** ID of the player whose checkpoint was set */
  readonly playerId: string;
  /** Reason the checkpoint was set */
  readonly reason: string;
}

/**
 * Creates an UndoCheckpointSetEvent.
 */
export function createUndoCheckpointSetEvent(
  playerId: string,
  reason: string
): UndoCheckpointSetEvent {
  return {
    type: UNDO_CHECKPOINT_SET,
    playerId,
    reason,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CardPlayUndoneEvent.
 */
export function isCardPlayUndoneEvent(event: {
  type: string;
}): event is CardPlayUndoneEvent {
  return event.type === CARD_PLAY_UNDONE;
}

/**
 * Type guard for MoveUndoneEvent.
 */
export function isMoveUndoneEvent(event: {
  type: string;
}): event is MoveUndoneEvent {
  return event.type === MOVE_UNDONE;
}

/**
 * Type guard for UndoFailedEvent.
 */
export function isUndoFailedEvent(event: {
  type: string;
}): event is UndoFailedEvent {
  return event.type === UNDO_FAILED;
}

/**
 * Type guard for UndoCheckpointSetEvent.
 */
export function isUndoCheckpointSetEvent(event: {
  type: string;
}): event is UndoCheckpointSetEvent {
  return event.type === UNDO_CHECKPOINT_SET;
}

/**
 * Check if an event is any undo-related event.
 */
export function isUndoEvent(event: { type: string }): boolean {
  return [CARD_PLAY_UNDONE, MOVE_UNDONE, UNDO_FAILED, UNDO_CHECKPOINT_SET].includes(
    event.type as typeof CARD_PLAY_UNDONE
  );
}
