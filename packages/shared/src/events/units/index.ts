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
 *     |-> Unit becomes exhausted
 *   UNIT_WOUNDED (if used to absorb damage)
 *     |-> Already wounded unit:
 *           |-> UNIT_DESTROYED (reason: double_wound)
 *
 * Round End:
 *   UNITS_READIED (all units become available again)
 *
 * Disbanding:
 *   UNIT_DISBANDED (player chooses to remove)
 *     |-> UNIT_DESTROYED (reason: disbanded)
 * ```
 */

// Re-export all unit event modules
export * from "./recruitment.js";
export * from "./activation.js";
export * from "./health.js";

// Import constants for the isUnitEvent guard
import { UNIT_RECRUITED, UNIT_DISBANDED } from "./recruitment.js";
import { UNIT_ACTIVATED } from "./activation.js";
import {
  UNIT_WOUNDED,
  UNIT_HEALED,
  UNIT_READIED,
  UNITS_READIED,
  UNIT_DESTROYED,
} from "./health.js";

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
