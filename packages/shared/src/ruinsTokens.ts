/**
 * Ancient Ruins "Yellow" Token definitions for Mage Knight
 *
 * Ruins tokens are placed on Ancient Ruins hexes when revealed.
 * - Day: token is face-up (visible)
 * - Night: token is face-down (yellow back only), reveals on entry or next day
 *
 * Token types:
 * - Altar: pay mana to gain fame (no combat)
 * - Enemy: fight the depicted enemies to gain rewards
 */

import type { BasicManaColor } from "./ids.js";
import type { EnemyColor } from "./enemies/index.js";
import type { SiteReward } from "./siteRewards.js";
import {
  artifactReward,
  spellReward,
  advancedActionReward,
  unitReward,
  compoundReward,
} from "./siteRewards.js";

// =============================================================================
// CONSTANTS
// =============================================================================

export const RUINS_TOKEN_TYPE_ALTAR = "altar" as const;
export const RUINS_TOKEN_TYPE_ENEMY = "enemy" as const;

// =============================================================================
// TYPES
// =============================================================================

/** The type of a ruins token */
export type RuinsTokenType =
  | typeof RUINS_TOKEN_TYPE_ALTAR
  | typeof RUINS_TOKEN_TYPE_ENEMY;

/** Branded string for ruins token IDs */
export type RuinsTokenId = string & { readonly __brand: "RuinsTokenId" };

/** Special altar cost that requires one of each basic mana color */
export const ALTAR_MANA_ALL_BASIC = "all_basic" as const;
export type AltarManaColor = BasicManaColor | typeof ALTAR_MANA_ALL_BASIC;

/** Reward types from enemy ruins tokens */
export const RUINS_REWARD_ARTIFACT = "artifact" as const;
export const RUINS_REWARD_SPELL = "spell" as const;
export const RUINS_REWARD_UNIT = "unit" as const;
export const RUINS_REWARD_ADVANCED_ACTION = "advanced_action" as const;
export const RUINS_REWARD_CRYSTALS_4 = "4_crystals" as const;

export type RuinsRewardType =
  | typeof RUINS_REWARD_ARTIFACT
  | typeof RUINS_REWARD_SPELL
  | typeof RUINS_REWARD_UNIT
  | typeof RUINS_REWARD_ADVANCED_ACTION
  | typeof RUINS_REWARD_CRYSTALS_4;

// =============================================================================
// TOKEN DEFINITIONS
// =============================================================================

/** Base definition shared by all ruins tokens */
interface RuinsTokenBase {
  readonly id: RuinsTokenId;
  readonly type: RuinsTokenType;
}

/** Altar token - pay mana to gain fame */
export interface RuinsAltarToken extends RuinsTokenBase {
  readonly type: typeof RUINS_TOKEN_TYPE_ALTAR;
  readonly manaColor: AltarManaColor;
  readonly manaCost: number;
  readonly fameReward: number;
}

/** Enemy token - fight enemies to gain rewards */
export interface RuinsEnemyToken extends RuinsTokenBase {
  readonly type: typeof RUINS_TOKEN_TYPE_ENEMY;
  readonly enemies: readonly EnemyColor[];
  readonly rewards: readonly RuinsRewardType[];
}

/** Discriminated union of all ruins token types */
export type RuinsTokenDefinition = RuinsAltarToken | RuinsEnemyToken;

// =============================================================================
// TOKEN DATA
// =============================================================================

/**
 * All ruins tokens in the base game.
 * Based on official Mage Knight rules and TTS mod data.
 */
