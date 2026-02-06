/**
 * Restoration / Rebirth (Green Spell #05)
 * Basic: Heal 3. If you are in a forest, Heal 5 instead.
 * Powered: Heal 3 (or 5 in forest) + Ready up to 3 levels worth of Units (5 in forest)
 */

import type { DeedCard } from "../../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../../../types/cards.js";
import { MANA_GREEN, MANA_BLACK, CARD_RESTORATION, TERRAIN_FOREST } from "@mage-knight/shared";
import { heal } from "../helpers.js";
import { ifOnTerrain, compound } from "../../effectHelpers.js";
import { EFFECT_READY_UNITS_BUDGET } from "../../../types/effectTypes.js";
import type { ReadyUnitsBudgetEffect } from "../../../types/cards.js";

function readyUnitsBudget(totalLevels: number): ReadyUnitsBudgetEffect {
  return { type: EFFECT_READY_UNITS_BUDGET, totalLevels };
}

export const RESTORATION: DeedCard = {
  id: CARD_RESTORATION,
  name: "Restoration",
  poweredName: "Rebirth",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CATEGORY_HEALING],
  poweredBy: [MANA_BLACK, MANA_GREEN],
  basicEffect: ifOnTerrain(TERRAIN_FOREST, heal(5), heal(3)),
  poweredEffect: compound([
    ifOnTerrain(TERRAIN_FOREST, heal(5), heal(3)),
    ifOnTerrain(TERRAIN_FOREST, readyUnitsBudget(5), readyUnitsBudget(3)),
  ]),
  sidewaysValue: 1,
};
