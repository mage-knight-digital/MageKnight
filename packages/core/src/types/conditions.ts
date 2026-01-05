/**
 * Condition types for conditional card effects
 *
 * These conditions are evaluated at effect resolution time to determine
 * which branch of a ConditionalEffect to execute.
 */

import type { CombatPhase } from "./combat.js";
import type { TimeOfDay, Terrain, ManaColor } from "@mage-knight/shared";

// === Condition Type Constants ===
export const CONDITION_IN_PHASE = "in_phase" as const;
export const CONDITION_TIME_OF_DAY = "time_of_day" as const;
export const CONDITION_ON_TERRAIN = "on_terrain" as const;
export const CONDITION_IN_COMBAT = "in_combat" as const;
export const CONDITION_BLOCKED_SUCCESSFULLY = "blocked_successfully" as const;
export const CONDITION_ENEMY_DEFEATED_THIS_COMBAT = "enemy_defeated_this_combat" as const;
export const CONDITION_MANA_USED_THIS_TURN = "mana_used_this_turn" as const;
export const CONDITION_HAS_WOUNDS_IN_HAND = "has_wounds_in_hand" as const;

// === Condition Interfaces ===

export interface InPhaseCondition {
  readonly type: typeof CONDITION_IN_PHASE;
  readonly phases: readonly CombatPhase[];
}

export interface TimeOfDayCondition {
  readonly type: typeof CONDITION_TIME_OF_DAY;
  readonly time: TimeOfDay;
}

export interface OnTerrainCondition {
  readonly type: typeof CONDITION_ON_TERRAIN;
  readonly terrain: Terrain | readonly Terrain[]; // Single terrain or array (OR logic)
}

export interface InCombatCondition {
  readonly type: typeof CONDITION_IN_COMBAT;
}

export interface BlockedSuccessfullyCondition {
  readonly type: typeof CONDITION_BLOCKED_SUCCESSFULLY;
}

export interface EnemyDefeatedThisCombatCondition {
  readonly type: typeof CONDITION_ENEMY_DEFEATED_THIS_COMBAT;
}

export interface ManaUsedThisTurnCondition {
  readonly type: typeof CONDITION_MANA_USED_THIS_TURN;
  readonly color?: ManaColor;
}

export interface HasWoundsInHandCondition {
  readonly type: typeof CONDITION_HAS_WOUNDS_IN_HAND;
}

// === Union Type ===

export type EffectCondition =
  | InPhaseCondition
  | TimeOfDayCondition
  | OnTerrainCondition
  | InCombatCondition
  | BlockedSuccessfullyCondition
  | EnemyDefeatedThisCombatCondition
  | ManaUsedThisTurnCondition
  | HasWoundsInHandCondition;
