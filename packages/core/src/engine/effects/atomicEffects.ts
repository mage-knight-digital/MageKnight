/**
 * Atomic Effect Handlers
 *
 * This module provides pure leaf functions that directly transform game state
 * without recursing back into resolveEffect. These handle direct state changes:
 *
 * | Module | Effects |
 * |--------|---------|
 * | `atomicCombatEffects.ts` | GainAttack, GainBlock |
 * | `atomicResourceEffects.ts` | GainMove, GainInfluence, GainMana, GainCrystal |
 * | `atomicProgressionEffects.ts` | GainFame, ChangeReputation |
 * | `atomicCardEffects.ts` | DrawCards, GainHealing, TakeWound |
 * | `atomicModifierEffects.ts` | ApplyModifier |
 * | `atomicHelpers.ts` | Shared utilities (updatePlayer, updateElementalValue) |
 *
 * @module effects/atomicEffects
 */

// ============================================================================
// SHARED HELPERS
// ============================================================================

export {
  updatePlayer,
  updateElementalValue,
  elementToPropertyKey,
} from "./atomicHelpers.js";

// ============================================================================
// COMBAT EFFECTS
// ============================================================================

export {
  applyGainAttack,
  applyGainBlock,
} from "./atomicCombatEffects.js";

// ============================================================================
// RESOURCE EFFECTS
// ============================================================================

export {
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainCrystal,
} from "./atomicResourceEffects.js";

// ============================================================================
// PROGRESSION EFFECTS
// ============================================================================

export {
  applyChangeReputation,
  applyGainFame,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "./atomicProgressionEffects.js";

// ============================================================================
// CARD EFFECTS
// ============================================================================

export {
  applyDrawCards,
  applyGainHealing,
  applyTakeWound,
} from "./atomicCardEffects.js";

// ============================================================================
// MODIFIER EFFECTS
// ============================================================================

export {
  applyModifierEffect,
} from "./atomicModifierEffects.js";

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

import type {
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  GainManaEffect,
  DrawCardsEffect,
  ChangeReputationEffect,
  GainFameEffect,
  GainCrystalEffect,
  TakeWoundEffect,
  ApplyModifierEffect,
} from "../../types/cards.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_NOOP,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_FAME,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_TAKE_WOUND,
  EFFECT_GRANT_WOUND_IMMUNITY,
  MANA_ANY,
} from "../../types/effectTypes.js";
import { applyGainMove, applyGainInfluence, applyGainMana, applyGainCrystal } from "./atomicResourceEffects.js";
import { applyGainAttack, applyGainBlock } from "./atomicCombatEffects.js";
import { applyChangeReputation, applyGainFame } from "./atomicProgressionEffects.js";
import { applyDrawCards, applyGainHealing, applyTakeWound } from "./atomicCardEffects.js";
import { applyModifierEffect } from "./atomicModifierEffects.js";

/**
 * Register all atomic effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerAtomicEffects(): void {
  registerEffect(EFFECT_GAIN_MOVE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainMove(state, playerIndex, player, (effect as GainMoveEffect).amount);
  });

  registerEffect(EFFECT_GAIN_INFLUENCE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainInfluence(state, playerIndex, player, (effect as GainInfluenceEffect).amount);
  });

  registerEffect(EFFECT_GAIN_ATTACK, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainAttack(state, playerIndex, player, effect as GainAttackEffect);
  });

  registerEffect(EFFECT_GAIN_BLOCK, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainBlock(state, playerIndex, player, effect as GainBlockEffect);
  });

  registerEffect(EFFECT_GAIN_HEALING, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainHealing(state, playerIndex, player, (effect as GainHealingEffect).amount);
  });

  registerEffect(EFFECT_TAKE_WOUND, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyTakeWound(state, playerIndex, player, (effect as TakeWoundEffect).amount);
  });

  registerEffect(EFFECT_DRAW_CARDS, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyDrawCards(state, playerIndex, player, (effect as DrawCardsEffect).amount);
  });

  registerEffect(EFFECT_NOOP, (state) => {
    return {
      state,
      description: "No additional effect",
    };
  });

  registerEffect(EFFECT_GAIN_MANA, (state, playerId, effect) => {
    const manaEffect = effect as GainManaEffect;
    if (manaEffect.color === MANA_ANY) {
      // MANA_ANY should be resolved via player choice, not passed directly
      return {
        state,
        description: "Mana color choice required",
        requiresChoice: true,
      };
    }
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainMana(state, playerIndex, player, manaEffect.color);
  });

  registerEffect(EFFECT_CHANGE_REPUTATION, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyChangeReputation(state, playerIndex, player, (effect as ChangeReputationEffect).amount);
  });

  registerEffect(EFFECT_GAIN_FAME, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainFame(state, playerIndex, player, (effect as GainFameEffect).amount);
  });

  registerEffect(EFFECT_GAIN_CRYSTAL, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyGainCrystal(state, playerIndex, player, (effect as GainCrystalEffect).color);
  });

  registerEffect(EFFECT_APPLY_MODIFIER, (state, playerId, effect, sourceCardId) => {
    return applyModifierEffect(state, playerId, effect as ApplyModifierEffect, sourceCardId);
  });

  // Grant wound immunity - hero ignores first wound from enemies this turn
  registerEffect(EFFECT_GRANT_WOUND_IMMUNITY, (state, playerId, _effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? { ...player, woundImmunityActive: true } : p
        ),
      },
      events: [],
      description: "Hero ignores first wound this turn",
    };
  });
}
