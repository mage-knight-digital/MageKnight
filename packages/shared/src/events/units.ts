/**
 * Unit Events
 *
 * Events related to unit recruitment, activation, wounds, and destruction.
 * Units are companions that fight alongside the player.
 *
 * @module events/units
 *
 * @remarks Unit System Overview
 * - Units are recruited from villages/keeps/mage towers
 * - Each unit has an ability (attack, block, etc.)
 * - Units can be wounded (once) then destroyed
 * - Units are readied at start of round
 *
 * @example Unit Flow
 * ```
 * Recruitment:
 *   UNIT_RECRUITED (from village/keep/mage tower)
 *
 * Combat:
 *   UNIT_ACTIVATED (use ability in combat)
 *     └─► Unit becomes exhausted
 *   UNIT_WOUNDED (if used to absorb damage)
 *     └─► Already wounded unit:
 *           └─► UNIT_DESTROYED (reason: double_wound)
 *
 * Round End:
 *   UNITS_READIED (all units become available again)
 *
 * Disbanding:
 *   UNIT_DISBANDED (player chooses to remove)
 *     └─► UNIT_DESTROYED (reason: disbanded)
 * ```
 */

import type { UnitId, UnitAbilityType } from "../units/index.js";
import type { Element } from "../elements.js";
import {
  UNIT_DESTROY_REASON_DISBANDED,
  UNIT_DESTROY_REASON_DOUBLE_WOUND,
  UNIT_DESTROY_REASON_PARALYZE,
  UNIT_DESTROY_REASON_POISON,
} from "../valueConstants.js";

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

// ============================================================================
// UNIT_ACTIVATED
// ============================================================================

/**
 * Event type constant for unit activation.
 * @see UnitActivatedEvent
 */
export const UNIT_ACTIVATED = "UNIT_ACTIVATED" as const;

/**
 * Emitted when a unit's ability is activated.
 *
 * Units provide attack, block, or other abilities.
 *
 * @remarks
 * - Unit becomes exhausted after activation
 * - abilityUsed indicates type (attack, block, etc.)
 * - abilityValue is the strength of the ability
 * - element indicates the attack/block element
 * - Triggers: ACTIVATE_UNIT_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === UNIT_ACTIVATED) {
 *   markUnitAsExhausted(event.unitInstanceId);
 *   applyUnitAbility(event.abilityUsed, event.abilityValue, event.element);
 * }
 * ```
 */
export interface UnitActivatedEvent {
  readonly type: typeof UNIT_ACTIVATED;
  /** ID of the player who activated the unit */
  readonly playerId: string;
  /** Instance ID of the activated unit */
  readonly unitInstanceId: string;
  /** Type of ability used */
  readonly abilityUsed: UnitAbilityType;
  /** Strength of the ability */
  readonly abilityValue: number;
  /** Element of the ability (for attack/block) */
  readonly element: Element;
}

/**
 * Creates a UnitActivatedEvent.
 */
export function createUnitActivatedEvent(
  playerId: string,
  unitInstanceId: string,
  abilityUsed: UnitAbilityType,
  abilityValue: number,
  element: Element
): UnitActivatedEvent {
  return {
    type: UNIT_ACTIVATED,
    playerId,
    unitInstanceId,
    abilityUsed,
    abilityValue,
    element,
  };
}

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

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for UnitRecruitedEvent.
 */
export function isUnitRecruitedEvent(event: {
  type: string;
}): event is UnitRecruitedEvent {
  return event.type === UNIT_RECRUITED;
}

/**
 * Type guard for UnitActivatedEvent.
 */
export function isUnitActivatedEvent(event: {
  type: string;
}): event is UnitActivatedEvent {
  return event.type === UNIT_ACTIVATED;
}

/**
 * Type guard for UnitDestroyedEvent.
 */
export function isUnitDestroyedEvent(event: {
  type: string;
}): event is UnitDestroyedEvent {
  return event.type === UNIT_DESTROYED;
}

/**
 * Check if an event is any unit-related event.
 */
export function isUnitEvent(event: { type: string }): boolean {
  return [
    UNIT_RECRUITED,
    UNIT_DISBANDED,
    UNIT_ACTIVATED,
    UNIT_WOUNDED,
    UNIT_HEALED,
    UNIT_READIED,
    UNITS_READIED,
    UNIT_DESTROYED,
  ].includes(event.type as typeof UNIT_RECRUITED);
}
