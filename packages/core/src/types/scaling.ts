/**
 * Scaling factor types for scaling effects
 *
 * These define what the scaling effect counts to determine its bonus.
 */

// === Scaling Factor Type Constants ===
export const SCALING_PER_ENEMY = "per_enemy" as const;
export const SCALING_PER_WOUND_IN_HAND = "per_wound_in_hand" as const;
export const SCALING_PER_UNIT = "per_unit" as const;

// Note: SCALING_PER_WOUND_PLAYED was removed because wounds cannot be "played"
// as cards in Mage Knight - they are dead cards. If a future card needs
// wound-based scaling (like "per wound taken this combat"), it should be
// added as a new scaling factor type.

// === Scaling Factor Interfaces ===

export interface ScalingPerEnemyFactor {
  readonly type: typeof SCALING_PER_ENEMY;
}

export interface ScalingPerWoundInHandFactor {
  readonly type: typeof SCALING_PER_WOUND_IN_HAND;
}

export interface ScalingPerUnitFactor {
  readonly type: typeof SCALING_PER_UNIT;
}

// === Union Type ===

export type ScalingFactor =
  | ScalingPerEnemyFactor
  | ScalingPerWoundInHandFactor
  | ScalingPerUnitFactor;
