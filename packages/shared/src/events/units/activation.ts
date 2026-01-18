/**
 * Unit Activation Events
 *
 * Events for activating unit abilities in combat.
 *
 * @module events/units/activation
 */

import type { UnitAbilityType } from "../../units/index.js";
import type { Element } from "../../elements.js";

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

/**
 * Type guard for UnitActivatedEvent.
 */
export function isUnitActivatedEvent(event: {
  type: string;
}): event is UnitActivatedEvent {
  return event.type === UNIT_ACTIVATED;
}
