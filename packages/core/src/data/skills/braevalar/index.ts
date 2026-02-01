/**
 * Braevalar Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to BRAEVALAR_SKILLS and BRAEVALAR_SKILL_IDS
 *
 * @module data/skills/braevalar
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./elementalResistance.js";
export * from "./feralAllies.js";
export * from "./thunderstorm.js";
export * from "./lightningStorm.js";
export * from "./beguile.js";
export * from "./forkedLightning.js";
export * from "./shapeshift.js";
export * from "./secretWays.js";
export * from "./regenerate.js";
export * from "./naturesVengeance.js";

// Import definitions for aggregation
import { SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE, elementalResistance } from "./elementalResistance.js";
import { SKILL_BRAEVALAR_FERAL_ALLIES, feralAllies } from "./feralAllies.js";
import { SKILL_BRAEVALAR_THUNDERSTORM, thunderstorm } from "./thunderstorm.js";
import { SKILL_BRAEVALAR_LIGHTNING_STORM, lightningStorm } from "./lightningStorm.js";
import { SKILL_BRAEVALAR_BEGUILE, beguile } from "./beguile.js";
import { SKILL_BRAEVALAR_FORKED_LIGHTNING, forkedLightning } from "./forkedLightning.js";
import { SKILL_BRAEVALAR_SHAPESHIFT, shapeshift } from "./shapeshift.js";
import { SKILL_BRAEVALAR_SECRET_WAYS, secretWays } from "./secretWays.js";
import { SKILL_BRAEVALAR_REGENERATE, braevalarRegenerate } from "./regenerate.js";
import { SKILL_BRAEVALAR_NATURES_VENGEANCE, naturesVengeance } from "./naturesVengeance.js";

/**
 * All Braevalar skill definitions keyed by skill ID.
 */
export const BRAEVALAR_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE]: elementalResistance,
  [SKILL_BRAEVALAR_FERAL_ALLIES]: feralAllies,
  [SKILL_BRAEVALAR_THUNDERSTORM]: thunderstorm,
  [SKILL_BRAEVALAR_LIGHTNING_STORM]: lightningStorm,
  [SKILL_BRAEVALAR_BEGUILE]: beguile,
  [SKILL_BRAEVALAR_FORKED_LIGHTNING]: forkedLightning,
  [SKILL_BRAEVALAR_SHAPESHIFT]: shapeshift,
  [SKILL_BRAEVALAR_SECRET_WAYS]: secretWays,
  [SKILL_BRAEVALAR_REGENERATE]: braevalarRegenerate,
  [SKILL_BRAEVALAR_NATURES_VENGEANCE]: naturesVengeance,
};

/**
 * Ordered list of Braevalar skill IDs for level-up draws.
 */
export const BRAEVALAR_SKILL_IDS = [
  SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
  SKILL_BRAEVALAR_FERAL_ALLIES,
  SKILL_BRAEVALAR_THUNDERSTORM,
  SKILL_BRAEVALAR_LIGHTNING_STORM,
  SKILL_BRAEVALAR_BEGUILE,
  SKILL_BRAEVALAR_FORKED_LIGHTNING,
  SKILL_BRAEVALAR_SHAPESHIFT,
  SKILL_BRAEVALAR_SECRET_WAYS,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
] as const;
