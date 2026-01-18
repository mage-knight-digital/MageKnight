/**
 * Unit Health Events
 *
 * Events for unit wounds, healing, readying, and destruction.
 *
 * @module events/units/health
 */

import {
  UNIT_DESTROY_REASON_DISBANDED,
  UNIT_DESTROY_REASON_DOUBLE_WOUND,
  UNIT_DESTROY_REASON_PARALYZE,
  UNIT_DESTROY_REASON_POISON,
} from "../../valueConstants.js";

// ============================================================================
// UNIT_WOUNDED
// ============================================================================

/**
 * Event type constant for unit wound.
 * @see UnitWoundedEvent
 */
export const UNIT_WOUNDED = "UNIT_WOUNDED" as const;

/**
 * Emitted when a unit is wounded.
 *
 * Units can absorb damage instead of the hero.
 *
 * @remarks
 * - Unit can only be wounded once
 * - Second wound destroys the unit
 * - damageAbsorbed is how much damage the unit took
 * - Wounded units can still be activated
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_WOUNDED) {
 *   markUnitAsWounded(event.unitInstanceId);
 *   showDamageAbsorbed(event.damageAbsorbed);
 * }
 * ```
 */
export interface UnitWoundedEvent {
  readonly type: typeof UNIT_WOUNDED;
  /** ID of the player whose unit was wounded */
  readonly playerId: string;
  /** Instance ID of the wounded unit */
  readonly unitInstanceId: string;
  /** Amount of damage the unit absorbed */
  readonly damageAbsorbed: number;
}

/**
 * Creates a UnitWoundedEvent.
 */
export function createUnitWoundedEvent(
  playerId: string,
  unitInstanceId: string,
  damageAbsorbed: number
): UnitWoundedEvent {
  return {
    type: UNIT_WOUNDED,
    playerId,
    unitInstanceId,
    damageAbsorbed,
  };
}

// ============================================================================
// UNIT_HEALED
// ============================================================================

/**
 * Event type constant for unit healing.
 * @see UnitHealedEvent
 */
export const UNIT_HEALED = "UNIT_HEALED" as const;

/**
 * Emitted when a unit is healed.
 *
 * Healing removes the wounded status from a unit.
 *
 * @remarks
 * - Unit returns to unwounded state
 * - Requires healing effect or site
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_HEALED) {
 *   removeWoundedStatus(event.unitInstanceId);
 * }
 * ```
 */
export interface UnitHealedEvent {
  readonly type: typeof UNIT_HEALED;
  /** ID of the player whose unit was healed */
  readonly playerId: string;
  /** Instance ID of the healed unit */
  readonly unitInstanceId: string;
}

/**
 * Creates a UnitHealedEvent.
 */
export function createUnitHealedEvent(
  playerId: string,
  unitInstanceId: string
): UnitHealedEvent {
  return {
    type: UNIT_HEALED,
    playerId,
    unitInstanceId,
  };
}

// ============================================================================
// UNIT_READIED
// ============================================================================

/**
 * Event type constant for single unit ready.
 * @see UnitReadiedEvent
 */
export const UNIT_READIED = "UNIT_READIED" as const;

/**
 * Emitted when a single unit becomes ready.
 *
 * Ready units can be activated in combat.
 *
 * @remarks
 * - Individual unit ready (from effect)
 * - For round-start readying, see UNITS_READIED
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_READIED) {
 *   markUnitAsReady(event.unitInstanceId);
 * }
 * ```
 */
export interface UnitReadiedEvent {
  readonly type: typeof UNIT_READIED;
  /** ID of the player whose unit was readied */
  readonly playerId: string;
  /** Instance ID of the readied unit */
  readonly unitInstanceId: string;
}

/**
 * Creates a UnitReadiedEvent.
 */
export function createUnitReadiedEvent(
  playerId: string,
  unitInstanceId: string
): UnitReadiedEvent {
  return {
    type: UNIT_READIED,
    playerId,
    unitInstanceId,
  };
}

// ============================================================================
// UNITS_READIED
// ============================================================================

/**
 * Event type constant for all units ready.
 * @see UnitsReadiedEvent
 */
export const UNITS_READIED = "UNITS_READIED" as const;

/**
 * Emitted when all units are readied at round start.
 *
 * All exhausted units become ready for the new round.
 *
 * @remarks
 * - Occurs at start of each round
 * - unitCount is how many units were readied
 * - Wounded units remain wounded but become ready
 *
 * @example
 * ```typescript
 * if (event.type === UNITS_READIED) {
 *   readyAllUnits(event.playerId);
 * }
 * ```
 */
export interface UnitsReadiedEvent {
  readonly type: typeof UNITS_READIED;
  /** ID of the player whose units were readied */
  readonly playerId: string;
  /** Number of units readied */
  readonly unitCount: number;
}

/**
 * Creates a UnitsReadiedEvent.
 */
export function createUnitsReadiedEvent(
  playerId: string,
  unitCount: number
): UnitsReadiedEvent {
  return {
    type: UNITS_READIED,
    playerId,
    unitCount,
  };
}

// ============================================================================
// UNIT_DESTROYED
// ============================================================================

/**
 * Event type constant for unit destruction.
 * @see UnitDestroyedEvent
 */
export const UNIT_DESTROYED = "UNIT_DESTROYED" as const;

/**
 * Emitted when a unit is destroyed.
 *
 * Destroyed units are permanently removed from the game.
 *
 * @remarks
 * - reason indicates why the unit was destroyed:
 *   - paralyze: Paralyzed by enemy attack
 *   - disbanded: Player chose to disband
 *   - double_wound: Took second wound
 *   - poison: Killed by poison attack
 * - Unit is removed from player's command
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_DESTROYED) {
 *   removeUnitPermanently(event.unitInstanceId);
 *   showDestructionReason(event.reason);
 * }
 * ```
 */
export interface UnitDestroyedEvent {
  readonly type: typeof UNIT_DESTROYED;
  /** ID of the player whose unit was destroyed */
  readonly playerId: string;
  /** Instance ID of the destroyed unit */
  readonly unitInstanceId: string;
  /** Reason for destruction */
  readonly reason:
    | typeof UNIT_DESTROY_REASON_PARALYZE
    | typeof UNIT_DESTROY_REASON_DISBANDED
    | typeof UNIT_DESTROY_REASON_DOUBLE_WOUND
    | typeof UNIT_DESTROY_REASON_POISON;
}

/**
 * Creates a UnitDestroyedEvent.
 */
export function createUnitDestroyedEvent(
  playerId: string,
  unitInstanceId: string,
  reason: UnitDestroyedEvent["reason"]
): UnitDestroyedEvent {
  return {
    type: UNIT_DESTROYED,
    playerId,
    unitInstanceId,
    reason,
  };
}

/**
 * Type guard for UnitDestroyedEvent.
 */
export function isUnitDestroyedEvent(event: {
  type: string;
}): event is UnitDestroyedEvent {
  return event.type === UNIT_DESTROYED;
}
