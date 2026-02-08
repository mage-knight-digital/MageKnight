/**
 * Shield of the Fallen Kings artifact
 * Card #20 (307/377)
 *
 * Basic: Block 6, or two Block 4 against different attacks.
 * Powered (any color, destroy): Cold Fire Block 8, or up to three
 *         Cold Fire Block 4 against different attacks.
 *
 * FAQ Q7/A7 (Ambush):
 * - When combining with Ambush (+X Block), only the FIRST block gets the bonus.
 * - This is handled naturally by the Ambush modifier system which applies once
 *   per card played, adding to the overall block pool.
 *
 * Split block mechanic:
 * - The compound of multiple Block 4 effects adds to the player's block pool.
 * - The existing ASSIGN_BLOCK system lets the player distribute block across
 *   different enemy attacks during the block phase.
 * - Unused blocks are naturally lost if not assigned.
 */

import type { DeedCard } from "../../types/cards.js";
import { CATEGORY_COMBAT, DEED_CARD_TYPE_ARTIFACT } from "../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_COMPOUND } from "../../types/effectTypes.js";
import { block, coldFireBlock } from "../effectHelpers.js";
import {
  CARD_SHIELD_OF_THE_FALLEN_KINGS,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

const SHIELD_OF_THE_FALLEN_KINGS: DeedCard = {
  id: CARD_SHIELD_OF_THE_FALLEN_KINGS,
  name: "Shield of the Fallen Kings",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_COMBAT],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: {
    type: EFFECT_CHOICE,
    options: [
      // Option 1: Single Block 6
      block(6),
      // Option 2: Two Block 4 (split across different attacks)
      {
        type: EFFECT_COMPOUND,
        effects: [block(4), block(4)],
      },
    ],
  },
  poweredEffect: {
    type: EFFECT_CHOICE,
    options: [
      // Option 1: Single Cold Fire Block 8
      coldFireBlock(8),
      // Option 2: Up to three Cold Fire Block 4 (split across different attacks)
      {
        type: EFFECT_COMPOUND,
        effects: [coldFireBlock(4), coldFireBlock(4), coldFireBlock(4)],
      },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const SHIELD_OF_THE_FALLEN_KINGS_CARDS: Record<CardId, DeedCard> = {
  [CARD_SHIELD_OF_THE_FALLEN_KINGS]: SHIELD_OF_THE_FALLEN_KINGS,
};
