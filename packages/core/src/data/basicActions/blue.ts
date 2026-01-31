/** Blue-powered basic action cards (powered by blue mana) */
import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT, CATEGORY_MOVEMENT, CATEGORY_SPECIAL,
  CATEGORY_HEALING, DEED_CARD_TYPE_BASIC_ACTION,
} from "../../types/cards.js";
import { COMBAT_TYPE_MELEE, COMBAT_TYPE_RANGED } from "../../types/effectTypes.js";
import { ELEMENT_ICE } from "../../types/modifierConstants.js";
import {
  MANA_BLUE, MANA_RED, MANA_GREEN, MANA_WHITE, CARD_DETERMINATION, CARD_STAMINA,
  CARD_CRYSTALLIZE, CARD_TOVAK_COLD_TOUGHNESS, CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS, CARD_BRAEVALAR_ONE_WITH_THE_LAND,
} from "@mage-knight/shared";
import {
  move, heal, attack, attackWithElement, block, blockWithElement, choice,
  gainCrystal, convertManaToCrystal, terrainBasedBlock,
} from "./helpers.js";

// === Shared Blue Cards ===

export const DETERMINATION: DeedCard = {
  id: CARD_DETERMINATION, name: "Determination", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_COMBAT],
  basicEffect: choice(attack(2), block(2)), poweredEffect: block(5), sidewaysValue: 1,
};

export const STAMINA: DeedCard = {
  id: CARD_STAMINA, name: "Stamina", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2), poweredEffect: move(4), sidewaysValue: 1,
};

export const CRYSTALLIZE: DeedCard = {
  id: CARD_CRYSTALLIZE, name: "Crystallize", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_SPECIAL],
  basicEffect: convertManaToCrystal(),
  poweredEffect: choice(gainCrystal(MANA_RED), gainCrystal(MANA_BLUE), gainCrystal(MANA_GREEN), gainCrystal(MANA_WHITE)),
  sidewaysValue: 1,
};

// === Hero-Specific Blue Cards ===

/** Tovak's Cold Toughness (replaces Determination) */
export const TOVAK_COLD_TOUGHNESS: DeedCard = {
  id: CARD_TOVAK_COLD_TOUGHNESS, name: "Cold Toughness", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_COMBAT],
  basicEffect: choice(attackWithElement(2, COMBAT_TYPE_MELEE, ELEMENT_ICE), blockWithElement(3, ELEMENT_ICE)),
  poweredEffect: blockWithElement(5, ELEMENT_ICE), sidewaysValue: 1,
};

/** Wolfhawk's Swift Reflexes (replaces Swiftness) */
export const WOLFHAWK_SWIFT_REFLEXES: DeedCard = {
  id: CARD_WOLFHAWK_SWIFT_REFLEXES, name: "Swift Reflexes", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  basicEffect: choice(move(2), attack(1, COMBAT_TYPE_RANGED)),
  poweredEffect: choice(move(4), attack(3, COMBAT_TYPE_RANGED)), sidewaysValue: 1,
};

/** Wolfhawk's Tirelessness (replaces Stamina) */
export const WOLFHAWK_TIRELESSNESS: DeedCard = {
  id: CARD_WOLFHAWK_TIRELESSNESS, name: "Tirelessness", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_MOVEMENT],
  basicEffect: move(2), poweredEffect: move(4), sidewaysValue: 1,
};

/** Braevalar's One with the Land (replaces Stamina) */
export const BRAEVALAR_ONE_WITH_THE_LAND: DeedCard = {
  id: CARD_BRAEVALAR_ONE_WITH_THE_LAND, name: "One with the Land", cardType: DEED_CARD_TYPE_BASIC_ACTION,
  poweredBy: [MANA_BLUE], categories: [CATEGORY_MOVEMENT, CATEGORY_HEALING, CATEGORY_COMBAT],
  basicEffect: choice(move(2), heal(1), block(2)),
  poweredEffect: choice(move(4), heal(2), terrainBasedBlock()), sidewaysValue: 1,
};

/** All blue-powered basic action cards */
export const BLUE_BASIC_ACTIONS = {
  [CARD_DETERMINATION]: DETERMINATION,
  [CARD_STAMINA]: STAMINA,
  [CARD_CRYSTALLIZE]: CRYSTALLIZE,
  [CARD_TOVAK_COLD_TOUGHNESS]: TOVAK_COLD_TOUGHNESS,
  [CARD_WOLFHAWK_SWIFT_REFLEXES]: WOLFHAWK_SWIFT_REFLEXES,
  [CARD_WOLFHAWK_TIRELESSNESS]: WOLFHAWK_TIRELESSNESS,
  [CARD_BRAEVALAR_ONE_WITH_THE_LAND]: BRAEVALAR_ONE_WITH_THE_LAND,
} as const;
