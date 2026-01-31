/**
 * Helper functions for game engine operations
 */

export {
  getPlayerByIdOrThrow,
  getPlayerIndexByIdOrThrow,
  getPlayerById,
  getPlayerIndexById,
} from "./playerHelpers.js";

export {
  getPlayerSite,
  isPlayerAtSiteType,
} from "./siteHelpers.js";

export {
  countOwnedKeeps,
  isNearOwnedKeep,
  getEffectiveHandLimit,
  getEndTurnDrawLimit,
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
  drawEnemyWithFactionPriority,
  discardEnemy,
  // Site/rampaging mappings and visibility
  getSiteDefenders,
  getAdventureSiteEnemies,
  getRampagingEnemyColor,
  isSiteEnemyRevealed,
  // Composite helper
  drawEnemiesForHex,
} from "./enemy/index.js";

export type {
  DrawEnemyResult,
  SiteDefenderConfig,
  DrawEnemiesForHexResult,
} from "./enemy/index.js";

export { grantSiteReward, queueSiteReward } from "./rewards/index.js";
export type { RewardResult } from "./rewards/index.js";

export {
  hasMonasterySite,
  countMonasteries,
  countUnburnedMonasteries,
  countUnburnedMonasteriesOnMap,
  drawMonasteryAdvancedAction,
} from "./monasteryHelpers.js";
export type { MonasteryAADrawResult } from "./monasteryHelpers.js";

// Ruins token helpers
export {
  createEmptyRuinsTokenPiles,
  createRuinsTokenPiles,
  drawRuinsToken,
  discardRuinsToken,
  shouldRuinsTokenBeRevealed,
  revealRuinsToken,
} from "./ruinsTokenHelpers.js";
export type { RuinsTokenPiles, DrawRuinsTokenResult } from "./ruinsTokenHelpers.js";

// Elemental value helpers
export {
  getElementalValue,
  addToElementalValues,
} from "./elementalValueHelpers.js";

// Cooperative assault helpers
export {
  validateDistributionCounts,
  distributeEnemies,
  createInstanceAssignments,
  getAssignedEnemyInstanceIds,
  isEnemyAssignedToPlayer,
} from "./cooperativeAssaultHelpers.js";
export type { DistributeEnemiesResult } from "./cooperativeAssaultHelpers.js";
