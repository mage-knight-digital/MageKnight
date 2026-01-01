/**
 * Game decks for Mage Knight
 *
 * These are the draw piles, separate from offers (what's visible).
 */

import type { CardId } from "@mage-knight/shared";

// The various draw decks in the game
export interface GameDecks {
  // Spell deck - draw from here to replenish offer
  readonly spells: readonly CardId[];

  // Advanced action deck - draw from here to replenish offer
  readonly advancedActions: readonly CardId[];

  // Artifact deck - never displayed, drawn as rewards
  readonly artifacts: readonly CardId[];

  // Unit decks - separate silver (regular) and gold (elite)
  readonly regularUnits: readonly CardId[]; // silver back
  readonly eliteUnits: readonly CardId[]; // gold back
}

// Helper to create empty decks
export function createEmptyDecks(): GameDecks {
  return {
    spells: [],
    advancedActions: [],
    artifacts: [],
    regularUnits: [],
    eliteUnits: [],
  };
}
