/**
 * Shapeshift skill effect handler (Braevalar)
 *
 * Once per turn: One Basic Action card that gives a fixed amount of Move,
 * Attack, or Block instead gives the same amount in one of the other two.
 * Elemental types are preserved on Attacks and Blocks.
 *
 * Key rules:
 * - Only works with Basic Action cards (the 16 starting cards)
 * - Only works with "fixed amount" effects (not Concentration bonus, not variable amounts)
 * - Elemental types preserved: Ice Block 3 → Ice Attack 3
 * - Move has no element: Move 3 → Physical Attack 3 or Physical Block 3
 * - Ice Attack 3 → Move 3 (element lost when converting to move)
 * - One with the Land terrain-based block IS eligible (FAQ S3)
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect, DeedCard } from "../../../types/cards.js";
import type { ShapeshiftTargetType } from "../../../types/modifiers.js";
import type { CardId, Element } from "@mage-knight/shared";
import type { CombatType } from "../../../types/effectTypes.js";
import { SKILL_BRAEVALAR_SHAPESHIFT } from "../../../data/skills/index.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { getBasicActionCard } from "../../../data/basicActions/index.js";
import { DEED_CARD_TYPE_BASIC_ACTION } from "../../../types/cards.js";
import { getCard } from "../../validActions/cards/index.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_CHOICE,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_SHAPESHIFT_RESOLVE,
  COMBAT_TYPE_MELEE,
} from "../../../types/effectTypes.js";
import {
  SHAPESHIFT_TARGET_MOVE,
  SHAPESHIFT_TARGET_ATTACK,
  SHAPESHIFT_TARGET_BLOCK,
} from "../../../types/modifierConstants.js";

/**
 * Describes a single shapeshiftable effect found in a card.
 */
interface ShapeshiftableEffect {
  readonly cardId: CardId;
  readonly cardName: string;
  readonly effectType: "move" | "attack" | "block";
  readonly amount: number;
  readonly element?: Element;
  readonly combatType?: CombatType;
  /** Index within a choice effect's options, if the effect is inside a choice */
  readonly choiceIndex?: number;
  /** Whether this is the terrain-based block from One with the Land */
  readonly isTerrainBased?: boolean;
}

/**
 * Describes a transformation option presented to the player.
 */
interface ShapeshiftOption {
  readonly source: ShapeshiftableEffect;
  readonly targetType: ShapeshiftTargetType;
  readonly description: string;
}

/**
 * Check if an effect is a "fixed amount" Move/Attack/Block effect.
 * Per FAQ S2, "fixed" means a static number — not Concentration bonus.
 * Per FAQ S3, terrain-based block from One with the Land IS eligible.
 */
function getShapeshiftableEffects(
  cardId: CardId,
  cardName: string,
  effect: CardEffect,
  isPowered: boolean,
): ShapeshiftableEffect[] {
  const results: ShapeshiftableEffect[] = [];

  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      results.push({
        cardId,
        cardName,
        effectType: "move",
        amount: effect.amount,
      });
      break;

    case EFFECT_GAIN_ATTACK:
      results.push({
        cardId,
        cardName,
        effectType: "attack",
        amount: effect.amount,
        element: effect.element,
        combatType: effect.combatType,
      });
      break;

    case EFFECT_GAIN_BLOCK:
      results.push({
        cardId,
        cardName,
        effectType: "block",
        amount: effect.amount,
        element: effect.element,
      });
      break;

    case EFFECT_TERRAIN_BASED_BLOCK:
      // FAQ S3: One with the Land's terrain-based block IS eligible
      // We use a placeholder amount; actual amount depends on terrain at play time
      results.push({
        cardId,
        cardName,
        effectType: "block",
        amount: 0, // Will be resolved at play time
        isTerrainBased: true,
      });
      break;

    case EFFECT_CHOICE: {
      // For choice effects (e.g., Rage: Attack 2 OR Block 2),
      // each option is independently shapeshiftable
      for (let i = 0; i < effect.options.length; i++) {
        const option = effect.options[i]!;
        const subEffects = getShapeshiftableEffects(cardId, cardName, option, isPowered);
        for (const sub of subEffects) {
          results.push({ ...sub, choiceIndex: i });
        }
      }
      break;
    }
  }

  return results;
}

/**
 * Build all valid transformation options for a card effect.
 */
function buildOptionsForEffect(source: ShapeshiftableEffect): ShapeshiftOption[] {
  const options: ShapeshiftOption[] = [];
  const { effectType, amount, element, cardName } = source;

  // Determine display amount (terrain-based block shows as "terrain-based")
  const amountStr = source.isTerrainBased ? "terrain-based" : String(amount);
  const elementStr = element ? ` ${element}` : "";

  if (effectType === "move") {
    // Move → Attack (physical, melee)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_ATTACK,
      description: `${cardName}: Move ${amountStr} → Attack ${amountStr}`,
    });
    // Move → Block (physical)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_BLOCK,
      description: `${cardName}: Move ${amountStr} → Block ${amountStr}`,
    });
  } else if (effectType === "attack") {
    // Attack → Move (element lost)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_MOVE,
      description: `${cardName}:${elementStr} Attack ${amountStr} → Move ${amountStr}`,
    });
    // Attack → Block (element preserved)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_BLOCK,
      description: `${cardName}:${elementStr} Attack ${amountStr} →${elementStr} Block ${amountStr}`,
    });
  } else if (effectType === "block") {
    // Block → Move (element lost)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_MOVE,
      description: `${cardName}:${elementStr} Block ${amountStr} → Move ${amountStr}`,
    });
    // Block → Attack (element preserved)
    options.push({
      source,
      targetType: SHAPESHIFT_TARGET_ATTACK,
      description: `${cardName}:${elementStr} Block ${amountStr} →${elementStr} Attack ${amountStr}`,
    });
  }

  return options;
}

