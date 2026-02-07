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
  CARD_MANA_MELTDOWN,
  CARD_DEMOLISH,
  CARD_BURNING_SHIELD,
  CARD_OFFERING,
} from "@mage-knight/shared";
import { FIREBALL } from "./fireball.js";
import { FLAME_WALL } from "./flameWall.js";
import { TREMOR } from "./tremor.js";
import { MANA_MELTDOWN } from "./manaMeltdown.js";
import { DEMOLISH } from "./demolish.js";
import { BURNING_SHIELD } from "./burningShield.js";
import { OFFERING } from "./offering.js";

export const RED_SPELLS: Record<CardId, DeedCard> = {
  [CARD_FIREBALL]: FIREBALL,
  [CARD_FLAME_WALL]: FLAME_WALL,
  [CARD_TREMOR]: TREMOR,
  [CARD_MANA_MELTDOWN]: MANA_MELTDOWN,
  [CARD_DEMOLISH]: DEMOLISH,
  [CARD_BURNING_SHIELD]: BURNING_SHIELD,
  [CARD_OFFERING]: OFFERING,
};

export { FIREBALL, FLAME_WALL, TREMOR, MANA_MELTDOWN, DEMOLISH, BURNING_SHIELD, OFFERING };
