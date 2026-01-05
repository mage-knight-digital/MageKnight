/**
 * Effect resolver - applies card effects to game state
 *
 * Phase 1: Basic effects only (no mana powering)
 * - GainMove: add move points
 * - GainInfluence: add influence points
 * - GainAttack: accumulate attack value for combat
 * - GainBlock: accumulate block value for combat
 * - GainHealing: track healing (wounds not yet implemented)
 * - Compound: resolve all sub-effects
 * - Choice: requires player selection (Phase 2)
 */

import type { GameState } from "../../state/GameState.js";
import type { CardEffect, GainAttackEffect, GainBlockEffect, ScalableBaseEffect } from "../../types/cards.js";
import type { Player, AccumulatedAttack, ElementalAttackValues } from "../../types/player.js";
import type { CardId, Element } from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE } from "@mage-knight/shared";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { evaluateScalingFactor } from "./scalingEvaluator.js";
import { addModifier } from "../modifiers.js";
import { SOURCE_CARD, SCOPE_SELF } from "../modifierConstants.js";
import type { ApplyModifierEffect } from "../../types/cards.js";
import { evaluateCondition } from "./conditionEvaluator.js";

export interface EffectResolutionResult {
  readonly state: GameState;
  readonly description: string;
  readonly requiresChoice?: boolean;
  /** True if a conditional effect was resolved — affects undo (command should be non-reversible) */
  readonly containsConditional?: boolean;
  /** True if a scaling effect was resolved — affects undo (command should be non-reversible) */
  readonly containsScaling?: boolean;
}

export function resolveEffect(
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string
): EffectResolutionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return applyGainMove(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_INFLUENCE:
      return applyGainInfluence(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_ATTACK:
      return applyGainAttack(state, playerIndex, player, effect);

    case EFFECT_GAIN_BLOCK:
      return applyGainBlock(state, playerIndex, player, effect);

    case EFFECT_GAIN_HEALING:
      return applyGainHealing(state, playerIndex, player, effect.amount);

    case EFFECT_APPLY_MODIFIER:
      return applyModifierEffect(state, playerId, effect, sourceCardId);

    case EFFECT_COMPOUND:
      return resolveCompoundEffect(state, playerId, effect.effects, sourceCardId);

    case EFFECT_CHOICE:
      // Phase 1: Return that choice is required
      // Phase 2: Use choiceIndex from action to pick option
      return {
        state,
        description: "Choice required",
        requiresChoice: true,
      };

    case EFFECT_CONDITIONAL: {
      const conditionMet = evaluateCondition(state, playerId, effect.condition);

      const effectToApply = conditionMet ? effect.thenEffect : effect.elseEffect;

      if (!effectToApply) {
        // Condition not met and no else — no-op
        return {
          state,
          description: "Condition not met (no else branch)",
          containsConditional: true,
        };
      }

      const result = resolveEffect(state, playerId, effectToApply, sourceCardId);

      // Mark that a conditional was resolved — affects undo
      return {
        ...result,
        containsConditional: true,
      };
    }

    case EFFECT_SCALING: {
      const scalingCount = evaluateScalingFactor(state, playerId, effect.scalingFactor);
      const scalingBonus = scalingCount * effect.amountPerUnit;

      // Apply minimum/maximum
      let totalBonus = scalingBonus;
      if (effect.minimum !== undefined) {
        totalBonus = Math.max(effect.minimum, totalBonus);
      }
      if (effect.maximum !== undefined) {
        totalBonus = Math.min(effect.maximum, totalBonus);
      }

      // Create modified base effect with increased amount
      const scaledEffect: ScalableBaseEffect = {
        ...effect.baseEffect,
        amount: effect.baseEffect.amount + totalBonus,
      };

      // Resolve the scaled effect
      const result = resolveEffect(state, playerId, scaledEffect, sourceCardId);

      // Mark that a scaling effect was resolved — affects undo
      return {
        ...result,
        description: `${result.description} (scaled by ${scalingCount})`,
        containsScaling: true,
      };
    }

    default:
      // Unknown effect type — log and continue
      return {
        state,
        description: "Unhandled effect type",
      };
  }
}

function updatePlayer(
  state: GameState,
  playerIndex: number,
  updatedPlayer: Player
): GameState {
  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

function applyGainMove(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    movePoints: player.movePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Move`,
  };
}

function applyGainInfluence(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    influencePoints: player.influencePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Influence`,
  };
}

/**
 * Helper to update elemental values
 */
function updateElementalValue(
  values: ElementalAttackValues,
  element: Element | undefined,
  amount: number
): ElementalAttackValues {
  if (!element) {
    return { ...values, physical: values.physical + amount };
  }
  switch (element) {
    case ELEMENT_FIRE:
      return { ...values, fire: values.fire + amount };
    case ELEMENT_ICE:
      return { ...values, ice: values.ice + amount };
    case ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire + amount };
    default:
      return { ...values, physical: values.physical + amount };
  }
}

