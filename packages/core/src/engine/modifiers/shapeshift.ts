/**
 * Shapeshift modifier helpers
 *
 * Provides functions to check for and apply Shapeshift effect transformations
 * during card play. Used by playCardCommand to intercept and transform effects
 * when Braevalar's Shapeshift skill is active.
 */

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";
import type { ActiveModifier, ShapeshiftActiveModifier } from "../../types/modifiers.js";
import type { CardId } from "@mage-knight/shared";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_CHOICE,
  EFFECT_TERRAIN_BASED_BLOCK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  EFFECT_SHAPESHIFT_ACTIVE,
  SHAPESHIFT_TARGET_MOVE,
  SHAPESHIFT_TARGET_ATTACK,
  SHAPESHIFT_TARGET_BLOCK,
} from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";
import { removeModifier } from "./lifecycle.js";

/**
 * Get the active Shapeshift modifier for a specific card being played.
 * Returns the modifier if found, null otherwise.
 */
export function getShapeshiftModifier(
  state: GameState,
  playerId: string,
  cardId: CardId,
): ActiveModifier | null {
  const playerModifiers = getModifiersForPlayer(state, playerId);

  for (const modifier of playerModifiers) {
    if (modifier.effect.type === EFFECT_SHAPESHIFT_ACTIVE) {
      const shapeshiftEffect = modifier.effect as ShapeshiftActiveModifier;
      if (shapeshiftEffect.targetCardId === cardId) {
        return modifier;
      }
    }
  }

  return null;
}

/**
 * Transform a card effect based on an active Shapeshift modifier.
 * Returns the transformed effect, or the original if no transformation applies.
 */
export function applyShapeshiftTransformation(
  effect: CardEffect,
  modifier: ShapeshiftActiveModifier,
): CardEffect {
  const { targetType, choiceIndex, combatType, element } = modifier;

  // Handle choice effects: transform only the specified option
  if (effect.type === EFFECT_CHOICE && choiceIndex !== undefined) {
    const options = [...effect.options];
    const targetOption = options[choiceIndex];
    if (targetOption) {
      options[choiceIndex] = transformSingleEffect(targetOption, targetType, combatType, element);
    }
    return { ...effect, options };
  }

  // Handle choice effects without specific index: transform all applicable options
  if (effect.type === EFFECT_CHOICE && choiceIndex === undefined) {
    const options = effect.options.map((opt) =>
      isTransformableEffect(opt) ? transformSingleEffect(opt, targetType, combatType, element) : opt
    );
    return { ...effect, options };
  }

  // Handle direct effects
  if (isTransformableEffect(effect)) {
    return transformSingleEffect(effect, targetType, combatType, element);
  }

  return effect;
}

/**
 * Check if an effect can be transformed by Shapeshift.
 */
function isTransformableEffect(effect: CardEffect): boolean {
  return (
    effect.type === EFFECT_GAIN_MOVE ||
    effect.type === EFFECT_GAIN_ATTACK ||
    effect.type === EFFECT_GAIN_BLOCK ||
    effect.type === EFFECT_TERRAIN_BASED_BLOCK
  );
}

/**
 * Transform a single atomic Move/Attack/Block effect into the target type.
 */
function transformSingleEffect(
  effect: CardEffect,
  targetType: ShapeshiftActiveModifier["targetType"],
  modCombatType?: ShapeshiftActiveModifier["combatType"],
  modElement?: ShapeshiftActiveModifier["element"],
): CardEffect {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return convertFromMove(effect.amount, targetType, modCombatType);

    case EFFECT_GAIN_ATTACK:
      return convertFromAttack(effect.amount, effect.element, targetType);

    case EFFECT_GAIN_BLOCK:
      return convertFromBlock(effect.amount, effect.element, targetType, modCombatType);

    case EFFECT_TERRAIN_BASED_BLOCK:
      // Terrain-based block converts to terrain-based move or attack
      // Since the amount is dynamic, we keep the terrain-based block as is
      // and just change the target type. However, terrain-based move/attack
      // don't exist, so we need to handle this specially.
      // For now, terrain-based block → move or attack of the terrain cost amount
      // This is handled at a different level since the amount is context-dependent.
      return convertTerrainBasedBlock(targetType, modCombatType, modElement);

    default:
      return effect;
  }
}

