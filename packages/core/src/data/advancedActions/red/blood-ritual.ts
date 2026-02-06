import type { DeedCard } from "../../../types/cards.js";
import { CATEGORY_SPECIAL, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../../types/cards.js";
import { MANA_RED, CARD_BLOOD_RITUAL } from "@mage-knight/shared";
import {
  compound,
  takeWound,
  gainCrystal,
  choice,
  gainManaAnyColor,
  noop,
  convertManaToCrystal,
} from "../helpers.js";

export const BLOOD_RITUAL: DeedCard = {
  id: CARD_BLOOD_RITUAL,
  name: "Blood Ritual",
  cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
  poweredBy: [MANA_RED],
  categories: [CATEGORY_SPECIAL],
  // Basic: Take a Wound. Gain a red crystal to your Inventory and a mana token of any color (including non-basic).
  basicEffect: compound(takeWound(1), gainCrystal(MANA_RED), gainManaAnyColor()),
  // Powered (Red): Take a Wound. Gain three mana tokens of any colors (including non-basic).
  // You may pay one mana of a basic color to gain a crystal of that color to your Inventory.
  poweredEffect: compound(
    takeWound(1),
    gainManaAnyColor(),
    gainManaAnyColor(),
    gainManaAnyColor(),
    choice(convertManaToCrystal(), noop())
  ),
  sidewaysValue: 1,
};
