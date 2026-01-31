/**
 * Artifact card definitions for Mage Knight
 *
 * Artifacts are powerful cards that can be gained from conquering sites.
 * Some artifacts have a "destroyOnPowered" flag, meaning they are
 * permanently removed from the game after using their powered effect.
 */

import type { DeedCard } from "../types/cards.js";
import {
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ARTIFACT,
} from "../types/cards.js";
import { EFFECT_COMPOUND } from "../types/effectTypes.js";
import { CARD_ENDLESS_BAG_OF_GOLD, MANA_BLACK } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { influence, fame } from "./effectHelpers.js";

// === Artifact Definitions ===

/**
 * Endless Bag of Gold
 * - Basic: Influence 4, Fame 2
 * - Powered (black): Influence 9, Fame 3 (card destroyed)
 */
const ENDLESS_BAG_OF_GOLD: DeedCard = {
  id: CARD_ENDLESS_BAG_OF_GOLD,
  name: "Endless Bag of Gold",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_INFLUENCE],
  poweredBy: [MANA_BLACK],
  basicEffect: {
    type: EFFECT_COMPOUND,
    effects: [influence(4), fame(2)],
  },
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [influence(9), fame(3)],
  },
  sidewaysValue: 2,
  destroyOnPowered: true,
};

// === Artifact Registry ===

export const ARTIFACT_CARDS: Record<CardId, DeedCard> = {
  [CARD_ENDLESS_BAG_OF_GOLD]: ENDLESS_BAG_OF_GOLD,
};

/**
 * Get an artifact card by ID
 */
export function getArtifactCard(id: CardId): DeedCard | undefined {
  return ARTIFACT_CARDS[id];
}

/**
 * Get all artifact card IDs (for deck creation)
 */
export function getAllArtifactCardIds(): CardId[] {
  return Object.keys(ARTIFACT_CARDS) as CardId[];
}
