/**
 * Skill Types and Usage Constants
 *
 * Shared types used by all hero skill files.
 *
 * @module data/skills/types
 */

import type { SkillId } from "@mage-knight/shared";
import type { Category, CardEffect } from "../../types/cards.js";
import type { ModifierEffect } from "../../types/modifiers.js";

// ============================================================================
// Hero ID type (to avoid circular dependency with hero.ts)
// ============================================================================

// Use string literals matching Hero enum values to avoid circular import
export type HeroId =
  | "arythea"
  | "tovak"
  | "goldyx"
  | "norowas"
  | "wolfhawk"
  | "krang"
  | "braevalar";

// ============================================================================
// Skill Usage Types
// ============================================================================

export const SKILL_USAGE_ONCE_PER_TURN = "once_per_turn" as const;
export const SKILL_USAGE_ONCE_PER_ROUND = "once_per_round" as const;
export const SKILL_USAGE_PASSIVE = "passive" as const;
export const SKILL_USAGE_INTERACTIVE = "interactive" as const;

export type SkillUsageType =
  | typeof SKILL_USAGE_ONCE_PER_TURN
  | typeof SKILL_USAGE_ONCE_PER_ROUND
  | typeof SKILL_USAGE_PASSIVE
  | typeof SKILL_USAGE_INTERACTIVE;

// ============================================================================
// Skill Definition Interface
// ============================================================================

export interface SkillDefinition {
  /** Unique skill identifier */
  readonly id: SkillId;
  /** Display name */
  readonly name: string;
  /** Hero this skill belongs to (null = started in common pool, which shouldn't happen normally) */
  readonly heroId: HeroId | null;
  /** Short description of the skill's effect */
  readonly description: string;
  /** How often the skill can be used */
  readonly usageType: SkillUsageType;
  /** The card effect to execute when the skill is activated (optional for not-yet-implemented skills) */
  readonly effect?: CardEffect;
  /** Passive modifiers applied while the skill is owned */
  readonly passiveModifiers?: readonly ModifierEffect[];
  /** Categories for this skill (movement, combat, influence, healing, special) */
  readonly categories: readonly Category[];
}