function applyGainAttack(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainAttackEffect
): EffectResolutionResult {
  const { amount, combatType, element } = effect;
  const currentAttack = player.combatAccumulator.attack;
  let updatedAttack: AccumulatedAttack;
  let attackTypeName: string;

  // If there's an element, track it in the elemental values
  // Otherwise, track in the main value
  switch (combatType) {
    case COMBAT_TYPE_RANGED:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          rangedElements: updateElementalValue(currentAttack.rangedElements, element, amount),
        };
        attackTypeName = `${element} Ranged Attack`;
      } else {
        updatedAttack = { ...currentAttack, ranged: currentAttack.ranged + amount };
        attackTypeName = "Ranged Attack";
      }
      break;
    case COMBAT_TYPE_SIEGE:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          siegeElements: updateElementalValue(currentAttack.siegeElements, element, amount),
        };
        attackTypeName = `${element} Siege Attack`;
      } else {
        updatedAttack = { ...currentAttack, siege: currentAttack.siege + amount };
        attackTypeName = "Siege Attack";
      }
      break;
    default:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          normalElements: updateElementalValue(currentAttack.normalElements, element, amount),
        };
        attackTypeName = `${element} Attack`;
      } else {
        updatedAttack = { ...currentAttack, normal: currentAttack.normal + amount };
        attackTypeName = "Attack";
      }
      break;
  }

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: updatedAttack,
    },
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} ${attackTypeName}`,
  };
}

function applyGainBlock(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainBlockEffect
): EffectResolutionResult {
  const { amount, element } = effect;
  let updatedPlayer: Player;
  let blockTypeName: string;

  if (element) {
    // Track elemental block
    updatedPlayer = {
      ...player,
      combatAccumulator: {
        ...player.combatAccumulator,
        blockElements: updateElementalValue(player.combatAccumulator.blockElements, element, amount),
      },
    };
    blockTypeName = `${element} Block`;
  } else {
    // Track physical block
    updatedPlayer = {
      ...player,
      combatAccumulator: {
        ...player.combatAccumulator,
        block: player.combatAccumulator.block + amount,
      },
    };
    blockTypeName = "Block";
  }

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} ${blockTypeName}`,
  };
}

function applyGainHealing(
  _state: GameState,
  _playerIndex: number,
  _player: Player,
  amount: number
): EffectResolutionResult {
  // Phase 1: Just track the healing value
  // Future: Actually heal wounds from hand/units
  return {
    state: _state,
    description: `Gained ${amount} Healing (wounds not yet implemented)`,
  };
}

function applyModifierEffect(
  state: GameState,
  playerId: string,
  effect: ApplyModifierEffect,
  sourceCardId?: string
): EffectResolutionResult {
  const newState = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "unknown") as CardId,
      playerId,
    },
    duration: effect.duration,
    scope: { type: SCOPE_SELF },
    effect: effect.modifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: newState,
    description: "Applied modifier",
  };
}

function resolveCompoundEffect(
  state: GameState,
  playerId: string,
  effects: readonly CardEffect[],
  sourceCardId?: string
): EffectResolutionResult {
  let currentState = state;
  const descriptions: string[] = [];

  for (const effect of effects) {
    const result = resolveEffect(currentState, playerId, effect, sourceCardId);
    if (result.requiresChoice) {
      return result; // Stop at first choice
    }
    currentState = result.state;
    descriptions.push(result.description);
  }

  return {
    state: currentState,
    description: descriptions.join(", "),
  };
}

// Reverse an effect (for undo)
export function reverseEffect(player: Player, effect: CardEffect): Player {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return { ...player, movePoints: player.movePoints - effect.amount };

    case EFFECT_GAIN_INFLUENCE:
      return {
        ...player,
        influencePoints: player.influencePoints - effect.amount,
      };

    case EFFECT_GAIN_ATTACK: {
      const attack = { ...player.combatAccumulator.attack };
      switch (effect.combatType) {
        case COMBAT_TYPE_RANGED:
          attack.ranged -= effect.amount;
          break;
        case COMBAT_TYPE_SIEGE:
          attack.siege -= effect.amount;
          break;
        default:
          attack.normal -= effect.amount;
      }
      return {
        ...player,
        combatAccumulator: { ...player.combatAccumulator, attack },
      };
    }

    case EFFECT_GAIN_BLOCK:
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block: player.combatAccumulator.block - effect.amount,
        },
      };

    case EFFECT_COMPOUND: {
      let result = player;
      for (const subEffect of effect.effects) {
        result = reverseEffect(result, subEffect);
      }
      return result;
    }

    case EFFECT_CONDITIONAL:
      // Cannot reliably reverse conditional effects — the condition may have
      // changed since the effect was applied, so we don't know which branch
      // was actually executed. Commands containing conditional effects should
      // be marked as non-reversible (isReversible: false).
      return player;

    case EFFECT_SCALING:
      // Cannot reliably reverse scaling effects — the scaling count may have
      // changed since the effect was applied (enemies defeated, wounds played).
      // Commands containing scaling effects should be marked as non-reversible.
      return player;

    default:
      return player;
  }
}
