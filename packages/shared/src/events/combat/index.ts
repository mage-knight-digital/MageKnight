/**
 * Combat Events
 *
 * Events covering the complete combat lifecycle: initiation, phases,
 * attacks, blocks, damage, and resolution.
 *
 * Combat has 4 phases: Ranged/Siege -> Block -> Assign Damage -> Attack
 *
 * @module events/combat
 *
 * @example Combat Flow
 * ```
 * COMBAT_TRIGGERED (rampaging enemy or site assault)
 *   |-> COMBAT_STARTED (enemies listed)
 *         |-> COMBAT_PHASE_CHANGED (to RANGED_SIEGE)
 *               |-> Player plays ranged/siege attack cards
 *               |-> ENEMY_DEFEATED (if killed in ranged phase)
 *         |-> COMBAT_PHASE_CHANGED (to BLOCK)
 *               |-> Player plays block cards
 *               |-> ENEMY_BLOCKED (if fully blocked)
 *               |-> BLOCK_FAILED (if insufficient)
 *         |-> COMBAT_PHASE_CHANGED (to ASSIGN_DAMAGE)
 *               |-> DAMAGE_ASSIGNED (for unblocked enemies)
 *               |-> WOUND_RECEIVED (damage taken)
 *               |-> PLAYER_KNOCKED_OUT (if too many wounds)
 *         |-> COMBAT_PHASE_CHANGED (to ATTACK)
 *               |-> Player plays attack cards
 *               |-> ENEMY_DEFEATED (if killed)
 *               |-> ATTACK_FAILED (if insufficient damage)
 *         |-> COMBAT_ENDED (victory or defeat)
 *
 * Alternative outcomes:
 *   |-> PLAYER_WITHDREW (player fled during combat)
 *   |-> COMBAT_EXITED (combat ended via undo, withdrawal, or flee)
 * ```
 */

// Re-export all combat event modules
export * from "./initiation.js";
export * from "./phases.js";
export * from "./blocking.js";
export * from "./attacks.js";
export * from "./resolution.js";

// Import constants for the isCombatEvent guard
import { COMBAT_TRIGGERED, COMBAT_STARTED } from "./initiation.js";
import { COMBAT_PHASE_CHANGED } from "./phases.js";
import { ENEMY_BLOCKED, BLOCK_FAILED } from "./blocking.js";
import { ENEMY_DEFEATED, ATTACK_FAILED, ATTACK_ASSIGNED, ATTACK_UNASSIGNED } from "./attacks.js";
import {
  DAMAGE_ASSIGNED,
  COMBAT_ENDED,
  COMBAT_EXITED,
  PLAYER_KNOCKED_OUT,
  PARALYZE_HAND_DISCARDED,
  PLAYER_WITHDREW,
} from "./resolution.js";

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
    ATTACK_ASSIGNED,
    ATTACK_UNASSIGNED,
    DAMAGE_ASSIGNED,
    COMBAT_ENDED,
    COMBAT_EXITED,
    PLAYER_KNOCKED_OUT,
    PARALYZE_HAND_DISCARDED,
    COMBAT_TRIGGERED,
    PLAYER_WITHDREW,
  ].includes(event.type as typeof COMBAT_STARTED);
}
