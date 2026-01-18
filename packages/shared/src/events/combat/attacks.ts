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
