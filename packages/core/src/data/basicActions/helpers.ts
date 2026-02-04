/** Effect helper functions for basic action card definitions */
import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_MOVE, EFFECT_GAIN_INFLUENCE, EFFECT_GAIN_ATTACK, EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING, EFFECT_GAIN_MANA, EFFECT_DRAW_CARDS, EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE, EFFECT_COMPOUND, EFFECT_CHANGE_REPUTATION, EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL, EFFECT_CARD_BOOST, EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED, EFFECT_TERRAIN_BASED_BLOCK, EFFECT_DISCARD_COST,
  EFFECT_NOOP,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  COMBAT_TYPE_MELEE, COMBAT_TYPE_RANGED, COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import type { BasicCardColor } from "../../types/effectTypes.js";
import { MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE, type BasicManaColor, type CardId, type Element as SharedElement } from "@mage-knight/shared";
import {
  ELEMENT_ICE, ELEMENT_FIRE, DURATION_TURN, EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE, RULE_BLACK_AS_ANY_COLOR,
} from "../../types/modifierConstants.js";

type CombatType = typeof COMBAT_TYPE_MELEE | typeof COMBAT_TYPE_RANGED | typeof COMBAT_TYPE_SIEGE;
type Element = typeof ELEMENT_ICE | typeof ELEMENT_FIRE;
type ManaColorType = typeof MANA_RED | typeof MANA_BLUE | typeof MANA_GREEN | typeof MANA_WHITE;

export function move(amount: number): CardEffect {
  return { type: EFFECT_GAIN_MOVE, amount };
}

export function influence(amount: number): CardEffect {
  return { type: EFFECT_GAIN_INFLUENCE, amount };
}

export function attack(amount: number, combatType: CombatType = COMBAT_TYPE_MELEE): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType };
}

export function attackWithElement(amount: number, combatType: CombatType, element: Element): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType, element };
}

export function block(amount: number): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount };
}

export function blockWithElement(amount: number, element: Element): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element };
}

export function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

export function drawCards(amount: number): CardEffect {
  return { type: EFFECT_DRAW_CARDS, amount };
}

export function gainMana(color: ManaColorType): CardEffect {
  return { type: EFFECT_GAIN_MANA, color };
}

/** Ready a wounded unit of a given max level */
export function readyUnit(maxLevel: 1 | 2 | 3 | 4): CardEffect {
  return { type: EFFECT_READY_UNIT, maxLevel };
}

export function choice(...options: CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}

export function compound(...effects: CardEffect[]): CardEffect {
  return { type: EFFECT_COMPOUND, effects };
}

/**
 * Track a specific attack and grant fame if it defeats at least one enemy.
 */
export function trackAttackDefeatFame(
  amount: number,
  combatType: CombatType,
  fame: number,
  element?: SharedElement,
  sourceCardId?: CardId
): CardEffect {
  return {
    type: EFFECT_TRACK_ATTACK_DEFEAT_FAME,
    amount,
    combatType,
    fame,
    ...(typeof element === "undefined" ? {} : { element }),
    ...(typeof sourceCardId === "undefined" ? {} : { sourceCardId }),
  };
}

export function changeReputation(amount: number): CardEffect {
  return { type: EFFECT_CHANGE_REPUTATION, amount };
}

export function gainCrystal(color: BasicManaColor): CardEffect {
  return { type: EFFECT_GAIN_CRYSTAL, color };
}

/** Convert a mana token to a crystal of the same color */
export function convertManaToCrystal(): CardEffect {
  return { type: EFFECT_CONVERT_MANA_TO_CRYSTAL };
}

/** Card boost effect - play another Action card with free powered effect + bonus */
export function cardBoost(bonus: number): CardEffect {
  return { type: EFFECT_CARD_BOOST, bonus };
}

/** Mana Draw powered effect - take 1 die, set its color, gain 2 mana tokens */
export function manaDrawPowered(): CardEffect {
  return { type: EFFECT_MANA_DRAW_POWERED, diceCount: 1, tokensPerDie: 2 };
}

/** Mana Pull powered effect - take 2 dice, set their colors, gain 1 mana token each */
export function manaPullPowered(): CardEffect {
  return { type: EFFECT_MANA_DRAW_POWERED, diceCount: 2, tokensPerDie: 1 };
}

/** Grant the player one additional mana die from source this turn */
export function grantExtraSourceDie(): CardEffect {
  return {
    type: EFFECT_APPLY_MODIFIER,
    modifier: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE },
    duration: DURATION_TURN,
    description: "Use 1 extra mana die from Source this turn",
  };
}

/** Grant extra source die AND allow black dice to be used as any basic color */
export function grantExtraSourceDieWithBlackAsAnyColor(): CardEffect {
  return {
    type: EFFECT_COMPOUND,
    effects: [
      grantExtraSourceDie(),
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: { type: EFFECT_RULE_OVERRIDE, rule: RULE_BLACK_AS_ANY_COLOR },
        duration: DURATION_TURN,
        description: "Use black dice as any basic color this turn",
      },
    ],
  };
}

/**
 * Terrain-based block effect.
 * Block value equals the unmodified movement cost of the hex the player is on.
 * Element: Fire during day, Ice at night or in dungeon/tomb (per FAQ S1).
 * Used by Braevalar's "One with the Land" card.
 */
export function terrainBasedBlock(): CardEffect {
  return { type: EFFECT_TERRAIN_BASED_BLOCK };
}

/**
 * Discard as cost effect.
 * Requires discarding card(s) from hand before resolving the thenEffect.
 * Used by Improvisation, which requires discarding a card to gain Move/Attack/etc.
 *
 * @param count - Number of cards to discard (usually 1)
 * @param thenEffect - Effect to resolve after discarding
 * @param optional - If true, player can skip discarding (and skip the effect)
 * @param filterWounds - If true (default), wounds cannot be discarded
 */
export function discardCost(
  count: number,
  thenEffect: CardEffect,
  optional: boolean = false,
  filterWounds: boolean = true
): CardEffect {
  return {
    type: EFFECT_DISCARD_COST,
    count,
    optional,
    thenEffect,
    filterWounds,
  };
}

/**
 * Discard as cost with color-dependent follow-up effect.
 * The discarded card's color determines which effect resolves.
 */
export function discardCostByColor(
  count: number,
  thenEffectByColor: Record<BasicCardColor, CardEffect>,
  optional: boolean = false,
  filterWounds: boolean = true
): CardEffect {
  return {
    type: EFFECT_DISCARD_COST,
    count,
    optional,
    thenEffect: { type: EFFECT_NOOP },
    colorMatters: true,
    thenEffectByColor,
    filterWounds,
  };
}
