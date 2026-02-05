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
 * Source of unit recruitment - determines which special rules apply.
 * - "normal": Standard recruitment at a site (all special rules apply)
 * - "artifact": Recruited via Banner of Command artifact (bypasses special rules)
 * - "spell": Recruited via Call to Glory spell (bypasses special rules)
 */
export const RECRUITMENT_SOURCE_NORMAL = "normal" as const;
export const RECRUITMENT_SOURCE_ARTIFACT = "artifact" as const;
export const RECRUITMENT_SOURCE_SPELL = "spell" as const;

export type RecruitmentSource =
  | typeof RECRUITMENT_SOURCE_NORMAL
  | typeof RECRUITMENT_SOURCE_ARTIFACT
  | typeof RECRUITMENT_SOURCE_SPELL;

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
   * If true, this Block ability counts twice when blocking an enemy with Swift.
   * Only applies to Block abilities.
   */
  readonly countsTwiceAgainstSwift?: boolean;
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
  /**
   * For effect-based abilities (type="effect"), indicates whether combat is required.
   * If true (default for effect abilities), ability can only be used during combat.
   * If false, ability can be used outside combat (like resource generation).
   */
  readonly requiresCombat?: boolean;
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
  /**
   * If true, reputation modifier is reversed when recruiting this unit.
   * Negative reputation makes it cheaper, positive makes it more expensive.
   * Used by Thugs per rulebook.
   */
  readonly reversedReputation?: boolean;
  /**
   * Influence cost required to assign combat damage to this unit.
   * If set, player must pay this amount before damage can be assigned.
   * Used by Thugs (cost = 2) per rulebook.
   */
  readonly damageInfluenceCost?: number;
}
