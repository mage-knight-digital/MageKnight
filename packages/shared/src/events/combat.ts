/**
 * Combat Events
 *
 * Events covering the complete combat lifecycle: initiation, phases,
 * attacks, blocks, damage, and resolution.
 *
 * Combat has 4 phases: Ranged/Siege → Block → Assign Damage → Attack
 *
 * @module events/combat
 *
 * @example Combat Flow
 * ```
 * COMBAT_TRIGGERED (rampaging enemy or site assault)
 *   └─► COMBAT_STARTED (enemies listed)
 *         └─► COMBAT_PHASE_CHANGED (to RANGED_SIEGE)
 *               └─► Player plays ranged/siege attack cards
 *               └─► ENEMY_DEFEATED (if killed in ranged phase)
 *         └─► COMBAT_PHASE_CHANGED (to BLOCK)
 *               └─► Player plays block cards
 *               └─► ENEMY_BLOCKED (if fully blocked)
 *               └─► BLOCK_FAILED (if insufficient)
 *         └─► COMBAT_PHASE_CHANGED (to ASSIGN_DAMAGE)
 *               └─► DAMAGE_ASSIGNED (for unblocked enemies)
 *               └─► WOUND_RECEIVED (damage taken)
 *               └─► PLAYER_KNOCKED_OUT (if too many wounds)
 *         └─► COMBAT_PHASE_CHANGED (to ATTACK)
 *               └─► Player plays attack cards
 *               └─► ENEMY_DEFEATED (if killed)
 *               └─► ATTACK_FAILED (if insufficient damage)
 *         └─► COMBAT_ENDED (victory or defeat)
 *
 * Alternative outcomes:
 *   └─► PLAYER_WITHDREW (player fled during combat)
 *   └─► COMBAT_EXITED (combat ended via undo, withdrawal, or flee)
 * ```
 */

import type { HexCoord } from "../hex.js";
import type { CombatPhase } from "../combatPhases.js";
import {
  COMBAT_EXIT_REASON_FLED,
  COMBAT_EXIT_REASON_UNDO,
  COMBAT_EXIT_REASON_WITHDRAW,
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
  COMBAT_TRIGGER_VOLUNTARY_EXPLORE,
} from "../valueConstants.js";

// ============================================================================
// COMBAT_TRIGGERED
// ============================================================================

/**
 * Event type constant for combat trigger.
 * @see CombatTriggeredEvent
 */
export const COMBAT_TRIGGERED = "COMBAT_TRIGGERED" as const;

/**
 * Emitted when combat is triggered by player action.
 *
 * Combat can be triggered by:
 * - Assaulting a fortified site
 * - Provoking rampaging enemies by entering their hex
 * - Voluntary exploration into danger
 *
 * @remarks
 * - Follows PLAYER_MOVED in most cases
 * - enemyTokenIds are the tokens that will be fought
 * - Creates undo checkpoint
 * - Triggers: MOVE_ACTION onto enemy hex, EXPLORE_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_TRIGGERED) {
 *   showCombatWarning(event.triggerType);
 *   prepareForCombat(event.enemyTokenIds);
 * }
 * ```
 */
export interface CombatTriggeredEvent {
  readonly type: typeof COMBAT_TRIGGERED;
  /** ID of the player entering combat */
  readonly playerId: string;
  /** What triggered the combat */
  readonly triggerType:
    | typeof COMBAT_TRIGGER_FORTIFIED_ASSAULT
    | typeof COMBAT_TRIGGER_PROVOKE_RAMPAGING
    | typeof COMBAT_TRIGGER_VOLUNTARY_EXPLORE;
  /** Location where combat occurs */
  readonly hexCoord: HexCoord;
  /** IDs of enemy tokens involved */
  readonly enemyTokenIds: readonly string[];
}

/**
 * Creates a CombatTriggeredEvent.
 */
export function createCombatTriggeredEvent(
  playerId: string,
  triggerType: CombatTriggeredEvent["triggerType"],
  hexCoord: HexCoord,
  enemyTokenIds: readonly string[]
): CombatTriggeredEvent {
  return {
    type: COMBAT_TRIGGERED,
    playerId,
    triggerType,
    hexCoord,
    enemyTokenIds,
  };
}

