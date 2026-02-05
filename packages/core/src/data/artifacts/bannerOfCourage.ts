/**
 * Banner of Courage artifact
 * Card #03 (116/377)
 *
 * Basic: Assign to a Unit. Once per Round (except combat), flip to Ready Unit.
 *        Flip face up at start of Round.
 * Powered: Ready all Units you control (anytime except combat). Destroy artifact.
 *
 * FAQ S1: You can use this Banner to ready the Unit even while it is wounded.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_NOOP, EFFECT_READY_ALL_UNITS } from "../../types/effectTypes.js";
import { CARD_BANNER_OF_COURAGE, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const BANNER_OF_COURAGE: DeedCard = {
  id: CARD_BANNER_OF_COURAGE,
  name: "Banner of Courage",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_HEALING],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  // Basic effect: Assign to unit (requires banner system from #211)
  // When attached, once per round (except combat), flip to ready the attached unit.
  basicEffect: {
    type: EFFECT_NOOP,
  },
  poweredEffect: {
    type: EFFECT_READY_ALL_UNITS,
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const BANNER_OF_COURAGE_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_COURAGE]: BANNER_OF_COURAGE,
};
