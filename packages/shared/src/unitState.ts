/**
 * Shared unit state model.
 *
 * Rulebook: activation state (ready/spent) is orthogonal to wounded status.
 * A unit can be Ready+Wounded or Spent+Wounded.
 */

export const UNIT_STATE_READY = "ready" as const;
export const UNIT_STATE_SPENT = "spent" as const;

export type UnitState = typeof UNIT_STATE_READY | typeof UNIT_STATE_SPENT;


