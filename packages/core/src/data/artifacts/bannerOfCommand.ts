/**
 * Banner of Command artifact
 * Card #17 (304/377)
 *
 * Basic: Influence 4. If recruited Unit this turn, may assign this instead
 *        of Command token. Put face down when spent, face up when ready.
 * Powered: Fame +2. Recruit any Unit from offer for free.
 *          If at Command limit, must disband first. Destroy artifact.
 *
 * FAQ S2: Permissible to play Banner → use Influence to recruit → assign Banner to Unit.
 * FAQ S3: No location restrictions — don't need to be at a site with Locals.
 * FAQ S4: Strong effect works in Combat.
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  CATEGORY_INFLUENCE,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { EFFECT_COMPOUND, EFFECT_FREE_RECRUIT } from "../../types/effectTypes.js";
import { CARD_BANNER_OF_COMMAND, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { influence, fame } from "../effectHelpers.js";

const BANNER_OF_COMMAND: DeedCard = {
  id: CARD_BANNER_OF_COMMAND,
  name: "Banner of Command",
  cardType: DEED_CARD_TYPE_ARTIFACT,
  categories: [CATEGORY_BANNER, CATEGORY_INFLUENCE],
  poweredBy: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  basicEffect: influence(4),
  poweredEffect: {
    type: EFFECT_COMPOUND,
    effects: [
      fame(2),
      { type: EFFECT_FREE_RECRUIT },
    ],
  },
  sidewaysValue: 1,
  destroyOnPowered: true,
};

export const BANNER_OF_COMMAND_CARDS: Record<CardId, DeedCard> = {
  [CARD_BANNER_OF_COMMAND]: BANNER_OF_COMMAND,
};
