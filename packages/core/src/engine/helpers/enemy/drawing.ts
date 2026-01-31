/**
 * Enemy drawing and discarding
 *
 * Functions for drawing enemy tokens from piles and discarding them.
 * Includes standard draw and faction-priority draw.
 */

import type { EnemyColor, Faction } from "@mage-knight/shared";
import { ENEMIES } from "@mage-knight/shared";
import type { EnemyTokenId, EnemyTokenPiles } from "../../../types/enemy.js";
import type { RngState } from "../../../utils/rng.js";
import { shuffleWithRng } from "../../../utils/rng.js";
import { getEnemyIdFromToken } from "./tokenId.js";

export interface DrawEnemyResult {
  readonly tokenId: EnemyTokenId | null;
  readonly piles: EnemyTokenPiles;
  readonly rng: RngState;
}

/**
 * Draw an enemy token from a specific color deck.
 * If the draw pile is empty, reshuffles the discard pile.
 * Returns null if both piles are empty.
 */
export function drawEnemy(
  piles: EnemyTokenPiles,
  color: EnemyColor,
  rng: RngState
): DrawEnemyResult {
  const drawPile = piles.drawPiles[color];
  const discardPile = piles.discardPiles[color];

  // If draw pile has tokens, draw from it
  if (drawPile.length > 0) {
    const [tokenId, ...remaining] = drawPile;
    return {
      tokenId: tokenId ?? null,
      piles: {
        ...piles,
        drawPiles: {
          ...piles.drawPiles,
          [color]: remaining,
        },
      },
      rng,
    };
  }

  // If draw pile is empty, reshuffle discard
  if (discardPile.length > 0) {
    const { result: shuffled, rng: newRng } = shuffleWithRng(discardPile, rng);
    const [tokenId, ...remaining] = shuffled;
    return {
      tokenId: tokenId ?? null,
      piles: {
        ...piles,
        drawPiles: {
          ...piles.drawPiles,
          [color]: remaining,
        },
        discardPiles: {
          ...piles.discardPiles,
          [color]: [],
        },
      },
      rng: newRng,
    };
  }

  // Both piles empty
  return { tokenId: null, piles, rng };
}

/**
 * Find a token matching the given faction in a token array.
 * Returns the index of the first matching token, or -1 if no match.
 */
function findFactionMatchInTokens(
  tokens: readonly EnemyTokenId[],
  faction: Faction
): number {
  for (let i = 0; i < tokens.length; i++) {
    const tokenId = tokens[i];
    if (!tokenId) continue;
    const enemyId = getEnemyIdFromToken(tokenId);
    const enemy = ENEMIES[enemyId];
    if (enemy.faction === faction) {
      return i;
    }
  }
  return -1;
}

/**
 * Draw an enemy token from a specific color deck with faction priority.
 * If a faction is specified, searches for a matching token first.
 * Falls back to standard random draw if no faction match is found.
 */
export function drawEnemyWithFactionPriority(
  piles: EnemyTokenPiles,
  color: EnemyColor,
  faction: Faction | undefined,
  rng: RngState
): DrawEnemyResult {
  // If no faction specified, use standard draw
  if (!faction) {
    return drawEnemy(piles, color, rng);
  }

  const drawPile = piles.drawPiles[color];
  const discardPile = piles.discardPiles[color];

  // Step 1: Search draw pile for faction match
  const drawPileMatchIndex = findFactionMatchInTokens(drawPile, faction);
  if (drawPileMatchIndex !== -1) {
    const matchedToken = drawPile[drawPileMatchIndex];
    if (matchedToken !== undefined) {
      const remaining = [
        ...drawPile.slice(0, drawPileMatchIndex),
        ...drawPile.slice(drawPileMatchIndex + 1),
      ];
      return {
        tokenId: matchedToken,
        piles: {
          ...piles,
          drawPiles: {
            ...piles.drawPiles,
            [color]: remaining,
          },
        },
        rng,
      };
    }
  }

  // Step 2: Search discard pile for faction match (reshuffle first)
  if (discardPile.length > 0) {
    const discardMatchIndex = findFactionMatchInTokens(discardPile, faction);
    if (discardMatchIndex !== -1) {
      // Reshuffle discard pile into draw pile first
      const { result: shuffled, rng: newRng } = shuffleWithRng(discardPile, rng);
      // Now find the match in the shuffled pile (position may have changed)
      const shuffledMatchIndex = findFactionMatchInTokens(shuffled, faction);
      if (shuffledMatchIndex !== -1) {
        const matchedToken = shuffled[shuffledMatchIndex];
        if (matchedToken !== undefined) {
          const remaining = [
            ...drawPile, // Keep existing draw pile
            ...shuffled.slice(0, shuffledMatchIndex),
            ...shuffled.slice(shuffledMatchIndex + 1),
          ];
          return {
            tokenId: matchedToken,
            piles: {
              ...piles,
              drawPiles: {
                ...piles.drawPiles,
                [color]: remaining,
              },
              discardPiles: {
                ...piles.discardPiles,
                [color]: [],
              },
            },
            rng: newRng,
          };
        }
      }
    }
  }

  // Step 3: No faction match found, fall back to standard draw
  return drawEnemy(piles, color, rng);
}

/**
 * Discard an enemy token to its color's discard pile.
 */
export function discardEnemy(
  piles: EnemyTokenPiles,
  tokenId: EnemyTokenId
): EnemyTokenPiles {
  const enemyId = getEnemyIdFromToken(tokenId);
  const enemy = ENEMIES[enemyId];
  const color = enemy.color;

  return {
    ...piles,
    discardPiles: {
      ...piles.discardPiles,
      [color]: [...piles.discardPiles[color], tokenId],
    },
  };
}
