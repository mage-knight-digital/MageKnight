import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_HEALING,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_BASIC_ACTION,
} from "../../../types/cards.js";
import { MANA_BLUE, CARD_BRAEVALAR_ONE_WITH_THE_LAND } from "@mage-knight/shared";
import { move, heal, block, terrainBasedBlock, choice } from "../helpers.js";

/**
 * Braevalar's One with the Land (replaces Stamina)
 */
export const BRAEVALAR_ONE_WITH_THE_LAND: DeedCard = {
  id: CARD_BRAEVALAR_ONE_WITH_THE_LAND,
  name: "One with the Land",
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE],
  categories: [CATEGORY_MOVEMENT, CATEGORY_HEALING, CATEGORY_COMBAT],
  basicEffect: choice(move(2), heal(1), block(2)),
  poweredEffect: choice(move(4), heal(2), terrainBasedBlock()),
  sidewaysValue: 1,
};