// ============================================================================
// COMBAT_STARTED
// ============================================================================

/**
 * Event type constant for combat start.
 * @see CombatStartedEvent
 */
export const COMBAT_STARTED = "COMBAT_STARTED" as const;

/**
 * Emitted when combat officially begins.
 *
 * Contains full enemy information for the combat.
 *
 * @remarks
 * - Follows COMBAT_TRIGGERED
 * - enemies includes all stats needed for combat resolution
 * - Creates undo checkpoint (combat cannot be undone)
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_STARTED) {
 *   initializeCombatUI(event.enemies);
 *   disableNonCombatActions();
 * }
 * ```
 */
export interface CombatStartedEvent {
  readonly type: typeof COMBAT_STARTED;
  /** ID of the player in combat */
  readonly playerId: string;
  /** Full enemy information for combat */
  readonly enemies: readonly {
    instanceId: string;
    name: string;
    attack: number;
    armor: number;
  }[];
}

/**
 * Creates a CombatStartedEvent.
 */
export function createCombatStartedEvent(
  playerId: string,
  enemies: CombatStartedEvent["enemies"]
): CombatStartedEvent {
  return {
    type: COMBAT_STARTED,
    playerId,
    enemies,
  };
}

// ============================================================================
// COMBAT_PHASE_CHANGED
// ============================================================================

/**
 * Event type constant for combat phase change.
 * @see CombatPhaseChangedEvent
 */
export const COMBAT_PHASE_CHANGED = "COMBAT_PHASE_CHANGED" as const;

/**
 * Emitted when combat transitions to a new phase.
 *
 * Combat phases: RANGED_SIEGE → BLOCK → ASSIGN_DAMAGE → ATTACK
 *
 * @remarks
 * - Each phase has different valid actions
 * - Player may choose to skip phases
 * - Some phases are automatic (ASSIGN_DAMAGE)
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_PHASE_CHANGED) {
 *   updateCombatPhaseUI(event.newPhase);
 *   updateAvailableActions(event.newPhase);
 * }
 * ```
 */
export interface CombatPhaseChangedEvent {
  readonly type: typeof COMBAT_PHASE_CHANGED;
  /** Phase that just ended */
  readonly previousPhase: CombatPhase;
  /** New active phase */
  readonly newPhase: CombatPhase;
}

/**
 * Creates a CombatPhaseChangedEvent.
 */
export function createCombatPhaseChangedEvent(
  previousPhase: CombatPhase,
  newPhase: CombatPhase
): CombatPhaseChangedEvent {
  return {
    type: COMBAT_PHASE_CHANGED,
    previousPhase,
    newPhase,
  };
}

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
// DAMAGE_ASSIGNED
// ============================================================================

/**
 * Event type constant for damage assignment.
 * @see DamageAssignedEvent
 */
export const DAMAGE_ASSIGNED = "DAMAGE_ASSIGNED" as const;

/**
 * Emitted when enemy damage is assigned to the player.
 *
 * Unblocked enemies deal damage during ASSIGN_DAMAGE phase.
 *
 * @remarks
 * - damage is the raw enemy attack value
 * - woundsTaken is how many wound cards are added
 * - Wounds can be assigned to units instead of hero
 *
 * @example
 * ```typescript
 * if (event.type === DAMAGE_ASSIGNED) {
 *   showDamageAnimation(event.damage);
 *   addWoundsToHand(event.woundsTaken);
 * }
 * ```
 */
export interface DamageAssignedEvent {
  readonly type: typeof DAMAGE_ASSIGNED;
  /** Instance ID of the attacking enemy */
  readonly enemyInstanceId: string;
  /** Raw damage dealt */
  readonly damage: number;
  /** Number of wound cards taken */
  readonly woundsTaken: number;
}

/**
 * Creates a DamageAssignedEvent.
 */
export function createDamageAssignedEvent(
  enemyInstanceId: string,
  damage: number,
  woundsTaken: number
): DamageAssignedEvent {
  return {
    type: DAMAGE_ASSIGNED,
    enemyInstanceId,
    damage,
    woundsTaken,
  };
}

// ============================================================================
// COMBAT_ENDED
// ============================================================================

/**
 * Event type constant for combat end.
 * @see CombatEndedEvent
 */
