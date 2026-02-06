/**
 * Mana Meltdown / Mana Radiance (Red Spell #109)
 *
 * Basic (Mana Meltdown): Each other player must randomly choose a crystal
 * in their inventory to be lost. You may gain one crystal lost this way to
 * your inventory. Any player that had no crystal when you played this takes
 * a Wound instead.
 *
 * Powered (Mana Radiance): When you play this, choose a basic mana color.
 * Each player, including you, takes a Wound for each crystal of that color
 * they own. Gain two crystals of the chosen color to your inventory.
 *
 * Interactive spell — removed in friendly game mode since it directly
 * affects other players' crystals/wounds.
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_RED, MANA_BLACK, CARD_MANA_MELTDOWN } from "@mage-knight/shared";
import {
  EFFECT_MANA_MELTDOWN,
  EFFECT_MANA_RADIANCE,
} from "../../../types/effectTypes.js";

export const MANA_MELTDOWN: DeedCard = {
  id: CARD_MANA_MELTDOWN,
  name: "Mana Meltdown",
  poweredName: "Mana Radiance",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_SPECIAL],
  poweredBy: [MANA_BLACK, MANA_RED],
  basicEffect: {
    type: EFFECT_MANA_MELTDOWN,
  },
  poweredEffect: {
    type: EFFECT_MANA_RADIANCE,
  },
  sidewaysValue: 1,
  interactive: true,
};
