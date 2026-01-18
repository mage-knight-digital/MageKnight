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

/**
 * Type guard for CombatStartedEvent.
 */
export function isCombatStartedEvent(event: {
  type: string;
}): event is CombatStartedEvent {
  return event.type === COMBAT_STARTED;
}