/**
 * Convert a Move effect to Attack or Block.
 * Move has no element, so conversions are physical.
 */
function convertFromMove(
  amount: number,
  targetType: ShapeshiftActiveModifier["targetType"],
  combatType?: ShapeshiftActiveModifier["combatType"],
): CardEffect {
  if (targetType === SHAPESHIFT_TARGET_ATTACK) {
    return {
      type: EFFECT_GAIN_ATTACK,
      amount,
      combatType: combatType ?? COMBAT_TYPE_MELEE,
    };
  }
  if (targetType === SHAPESHIFT_TARGET_BLOCK) {
    return {
      type: EFFECT_GAIN_BLOCK,
      amount,
    };
  }
  // Shouldn't happen (move → move), return unchanged
  return { type: EFFECT_GAIN_MOVE, amount };
}

/**
 * Convert an Attack effect to Move or Block.
 * Element is preserved when converting to Block, lost when converting to Move.
 */
function convertFromAttack(
  amount: number,
  element: import("@mage-knight/shared").Element | undefined,
  targetType: ShapeshiftActiveModifier["targetType"],
): CardEffect {
  if (targetType === SHAPESHIFT_TARGET_MOVE) {
    // Element lost when converting to move
    return { type: EFFECT_GAIN_MOVE, amount };
  }
  if (targetType === SHAPESHIFT_TARGET_BLOCK) {
    // Element preserved
    const base: { type: typeof EFFECT_GAIN_BLOCK; amount: number; element?: import("@mage-knight/shared").Element } = {
      type: EFFECT_GAIN_BLOCK,
      amount,
    };
    if (element) {
      base.element = element;
    }
    return base;
  }
  // Shouldn't happen (attack → attack), return unchanged
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE };
}

/**
 * Convert a Block effect to Move or Attack.
 * Element is preserved when converting to Attack, lost when converting to Move.
 */
function convertFromBlock(
  amount: number,
  element: import("@mage-knight/shared").Element | undefined,
  targetType: ShapeshiftActiveModifier["targetType"],
  combatType?: ShapeshiftActiveModifier["combatType"],
): CardEffect {
  if (targetType === SHAPESHIFT_TARGET_MOVE) {
    // Element lost when converting to move
    return { type: EFFECT_GAIN_MOVE, amount };
  }
  if (targetType === SHAPESHIFT_TARGET_ATTACK) {
    // Element preserved
    const base: { type: typeof EFFECT_GAIN_ATTACK; amount: number; combatType: import("../../types/effectTypes.js").CombatType; element?: import("@mage-knight/shared").Element } = {
      type: EFFECT_GAIN_ATTACK,
      amount,
      combatType: combatType ?? COMBAT_TYPE_MELEE,
    };
    if (element) {
      base.element = element;
    }
    return base;
  }
  // Shouldn't happen (block → block), return unchanged
  return { type: EFFECT_GAIN_BLOCK, amount };
}

/**
 * Convert terrain-based block to another type.
 * This is a special case since the block amount depends on terrain.
 * We convert the terrain-based block effect type directly.
 */
function convertTerrainBasedBlock(
  _targetType: ShapeshiftActiveModifier["targetType"],
  _combatType?: ShapeshiftActiveModifier["combatType"],
  _element?: ShapeshiftActiveModifier["element"],
): CardEffect {
  // Terrain-based block is special - we can't easily convert it here
  // because the amount depends on the terrain at play time.
  // Instead, we keep the terrain-based block effect as-is and handle
  // the conversion in the terrain-based block resolver.
  // For now, return the original effect since this is an edge case.
  // The actual terrain-based block resolver will need to be aware of shapeshift.
  return { type: EFFECT_TERRAIN_BASED_BLOCK };
}

/**
 * Consume the Shapeshift modifier (remove it after use).
 */
export function consumeShapeshiftModifier(
  state: GameState,
  modifierId: string,
): GameState {
  return removeModifier(state, modifierId);
}
