/**
 * Unit-related core state types.
 *
 * Activation state is orthogonal to wounded status.
 */

import type { UnitId, UnitState } from "@mage-knight/shared";

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


