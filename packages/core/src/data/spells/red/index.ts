/**
 * Red spell card definitions
 *
 * Red spells are powered by BLACK + RED mana.
 */

import type { DeedCard } from "../../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_FIREBALL,
  CARD_FLAME_WALL,
  CARD_TREMOR,
} from "@mage-knight/shared";
import { FIREBALL } from "./fireball.js";
import { FLAME_WALL } from "./flameWall.js";
import { TREMOR } from "./tremor.js";

export const RED_SPELLS: Record<CardId, DeedCard> = {
  [CARD_FIREBALL]: FIREBALL,
  [CARD_FLAME_WALL]: FLAME_WALL,
  [CARD_TREMOR]: TREMOR,
};

export { FIREBALL, FLAME_WALL, TREMOR };