export const COMBAT_ENDED = "COMBAT_ENDED" as const;

/**
 * Emitted when combat concludes normally.
 *
 * Contains summary of combat results.
 *
 * @remarks
 * - victory is true if all enemies defeated
 * - Player may still have taken damage/wounds
 * - Follows last ENEMY_DEFEATED or failed attack
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_ENDED) {
 *   showCombatSummary(event);
 *   if (event.victory) {
 *     playVictoryAnimation();
 *   } else {
 *     showDefeatMessage();
 *   }
 *   returnToNormalPlay();
 * }
 * ```
 */
export interface CombatEndedEvent {
  readonly type: typeof COMBAT_ENDED;
  /** True if player won (all enemies defeated) */
  readonly victory: boolean;
  /** Total fame earned in this combat */
  readonly totalFameGained: number;
  /** Number of enemies defeated */
  readonly enemiesDefeated: number;
  /** Number of enemies that survived */
  readonly enemiesSurvived: number;
}

/**
 * Creates a CombatEndedEvent.
 */
export function createCombatEndedEvent(
  victory: boolean,
  totalFameGained: number,
  enemiesDefeated: number,
  enemiesSurvived: number
): CombatEndedEvent {
  return {
    type: COMBAT_ENDED,
    victory,
    totalFameGained,
    enemiesDefeated,
    enemiesSurvived,
  };
}

// ============================================================================
// COMBAT_EXITED
// ============================================================================

/**
 * Event type constant for combat exit.
 * @see CombatExitedEvent
 */
export const COMBAT_EXITED = "COMBAT_EXITED" as const;

/**
 * Emitted when combat ends without normal resolution.
 *
 * This can happen via undo, withdrawal, or fleeing.
 *
 * @remarks
 * - UNDO: Combat was undone (before irreversible action)
 * - WITHDRAW: Player chose to retreat (reputation penalty)
 * - FLED: Player forced to flee (e.g., knocked out)
 *
 * @example
 * ```typescript
 * if (event.type === COMBAT_EXITED) {
 *   if (event.reason === COMBAT_EXIT_REASON_WITHDRAW) {
 *     showWithdrawalPenalty();
 *   }
 *   cleanupCombatUI();
 * }
 * ```
 */
export interface CombatExitedEvent {
  readonly type: typeof COMBAT_EXITED;
  /** ID of the player who exited combat */
  readonly playerId: string;
  /** Reason for exiting */
  readonly reason:
    | typeof COMBAT_EXIT_REASON_UNDO
    | typeof COMBAT_EXIT_REASON_WITHDRAW
    | typeof COMBAT_EXIT_REASON_FLED;
}

/**
 * Creates a CombatExitedEvent.
 */
export function createCombatExitedEvent(
  playerId: string,
  reason: CombatExitedEvent["reason"]
): CombatExitedEvent {
  return {
    type: COMBAT_EXITED,
    playerId,
    reason,
  };
}

// ============================================================================
// PLAYER_KNOCKED_OUT
// ============================================================================

/**
 * Event type constant for player knockout.
 * @see PlayerKnockedOutEvent
 */
export const PLAYER_KNOCKED_OUT = "PLAYER_KNOCKED_OUT" as const;

/**
 * Emitted when a player is knocked out in combat.
 *
 * The player took too many wounds and cannot continue.
 *
 * @remarks
 * - Occurs when wounds fill entire hand
 * - Player's turn ends immediately
 * - Player must retreat to safe space
 * - Significant game penalty
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_KNOCKED_OUT) {
 *   showKnockoutAnimation(event.playerId);
 *   disableAllActions(event.playerId);
 * }
 * ```
 */
export interface PlayerKnockedOutEvent {
  readonly type: typeof PLAYER_KNOCKED_OUT;
  /** ID of the knocked out player */
  readonly playerId: string;
  /** Total wounds taken this combat */
  readonly woundsThisCombat: number;
}

/**
 * Creates a PlayerKnockedOutEvent.
 */
export function createPlayerKnockedOutEvent(
  playerId: string,
  woundsThisCombat: number
): PlayerKnockedOutEvent {
  return {
    type: PLAYER_KNOCKED_OUT,
    playerId,
    woundsThisCombat,
  };
}

// ============================================================================
// PARALYZE_HAND_DISCARDED
// ============================================================================

