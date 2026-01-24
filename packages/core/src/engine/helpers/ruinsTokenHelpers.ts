/**
 * Ruins token helpers for Mage Knight
 *
 * Functions for managing the Ancient Ruins "yellow" token deck:
 * - Initializing the token pile
 * - Drawing tokens when tiles with Ancient Ruins are revealed
 * - Revealing tokens based on time of day
 */

import type { TimeOfDay, RuinsTokenId } from "@mage-knight/shared";
import { ALL_RUINS_TOKEN_IDS, TIME_OF_DAY_DAY } from "@mage-knight/shared";
import type { RuinsToken } from "../../types/map.js";
import type { RngState } from "../../utils/rng.js";
import { shuffleWithRng } from "../../utils/rng.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Ruins token piles in game state.
 * Unlike enemy tokens (which have multiple colors), ruins tokens are a single pile.
 */
export interface RuinsTokenPiles {
  readonly drawPile: readonly RuinsTokenId[];
  readonly discardPile: readonly RuinsTokenId[];
}

// =============================================================================
// PILE MANAGEMENT
// =============================================================================

/**
 * Create empty ruins token piles.
 */
export function createEmptyRuinsTokenPiles(): RuinsTokenPiles {
  return {
    drawPile: [],
    discardPile: [],
  };
}

/**
 * Initialize ruins token piles with all tokens shuffled.
 * Call this at game start to set up the draw pile.
 */
export function createRuinsTokenPiles(rng: RngState): {
  piles: RuinsTokenPiles;
  rng: RngState;
} {
  // Create a mutable copy of all token IDs and shuffle
  const allTokens = [...ALL_RUINS_TOKEN_IDS];
  const { result: shuffled, rng: newRng } = shuffleWithRng(allTokens, rng);

  return {
    piles: {
      drawPile: shuffled,
      discardPile: [],
    },
    rng: newRng,
  };
}

// =============================================================================
// DRAW AND DISCARD
// =============================================================================

export interface DrawRuinsTokenResult {
  readonly token: RuinsToken | null;
  readonly piles: RuinsTokenPiles;
  readonly rng: RngState;
}

/**
 * Draw a ruins token from the pile.
 * If the draw pile is empty, reshuffles the discard pile.
 * Returns null if both piles are empty.
 *
 * @param piles - Current ruins token piles
 * @param rng - Current RNG state
 * @param timeOfDay - Current time of day (determines if token is revealed)
 */
export function drawRuinsToken(
  piles: RuinsTokenPiles,
  rng: RngState,
  timeOfDay: TimeOfDay
): DrawRuinsTokenResult {
  const { drawPile, discardPile } = piles;

  // If draw pile has tokens, draw from it
  if (drawPile.length > 0) {
    const [tokenId, ...remaining] = drawPile;
    if (!tokenId) {
      return { token: null, piles, rng };
    }

    const token: RuinsToken = {
      tokenId,
      isRevealed: shouldRuinsTokenBeRevealed(timeOfDay),
    };

    return {
      token,
      piles: {
        drawPile: remaining,
        discardPile,
      },
      rng,
    };
  }

  // If draw pile is empty, reshuffle discard
  if (discardPile.length > 0) {
    const { result: shuffled, rng: newRng } = shuffleWithRng(
      [...discardPile],
      rng
    );
    const [tokenId, ...remaining] = shuffled;
    if (!tokenId) {
      return { token: null, piles, rng: newRng };
    }

    const token: RuinsToken = {
      tokenId,
      isRevealed: shouldRuinsTokenBeRevealed(timeOfDay),
    };

    return {
      token,
      piles: {
        drawPile: remaining,
        discardPile: [],
      },
      rng: newRng,
    };
  }

  // Both piles empty
  return { token: null, piles, rng };
}

/**
 * Discard a ruins token to the discard pile.
 */
export function discardRuinsToken(
  piles: RuinsTokenPiles,
  tokenId: RuinsTokenId
): RuinsTokenPiles {
  return {
    ...piles,
    discardPile: [...piles.discardPile, tokenId],
  };
}

// =============================================================================
// VISIBILITY RULES
// =============================================================================

/**
 * Determine if a ruins token should be revealed based on time of day.
 * Per Mage Knight rules:
 * - Day: tokens are face-up (revealed)
 * - Night: tokens are face-down (unrevealed), revealed on entry or at dawn
 */
export function shouldRuinsTokenBeRevealed(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === TIME_OF_DAY_DAY;
}

/**
 * Reveal a ruins token (flip from face-down to face-up).
 * Used when:
 * - Player enters an Ancient Ruins hex with an unrevealed token
 * - Dawn occurs (Night → Day transition) with unrevealed tokens on the map
 */
export function revealRuinsToken(token: RuinsToken): RuinsToken {
  if (token.isRevealed) {
    return token; // Already revealed, no change
  }

  return {
    ...token,
    isRevealed: true,
  };
}
