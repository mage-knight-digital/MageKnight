/**
 * Combat Initiation Events
 *
 * Events for triggering and starting combat encounters.
 *
 * @module events/combat/initiation
 */

import type { HexCoord } from "../../hex.js";
import {
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
  COMBAT_TRIGGER_VOLUNTARY_EXPLORE,
  COMBAT_TRIGGER_CHALLENGE,
  COMBAT_TRIGGER_LIBERATE_LOCATION,
} from "../../valueConstants.js";

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
    | typeof COMBAT_TRIGGER_VOLUNTARY_EXPLORE
    | typeof COMBAT_TRIGGER_CHALLENGE
    | typeof COMBAT_TRIGGER_LIBERATE_LOCATION;
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

/**
 * Type guard for CombatStartedEvent.
 */
export function isCombatStartedEvent(event: {
  type: string;
}): event is CombatStartedEvent {
  return event.type === COMBAT_STARTED;
}

// ============================================================================
// ENEMY_SUMMONED
// ============================================================================

/**
 * Event type constant for enemy summon.
 * @see EnemySummonedEvent
 */
export const ENEMY_SUMMONED = "ENEMY_SUMMONED" as const;

/**
 * Emitted when an enemy with the Summon ability draws a brown enemy token.
 *
 * The summoned enemy replaces the summoner for Block and Assign Damage phases.
 *
 * @remarks
 * - Occurs at start of Block phase for each enemy with Summon ability
 * - The summoner is hidden during Block and Assign Damage phases
 * - Summoned enemy grants no fame when blocked/killed
 * - Original summoner returns at start of Attack phase
 *
 * @example
 * ```typescript
 * if (event.type === ENEMY_SUMMONED) {
 *   addSummonedEnemyToUI(event.summonedEnemy);
 *   hideEnemy(event.summonerInstanceId);
 * }
 * ```
 */
export interface EnemySummonedEvent {
  readonly type: typeof ENEMY_SUMMONED;
  /** Instance ID of the summoner enemy */
  readonly summonerInstanceId: string;
  /** Name of the summoner enemy */
  readonly summonerName: string;
  /** Instance ID of the summoned enemy */
  readonly summonedInstanceId: string;
  /** Name of the summoned enemy */
  readonly summonedName: string;
  /** Attack value of the summoned enemy */
  readonly summonedAttack: number;
  /** Armor value of the summoned enemy */
  readonly summonedArmor: number;
}

/**
 * Creates an EnemySummonedEvent.
 */
export function createEnemySummonedEvent(
  summonerInstanceId: string,
  summonerName: string,
  summonedInstanceId: string,
  summonedName: string,
  summonedAttack: number,
  summonedArmor: number
): EnemySummonedEvent {
  return {
    type: ENEMY_SUMMONED,
    summonerInstanceId,
    summonerName,
    summonedInstanceId,
    summonedName,
    summonedAttack,
    summonedArmor,
  };
}

/**
 * Type guard for EnemySummonedEvent.
 */
export function isEnemySummonedEvent(event: {
  type: string;
}): event is EnemySummonedEvent {
  return event.type === ENEMY_SUMMONED;
}

// ============================================================================
// SUMMONED_ENEMY_DISCARDED
// ============================================================================

/**
 * Event type constant for summoned enemy discard.
 * @see SummonedEnemyDiscardedEvent
 */
export const SUMMONED_ENEMY_DISCARDED = "SUMMONED_ENEMY_DISCARDED" as const;

/**
 * Emitted when a summoned enemy is discarded at the start of Attack phase.
 *
 * The summoned enemy is returned to the brown discard pile and grants no fame.
 * The original summoner returns and can be attacked normally.
 *
 * @remarks
 * - Occurs at start of Attack phase for each summoned enemy
 * - Summoned enemy goes to brown discard pile (not removed from game)
 * - No fame is granted for discarding the summoned enemy
 * - Original summoner becomes targetable again
 *
 * @example
 * ```typescript
 * if (event.type === SUMMONED_ENEMY_DISCARDED) {
 *   removeSummonedEnemyFromUI(event.summonedInstanceId);
 *   showEnemy(event.summonerInstanceId);
 * }
 * ```
 */
export interface SummonedEnemyDiscardedEvent {
  readonly type: typeof SUMMONED_ENEMY_DISCARDED;
  /** Instance ID of the summoned enemy being discarded */
  readonly summonedInstanceId: string;
  /** Name of the summoned enemy */
  readonly summonedName: string;
  /** Instance ID of the summoner that returns to combat */
  readonly summonerInstanceId: string;
  /** Name of the summoner enemy */
  readonly summonerName: string;
}

/**
 * Creates a SummonedEnemyDiscardedEvent.
 */
export function createSummonedEnemyDiscardedEvent(
  summonedInstanceId: string,
  summonedName: string,
  summonerInstanceId: string,
  summonerName: string
): SummonedEnemyDiscardedEvent {
  return {
    type: SUMMONED_ENEMY_DISCARDED,
    summonedInstanceId,
    summonedName,
    summonerInstanceId,
    summonerName,
  };
}

/**
 * Type guard for SummonedEnemyDiscardedEvent.
 */
export function isSummonedEnemyDiscardedEvent(event: {
  type: string;
}): event is SummonedEnemyDiscardedEvent {
  return event.type === SUMMONED_ENEMY_DISCARDED;
}
