/**
 * Combat Phase Events
 *
 * Events for combat phase transitions.
 *
 * @module events/combat/phases
 */

import type { CombatPhase } from "../../combatPhases.js";

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
 * Combat phases: RANGED_SIEGE -> BLOCK -> ASSIGN_DAMAGE -> ATTACK
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

/**
 * Type guard for CombatPhaseChangedEvent.
 */
export function isCombatPhaseChangedEvent(event: {
  type: string;
}): event is CombatPhaseChangedEvent {
  return event.type === COMBAT_PHASE_CHANGED;
}
