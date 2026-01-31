/**
 * Bolt Advanced Action Cards
 *
 * Bolt cards are a special category of advanced actions that gain crystals
 * as their basic effect and provide elemental ranged/siege attacks when powered.
 * Each bolt matches a basic mana color.
 *
 * @module data/advancedActions/bolts
 *
 * @remarks Cards in this module:
 * - Fire Bolt - Red crystal / Ranged Fire Attack 3
 * - Ice Bolt - Blue crystal / Ranged Ice Attack 3
 * - Swift Bolt - White crystal / Ranged Attack 4
 * - Crushing Bolt - Green crystal / Siege Attack 3
 */

import type { DeedCard } from "../../types/cards.js";
import {
  CATEGORY_COMBAT,
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_SWIFT_BOLT,
  CARD_CRUSHING_BOLT,
  type AdvancedActionCardId,
} from "@mage-knight/shared";
import {
  gainCrystal,
  rangedAttack,
  rangedAttackWithElement,
  siegeAttack,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "./helpers.js";

/**
 * Bolt card definitions.
 *
 * These cards provide a consistent pattern:
 * - Basic: Gain a crystal of the card's color
 * - Powered: Ranged or siege attack (often with an element)
 */
export const BOLT_CARDS = {
  [CARD_FIRE_BOLT]: {
    id: CARD_FIRE_BOLT,
    name: "Fire Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
    // Basic: Gain a red crystal to your Inventory
    // Powered: Ranged Fire Attack 3
    basicEffect: gainCrystal(MANA_RED),
    poweredEffect: rangedAttackWithElement(3, ELEMENT_FIRE),
    sidewaysValue: 1,
  },

  [CARD_ICE_BOLT]: {
    id: CARD_ICE_BOLT,
    name: "Ice Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_BLUE],
    categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
    // Basic: Gain a blue crystal to your Inventory
    // Powered: Ranged Ice Attack 3
    basicEffect: gainCrystal(MANA_BLUE),
    poweredEffect: rangedAttackWithElement(3, ELEMENT_ICE),
    sidewaysValue: 1,
  },

  [CARD_SWIFT_BOLT]: {
    id: CARD_SWIFT_BOLT,
    name: "Swift Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_WHITE],
    categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
    // Basic: Gain a white crystal to your Inventory
    // Powered: Ranged Attack 4
    basicEffect: gainCrystal(MANA_WHITE),
    poweredEffect: rangedAttack(4),
    sidewaysValue: 1,
  },

  [CARD_CRUSHING_BOLT]: {
    id: CARD_CRUSHING_BOLT,
    name: "Crushing Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_GREEN],
    categories: [CATEGORY_SPECIAL, CATEGORY_COMBAT],
    // Basic: Gain a green crystal to your Inventory
    // Powered: Siege Attack 3
    basicEffect: gainCrystal(MANA_GREEN),
    poweredEffect: siegeAttack(3),
    sidewaysValue: 1,
  },
} satisfies Partial<Record<AdvancedActionCardId, DeedCard>>;
