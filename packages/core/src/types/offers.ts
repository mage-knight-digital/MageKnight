/**
 * Game offers types for Mage Knight
 *
 * Offers are what's visible to players for purchase/recruitment.
 * Separate from decks (draw piles) in decks.ts.
 */

import type { CardId, SkillId, UnitId } from "@mage-knight/shared";

// Card offers with position tracking (position matters for sliding)
export interface CardOffer {
  readonly cards: readonly CardId[]; // index 0 = top (newest), last = bottom (oldest, removed at round end)
}

// All game offers (visible cards/skills available for purchase)
export interface GameOffers {
  // Visible units for recruitment (refreshed each round from decks)
  readonly units: readonly UnitId[];

  // Advanced actions offer - 3 visible, slides down when taken, replenished from deck
  readonly advancedActions: CardOffer;

  // Spell offer - 3 visible, slides down when taken, replenished from deck
  readonly spells: CardOffer;

  // Skills rejected during level up, available to other players
  readonly commonSkills: readonly SkillId[];

  // Advanced actions added to unit offer from monasteries (one per unburned monastery)
  readonly monasteryAdvancedActions: readonly CardId[];
}

// Helper to create empty offers
export function createEmptyOffers(): GameOffers {
  return {
    units: [],
    advancedActions: { cards: [] },
    spells: { cards: [] },
    commonSkills: [],
    monasteryAdvancedActions: [],
  };
}
