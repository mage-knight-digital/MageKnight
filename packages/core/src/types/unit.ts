/**
 * Unit-related core state types.
 *
 * Activation state is orthogonal to wounded status.
 */

import type { UnitId, UnitState } from "@mage-knight/shared";
import { UNIT_STATE_READY } from "@mage-knight/shared";

/**
 * A unit owned by a player.
 *
 * `instanceId` is unique per unit instance in the player's roster.
 * `state` is activation (ready/spent).
 * `wounded` is separate per rulebook.
 */
export interface PlayerUnit {
  readonly instanceId: string;
  readonly unitId: UnitId;
  readonly state: UnitState;
  readonly wounded: boolean;
  readonly usedResistanceThisCombat: boolean;
}

/**
 * Create a new unit instance with default (ready, unwounded) state.
 */
export function createPlayerUnit(unitId: UnitId, instanceId: string): PlayerUnit {
  return {
    instanceId,
    unitId,
    state: UNIT_STATE_READY,
    wounded: false,
    usedResistanceThisCombat: false,
  };
}

/**
 * Ready all units at end of round.
 * Resets state to ready and clears usedResistanceThisCombat.
 */
export function readyAllUnits(units: readonly PlayerUnit[]): readonly PlayerUnit[] {
  return units.map((unit) => ({
    ...unit,
    state: UNIT_STATE_READY,
    usedResistanceThisCombat: false,
  }));
}
