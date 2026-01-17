/**
 * Unit type definitions for Mage Knight
 */

import { type Element } from "../elements.js";
import { type EnemyResistances } from "../enemies/index.js";
import { type UnitId } from "./ids.js";

// =============================================================================
// TYPE ALIASES
// =============================================================================

/**
 * Unit type - regular or elite
 */
export type UnitType = "regular" | "elite";

/**
 * Recruitment site where units can be hired
 */
export type RecruitSite =
  | "village"
  | "keep"
  | "mage_tower"
  | "monastery"
  | "city"
  | "camp";

/**
 * Type of ability a unit can have
 */
export type UnitAbilityType =
  | "attack"
  | "block"
  | "ranged_attack"
  | "siege_attack"
  | "move"
  | "influence"
  | "heal"
  | "swift"
  | "brutal"
  | "poison"
  | "paralyze";

/**
 * Re-use EnemyResistances interface for consistency
 */
export type UnitResistances = EnemyResistances;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * A unit's ability (attack, block, etc.)
 */
export interface UnitAbility {
  readonly type: UnitAbilityType;
  readonly value?: number;
  readonly element?: Element;
}

/**
 * Complete definition of a unit
 */
export interface UnitDefinition {
  readonly id: UnitId;
  readonly name: string;
  readonly type: UnitType;
  readonly level: number; // 1-4
  readonly influence: number; // Cost to recruit
  readonly armor: number;
  readonly resistances: UnitResistances;
  readonly recruitSites: readonly RecruitSite[];
  readonly abilities: readonly UnitAbility[];
  readonly copies: number; // How many copies in deck
}
