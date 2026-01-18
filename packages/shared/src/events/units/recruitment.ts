/**
 * Unit Recruitment Events
 *
 * Events for recruiting and disbanding units.
 *
 * @module events/units/recruitment
 */

import type { UnitId } from "../../units/index.js";

// ============================================================================
// UNIT_RECRUITED
// ============================================================================

/**
 * Event type constant for unit recruitment.
 * @see UnitRecruitedEvent
 */
export const UNIT_RECRUITED = "UNIT_RECRUITED" as const;

/**
 * Emitted when a player recruits a unit.
 *
 * Units are recruited from villages, keeps, and mage towers.
 *
 * @remarks
 * - Requires influence to recruit
 * - influenceSpent includes reputation modifiers
 * - Unit gets a unique instance ID
 * - Unit starts ready (can be used immediately)
 * - Triggers: RECRUIT_UNIT_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_RECRUITED) {
 *   addUnitToPlayer(event.playerId, event.unitId, event.unitInstanceId);
 *   showRecruitmentAnimation(event.unitId);
 * }
 * ```
 */
export interface UnitRecruitedEvent {
  readonly type: typeof UNIT_RECRUITED;
  /** ID of the player who recruited */
  readonly playerId: string;
  /** Type ID of the unit */
  readonly unitId: UnitId;
  /** Unique instance ID for this unit */
  readonly unitInstanceId: string;
  /** Influence spent to recruit */
  readonly influenceSpent: number;
}

/**
 * Creates a UnitRecruitedEvent.
 */
export function createUnitRecruitedEvent(
  playerId: string,
  unitId: UnitId,
  unitInstanceId: string,
  influenceSpent: number
): UnitRecruitedEvent {
  return {
    type: UNIT_RECRUITED,
    playerId,
    unitId,
    unitInstanceId,
    influenceSpent,
  };
}

/**
 * Type guard for UnitRecruitedEvent.
 */
export function isUnitRecruitedEvent(event: {
  type: string;
}): event is UnitRecruitedEvent {
  return event.type === UNIT_RECRUITED;
}

// ============================================================================
// UNIT_DISBANDED
// ============================================================================

/**
 * Event type constant for unit disbanding.
 * @see UnitDisbandedEvent
 */
export const UNIT_DISBANDED = "UNIT_DISBANDED" as const;

/**
 * Emitted when a player disbands a unit.
 *
 * The unit is removed from the player's command.
 *
 * @remarks
 * - Player voluntarily removes the unit
 * - May be done to make room for new units
 * - Followed by UNIT_DESTROYED with reason: disbanded
 * - Triggers: DISBAND_UNIT_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_DISBANDED) {
 *   removeUnitFromPlayer(event.playerId, event.unitInstanceId);
 * }
 * ```
 */
export interface UnitDisbandedEvent {
  readonly type: typeof UNIT_DISBANDED;
  /** ID of the player who disbanded */
  readonly playerId: string;
  /** Instance ID of the disbanded unit */
  readonly unitInstanceId: string;
}

/**
 * Creates a UnitDisbandedEvent.
 */
export function createUnitDisbandedEvent(
  playerId: string,
  unitInstanceId: string
): UnitDisbandedEvent {
  return {
    type: UNIT_DISBANDED,
    playerId,
    unitInstanceId,
  };
}
