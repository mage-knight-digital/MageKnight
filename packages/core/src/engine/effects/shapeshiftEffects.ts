/**
 * Shapeshift effect resolver
 *
 * Handles EFFECT_SHAPESHIFT_RESOLVE: applies a modifier that transforms
 * a specific card's effect when it is played.
 */

import { registerEffect } from "./effectRegistry.js";
import { EFFECT_SHAPESHIFT_RESOLVE } from "../../types/effectTypes.js";
import { EFFECT_SHAPESHIFT_ACTIVE, SCOPE_SELF, DURATION_TURN, SOURCE_SKILL } from "../../types/modifierConstants.js";
import { addModifier } from "../modifiers/lifecycle.js";
import { getPlayerIndexByIdOrThrow } from "../helpers/playerHelpers.js";
import { SKILL_BRAEVALAR_SHAPESHIFT } from "../../data/skills/index.js";
import type { GameState } from "../../state/GameState.js";
import type { CardEffect, ShapeshiftResolveEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./index.js";
import type { ShapeshiftActiveModifier } from "../../types/modifiers.js";

function resolveShapeshift(
  state: GameState,
  playerId: string,
  effect: CardEffect,
): EffectResolutionResult {
  const shapeshiftEffect = effect as ShapeshiftResolveEffect;

  // Build the modifier
  const modifierEffect: ShapeshiftActiveModifier = {
    type: EFFECT_SHAPESHIFT_ACTIVE,
    targetCardId: shapeshiftEffect.targetCardId,
    targetType: shapeshiftEffect.targetType,
    ...(shapeshiftEffect.choiceIndex !== undefined ? { choiceIndex: shapeshiftEffect.choiceIndex } : {}),
    ...(shapeshiftEffect.combatType !== undefined ? { combatType: shapeshiftEffect.combatType } : {}),
    ...(shapeshiftEffect.element !== undefined ? { element: shapeshiftEffect.element } : {}),
  };

  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);

  // Add the modifier to game state
  const updatedState = addModifier(state, {
    source: { type: SOURCE_SKILL, skillId: SKILL_BRAEVALAR_SHAPESHIFT, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: modifierEffect,
    createdByPlayerId: playerId,
    createdAtRound: state.round,
  });

  // Clear pending choice
  const player = updatedState.players[playerIndex];
  if (player?.pendingChoice?.skillId === SKILL_BRAEVALAR_SHAPESHIFT) {
    const updatedPlayer = { ...player, pendingChoice: null };
    const players = [...updatedState.players];
    players[playerIndex] = updatedPlayer;
    return {
      state: { ...updatedState, players },
      description: shapeshiftEffect.description,
    };
  }

  return {
    state: updatedState,
    description: shapeshiftEffect.description,
  };
}

export function registerShapeshiftEffects(): void {
  registerEffect(EFFECT_SHAPESHIFT_RESOLVE, resolveShapeshift);
}
