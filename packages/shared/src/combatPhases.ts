/**
 * Combat phase constants shared between engine and client.
 *
 * These phases drive UI + validation, so they must not drift.
 */

export const COMBAT_PHASE_RANGED_SIEGE = "ranged_siege" as const;
export const COMBAT_PHASE_BLOCK = "block" as const;
export const COMBAT_PHASE_ASSIGN_DAMAGE = "assign_damage" as const;
export const COMBAT_PHASE_ATTACK = "attack" as const;

export type CombatPhase =
  | typeof COMBAT_PHASE_RANGED_SIEGE
  | typeof COMBAT_PHASE_BLOCK
  | typeof COMBAT_PHASE_ASSIGN_DAMAGE
  | typeof COMBAT_PHASE_ATTACK;


