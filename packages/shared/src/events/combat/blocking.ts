/**
 * Combat Blocking Events
 *
 * Events for blocking enemy attacks during combat.
 *
 * @module events/combat/blocking
 */

// ============================================================================
// ENEMY_BLOCKED
// ============================================================================

/**
 * Event type constant for successful block.
 * @see EnemyBlockedEvent
 */
export const ENEMY_BLOCKED = "ENEMY_BLOCKED" as const;

/**
 * Emitted when an enemy's attack is successfully blocked.
 *
 * A blocked enemy deals no damage to the player this combat.
 *
 * @remarks
 * - Block value must meet or exceed enemy's attack
 * - Some enemies require specific block types (ice, fire)
 * - Blocked enemies still need to be defeated
 *
 * @example
 * ```typescript
 * if (event.type === ENEMY_BLOCKED) {
 *   markEnemyAsBlocked(event.enemyInstanceId);
 *   showBlockSuccess(event.blockValue);
 * }
 * ```
 */
export interface EnemyBlockedEvent {
  readonly type: typeof ENEMY_BLOCKED;
  /** Instance ID of the blocked enemy */
  readonly enemyInstanceId: string;
  /** Total block value applied */
  readonly blockValue: number;
}

/**
 * Creates an EnemyBlockedEvent.
 */
export function createEnemyBlockedEvent(
  enemyInstanceId: string,
  blockValue: number
): EnemyBlockedEvent {
  return {
    type: ENEMY_BLOCKED,
    enemyInstanceId,
    blockValue,
  };
}

// ============================================================================
// BLOCK_FAILED
// ============================================================================

/**
 * Event type constant for failed block.
 * @see BlockFailedEvent
 */
export const BLOCK_FAILED = "BLOCK_FAILED" as const;

/**
 * Emitted when a block attempt is insufficient.
 *
 * The enemy will deal its full damage during ASSIGN_DAMAGE phase.
 *
 * @remarks
 * - Block value was less than required
 * - Player still takes full damage (partial blocks don't reduce damage)
 * - Consider using block more efficiently
 *
 * @example
 * ```typescript
 * if (event.type === BLOCK_FAILED) {
 *   showBlockFailed(event.blockValue, event.requiredBlock);
 *   highlightIncomingDamage(event.enemyInstanceId);
 * }
 * ```
 */
export interface BlockFailedEvent {
  readonly type: typeof BLOCK_FAILED;
  /** Instance ID of the unblocked enemy */
  readonly enemyInstanceId: string;
  /** Block value that was attempted */
  readonly blockValue: number;
  /** Block value that was needed */
  readonly requiredBlock: number;
}

/**
 * Creates a BlockFailedEvent.
 */
export function createBlockFailedEvent(
  enemyInstanceId: string,
  blockValue: number,
  requiredBlock: number
): BlockFailedEvent {
  return {
    type: BLOCK_FAILED,
    enemyInstanceId,
    blockValue,
    requiredBlock,
  };
}

// ============================================================================
// BLOCK_ASSIGNED (Incremental block allocation)
// ============================================================================

/**
 * Event type constant for block assignment.
 * @see BlockAssignedEvent
 */
export const BLOCK_ASSIGNED = "BLOCK_ASSIGNED" as const;

/**
 * Emitted when block is incrementally assigned to an enemy.
 *
 * Part of the incremental block allocation system where players
 * assign block point-by-point before committing.
 *
 * @example
 * ```typescript
 * if (event.type === BLOCK_ASSIGNED) {
 *   updateBlockAllocationUI(event.enemyInstanceId, event.element, event.amount);
 * }
 * ```
 */
export interface BlockAssignedEvent {
  readonly type: typeof BLOCK_ASSIGNED;
  /** Instance ID of the target enemy */
  readonly enemyInstanceId: string;
  /** Element of the block assigned */
  readonly element: string;
  /** Amount of block assigned */
  readonly amount: number;
}

/**
 * Type guard for BlockAssignedEvent.
 */
export function isBlockAssignedEvent(event: { type: string }): event is BlockAssignedEvent {
  return event.type === BLOCK_ASSIGNED;
}

// ============================================================================
// BLOCK_UNASSIGNED (Incremental block allocation)
// ============================================================================

/**
 * Event type constant for block unassignment.
 * @see BlockUnassignedEvent
 */
export const BLOCK_UNASSIGNED = "BLOCK_UNASSIGNED" as const;

/**
 * Emitted when previously assigned block is removed from an enemy.
 *
 * Part of the incremental block allocation system that allows
 * players to reallocate block before committing.
 *
 * @example
 * ```typescript
 * if (event.type === BLOCK_UNASSIGNED) {
 *   updateBlockAllocationUI(event.enemyInstanceId, event.element, -event.amount);
 * }
 * ```
 */
export interface BlockUnassignedEvent {
  readonly type: typeof BLOCK_UNASSIGNED;
  /** Instance ID of the target enemy */
  readonly enemyInstanceId: string;
  /** Element of the block unassigned */
  readonly element: string;
  /** Amount of block unassigned */
  readonly amount: number;
}

/**
 * Type guard for BlockUnassignedEvent.
 */
export function isBlockUnassignedEvent(event: { type: string }): event is BlockUnassignedEvent {
  return event.type === BLOCK_UNASSIGNED;
}
