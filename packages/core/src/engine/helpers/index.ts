/**
 * Helper functions for game engine operations
 */

export {
  getPlayerSite,
  isPlayerAtSiteType,
} from "./siteHelpers.js";

export {
  countOwnedKeeps,
  isNearOwnedKeep,
  getEffectiveHandLimit,
} from "./handLimitHelpers.js";

export {
  // Token ID management
  createEnemyTokenId,
  resetTokenCounter,
  getEnemyIdFromToken,
  // Deck initialization
  getEnemyIdsByColor,
  createEnemyTokenPiles,
  // Draw/discard
  drawEnemy,
  discardEnemy,
  // Site/rampaging mappings
  getSiteDefenders,
  getAdventureSiteEnemies,
  getRampagingEnemyColor,
  // Composite helper
  drawEnemiesForHex,
} from "./enemyHelpers.js";

export type {
  DrawEnemyResult,
  SiteDefenderConfig,
  DrawEnemiesForHexResult,
} from "./enemyHelpers.js";

export { grantSiteReward, queueSiteReward } from "./rewardHelpers.js";
export type { RewardResult } from "./rewardHelpers.js";
