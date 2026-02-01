/**
 * Unit type definitions for Mage Knight
 */

import { type Element } from "../elements.js";
import { type EnemyResistances } from "../enemies/index.js";
import { type Terrain } from "../terrain.js";
import { type UnitId } from "./ids.js";
import { type ManaColor } from "../ids.js";

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
  | "paralyze"
  | "effect";

/**
 * Re-use EnemyResistances interface for consistency
 */
export type UnitResistances = EnemyResistances;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Terrain cost modifier applied when a unit ability is activated.
 * For example, Foresters reduce forest/hills/swamp cost by 1 when their Move is used.
 */
export interface UnitTerrainModifier {
  readonly terrain: Terrain;
  readonly amount: number; // Negative = reduction
  readonly minimum: number; // Cost cannot go below this
}

/**
 * A unit's ability (attack, block, etc.)
 */
export interface UnitAbility {
  readonly type: UnitAbilityType;
  readonly value?: number;
  readonly element?: Element;
  /**
   * Optional terrain cost modifiers applied when this ability is activated.
   * Modifiers last until the end of the current turn.
   */
  readonly terrainModifiers?: readonly UnitTerrainModifier[];
  /**
   * Mana cost to activate this ability.
   * If undefined, the ability is free to use.
   */
  readonly manaCost?: ManaColor;
  /**
   * For effect-based abilities (type="effect"), this ID references the effect
   * definition in core's unit ability effects registry. The effect will be
   * resolved using the standard card effect system.
   */
  readonly effectId?: string;
  /**
   * Display name for the ability (used for effect-based abilities).
   * Simple abilities derive their name from the type field.
   */
  readonly displayName?: string;
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
