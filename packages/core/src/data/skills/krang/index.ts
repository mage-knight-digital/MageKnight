/**
 * Krang Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to KRANG_SKILLS and KRANG_SKILL_IDS
 *
 * @module data/skills/krang
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./spiritGuides.js";
export * from "./battleHardened.js";
export * from "./battleFrenzy.js";
export * from "./shamanicRitual.js";
export * from "./regenerate.js";
export * from "./arcaneDisguise.js";
export * from "./puppetMaster.js";
export * from "./masterOfChaos.js";
export * from "./curse.js";
export * from "./manaSuppression.js";

// Import definitions for aggregation
import { SKILL_KRANG_SPIRIT_GUIDES, spiritGuides } from "./spiritGuides.js";
import { SKILL_KRANG_BATTLE_HARDENED, battleHardened } from "./battleHardened.js";
import { SKILL_KRANG_BATTLE_FRENZY, battleFrenzy } from "./battleFrenzy.js";
import { SKILL_KRANG_SHAMANIC_RITUAL, shamanicRitual } from "./shamanicRitual.js";
import { SKILL_KRANG_REGENERATE, krangRegenerate } from "./regenerate.js";
import { SKILL_KRANG_ARCANE_DISGUISE, arcaneDisguise } from "./arcaneDisguise.js";
import { SKILL_KRANG_PUPPET_MASTER, puppetMaster } from "./puppetMaster.js";
import { SKILL_KRANG_MASTER_OF_CHAOS, masterOfChaos } from "./masterOfChaos.js";
import { SKILL_KRANG_CURSE, curse } from "./curse.js";
import { SKILL_KRANG_MANA_SUPPRESSION, manaSuppression } from "./manaSuppression.js";

/**
 * All Krang skill definitions keyed by skill ID.
 */
export const KRANG_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_KRANG_SPIRIT_GUIDES]: spiritGuides,
  [SKILL_KRANG_BATTLE_HARDENED]: battleHardened,
  [SKILL_KRANG_BATTLE_FRENZY]: battleFrenzy,
  [SKILL_KRANG_SHAMANIC_RITUAL]: shamanicRitual,
  [SKILL_KRANG_REGENERATE]: krangRegenerate,
  [SKILL_KRANG_ARCANE_DISGUISE]: arcaneDisguise,
  [SKILL_KRANG_PUPPET_MASTER]: puppetMaster,
  [SKILL_KRANG_MASTER_OF_CHAOS]: masterOfChaos,
  [SKILL_KRANG_CURSE]: curse,
  [SKILL_KRANG_MANA_SUPPRESSION]: manaSuppression,
};

/**
 * Ordered list of Krang skill IDs for level-up draws.
 */
export const KRANG_SKILL_IDS = [
  SKILL_KRANG_SPIRIT_GUIDES,
  SKILL_KRANG_BATTLE_HARDENED,
  SKILL_KRANG_BATTLE_FRENZY,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_ARCANE_DISGUISE,
  SKILL_KRANG_PUPPET_MASTER,
  SKILL_KRANG_MASTER_OF_CHAOS,
  SKILL_KRANG_CURSE,
  SKILL_KRANG_MANA_SUPPRESSION,
] as const;
