/**
 * Unit constants for Mage Knight
 */

import type { UnitType, RecruitSite, UnitAbilityType } from "./types.js";

// =============================================================================
// UNIT TYPE CONSTANTS
// =============================================================================
export const UNIT_TYPE_REGULAR = "regular" as const satisfies UnitType;
export const UNIT_TYPE_ELITE = "elite" as const satisfies UnitType;

// =============================================================================
// RECRUITMENT SITE CONSTANTS
// =============================================================================
export const RECRUIT_SITE_VILLAGE = "village" as const satisfies RecruitSite;
export const RECRUIT_SITE_KEEP = "keep" as const satisfies RecruitSite;
export const RECRUIT_SITE_MAGE_TOWER =
  "mage_tower" as const satisfies RecruitSite;
export const RECRUIT_SITE_MONASTERY =
  "monastery" as const satisfies RecruitSite;
export const RECRUIT_SITE_CITY = "city" as const satisfies RecruitSite;
export const RECRUIT_SITE_CAMP = "camp" as const satisfies RecruitSite;

// =============================================================================
// UNIT ABILITY CONSTANTS
// =============================================================================
export const UNIT_ABILITY_ATTACK = "attack" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_BLOCK = "block" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_RANGED_ATTACK =
  "ranged_attack" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_SIEGE_ATTACK =
  "siege_attack" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_MOVE = "move" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_INFLUENCE =
  "influence" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_HEAL = "heal" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_SWIFT = "swift" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_BRUTAL = "brutal" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_POISON = "poison" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_PARALYZE =
  "paralyze" as const satisfies UnitAbilityType;
export const UNIT_ABILITY_EFFECT =
  "effect" as const satisfies UnitAbilityType;
