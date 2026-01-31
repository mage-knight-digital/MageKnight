/**
 * Spell card definitions for Mage Knight
 *
 * Spells require BLACK mana + their color mana to cast the powered effect:
 * - Basic effect (can be played with just the card)
 * - Powered effect (requires spending BLACK + the spell's color mana)
 *
 * Organized by color:
 * - Red: Fire damage, armor reduction
 * - Blue: Ice damage, freezing effects
 * - Green: Healing, unit readying
 * - White: Enemy debuffs, instant defeat
 */

import type { DeedCard } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { RED_SPELLS } from "./red.js";
import { BLUE_SPELLS } from "./blue.js";
import { GREEN_SPELLS } from "./green.js";
import { WHITE_SPELLS } from "./white.js";

export const SPELL_CARDS: Record<CardId, DeedCard> = {
  ...RED_SPELLS,
  ...BLUE_SPELLS,
  ...GREEN_SPELLS,
  ...WHITE_SPELLS,
};

/**
 * Get a spell card definition by ID
 */
export function getSpellCard(id: CardId): DeedCard | undefined {
  return SPELL_CARDS[id];
}

/**
 * Get all spell card IDs
 */
export function getAllSpellCardIds(): CardId[] {
  return Object.keys(SPELL_CARDS) as CardId[];
}

// Re-export helpers for external use if needed
export * from "./helpers.js";
