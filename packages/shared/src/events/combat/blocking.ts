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
 * For multi-attack enemies, each attack must be blocked separately.
 *
 * @remarks
 * - Block value must meet or exceed enemy's attack
 * - Some enemies require specific block types (ice, fire)
 * - Blocked enemies still need to be defeated
 * - Multi-attack enemies: blocking one attack doesn't block others
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
  /**
   * For multi-attack enemies, which attack was blocked (0-indexed).
   * Undefined for single-attack enemies (backwards compatible).
   */
  readonly attackIndex?: number;
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
 * For multi-attack enemies, other attacks may still be blocked.
 *
 * @remarks
 * - Block value was less than required
 * - Player still takes full damage (partial blocks don't reduce damage)
 * - Consider using block more efficiently
 * - Multi-attack enemies: a failed block on one attack doesn't affect others
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
  /**
   * For multi-attack enemies, which attack failed to be blocked (0-indexed).
   * Undefined for single-attack enemies (backwards compatible).
   */
  readonly attackIndex?: number;
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

// ============================================================================
// MOVE_SPENT_ON_CUMBERSOME (Cumbersome ability)
// ============================================================================

/**
 * Event type constant for spending move on Cumbersome enemy.
 * @see MoveSpentOnCumbersomeEvent
 */
export const MOVE_SPENT_ON_CUMBERSOME = "MOVE_SPENT_ON_CUMBERSOME" as const;

/**
 * Emitted when move points are spent to reduce a Cumbersome enemy's attack.
 *
 * Each move point spent reduces the enemy's attack by 1 for the rest of
 * the turn. An attack reduced to 0 is considered successfully blocked.
 *
 * @remarks
 * - Only valid during BLOCK phase
 * - Target enemy must have Cumbersome ability
 * - Reduction applies BEFORE Swift doubling
 * - Reduction persists through Assign Damage phase
 *
 * @example
 * ```typescript
 * if (event.type === MOVE_SPENT_ON_CUMBERSOME) {
 *   updateEnemyAttackDisplay(event.enemyInstanceId, event.totalReduction);
 * }
 * ```
 */
export interface MoveSpentOnCumbersomeEvent {
  readonly type: typeof MOVE_SPENT_ON_CUMBERSOME;
  /** Instance ID of the enemy with Cumbersome ability */
  readonly enemyInstanceId: string;
  /** Move points spent in this action */
  readonly movePointsSpent: number;
  /** Total reduction applied to this enemy (cumulative) */
  readonly totalReduction: number;
}

/**
 * Creates a MoveSpentOnCumbersomeEvent.
 */
export function createMoveSpentOnCumbersomeEvent(
  enemyInstanceId: string,
  movePointsSpent: number,
  totalReduction: number
): MoveSpentOnCumbersomeEvent {
  return {
    type: MOVE_SPENT_ON_CUMBERSOME,
    enemyInstanceId,
    movePointsSpent,
    totalReduction,
  };
}

/**
 * Type guard for MoveSpentOnCumbersomeEvent.
 */
export function isMoveSpentOnCumbersomeEvent(
  event: { type: string }
): event is MoveSpentOnCumbersomeEvent {
  return event.type === MOVE_SPENT_ON_CUMBERSOME;
}

// ============================================================================
// HEROES_ASSAULT_INFLUENCE_PAID (Heroes special rule)
// ============================================================================

/**
 * Event type constant for Heroes assault influence payment.
 * @see HeroesAssaultInfluencePaidEvent
 */
export const HEROES_ASSAULT_INFLUENCE_PAID = "HEROES_ASSAULT_INFLUENCE_PAID" as const;

/**
 * Emitted when 2 Influence is paid to enable Heroes unit abilities
 * during a fortified site assault.
 *
 * Per rulebook: Heroes cannot use abilities in fortified assaults
 * unless 2 Influence is paid once per combat.
 *
 * @remarks
 * - Only valid during fortified site assaults
 * - Payment enables all Heroes units for remaining combat
 * - One-time payment per combat
 * - Damage assignment to Heroes is allowed without payment
 *
 * @example
 * ```typescript
 * if (event.type === HEROES_ASSAULT_INFLUENCE_PAID) {
 *   enableHeroesAbilities();
 *   updateInfluenceDisplay(event.influenceSpent);
 * }
 * ```
 */
export interface HeroesAssaultInfluencePaidEvent {
  readonly type: typeof HEROES_ASSAULT_INFLUENCE_PAID;
  /** Player who paid the influence */
  readonly playerId: string;
  /** Amount of influence spent (always 2) */
  readonly influenceSpent: number;
}

/**
 * Creates a HeroesAssaultInfluencePaidEvent.
 */
export function createHeroesAssaultInfluencePaidEvent(
  playerId: string,
  influenceSpent: number
): HeroesAssaultInfluencePaidEvent {
  return {
    type: HEROES_ASSAULT_INFLUENCE_PAID,
    playerId,
    influenceSpent,
  };
}

/**
 * Type guard for HeroesAssaultInfluencePaidEvent.
 */
export function isHeroesAssaultInfluencePaidEvent(
  event: { type: string }
): event is HeroesAssaultInfluencePaidEvent {
  return event.type === HEROES_ASSAULT_INFLUENCE_PAID;
}

// ============================================================================
// THUGS_DAMAGE_INFLUENCE_PAID
// ============================================================================

/**
 * Event type constant for Thugs damage influence payment.
 * @see ThugsDamageInfluencePaidEvent
 */
export const THUGS_DAMAGE_INFLUENCE_PAID = "THUGS_DAMAGE_INFLUENCE_PAID" as const;

/**
 * Emitted when influence is paid to allow damage assignment to a Thugs unit.
 *
 * Per rulebook: Thugs are not willing to take damage unless you pay
 * 2 Influence during combat. Payment is per-unit, per-combat.
 */
export interface ThugsDamageInfluencePaidEvent {
  readonly type: typeof THUGS_DAMAGE_INFLUENCE_PAID;
  /** Player who paid the influence */
  readonly playerId: string;
  /** Instance ID of the Thugs unit */
  readonly unitInstanceId: string;
  /** Amount of influence spent (always 2) */
  readonly influenceSpent: number;
}

// ============================================================================
// INFLUENCE_CONVERTED_TO_BLOCK (Diplomacy card)
// ============================================================================

/**
 * Event type constant for influence-to-block conversion.
 * @see InfluenceConvertedToBlockEvent
 */
export const INFLUENCE_CONVERTED_TO_BLOCK = "INFLUENCE_CONVERTED_TO_BLOCK" as const;

/**
 * Emitted when influence points are converted to block via Diplomacy card.
 *
 * @remarks
 * - Only valid when an influence-to-block conversion modifier is active
 * - Available during BLOCK phase
 * - Influence points are consumed and block is added to the combat accumulator
 */
export interface InfluenceConvertedToBlockEvent {
  readonly type: typeof INFLUENCE_CONVERTED_TO_BLOCK;
  /** Influence points spent */
  readonly influencePointsSpent: number;
  /** Block points gained */
  readonly blockGained: number;
  /** Element of the block gained */
  readonly blockElement: "physical" | "fire" | "ice";
}

/**
 * Creates an InfluenceConvertedToBlockEvent.
 */
export function createInfluenceConvertedToBlockEvent(
  influencePointsSpent: number,
  blockGained: number,
  blockElement: "physical" | "fire" | "ice"
): InfluenceConvertedToBlockEvent {
  return {
    type: INFLUENCE_CONVERTED_TO_BLOCK,
    influencePointsSpent,
    blockGained,
    blockElement,
  };
}

/**
 * Type guard for InfluenceConvertedToBlockEvent.
 */
export function isInfluenceConvertedToBlockEvent(
  event: { type: string }
): event is InfluenceConvertedToBlockEvent {
  return event.type === INFLUENCE_CONVERTED_TO_BLOCK;
}
