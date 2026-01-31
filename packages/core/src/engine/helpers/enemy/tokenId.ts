/**
 * Enemy token ID generation and extraction
 *
 * Functions for creating unique enemy token IDs and extracting
 * the base enemy ID from a token ID.
 */

import type { EnemyId } from "@mage-knight/shared";
import type { EnemyTokenId } from "../../../types/enemy.js";

// =============================================================================
// ENEMY TOKEN ID GENERATION
// =============================================================================

let tokenCounter = 0;

/**
 * Create a unique enemy token ID
 */
export function createEnemyTokenId(enemyId: EnemyId): EnemyTokenId {
  tokenCounter++;
  return `${enemyId}_${tokenCounter}` as EnemyTokenId;
}

/**
 * Reset token counter (for testing)
 */
export function resetTokenCounter(): void {
  tokenCounter = 0;
}

/**
 * Extract the EnemyId from an EnemyTokenId
 */
export function getEnemyIdFromToken(tokenId: EnemyTokenId): EnemyId {
  // Token format is "enemyId_counter"
  const parts = tokenId.split("_");
  // Handle enemy IDs that contain underscores (e.g., "cursed_hags")
  parts.pop(); // Remove the counter
  return parts.join("_") as EnemyId;
}
