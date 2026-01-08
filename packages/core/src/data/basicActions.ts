/**
 * Basic action card definitions for Mage Knight
 *
 * Each hero starts with 16 cards: 14 shared basic actions + 2 hero-specific cards.
 * Cards are organized by their frame color (which indicates what mana powers them).
 *
 * Note: Some effects (like Concentration's card boost, Mana Draw's powered effect)
 * cannot be fully represented with the current effect system and use placeholders.
 */

import type { DeedCard, CardEffect } from "../types/cards.js";
import {
  CARD_CATEGORY_MOVEMENT,
  CARD_CATEGORY_COMBAT,
  CARD_CATEGORY_INFLUENCE,
  CARD_CATEGORY_HEALING,
  CARD_CATEGORY_SPECIAL,
} from "../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
  CARD_COLOR_WOUND,
} from "../types/effectTypes.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_WHITE,
} from "@mage-knight/shared";
import {
  ELEMENT_ICE,
  ELEMENT_FIRE,
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE,
} from "../types/modifierConstants.js";
import {
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_WOUND,
} from "../types/cards.js";
import {
  // Shared basic actions
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
  // Hero-specific cards
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_ARYTHEA_MANA_PULL,
  CARD_GOLDYX_CRYSTAL_JOY,
  CARD_GOLDYX_WILL_FOCUS,
  CARD_NOROWAS_NOBLE_MANNERS,
  CARD_NOROWAS_REJUVENATE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_TOVAK_INSTINCT,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_BRAEVALAR_DRUIDIC_PATHS,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
  // Wound
  CARD_WOUND,
  type BasicActionCardId,
} from "@mage-knight/shared";

// === Effect Helpers ===

function move(amount: number): CardEffect {
  return { type: EFFECT_GAIN_MOVE, amount };
}

function influence(amount: number): CardEffect {
  return { type: EFFECT_GAIN_INFLUENCE, amount };
}

function attack(
  amount: number,
  combatType: typeof COMBAT_TYPE_MELEE | typeof COMBAT_TYPE_RANGED | typeof COMBAT_TYPE_SIEGE = COMBAT_TYPE_MELEE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType };
}

function attackWithElement(
  amount: number,
  combatType: typeof COMBAT_TYPE_MELEE | typeof COMBAT_TYPE_RANGED | typeof COMBAT_TYPE_SIEGE,
  element: typeof ELEMENT_ICE | typeof ELEMENT_FIRE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType, element };
}

function block(amount: number): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount };
}

function blockWithElement(
  amount: number,
  element: typeof ELEMENT_ICE | typeof ELEMENT_FIRE
): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element };
}

function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

function drawCards(amount: number): CardEffect {
  return { type: EFFECT_DRAW_CARDS, amount };
}

function gainMana(color: typeof MANA_RED | typeof MANA_BLUE | typeof MANA_WHITE): CardEffect {
  return { type: EFFECT_GAIN_MANA, color };
}

function choice(...options: CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}

/**
 * Grant the player one additional mana die from source this turn.
 * Used by Mana Draw basic effect.
 */
function grantExtraSourceDie(): CardEffect {
  return {
    type: EFFECT_APPLY_MODIFIER,
    modifier: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_EXTRA_SOURCE_DIE,
    },
    duration: DURATION_TURN,
  };
}

// === Basic Action Card Definitions ===
// Organized by card frame color (the mana color that powers the card)

