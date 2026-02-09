/**
 * Mysterious Box artifact
 * Card #24 (UE270/377) - Ultimate Edition
 *
 * Basic: Reveal top artifact from deck. This turn, use Mysterious Box as that
 * artifact (basic/powered/banner) or keep it unused.
 * End of turn cleanup:
 * - Revealed artifact goes to bottom of artifact deck
 * - If Box unused, return to hand
 * - If used as basic or banner, discard
 * - If used as powered, remove from game
 */

import type { DeedCard } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ARTIFACT } from "../../types/cards.js";
import { CARD_MYSTERIOUS_BOX } from "@mage-knight/shared";
import { EFFECT_MYSTERIOUS_BOX } from "../../types/effectTypes.js";

export const MYSTERIOUS_BOX: DeedCard = {
  id: CARD_MYSTERIOUS_BOX,
  name: "Mysterious Box",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  poweredBy: [],
  categories: [CATEGORY_SPECIAL],
  basicEffect: { type: EFFECT_MYSTERIOUS_BOX },
  poweredEffect: { type: EFFECT_MYSTERIOUS_BOX },
  sidewaysValue: 1,
};

export const MYSTERIOUS_BOX_CARDS: Record<CardId, DeedCard> = {
  [CARD_MYSTERIOUS_BOX]: MYSTERIOUS_BOX,
};
