/**
 * Draw enemies for hex
 *
 * Main orchestration function for drawing all enemies needed when
 * revealing a tile or hex.
 */

import type { TimeOfDay } from "@mage-knight/shared";
import type { EnemyTokenPiles } from "../../../types/enemy.js";
import { SiteType, RampagingEnemyType, type HexEnemy } from "../../../types/map.js";
import type { RngState } from "../../../utils/rng.js";
import { drawEnemy } from "./drawing.js";
import {
  getSiteDefenders,
  getRampagingEnemyColor,
  isSiteEnemyRevealed,
} from "./siteMapping.js";

export interface DrawEnemiesForHexResult {
  readonly enemies: readonly HexEnemy[];
  readonly piles: EnemyTokenPiles;
  readonly rng: RngState;
}

/**
 * Draw all enemies needed for a hex (rampaging + site defenders).
 * Pass timeOfDay to correctly handle sites like Ancient Ruins (night-only enemies).
 *
 * Returns HexEnemy[] with proper isRevealed values:
 * - Rampaging enemies: always face-UP (revealed)
 * - Fortified sites: face-DOWN (unrevealed)
 * - Adventure sites: face-UP (revealed)
 */
export function drawEnemiesForHex(
  rampagingTypes: readonly RampagingEnemyType[],
  siteType: SiteType | null,
  piles: EnemyTokenPiles,
  rng: RngState,
  timeOfDay?: TimeOfDay
): DrawEnemiesForHexResult {
  const enemies: HexEnemy[] = [];
  let currentPiles = piles;
  let currentRng = rng;

  // Draw rampaging enemies - always face UP (revealed)
  for (const rampagingType of rampagingTypes) {
    const color = getRampagingEnemyColor(rampagingType);
    const result = drawEnemy(currentPiles, color, currentRng);
    if (result.tokenId) {
      enemies.push({
        tokenId: result.tokenId,
        color,
        isRevealed: true, // Rampaging enemies are always face-up
      });
    }
    currentPiles = result.piles;
    currentRng = result.rng;
  }

  // Draw site defenders (only those placed at tile reveal)
  if (siteType) {
    const defenderConfig = getSiteDefenders(siteType, timeOfDay);
    if (defenderConfig) {
      const isRevealed = isSiteEnemyRevealed(siteType);
      for (let i = 0; i < defenderConfig.count; i++) {
        const result = drawEnemy(currentPiles, defenderConfig.color, currentRng);
        if (result.tokenId) {
          enemies.push({
            tokenId: result.tokenId,
            color: defenderConfig.color,
            isRevealed,
          });
        }
        currentPiles = result.piles;
        currentRng = result.rng;
      }
    }
  }

  return {
    enemies,
    piles: currentPiles,
    rng: currentRng,
  };
}
