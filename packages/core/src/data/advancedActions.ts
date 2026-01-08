/**
 * Advanced action card definitions for Mage Knight
 *
 * Advanced actions are powerful cards acquired during the game from the
 * Advanced Actions offer. Each has a basic effect (top) and powered effect (bottom).
 */

import type { DeedCard, CardEffect } from "../types/cards.js";
import {
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_CRYSTAL,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
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
  type BasicManaColor,
} from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE } from "../types/modifierConstants.js";

// === Effect Helpers ===

function gainCrystal(color: BasicManaColor): CardEffect {
  return { type: EFFECT_GAIN_CRYSTAL, color };
}

function rangedAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED };
}

function rangedAttackWithElement(
  amount: number,
  element: typeof ELEMENT_FIRE | typeof ELEMENT_ICE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element };
}

function siegeAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE };
}

// === Advanced Action Card Definitions ===

export const ADVANCED_ACTION_CARDS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BOLT CARDS (gain crystal basic / ranged attack powered)
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_FIRE_BOLT]: {
    id: CARD_FIRE_BOLT,
    name: "Fire Bolt",
    cardType: DEED_CARD_TYPE_ADVANCED_ACTION,
    poweredBy: [MANA_RED],
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
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
    categories: [CARD_CATEGORY_SPECIAL, CARD_CATEGORY_COMBAT],
    // Basic: Gain a green crystal to your Inventory
    // Powered: Siege Attack 3
    basicEffect: gainCrystal(MANA_GREEN),
    poweredEffect: siegeAttack(3),
    sidewaysValue: 1,
  },
} satisfies Record<AdvancedActionCardId, DeedCard>;

// === Helper to get a card by ID ===
export function getAdvancedActionCard(id: AdvancedActionCardId): DeedCard {
  const card = ADVANCED_ACTION_CARDS[id];
  if (!card) {
    throw new Error(`Unknown advanced action card: ${String(id)}`);
  }
  return card;
}
