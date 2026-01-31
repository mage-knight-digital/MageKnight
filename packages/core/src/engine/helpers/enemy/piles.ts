/**
 * Enemy deck initialization
 *
 * Functions for creating and initializing enemy token piles.
 */

import type { EnemyId, EnemyColor } from "@mage-knight/shared";
import {
  ENEMIES,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_GREEN,
  ENEMY_COLOR_RED,
  ENEMY_COLOR_VIOLET,
  ENEMY_COLOR_WHITE,
} from "@mage-knight/shared";
import type { EnemyTokenId, EnemyTokenPiles } from "../../../types/enemy.js";
import type { RngState } from "../../../utils/rng.js";
import { shuffleWithRng } from "../../../utils/rng.js";
import { createEnemyTokenId } from "./tokenId.js";

/**
 * Get all enemy IDs of a specific color
 */
export function getEnemyIdsByColor(color: EnemyColor): EnemyId[] {
  return (Object.keys(ENEMIES) as EnemyId[]).filter(
    (id) => ENEMIES[id].color === color
  );
}

/**
 * Create initial enemy token piles with all enemies shuffled by color.
 * Each enemy type creates one token in its color's draw pile.
 */
export function createEnemyTokenPiles(rng: RngState): {
  piles: EnemyTokenPiles;
  rng: RngState;
} {
  let currentRng = rng;

  // Create tokens for each color and shuffle
  const createColorPile = (
    color: EnemyColor
  ): { tokens: EnemyTokenId[]; rng: RngState } => {
    const enemyIds = getEnemyIdsByColor(color);
    const tokens = enemyIds.map((id) => createEnemyTokenId(id));
    const { result: shuffled, rng: newRng } = shuffleWithRng(
      tokens,
      currentRng
    );
    currentRng = newRng;
    return { tokens: shuffled, rng: currentRng };
  };

  const green = createColorPile(ENEMY_COLOR_GREEN);
  const gray = createColorPile(ENEMY_COLOR_GRAY);
  const brown = createColorPile(ENEMY_COLOR_BROWN);
  const violet = createColorPile(ENEMY_COLOR_VIOLET);
  const red = createColorPile(ENEMY_COLOR_RED);
  const white = createColorPile(ENEMY_COLOR_WHITE);

  return {
    piles: {
      drawPiles: {
        [ENEMY_COLOR_GREEN]: green.tokens,
        [ENEMY_COLOR_GRAY]: gray.tokens,
        [ENEMY_COLOR_BROWN]: brown.tokens,
        [ENEMY_COLOR_VIOLET]: violet.tokens,
        [ENEMY_COLOR_RED]: red.tokens,
        [ENEMY_COLOR_WHITE]: white.tokens,
      },
      discardPiles: {
        [ENEMY_COLOR_GREEN]: [],
        [ENEMY_COLOR_GRAY]: [],
        [ENEMY_COLOR_BROWN]: [],
        [ENEMY_COLOR_VIOLET]: [],
        [ENEMY_COLOR_RED]: [],
        [ENEMY_COLOR_WHITE]: [],
      },
    },
    rng: currentRng,
  };
}
