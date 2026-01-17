/**
 * Effect Resolution Module
 *
 * This module provides the complete effect resolution system for the
 * Mage Knight game engine. Effects are the primary mechanism for
 * applying card abilities to game state.
 *
 * ## Architecture
 *
 * Effects are organized into category-based modules for better discoverability
 * and maintainability. Each module contains resolver functions for related
 * effect types:
 *
 * | Module | Effects |
 * |--------|---------|
 * | `atomicEffects.ts` | GainMove, GainInfluence, GainAttack, GainBlock, GainHealing, etc. |
 * | `compound.ts` | Compound, Conditional, Scaling |
 * | `choice.ts` | Choice |
 * | `crystallize.ts` | ConvertManaToCrystal, CrystallizeColor |
 * | `cardBoostResolvers.ts` | CardBoost, ResolveBoostTarget |
 * | `combatEffects.ts` | SelectCombatEnemy, ResolveCombatEnemyTarget |
 * | `manaDrawEffects.ts` | ManaDrawPowered, ManaDrawPickDie, ManaDrawSetColor |
 * | `unitEffects.ts` | ReadyUnit |
 * | `reverse.ts` | reverseEffect (for undo) |
 * | `resolvability.ts` | isEffectResolvable |
 *
 * ## Main Entry Point
 *
 * The `resolveEffect` function is the main dispatcher that routes each
 * effect type to its appropriate handler. It handles the full CardEffect
 * discriminated union.
 *
 * ## Usage Examples
 *
 * ### Resolving an Effect
 * ```typescript
 * import { resolveEffect } from './effects';
 *
 * const result = resolveEffect(state, playerId, effect, sourceCardId);
 * if (result.requiresChoice) {
 *   // Store pending choice, wait for player selection
 * } else {
 *   // Use result.state as the new game state
 * }
 * ```
 *
 * ### Checking Resolvability
 * ```typescript
 * import { isEffectResolvable } from './effects';
 *
 * const validOptions = effect.options.filter(opt =>
 *   isEffectResolvable(state, playerId, opt)
 * );
 * ```
 *
 * ### Reversing for Undo
 * ```typescript
 * import { reverseEffect } from './effects';
 *
 * const restoredPlayer = reverseEffect(player, effect);
 * ```
 *
 * @module effects
 */

// ============================================================================
// RE-EXPORT ALL MODULES
// ============================================================================

// Types
export * from "./types.js";

// Resolvability checks
export * from "./resolvability.js";

// Atomic effects (gain move, attack, etc.)
export {
  updatePlayer,
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainAttack,
  applyGainBlock,
  applyGainHealing,
  applyDrawCards,
  applyChangeReputation,
  applyGainCrystal,
  applyTakeWound,
  applyModifierEffect,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "./atomicEffects.js";

// Compound effect resolution
export {
  resolveCompoundEffect,
  resolveCompoundEffectList,
  resolveConditionalEffect,
  resolveScalingEffect,
  type EffectResolver,
} from "./compound.js";

// Choice effect resolution
export { resolveChoiceEffect } from "./choice.js";

// Crystallize effects
export {
  resolveConvertManaToCrystal,
  resolveCrystallizeColor,
} from "./crystallize.js";

// Card boost effects
export {
  resolveCardBoostEffect,
  resolveBoostTargetEffect,
} from "./cardBoostResolvers.js";
export { addBonusToEffect } from "./cardBoostEffects.js";

// Combat enemy targeting effects
export {
  resolveSelectCombatEnemy,
  resolveCombatEnemyTarget,
} from "./combatEffects.js";

// Mana draw effects
export {
  handleManaDrawPowered,
  handleManaDrawPickDie,
  applyManaDrawSetColor,
} from "./manaDrawEffects.js";

// Unit effects
export {
  handleReadyUnit,
  getSpentUnitsAtOrBelowLevel,
} from "./unitEffects.js";

// Effect reversal (for undo)
export { reverseEffect } from "./reverse.js";

// Effect description
export { describeEffect } from "./describeEffect.js";

// ============================================================================
// IMPORTS FOR MAIN RESOLVER
// ============================================================================

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_TAKE_WOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  MANA_ANY,
} from "../../types/effectTypes.js";

// Atomic effects
import {
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainAttack,
  applyGainBlock,
  applyGainHealing,
  applyDrawCards,
  applyChangeReputation,
  applyGainCrystal,
  applyTakeWound,
  applyModifierEffect,
} from "./atomicEffects.js";

// Compound effects
import {
  resolveCompoundEffectList,
  resolveConditionalEffect,
  resolveScalingEffect,
} from "./compound.js";

// Choice effects
import { resolveChoiceEffect } from "./choice.js";

// Crystallize effects
import {
  resolveConvertManaToCrystal,
  resolveCrystallizeColor,
} from "./crystallize.js";

