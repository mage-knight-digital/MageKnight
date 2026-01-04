/**
 * Combat attack types (for phase restrictions).
 *
 * Single source of truth: shared across client/server/core.
 */

export const COMBAT_TYPE_MELEE = "melee" as const;
export const COMBAT_TYPE_RANGED = "ranged" as const;
export const COMBAT_TYPE_SIEGE = "siege" as const;

export type CombatType =
  | typeof COMBAT_TYPE_MELEE
  | typeof COMBAT_TYPE_RANGED
  | typeof COMBAT_TYPE_SIEGE;


