/**
 * Green spell card definitions
 *
 * Green spells are powered by BLACK + GREEN mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_RESTORATION } from "@mage-knight/shared";
import { RESTORATION } from "./restoration.js";

export const GREEN_SPELLS: Record<CardId, DeedCard> = {
  [CARD_RESTORATION]: RESTORATION,
};

export { RESTORATION };