export const RUINS_TOKENS: Record<string, RuinsTokenDefinition> = {
  // Altars (5 tokens - one per basic color + all colors)
  altar_blue: {
    id: "altar_blue" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ALTAR,
    manaColor: "blue",
    manaCost: 3,
    fameReward: 7,
  },
  altar_green: {
    id: "altar_green" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ALTAR,
    manaColor: "green",
    manaCost: 3,
    fameReward: 7,
  },
  altar_red: {
    id: "altar_red" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ALTAR,
    manaColor: "red",
    manaCost: 3,
    fameReward: 7,
  },
  altar_white: {
    id: "altar_white" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ALTAR,
    manaColor: "white",
    manaCost: 3,
    fameReward: 7,
  },
  altar_all_colors: {
    id: "altar_all_colors" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ALTAR,
    manaColor: ALTAR_MANA_ALL_BASIC,
    manaCost: 4, // 1 of each basic color
    fameReward: 10,
  },

  // Enemy encounters (10 tokens)
  enemy_green_brown_artifact: {
    id: "enemy_green_brown_artifact" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["green", "brown"],
    rewards: [RUINS_REWARD_ARTIFACT],
  },
  enemy_green_violet_artifact: {
    id: "enemy_green_violet_artifact" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["green", "violet"],
    rewards: [RUINS_REWARD_UNIT],
  },
  enemy_green_green_crystals: {
    id: "enemy_green_green_crystals" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["green", "green"],
    rewards: [RUINS_REWARD_CRYSTALS_4],
  },
  enemy_grey_brown_artifact: {
    id: "enemy_grey_brown_artifact" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["gray", "brown"], // Note: using "gray" to match EnemyColor
    rewards: [RUINS_REWARD_ARTIFACT],
  },
  enemy_green_red_artifact_unit: {
    id: "enemy_green_red_artifact_unit" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["green", "red"],
    rewards: [RUINS_REWARD_ARTIFACT, RUINS_REWARD_ADVANCED_ACTION],
  },
  enemy_brown_violet_spell_crystals: {
    id: "enemy_brown_violet_spell_crystals" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["brown", "violet"],
    rewards: [RUINS_REWARD_SPELL, RUINS_REWARD_CRYSTALS_4],
  },
  enemy_brown_red_artifact_artifact: {
    id: "enemy_brown_red_artifact_artifact" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["brown", "red"],
    rewards: [RUINS_REWARD_ARTIFACT, RUINS_REWARD_ARTIFACT],
  },
  enemy_green_green_green_artifact: {
    id: "enemy_green_green_green_artifact" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["green", "green", "green"],
    rewards: [RUINS_REWARD_UNIT],
  },
  enemy_green_grey_artifact_spell: {
    id: "enemy_green_grey_artifact_spell" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["gray", "white"],
    rewards: [RUINS_REWARD_ARTIFACT, RUINS_REWARD_SPELL],
  },
  enemy_violet_violet_spell_unit: {
    id: "enemy_violet_violet_spell_unit" as RuinsTokenId,
    type: RUINS_TOKEN_TYPE_ENEMY,
    enemies: ["violet", "violet"],
    rewards: [RUINS_REWARD_SPELL, RUINS_REWARD_ADVANCED_ACTION],
  },
};

/**
 * Get all ruins token IDs as an array.
 */
export const ALL_RUINS_TOKEN_IDS: readonly RuinsTokenId[] = Object.keys(
  RUINS_TOKENS
) as RuinsTokenId[];

/**
 * Get a ruins token definition by ID.
 */
export function getRuinsTokenDefinition(
  tokenId: RuinsTokenId
): RuinsTokenDefinition | undefined {
  return RUINS_TOKENS[tokenId];
}

/**
 * Type guard for altar tokens.
 */
export function isAltarToken(
  token: RuinsTokenDefinition
): token is RuinsAltarToken {
  return token.type === RUINS_TOKEN_TYPE_ALTAR;
}

/**
 * Type guard for enemy tokens.
 */
export function isEnemyToken(
  token: RuinsTokenDefinition
): token is RuinsEnemyToken {
  return token.type === RUINS_TOKEN_TYPE_ENEMY;
}

/**
 * Map a ruins reward type string to a SiteReward object.
 */
function ruinsRewardToSiteReward(rewardType: RuinsRewardType): SiteReward {
  switch (rewardType) {
    case RUINS_REWARD_ARTIFACT:
      return artifactReward(1);
    case RUINS_REWARD_SPELL:
      return spellReward(1);
    case RUINS_REWARD_ADVANCED_ACTION:
      return advancedActionReward(1);
    case RUINS_REWARD_UNIT:
      return unitReward();
    case RUINS_REWARD_CRYSTALS_4:
      // 4 crystals is handled specially (grant 1 of each basic color)
      // We represent it as a fame reward of 0 as a sentinel — the actual
      // crystal granting is done by the command that processes ruins rewards.
      // This avoids needing a dedicated "4 crystals" SiteReward type.
      // NOTE: This case is handled directly by the ruins reward processor,
      // not by the standard queueSiteReward pipeline.
      return artifactReward(0); // placeholder — never actually queued
  }
}

/**
 * Get the compound SiteReward for an enemy ruins token.
 * Maps the token's rewards array into SiteReward objects.
 *
 * Note: "4_crystals" rewards are handled specially by the combat end handler
 * (grant +1 crystal of each basic color directly). This function's output
 * for those is just a placeholder.
 */
export function getRuinsTokenRewards(token: RuinsEnemyToken): SiteReward {
  if (token.rewards.length === 1) {
    const reward = token.rewards[0];
    if (reward === undefined) {
      return artifactReward(0);
    }
    return ruinsRewardToSiteReward(reward);
  }
  return compoundReward(
    ...token.rewards.map((r) => ruinsRewardToSiteReward(r))
  );
}
