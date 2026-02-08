/**
 * Green spell card definitions
 *
 * Green spells are powered by BLACK + GREEN mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_RESTORATION, CARD_ENERGY_FLOW, CARD_UNDERGROUND_TRAVEL, CARD_MEDITATION } from "@mage-knight/shared";
import { RESTORATION } from "./restoration.js";
import { ENERGY_FLOW } from "./energyFlow.js";
import { UNDERGROUND_TRAVEL } from "./undergroundTravel.js";
import { MEDITATION } from "./meditation.js";

export const GREEN_SPELLS: Record<CardId, DeedCard> = {
  [CARD_RESTORATION]: RESTORATION,
  [CARD_ENERGY_FLOW]: ENERGY_FLOW,
  [CARD_UNDERGROUND_TRAVEL]: UNDERGROUND_TRAVEL,
  [CARD_MEDITATION]: MEDITATION,
};

export { RESTORATION, ENERGY_FLOW, UNDERGROUND_TRAVEL, MEDITATION };
