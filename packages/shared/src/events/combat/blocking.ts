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