// Card boost effects
import {
  resolveCardBoostEffect,
  resolveBoostTargetEffect,
} from "./cardBoostResolvers.js";

// Combat effects
import {
  resolveSelectCombatEnemy,
  resolveCombatEnemyTarget,
} from "./combatEffects.js";

// Mana draw effects
import {
  handleManaDrawPowered,
  handleManaDrawPickDie,
  applyManaDrawSetColor,
} from "./manaDrawEffects.js";

// Unit effects
import { handleReadyUnit } from "./unitEffects.js";

// ============================================================================
// MAIN EFFECT RESOLVER
// ============================================================================

/**
 * Resolves a card effect by dispatching to the appropriate category handler.
 *
 * This is the main entry point for effect resolution. It handles the full
 * CardEffect discriminated union by routing each effect type to its
 * specialized resolver.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The effect to resolve
 * @param sourceCardId - Optional ID of the card that triggered this effect
 * @returns Resolution result with updated state and metadata
 *
 * @example Basic usage
 * ```typescript
 * const result = resolveEffect(state, "player1", effect);
 * if (result.requiresChoice) {
 *   // Handle pending choice
 * } else {
 *   state = result.state;
 * }
 * ```
 */
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
    // ========================================================================
    // ATOMIC EFFECTS (gain move, attack, etc.)
    // ========================================================================

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

    case EFFECT_TAKE_WOUND:
      return applyTakeWound(state, playerIndex, player, effect.amount);

    case EFFECT_DRAW_CARDS:
      return applyDrawCards(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_MANA: {
      if (effect.color === MANA_ANY) {
        // MANA_ANY should be resolved via player choice, not passed directly
        return {
          state,
          description: "Mana color choice required",
          requiresChoice: true,
        };
      }
      return applyGainMana(state, playerIndex, player, effect.color);
    }

    case EFFECT_CHANGE_REPUTATION:
      return applyChangeReputation(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_CRYSTAL:
      return applyGainCrystal(state, playerIndex, player, effect.color);

    case EFFECT_APPLY_MODIFIER:
      return applyModifierEffect(state, playerId, effect, sourceCardId);

    // ========================================================================
    // CRYSTALLIZE EFFECTS
    // ========================================================================

    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
      return resolveConvertManaToCrystal(
        state,
        playerId,
        player,
        effect,
        sourceCardId,
        resolveEffect
      );

    case EFFECT_CRYSTALLIZE_COLOR:
      return resolveCrystallizeColor(state, playerIndex, player, effect);

    // ========================================================================
    // COMPOUND EFFECTS (compound, conditional, scaling)
    // ========================================================================

    case EFFECT_COMPOUND:
      return resolveCompoundEffectList(
        state,
        playerId,
        effect.effects,
        sourceCardId,
        resolveEffect
      );

    case EFFECT_CHOICE:
      return resolveChoiceEffect(state, playerId, effect);

    case EFFECT_CONDITIONAL:
      return resolveConditionalEffect(
        state,
        playerId,
        effect,
        sourceCardId,
        resolveEffect
      );

    case EFFECT_SCALING:
      return resolveScalingEffect(
        state,
        playerId,
        effect,
        sourceCardId,
        resolveEffect
      );

    // ========================================================================
    // CARD BOOST EFFECTS
    // ========================================================================

    case EFFECT_CARD_BOOST:
      return resolveCardBoostEffect(state, player, effect);

    case EFFECT_RESOLVE_BOOST_TARGET:
      return resolveBoostTargetEffect(
        state,
        playerId,
        playerIndex,
        player,
        effect,
        resolveEffect
      );

    // ========================================================================
    // UNIT EFFECTS
    // ========================================================================

    case EFFECT_READY_UNIT:
      return handleReadyUnit(state, playerIndex, player, effect);

    // ========================================================================
    // MANA DRAW EFFECTS
    // ========================================================================

    case EFFECT_MANA_DRAW_POWERED:
      return handleManaDrawPowered(state, effect);

    case EFFECT_MANA_DRAW_PICK_DIE:
      return handleManaDrawPickDie(state, effect);

    case EFFECT_MANA_DRAW_SET_COLOR:
      return applyManaDrawSetColor(state, playerIndex, player, effect);

    // ========================================================================
    // COMBAT ENEMY TARGETING EFFECTS
    // ========================================================================

    case EFFECT_SELECT_COMBAT_ENEMY:
      return resolveSelectCombatEnemy(state, effect);

    case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET:
      return resolveCombatEnemyTarget(state, playerId, effect, sourceCardId);

    // ========================================================================
    // UNKNOWN EFFECT TYPE
    // ========================================================================

    default:
      // Unknown effect type — log and continue
      return {
        state,
        description: "Unhandled effect type",
      };
  }
}