export const BASIC_ACTION_CARDS: { readonly [K in BasicActionCardId]: DeedCard } = {
  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED BASIC ACTIONS (12 unique cards, some ×2 = 14 cards in starting deck)
  // ═══════════════════════════════════════════════════════════════════════════

  // --- RED CARDS (powered by red mana) ---

  [CARD_RAGE]: {
    id: CARD_RAGE,
    name: "Rage",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Attack or Block 2 | Powered: Attack 4
    basicEffect: choice(attack(2), block(2)),
    poweredEffect: attack(4),
    sidewaysValue: 1,
  },

  [CARD_THREATEN]: {
    id: CARD_THREATEN,
    name: "Threaten",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_INFLUENCE],
    // Basic: Influence 2 | Powered: Influence 5, Reputation -1
    // Note: Reputation loss not modeled in effect system
    basicEffect: influence(2),
    poweredEffect: influence(5),
    sidewaysValue: 1,
  },

  [CARD_IMPROVISATION]: {
    id: CARD_IMPROVISATION,
    name: "Improvisation",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_COMBAT, CARD_CATEGORY_INFLUENCE],
    // Basic: Discard a card → Move 3, Influence 3, Attack 3, or Block 3
    // Powered: Discard a card → Move 5, Influence 5, Attack 5, or Block 5
    // Note: Discard cost not modeled
    basicEffect: choice(move(3), influence(3), attack(3), block(3)),
    poweredEffect: choice(move(5), influence(5), attack(5), block(5)),
    sidewaysValue: 1,
  },

  // --- BLUE CARDS (powered by blue mana) ---

  [CARD_DETERMINATION]: {
    id: CARD_DETERMINATION,
    name: "Determination",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_COMBAT],
    // Basic: Attack or Block 2 | Powered: Block 5
    basicEffect: choice(attack(2), block(2)),
    poweredEffect: block(5),
    sidewaysValue: 1,
  },

  [CARD_SWIFTNESS]: {
    id: CARD_SWIFTNESS,
    name: "Swiftness",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_COMBAT],
    // Basic: Move 2 | Powered: Ranged Attack 3
    basicEffect: move(2),
    poweredEffect: attack(3, COMBAT_TYPE_RANGED),
    sidewaysValue: 1,
  },

  [CARD_STAMINA]: {
    id: CARD_STAMINA,
    name: "Stamina",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2 | Powered: Move 4
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_CRYSTALLIZE]: {
    id: CARD_CRYSTALLIZE,
    name: "Crystallize",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Gain a crystal of any basic color
    // Powered: Pay mana of a basic color, gain crystal of that color
    // Note: Crystal/mana manipulation not modeled - placeholder
    basicEffect: drawCards(0), // Placeholder
    poweredEffect: drawCards(0), // Placeholder
    sidewaysValue: 1,
  },

  // --- GREEN CARDS (powered by green mana) ---

  [CARD_MARCH]: {
    id: CARD_MARCH,
    name: "March",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT],
    // Basic: Move 2 | Powered: Move 4
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_TRANQUILITY]: {
    id: CARD_TRANQUILITY,
    name: "Tranquility",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_HEALING],
    // Basic: Heal 1 or Draw a Card | Powered: Heal 2 or Draw 2 Cards
    basicEffect: choice(heal(1), drawCards(1)),
    poweredEffect: choice(heal(2), drawCards(2)),
    sidewaysValue: 1,
  },

  [CARD_CONCENTRATION]: {
    id: CARD_CONCENTRATION,
    name: "Concentration",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Gain a blue, white, or red mana token
    basicEffect: choice(gainMana(MANA_BLUE), gainMana(MANA_WHITE), gainMana(MANA_RED)),
    // Powered: Play with another Action card: get its stronger effect free;
    //          if Move/Influence/Block/Attack, get +2
    // TODO: Card boost mechanic requires new effect type
    poweredEffect: drawCards(0), // Placeholder for card boost
    sidewaysValue: 1,
  },

  // --- WHITE CARDS (powered by white mana) ---

  [CARD_PROMISE]: {
    id: CARD_PROMISE,
    name: "Promise",
    color: CARD_COLOR_WHITE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_INFLUENCE],
    // Basic: Influence 2 | Powered: Influence 4
    basicEffect: influence(2),
    poweredEffect: influence(4),
    sidewaysValue: 1,
  },

  [CARD_MANA_DRAW]: {
    id: CARD_MANA_DRAW,
    name: "Mana Draw",
    color: CARD_COLOR_WHITE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Basic: Use 1 additional mana die from Source this turn
    basicEffect: grantExtraSourceDie(),
    // Powered: Take die, set to any non-gold color, gain 2 mana tokens
    // TODO: Powered effect requires new effect type with player choice
    poweredEffect: drawCards(0), // Placeholder - needs EFFECT_MANA_DRAW_POWERED
    sidewaysValue: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WOUND CARD (not a real action card - clogs your hand)
  // ═══════════════════════════════════════════════════════════════════════════

  [CARD_WOUND]: {
    id: CARD_WOUND,
    name: "Wound",
    color: CARD_COLOR_WOUND,
    cardType: DEED_CARD_TYPE_WOUND,
    categories: [], // Wounds have no category symbols
    basicEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
    poweredEffect: { type: EFFECT_GAIN_MOVE, amount: 0 },
    sidewaysValue: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO-SPECIFIC BASIC ACTIONS (2 per hero, replaces specific shared cards)
  // ═══════════════════════════════════════════════════════════════════════════

  // --- ARYTHEA (Blood Cultist) ---

  [CARD_ARYTHEA_BATTLE_VERSATILITY]: {
    id: CARD_ARYTHEA_BATTLE_VERSATILITY,
    name: "Battle Versatility",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_COMBAT],
    // Replaces: Rage
    // Basic: Attack 2, Block 2, or Ranged Attack 1
    // Powered: Attack 4, Block 4, Fire Attack 3, Fire Block 3, Ranged Attack 3, or Siege Attack 2
    basicEffect: choice(attack(2), block(2), attack(1, COMBAT_TYPE_RANGED)),
    poweredEffect: choice(
      attack(4),
      block(4),
      attackWithElement(3, COMBAT_TYPE_MELEE, ELEMENT_FIRE),
      blockWithElement(3, ELEMENT_FIRE),
      attack(3, COMBAT_TYPE_RANGED),
      attack(2, COMBAT_TYPE_SIEGE)
    ),
    sidewaysValue: 1,
  },

  [CARD_ARYTHEA_MANA_PULL]: {
    id: CARD_ARYTHEA_MANA_PULL,
    name: "Mana Pull",
    color: CARD_COLOR_WHITE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Replaces: Mana Draw
    // Basic: Use 1 additional die from Source; if black, use as any color
    // Powered: Take 2 dice, set each to any non-gold color, gain 1 mana token of each
    // Note: Die manipulation not modeled - placeholder
    basicEffect: drawCards(0), // Placeholder
    poweredEffect: drawCards(0), // Placeholder
    sidewaysValue: 1,
  },

  // --- GOLDYX (Dragon Mage) ---

  [CARD_GOLDYX_CRYSTAL_JOY]: {
    id: CARD_GOLDYX_CRYSTAL_JOY,
    name: "Crystal Joy",
    color: CARD_COLOR_WHITE, // "Any basic" - using white as default
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Replaces: Crystallize
    // Basic: Pay mana, gain crystal. At end of turn, may discard non-Wound to return to hand
    // Powered: (same as basic)
    // Note: Crystal manipulation not modeled - placeholder
    basicEffect: drawCards(0), // Placeholder
    poweredEffect: drawCards(0), // Placeholder
    sidewaysValue: 1,
  },

  [CARD_GOLDYX_WILL_FOCUS]: {
    id: CARD_GOLDYX_WILL_FOCUS,
    name: "Will Focus",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_SPECIAL],
    // Replaces: Concentration
    // Basic: Gain blue, white, or red mana token, OR gain a green crystal
    // Powered: Play with another Action card: get stronger effect free; +3 to Move/Influence/Block/Attack
    // Note: Card boost mechanic not modeled - placeholder
    basicEffect: drawCards(0), // Placeholder for mana/crystal gain
    poweredEffect: drawCards(0), // Placeholder for +3 card boost
    sidewaysValue: 1,
  },

  // --- NOROWAS (Elf Lord) ---

  [CARD_NOROWAS_NOBLE_MANNERS]: {
    id: CARD_NOROWAS_NOBLE_MANNERS,
    name: "Noble Manners",
    color: CARD_COLOR_WHITE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_INFLUENCE],
    // Replaces: Promise
    // Basic: Influence 2. If used during interaction: Fame +1 at end of turn
    // Powered: Influence 4. If used during interaction: Fame +1 and Reputation +1
    // Note: Fame/Rep bonuses not modeled
    basicEffect: influence(2),
    poweredEffect: influence(4),
    sidewaysValue: 1,
  },

  [CARD_NOROWAS_REJUVENATE]: {
    id: CARD_NOROWAS_REJUVENATE,
    name: "Rejuvenate",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_HEALING],
    // Replaces: Tranquility
    // Basic: Heal 1, Draw a card, Gain green mana token, OR Ready a Level I or II Unit
    // Powered: Heal 2, Draw 2 cards, Gain green crystal, OR Ready a Level I, II, or III Unit
    // Note: Mana/unit ready not modeled - showing heal/draw options
    basicEffect: choice(heal(1), drawCards(1)),
    poweredEffect: choice(heal(2), drawCards(2)),
    sidewaysValue: 1,
  },

  // --- TOVAK (Wyrmstalker) ---

  [CARD_TOVAK_COLD_TOUGHNESS]: {
    id: CARD_TOVAK_COLD_TOUGHNESS,
    name: "Cold Toughness",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_COMBAT],
    // Replaces: Determination
    // Basic: Ice Attack 2 or Ice Block 3
    // Powered: Ice Block 5. +1 Ice Block per special ability, color of attack, and resistance
    // Note: Conditional bonus not modeled
    basicEffect: choice(attackWithElement(2, COMBAT_TYPE_MELEE, ELEMENT_ICE), blockWithElement(3, ELEMENT_ICE)),
    poweredEffect: blockWithElement(5, ELEMENT_ICE),
    sidewaysValue: 1,
  },

  [CARD_TOVAK_INSTINCT]: {
    id: CARD_TOVAK_INSTINCT,
    name: "Instinct",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_INFLUENCE, CARD_CATEGORY_COMBAT],
    // Replaces: Improvisation
    // Basic: Move 2, Influence 2, Attack 2, or Block 2 (no discard required!)
    // Powered: Move 4, Influence 4, Attack 4, or Block 4
    basicEffect: choice(move(2), influence(2), attack(2), block(2)),
    poweredEffect: choice(move(4), influence(4), attack(4), block(4)),
    sidewaysValue: 1,
  },

  // --- WOLFHAWK (Lost Legion) ---

  [CARD_WOLFHAWK_SWIFT_REFLEXES]: {
    id: CARD_WOLFHAWK_SWIFT_REFLEXES,
    name: "Swift Reflexes",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_COMBAT],
    // Replaces: Swiftness
    // Basic: Move 2, Ranged Attack 1, OR reduce one enemy attack by 1
    // Powered: Move 4, Ranged Attack 3, OR reduce one enemy attack by 2
    // Note: Attack reduction not modeled
    basicEffect: choice(move(2), attack(1, COMBAT_TYPE_RANGED)),
    poweredEffect: choice(move(4), attack(3, COMBAT_TYPE_RANGED)),
    sidewaysValue: 1,
  },

  [CARD_WOLFHAWK_TIRELESSNESS]: {
    id: CARD_WOLFHAWK_TIRELESSNESS,
    name: "Tirelessness",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT],
    // Replaces: Stamina
    // Basic: Move 2. Next card providing Move gives +1 extra Move
    // Powered: Move 4. Each other card providing Move gives +1 extra Move
    // Note: Move bonus modifier not modeled
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  // --- KRANG (Orc Shaman, Lost Legion) ---

  [CARD_KRANG_SAVAGE_HARVESTING]: {
    id: CARD_KRANG_SAVAGE_HARVESTING,
    name: "Savage Harvesting",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_SPECIAL],
    // Replaces: March
    // Basic: Move 2. Once when moving, may discard a card for crystal of same color
    // Powered: Move 4. Each time you move, may discard a card for crystal
    // Note: Crystal gain not modeled
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_KRANG_RUTHLESS_COERCION]: {
    id: CARD_KRANG_RUTHLESS_COERCION,
    name: "Ruthless Coercion",
    color: CARD_COLOR_RED,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_INFLUENCE],
    // Replaces: Threaten
    // Basic: Influence 2. May get -2 discount to recruit one Unit; if recruited, Reputation -1
    // Powered: Influence 6, Reputation -1. May ready Level I and II Units for 2 Influence/level
    // Note: Recruitment/ready mechanics not modeled
    basicEffect: influence(2),
    poweredEffect: influence(6),
    sidewaysValue: 1,
  },

  // --- BRAEVALAR (Druid, Shades of Tezla) ---

  [CARD_BRAEVALAR_DRUIDIC_PATHS]: {
    id: CARD_BRAEVALAR_DRUIDIC_PATHS,
    name: "Druidic Paths",
    color: CARD_COLOR_GREEN,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT],
    // Replaces: March
    // Basic: Move 2. Move cost of one space reduced by 1 (min 2)
    // Powered: Move 4. Move cost of one terrain type reduced by 1 (min 2)
    // Note: Terrain cost reduction not modeled in effect
    basicEffect: move(2),
    poweredEffect: move(4),
    sidewaysValue: 1,
  },

  [CARD_BRAEVALAR_ONE_WITH_THE_LAND]: {
    id: CARD_BRAEVALAR_ONE_WITH_THE_LAND,
    name: "One with the Land",
    color: CARD_COLOR_BLUE,
    cardType: DEED_CARD_TYPE_BASIC_ACTION,
    categories: [CARD_CATEGORY_MOVEMENT, CARD_CATEGORY_HEALING, CARD_CATEGORY_COMBAT],
    // Replaces: Stamina
    // Basic: Move 2, Heal 1, or Block 2
    // Powered: Move 4, Heal 2, OR Block equal to terrain Move cost (Fire day / Ice night)
    // Note: Terrain-based block not modeled
    basicEffect: choice(move(2), heal(1), block(2)),
    poweredEffect: choice(move(4), heal(2), block(4)), // Simplified
    sidewaysValue: 1,
  },
};

// === Helper to get a card by ID ===
export function getBasicActionCard(id: BasicActionCardId): DeedCard {
  const card = (BASIC_ACTION_CARDS as unknown as Record<string, DeedCard>)[id];
  if (!card) {
    throw new Error(`Unknown basic action card: ${String(id)}`);
  }
  return card;
}