/**
 * Event type constant for paralyze discard.
 * @see ParalyzeHandDiscardedEvent
 */
export const PARALYZE_HAND_DISCARDED = "PARALYZE_HAND_DISCARDED" as const;

/**
 * Emitted when a player's hand is discarded due to paralysis.
 *
 * Some enemies have paralyze attacks that force hand discard.
 *
 * @remarks
 * - Paralyze is a special attack type
 * - All cards in hand (except wounds) are discarded
 * - Devastating effect that limits options
 *
 * @example
 * ```typescript
 * if (event.type === PARALYZE_HAND_DISCARDED) {
 *   animateHandDiscard(event.playerId);
 *   showParalyzeEffect();
 * }
 * ```
 */
export interface ParalyzeHandDiscardedEvent {
  readonly type: typeof PARALYZE_HAND_DISCARDED;
  /** ID of the paralyzed player */
  readonly playerId: string;
  /** Number of cards discarded */
  readonly cardsDiscarded: number;
}

/**
 * Creates a ParalyzeHandDiscardedEvent.
 */
export function createParalyzeHandDiscardedEvent(
  playerId: string,
  cardsDiscarded: number
): ParalyzeHandDiscardedEvent {
  return {
    type: PARALYZE_HAND_DISCARDED,
    playerId,
    cardsDiscarded,
  };
}

// ============================================================================
// PLAYER_WITHDREW
// ============================================================================

/**
 * Event type constant for player withdrawal.
 * @see PlayerWithdrewEvent
 */
export const PLAYER_WITHDREW = "PLAYER_WITHDREW" as const;

/**
 * Emitted when a player withdraws from combat.
 *
 * The player retreats to an adjacent safe hex.
 *
 * @remarks
 * - Incurs reputation penalty
 * - Enemies remain at the location
 * - Player moves to adjacent safe hex
 * - Triggers: WITHDRAW_ACTION during combat
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_WITHDREW) {
 *   animateRetreat(event.playerId, event.from, event.to);
 *   showReputationPenalty();
 * }
 * ```
 */
export interface PlayerWithdrewEvent {
  readonly type: typeof PLAYER_WITHDREW;
  /** ID of the withdrawing player */
  readonly playerId: string;
  /** Hex the player withdrew from */
  readonly from: HexCoord;
  /** Hex the player retreated to */
  readonly to: HexCoord;
}

/**
 * Creates a PlayerWithdrewEvent.
 */
export function createPlayerWithdrewEvent(
  playerId: string,
  from: HexCoord,
  to: HexCoord
): PlayerWithdrewEvent {
  return {
    type: PLAYER_WITHDREW,
    playerId,
    from,
    to,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CombatStartedEvent.
 */
export function isCombatStartedEvent(event: {
  type: string;
}): event is CombatStartedEvent {
  return event.type === COMBAT_STARTED;
}

/**
 * Type guard for CombatEndedEvent.
 */
export function isCombatEndedEvent(event: {
  type: string;
}): event is CombatEndedEvent {
  return event.type === COMBAT_ENDED;
}

/**
 * Type guard for EnemyDefeatedEvent.
 */
export function isEnemyDefeatedEvent(event: {
  type: string;
}): event is EnemyDefeatedEvent {
  return event.type === ENEMY_DEFEATED;
}

/**
 * Type guard for CombatPhaseChangedEvent.
 */
export function isCombatPhaseChangedEvent(event: {
  type: string;
}): event is CombatPhaseChangedEvent {
  return event.type === COMBAT_PHASE_CHANGED;
}

/**
 * Check if an event is any combat-related event.
 */
export function isCombatEvent(event: { type: string }): boolean {
  return [
    COMBAT_STARTED,
    COMBAT_PHASE_CHANGED,
    ENEMY_BLOCKED,
    BLOCK_FAILED,
    ENEMY_DEFEATED,
    ATTACK_FAILED,
    DAMAGE_ASSIGNED,
    COMBAT_ENDED,
    COMBAT_EXITED,
    PLAYER_KNOCKED_OUT,
    PARALYZE_HAND_DISCARDED,
    COMBAT_TRIGGERED,
    PLAYER_WITHDREW,
  ].includes(event.type as typeof COMBAT_STARTED);
}
