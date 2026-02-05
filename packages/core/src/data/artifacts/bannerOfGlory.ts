/**
 * Banner of Glory artifact
 * Card #00 (113/377)
 *
 * Basic: Assign to a Unit. Unit gets Armor +1 and +1 to attacks/blocks.
 *        Fame +1 whenever Unit attacks or blocks.
 * Powered (Red): All Units get Armor +1 and +1 to attacks/blocks this turn.
 *          Fame +1 for each Unit that attacks or blocks.
 *          Artifact is destroyed after use.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_NOOP } from "../../types/effectTypes.js";
import { CARD_BANNER_OF_GLORY, MANA_RED } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

// TODO: Implement full banner effects (basic/powered) in individual banner tickets
const BANNER_OF_GLORY: DeedCard = {
  id: CARD_BANNER_OF_GLORY,
  name: "Banner of Glory",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER],
  poweredBy: [MANA_RED],
  basicEffect: { type: EFFECT_NOOP },
  poweredEffect: { type: EFFECT_NOOP },
  sidewaysValue: 0,
  destroyOnPowered: true,
};

export const BANNER_OF_GLORY_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_GLORY]: BANNER_OF_GLORY,
};