/**
 * Build ShapeshiftResolveEffect options from the transformation options.
 */
function buildChoiceEffects(options: ShapeshiftOption[]): CardEffect[] {
  return options.map((opt) => {
    const base: Record<string, unknown> = {
      type: EFFECT_SHAPESHIFT_RESOLVE,
      targetCardId: opt.source.cardId,
      targetType: opt.targetType,
      description: opt.description,
    };

    if (opt.source.choiceIndex !== undefined) {
      base.choiceIndex = opt.source.choiceIndex;
    }

    if (opt.targetType === SHAPESHIFT_TARGET_ATTACK) {
      base.combatType = opt.source.combatType ?? COMBAT_TYPE_MELEE;
    }

    // Preserve element when converting between attack and block
    if (opt.source.element) {
      if (opt.targetType !== SHAPESHIFT_TARGET_MOVE) {
        base.element = opt.source.element;
      }
    }

    return base as CardEffect;
  });
}

/**
 * Get all eligible Basic Action cards from the player's hand.
 */
function getEligibleCards(player: Player): DeedCard[] {
  const cards: DeedCard[] = [];

  for (const cardId of player.hand) {
    // Try basic action lookup first, then general card lookup
    let card: DeedCard | undefined;
    try {
      card = getBasicActionCard(cardId as import("@mage-knight/shared").BasicActionCardId);
    } catch {
      card = getCard(cardId);
    }

    if (card && card.cardType === DEED_CARD_TYPE_BASIC_ACTION) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Apply the Shapeshift skill effect.
 *
 * Scans the player's hand for eligible Basic Action cards,
 * identifies all valid transformations, and creates a pending choice.
 */
export function applyShapeshiftEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  const eligibleCards = getEligibleCards(player);
  const allOptions: ShapeshiftOption[] = [];
  const inCombat = state.combat !== null;

  for (const card of eligibleCards) {
    // Check both basic and powered effects for shapeshiftable effects
    const basicEffects = getShapeshiftableEffects(card.id, card.name, card.basicEffect, false);
    const poweredEffects = getShapeshiftableEffects(card.id, card.name, card.poweredEffect, true);

    // Combine: use basic effects plus powered effects (powered adds "powered:" prefix)
    for (const effect of basicEffects) {
      const options = buildOptionsForEffect(effect);
      // Filter: Attack/Block conversions only valid in combat
      for (const opt of options) {
        if (!inCombat && (opt.targetType === SHAPESHIFT_TARGET_ATTACK || opt.targetType === SHAPESHIFT_TARGET_BLOCK)) {
          // Attack and block only usable in combat - but the card might be played
          // during combat later. We allow all options since the card will be played later.
        }
        allOptions.push(opt);
      }
    }

    // Powered effects: prefix description to distinguish
    for (const effect of poweredEffects) {
      // Skip if same as basic effect (dedup)
      const basicMatch = basicEffects.some(
        (b) => b.effectType === effect.effectType && b.amount === effect.amount && b.element === effect.element
      );
      if (!basicMatch) {
        const options = buildOptionsForEffect({
          ...effect,
          cardName: `${card.name} (powered)`,
        });
        allOptions.push(...options);
      }
    }
  }

  if (allOptions.length === 0) {
    return state;
  }

  const choiceOptions = buildChoiceEffects(allOptions);

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_BRAEVALAR_SHAPESHIFT,
      unitInstanceId: null,
      options: choiceOptions,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove Shapeshift effect for undo.
 *
 * Clears the pending choice if it's from Shapeshift, and removes
 * any active Shapeshift modifiers.
 */
export function removeShapeshiftEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if it's from Shapeshift
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_BRAEVALAR_SHAPESHIFT
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  // Remove any active Shapeshift modifiers
  const updatedModifiers = state.activeModifiers.filter(
    (m) => m.effect.type !== "shapeshift_active" || m.createdByPlayerId !== playerId
  );

  return { ...state, players, activeModifiers: updatedModifiers };
}

/**
 * Check if Shapeshift skill can be activated.
 * Used by validActions to determine if the skill should be shown.
 */
export function canActivateShapeshift(
  _state: GameState,
  player: Player
): boolean {
  const eligibleCards = getEligibleCards(player);

  // Check if any eligible card has a shapeshiftable effect
  for (const card of eligibleCards) {
    const basicEffects = getShapeshiftableEffects(card.id, card.name, card.basicEffect, false);
    const poweredEffects = getShapeshiftableEffects(card.id, card.name, card.poweredEffect, true);
    if (basicEffects.length > 0 || poweredEffects.length > 0) {
      return true;
    }
  }

  return false;
}
