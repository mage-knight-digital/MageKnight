/**
 * Artifact deck setup utilities for Mage Knight
 *
 * Creates and shuffles the artifact deck based on scenario configuration.
 * Artifacts are drawn directly as rewards (no offer/selection for now).
 */

import type { CardId } from "@mage-knight/shared";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";
import { getAllArtifactCardIds } from "./artifacts/index.js";

/**
 * Result of artifact deck initialization
 */
export interface ArtifactDeckSetupResult {
  readonly artifactDeck: readonly CardId[];
  readonly rng: RngState;
}

/**
 * Build the artifact deck from card definitions.
 * Each artifact appears once in the deck.
 */
function buildArtifactDeck(): CardId[] {
  return getAllArtifactCardIds();
}

/**
 * Create and shuffle the artifact deck.
 *
 * Per the rulebook:
 * - Shuffle the Artifact deck
 * - Draw artifacts directly as rewards from conquests
 * - Drawn artifacts go to top of player's deed deck
 *
 * @param rng - Seeded RNG state
 * @returns Artifact deck and updated RNG state
 */
export function createArtifactDeck(rng: RngState): ArtifactDeckSetupResult {
  // Build and shuffle artifact deck
  const deck = buildArtifactDeck();
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(deck, rng);

  return {
    artifactDeck: shuffledDeck,
    rng: newRng,
  };
}
