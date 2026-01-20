/**
 * Combat Attack Events
 *
 * Events for attack resolution during combat.
 *
 * @module events/combat/attacks
 */

// ============================================================================
// ENEMY_DEFEATED
// ============================================================================

/**
 * Event type constant for enemy defeat.
 * @see EnemyDefeatedEvent
 */
export const ENEMY_DEFEATED = "ENEMY_DEFEATED" as const;

/**
 * Emitted when an enemy is defeated in combat.
 *
 * Player gains fame for defeating enemies.
 *
 * @remarks
 * - Fame gained depends on enemy type and level
 * - Can occur in RANGED_SIEGE or ATTACK phases
 * - Enemy is removed from combat
 *
 * @example
 * ```typescript
 * if (event.type === ENEMY_DEFEATED) {
 *   removeEnemyFromCombat(event.enemyInstanceId);
 *   showFameGained(event.fameGained);
 *   playDefeatAnimation(event.enemyName);
 * }
 * ```
 */
export interface EnemyDefeatedEvent {
  readonly type: typeof ENEMY_DEFEATED;
  /** Instance ID of the defeated enemy */
  readonly enemyInstanceId: string;
  /** Name of the defeated enemy */
  readonly enemyName: string;
  /** Fame points gained */
  readonly fameGained: number;
}

/**
 * Creates an EnemyDefeatedEvent.
 */
export function createEnemyDefeatedEvent(
  enemyInstanceId: string,
  enemyName: string,
  fameGained: number
): EnemyDefeatedEvent {
  return {
    type: ENEMY_DEFEATED,
    enemyInstanceId,
    enemyName,
    fameGained,
  };
}

/**
 * Type guard for EnemyDefeatedEvent.
 */
export function isEnemyDefeatedEvent(event: {
  type: string;
}): event is EnemyDefeatedEvent {
  return event.type === ENEMY_DEFEATED;
}

// ============================================================================
// ATTACK_FAILED
// ============================================================================

/**
 * Event type constant for failed attack.
 * @see AttackFailedEvent
 */
export const ATTACK_FAILED = "ATTACK_FAILED" as const;

/**
 * Emitted when an attack doesn't defeat the target enemies.
 *
 * Attack was insufficient to overcome enemy armor.
 *
 * @remarks
 * - Attack value must exceed enemy armor to defeat
 * - Partial damage has no effect (all or nothing)
 * - Enemy survives and remains in combat
 *
 * @example
 * ```typescript
 * if (event.type === ATTACK_FAILED) {
 *   showAttackFailed(event.attackValue, event.requiredAttack);
 *   shakeEnemySprite(event.targetEnemyInstanceIds);
 * }
 * ```
 */
export interface AttackFailedEvent {
  readonly type: typeof ATTACK_FAILED;
  /** Instance IDs of targeted enemies */
  readonly targetEnemyInstanceIds: readonly string[];
  /** Total attack value dealt */
  readonly attackValue: number;
  /** Attack value needed to defeat */
  readonly requiredAttack: number;
}

/**
 * Creates an AttackFailedEvent.
 */
export function createAttackFailedEvent(
  targetEnemyInstanceIds: readonly string[],
  attackValue: number,
  requiredAttack: number
): AttackFailedEvent {
  return {
    type: ATTACK_FAILED,
    targetEnemyInstanceIds,
    attackValue,
    requiredAttack,
  };
}

// ============================================================================
// ATTACK_ASSIGNED
// ============================================================================

/**
 * Event type constant for attack assignment.
 * @see AttackAssignedEvent
 */
export const ATTACK_ASSIGNED = "ATTACK_ASSIGNED" as const;

/**
 * Emitted when damage is incrementally assigned to an enemy.
 *
 * Part of the incremental damage allocation system where players
 * assign attack damage point-by-point to enemies.
 *
 * @remarks
 * - Used in RANGED_SIEGE and ATTACK phases
 * - Damage is "pending" until END_COMBAT_PHASE resolves it
 * - Can be undone until phase ends
 *
 * @example
 * ```typescript
 * if (event.type === ATTACK_ASSIGNED) {
 *   updatePendingDamage(event.enemyInstanceId, event.element, event.amount);
 *   showDamagePreview();
 * }
 * ```
 */
export interface AttackAssignedEvent {
  readonly type: typeof ATTACK_ASSIGNED;
  /** Instance ID of the enemy receiving damage */
  readonly enemyInstanceId: string;
  /** Attack type used (ranged, siege, melee) */
  readonly attackType: "ranged" | "siege" | "melee";
  /** Element of the attack (physical, fire, ice, coldFire) */
  readonly element: "physical" | "fire" | "ice" | "coldFire";
  /** Amount of damage assigned */
  readonly amount: number;
}

/**
 * Creates an AttackAssignedEvent.
 */
export function createAttackAssignedEvent(
  enemyInstanceId: string,
  attackType: "ranged" | "siege" | "melee",
  element: "physical" | "fire" | "ice" | "coldFire",
  amount: number
): AttackAssignedEvent {
  return {
    type: ATTACK_ASSIGNED,
    enemyInstanceId,
    attackType,
    element,
    amount,
  };
}

/**
 * Type guard for AttackAssignedEvent.
 */
export function isAttackAssignedEvent(event: {
  type: string;
}): event is AttackAssignedEvent {
  return event.type === ATTACK_ASSIGNED;
}

// ============================================================================
// ATTACK_UNASSIGNED
// ============================================================================

/**
 * Event type constant for attack unassignment.
 * @see AttackUnassignedEvent
 */
export const ATTACK_UNASSIGNED = "ATTACK_UNASSIGNED" as const;

/**
 * Emitted when previously assigned damage is removed from an enemy.
 *
 * Allows players to reallocate damage before committing with END_COMBAT_PHASE.
 *
 * @remarks
 * - Only possible before phase ends
 * - Damage returns to available pool
 * - Supports exploration of different allocations
 *
 * @example
 * ```typescript
 * if (event.type === ATTACK_UNASSIGNED) {
 *   reducePendingDamage(event.enemyInstanceId, event.element, event.amount);
 *   showDamagePreview();
 * }
 * ```
 */
export interface AttackUnassignedEvent {
  readonly type: typeof ATTACK_UNASSIGNED;
  /** Instance ID of the enemy losing damage */
  readonly enemyInstanceId: string;
  /** Attack type being unassigned (ranged, siege, melee) */
  readonly attackType: "ranged" | "siege" | "melee";
  /** Element of the attack (physical, fire, ice, coldFire) */
  readonly element: "physical" | "fire" | "ice" | "coldFire";
  /** Amount of damage removed */
  readonly amount: number;
}

/**
 * Creates an AttackUnassignedEvent.
 */
export function createAttackUnassignedEvent(
  enemyInstanceId: string,
  attackType: "ranged" | "siege" | "melee",
  element: "physical" | "fire" | "ice" | "coldFire",
  amount: number
): AttackUnassignedEvent {
  return {
    type: ATTACK_UNASSIGNED,
    enemyInstanceId,
    attackType,
    element,
    amount,
  };
}

/**
 * Type guard for AttackUnassignedEvent.
 */
export function isAttackUnassignedEvent(event: {
  type: string;
}): event is AttackUnassignedEvent {
  return event.type === ATTACK_UNASSIGNED;
}
