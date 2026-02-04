/**
 * Scaling factor types for scaling effects
 *
 * These define what the scaling effect counts to determine its bonus.
 */

// === Scaling Factor Type Constants ===
export const SCALING_PER_ENEMY = "per_enemy" as const;
export const SCALING_PER_WOUND_IN_HAND = "per_wound_in_hand" as const;
export const SCALING_PER_WOUND_THIS_COMBAT = "per_wound_this_combat" as const;
export const SCALING_PER_UNIT = "per_unit" as const;
export const SCALING_PER_CRYSTAL_COLOR = "per_crystal_color" as const;
export const SCALING_PER_EMPTY_COMMAND_TOKEN = "per_empty_command_token" as const;

// Note: SCALING_PER_WOUND_PLAYED was removed because wounds cannot be "played"
// as cards in Mage Knight - they are dead cards.

// === Scaling Factor Interfaces ===

export interface ScalingPerEnemyFactor {
  readonly type: typeof SCALING_PER_ENEMY;
}

export interface ScalingPerWoundInHandFactor {
  readonly type: typeof SCALING_PER_WOUND_IN_HAND;
}

export interface ScalingPerWoundThisCombatFactor {
  readonly type: typeof SCALING_PER_WOUND_THIS_COMBAT;
}

export interface ScalingPerUnitFactor {
  readonly type: typeof SCALING_PER_UNIT;
  /** Optional filter: only count units matching criteria */
  readonly filter?: UnitFilter;
}

/**
 * Scales by number of different crystal colors the player has (0-4).
 * For skills like "Arcane Mastery" that reward mana diversity.
 */
export interface ScalingPerCrystalColorFactor {
  readonly type: typeof SCALING_PER_CRYSTAL_COLOR;
}

/**
 * Scales by number of empty command token slots.
 * For skills like "On Her Own" that reward having fewer units.
 */
export interface ScalingPerEmptyCommandTokenFactor {
  readonly type: typeof SCALING_PER_EMPTY_COMMAND_TOKEN;
}

/**
 * Filter criteria for unit-based scaling.
 */
export interface UnitFilter {
  /** Only count units with this wound status */
  readonly wounded?: boolean;
  /** Only count units at or below this level */
  readonly maxLevel?: 1 | 2 | 3 | 4;
  /** Only count units in this state (ready/spent) */
  readonly state?: "ready" | "spent";
}

// === Union Type ===

export type ScalingFactor =
  | ScalingPerEnemyFactor
  | ScalingPerWoundInHandFactor
  | ScalingPerWoundThisCombatFactor
  | ScalingPerUnitFactor
  | ScalingPerCrystalColorFactor
  | ScalingPerEmptyCommandTokenFactor;
