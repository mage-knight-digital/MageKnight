/**
 * Green spell card definitions
 *
 * Green spells are powered by BLACK + GREEN mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_RESTORATION, CARD_ENERGY_FLOW } from "@mage-knight/shared";
import { RESTORATION } from "./restoration.js";
import { ENERGY_FLOW } from "./energyFlow.js";

export const GREEN_SPELLS: Record<CardId, DeedCard> = {
  [CARD_RESTORATION]: RESTORATION,
  [CARD_ENERGY_FLOW]: ENERGY_FLOW,
};

export { RESTORATION, ENERGY_FLOW };
