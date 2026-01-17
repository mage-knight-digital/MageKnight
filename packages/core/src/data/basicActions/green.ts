/** Green-powered basic action cards (powered by green mana) */
import type { DeedCard } from "../../types/cards.js";
import {
  CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_HEALING, CARD_CATEGORY_SPECIAL, DEED_CARD_TYPE_BASIC_ACTION,
} from "../../types/cards.js";
import {
  MANA_GREEN, MANA_RED, MANA_BLUE, MANA_WHITE, CARD_MARCH, CARD_TRANQUILITY,
  CARD_CONCENTRATION, CARD_GOLDYX_WILL_FOCUS, CARD_NOROWAS_REJUVENATE,
  CARD_KRANG_SAVAGE_HARVESTING, CARD_BRAEVALAR_DRUIDIC_PATHS,
} from "@mage-knight/shared";
import { move, heal, drawCards, gainMana, readyUnit, choice, gainCrystal, cardBoost } from "./helpers.js";

// === Shared Green Cards ===

export const MARCH: DeedCard = {
  id: CARD_MARCH, name: "March", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_MOVEMENT],
  basicEffect: move(2), poweredEffect: move(4), sidewaysValue: 1,
};

export const TRANQUILITY: DeedCard = {
  id: CARD_TRANQUILITY, name: "Tranquility", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_HEALING],
  basicEffect: choice(heal(1), drawCards(1)), poweredEffect: choice(heal(2), drawCards(2)), sidewaysValue: 1,
};

export const CONCENTRATION: DeedCard = {
  id: CARD_CONCENTRATION, name: "Concentration", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_SPECIAL],
  basicEffect: choice(gainMana(MANA_BLUE), gainMana(MANA_WHITE), gainMana(MANA_RED)),
  poweredEffect: cardBoost(2), sidewaysValue: 1,
};

// === Hero-Specific Green Cards ===

/** Goldyx's Will Focus (replaces Concentration) */
export const GOLDYX_WILL_FOCUS: DeedCard = {
  id: CARD_GOLDYX_WILL_FOCUS, name: "Will Focus", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_SPECIAL],
  basicEffect: choice(gainMana(MANA_BLUE), gainMana(MANA_WHITE), gainMana(MANA_RED), gainCrystal(MANA_GREEN)),
  poweredEffect: cardBoost(3), sidewaysValue: 1,
};

/** Norowas's Rejuvenate (replaces Tranquility) */
export const NOROWAS_REJUVENATE: DeedCard = {
  id: CARD_NOROWAS_REJUVENATE, name: "Rejuvenate", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_HEALING],
  basicEffect: choice(heal(1), drawCards(1), gainMana(MANA_GREEN), readyUnit(2)),
  poweredEffect: choice(heal(2), drawCards(2), gainCrystal(MANA_GREEN), readyUnit(3)), sidewaysValue: 1,
};

/** Krang's Savage Harvesting (replaces March) */
export const KRANG_SAVAGE_HARVESTING: DeedCard = {
  id: CARD_KRANG_SAVAGE_HARVESTING, name: "Savage Harvesting", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_SPECIAL],
  basicEffect: move(2), poweredEffect: move(4), sidewaysValue: 1,
};

/** Braevalar's Druidic Paths (replaces March) */
export const BRAEVALAR_DRUIDIC_PATHS: DeedCard = {
  id: CARD_BRAEVALAR_DRUIDIC_PATHS, name: "Druidic Paths", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_GREEN], categories: [CARD_CATEGORY_MOVEMENT],
  basicEffect: move(2), poweredEffect: move(4), sidewaysValue: 1,
};

/** All green-powered basic action cards */
export const GREEN_BASIC_ACTIONS = {
  [CARD_MARCH]: MARCH,
  [CARD_TRANQUILITY]: TRANQUILITY,
  [CARD_CONCENTRATION]: CONCENTRATION,
  [CARD_GOLDYX_WILL_FOCUS]: GOLDYX_WILL_FOCUS,
  [CARD_NOROWAS_REJUVENATE]: NOROWAS_REJUVENATE,
  [CARD_KRANG_SAVAGE_HARVESTING]: KRANG_SAVAGE_HARVESTING,
  [CARD_BRAEVALAR_DRUIDIC_PATHS]: BRAEVALAR_DRUIDIC_PATHS,
} as const;
