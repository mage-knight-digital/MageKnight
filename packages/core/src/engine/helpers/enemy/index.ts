/**
 * Enemy token helpers for Mage Knight
 *
 * Re-exports all enemy helper functions from their respective modules.
 * This module provides a unified entry point for enemy token management,
 * drawing, site mapping, and hex population.
 */

// Token ID management
export {
  createEnemyTokenId,
  resetTokenCounter,
  getEnemyIdFromToken,
} from "./tokenId.js";

// Deck initialization
export { getEnemyIdsByColor, createEnemyTokenPiles } from "./piles.js";

// Draw/discard
export {
  drawEnemy,
  drawEnemyWithFactionPriority,
  discardEnemy,
} from "./drawing.js";
export type { DrawEnemyResult } from "./drawing.js";

// Site/rampaging mappings and visibility
export {
  getSiteDefenders,
  getAdventureSiteEnemies,
  getRampagingEnemyColor,
  isSiteEnemyRevealed,
} from "./siteMapping.js";
export type { SiteDefenderConfig } from "./siteMapping.js";

// Composite helper for hex drawing
export { drawEnemiesForHex } from "./hexDrawing.js";
export type { DrawEnemiesForHexResult } from "./hexDrawing.js";
