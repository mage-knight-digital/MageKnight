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
export const CONDITION_NO_UNIT_RECRUITED_THIS_TURN = "no_unit_recruited_this_turn" as const;
export const CONDITION_LOWEST_FAME = "lowest_fame" as const;
export const CONDITION_IS_NIGHT_OR_UNDERGROUND = "is_night_or_underground" as const;
export const CONDITION_IN_INTERACTION = "in_interaction" as const;
export const CONDITION_AT_FORTIFIED_SITE = "at_fortified_site" as const;
export const CONDITION_AT_MAGICAL_GLADE = "at_magical_glade" as const;

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

/**
 * True if no unit was recruited this turn.
 * Used by skills like "Resistance" that only work if no unit was recruited.
 */
export interface NoUnitRecruitedThisTurnCondition {
  readonly type: typeof CONDITION_NO_UNIT_RECRUITED_THIS_TURN;
}

/**
 * True if the player has the lowest (or tied for lowest) fame among all players.
 * Used by skills in multiplayer for catch-up mechanics.
 */
export interface LowestFameCondition {
  readonly type: typeof CONDITION_LOWEST_FAME;
}

/**
 * Condition that checks if it's night OR if player is in underground combat (dungeon/tomb).
 * Dungeons and Tombs count as "night" for this condition per FAQ ruling S1.
 */
export interface IsNightOrUndergroundCondition {
  readonly type: typeof CONDITION_IS_NIGHT_OR_UNDERGROUND;
}

/**
 * True if the player is at an inhabited site where they can interact with locals.
 * Covers unit recruitment and healing purchases at villages, monasteries, etc.
 */
export interface InInteractionCondition {
  readonly type: typeof CONDITION_IN_INTERACTION;
}

/**
 * True if the player is at a fortified site (Keep, Mage Tower, City).
 * Checks the site's fortified property regardless of conquest status.
 */
export interface AtFortifiedSiteCondition {
  readonly type: typeof CONDITION_AT_FORTIFIED_SITE;
}

/**
 * True if the player is at a Magical Glade site.
 */
export interface AtMagicalGladeCondition {
  readonly type: typeof CONDITION_AT_MAGICAL_GLADE;
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
  | HasWoundsInHandCondition
  | NoUnitRecruitedThisTurnCondition
  | LowestFameCondition
  | IsNightOrUndergroundCondition
  | InInteractionCondition
  | AtFortifiedSiteCondition
  | AtMagicalGladeCondition;
