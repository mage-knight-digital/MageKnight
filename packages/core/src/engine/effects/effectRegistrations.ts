/**
 * Effect Registrations
 *
 * Registers all effect handlers with the central registry.
 * Import this module to initialize the effect dispatch system.
 *
 * @module effects/effectRegistrations
 *
 * @remarks
 * This module acts as the central point where all effect handlers are registered.
 * Each effect type maps to a handler function that processes that effect.
 * The handlers wrap the existing resolution functions to match the registry signature.
 */

import type { GameState } from "../../state/GameState.js";
import type {
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  GainManaEffect,
  DrawCardsEffect,
  ApplyModifierEffect,
  ChangeReputationEffect,
  GainFameEffect,
  GainCrystalEffect,
  TakeWoundEffect,
  ConvertManaToCrystalEffect,
  CrystallizeColorEffect,
  ChoiceEffect,
  CardBoostEffect,
  ResolveBoostTargetEffect,
  ReadyUnitEffect,
  ManaDrawPoweredEffect,
  ManaDrawPickDieEffect,
  ManaDrawSetColorEffect,
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  HealUnitEffect,
  DiscardCardEffect,
  RevealTilesEffect,
  PayManaCostEffect,
  TerrainBasedBlockEffect,
  CompoundEffect,
  ConditionalEffect,
  ScalingEffect,
} from "../../types/cards.js";
import { registerEffect, type EffectHandler } from "./effectRegistry.js";
import { getPlayerIndexByIdOrThrow } from "../helpers/playerHelpers.js";

// Effect type constants
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_FAME,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_TAKE_WOUND,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_CHOICE,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_HEAL_UNIT,
  EFFECT_DISCARD_CARD,
  EFFECT_REVEAL_TILES,
  EFFECT_PAY_MANA,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
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
  applyGainFame,
  applyGainCrystal,
  applyTakeWound,
  applyModifierEffect,
} from "./atomicEffects.js";

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

// Heal unit effects
import { handleHealUnit } from "./healUnitEffects.js";

// Discard effects
import { handleDiscardCard } from "./discardEffects.js";

// Map effects
import { handleRevealTiles } from "./mapEffects.js";

// Mana payment effects
import { handlePayMana } from "./manaPaymentEffects.js";

// Terrain-based effects
import { resolveTerrainBasedBlock } from "./terrainEffects.js";

// Compound effects (need special handling for recursive resolution)
import {
  resolveCompoundEffectList,
  resolveConditionalEffect,
  resolveScalingEffect,
} from "./compound.js";

// ============================================================================
// HELPER
// ============================================================================

/**
 * Get player index and player object from state and playerId.
 * Helper to bridge between registry signature and internal function signatures.
 */
function getPlayerContext(state: GameState, playerId: string) {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }
  return { playerIndex, player };
}

// ============================================================================
// MAIN RESOLVER REFERENCE
// ============================================================================

/**
 * Reference to the main resolveEffect function.
 * Set by initializeRegistry() to break circular dependency.
 */
let mainResolver: EffectHandler | null = null;

/**
 * Initialize the registry with a reference to the main resolver.
 * This is called from index.ts to break the circular dependency.
 *
 * @param resolver - The main resolveEffect function
 */
export function initializeRegistry(resolver: EffectHandler): void {
  mainResolver = resolver;
}

/**
 * Get the main resolver, throwing if not initialized.
 */
function getResolver(): EffectHandler {
  if (!mainResolver) {
    throw new Error("Effect registry not initialized - call initializeRegistry first");
  }
  return mainResolver;
}

// ============================================================================
// REGISTRATIONS
// ============================================================================

/**
 * Register all effect handlers.
 * Called once during module initialization.
 */
function registerAllEffects(): void {
  // ========================================================================
  // ATOMIC EFFECTS
  // ========================================================================

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

  // ========================================================================
  // CRYSTALLIZE EFFECTS
  // ========================================================================

  registerEffect(EFFECT_CONVERT_MANA_TO_CRYSTAL, (state, playerId, effect, sourceCardId) => {
    const { player } = getPlayerContext(state, playerId);
    return resolveConvertManaToCrystal(
      state,
      playerId,
      player,
      effect as ConvertManaToCrystalEffect,
      sourceCardId,
      getResolver()
    );
  });

  registerEffect(EFFECT_CRYSTALLIZE_COLOR, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveCrystallizeColor(state, playerIndex, player, effect as CrystallizeColorEffect);
  });

  // ========================================================================
  // COMPOUND EFFECTS
  // ========================================================================

  registerEffect(EFFECT_COMPOUND, (state, playerId, effect, sourceCardId) => {
    return resolveCompoundEffectList(
      state,
      playerId,
      (effect as CompoundEffect).effects,
      sourceCardId,
      getResolver()
    );
  });

  registerEffect(EFFECT_CHOICE, (state, playerId, effect) => {
    return resolveChoiceEffect(state, playerId, effect as ChoiceEffect);
  });

  registerEffect(EFFECT_CONDITIONAL, (state, playerId, effect, sourceCardId) => {
    return resolveConditionalEffect(
      state,
      playerId,
      effect as ConditionalEffect,
      sourceCardId,
      getResolver()
    );
  });

  registerEffect(EFFECT_SCALING, (state, playerId, effect, sourceCardId) => {
    return resolveScalingEffect(
      state,
      playerId,
      effect as ScalingEffect,
      sourceCardId,
      getResolver()
    );
  });

  // ========================================================================
  // CARD BOOST EFFECTS
  // ========================================================================

  registerEffect(EFFECT_CARD_BOOST, (state, playerId, effect) => {
    const { player } = getPlayerContext(state, playerId);
    return resolveCardBoostEffect(state, player, effect as CardBoostEffect);
  });

  registerEffect(EFFECT_RESOLVE_BOOST_TARGET, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveBoostTargetEffect(
      state,
      playerId,
      playerIndex,
      player,
      effect as ResolveBoostTargetEffect,
      getResolver()
    );
  });

  // ========================================================================
  // UNIT EFFECTS
  // ========================================================================

  registerEffect(EFFECT_READY_UNIT, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleReadyUnit(state, playerIndex, player, effect as ReadyUnitEffect);
  });

  // ========================================================================
  // MANA DRAW EFFECTS
  // ========================================================================

  registerEffect(EFFECT_MANA_DRAW_POWERED, (state, _playerId, effect) => {
    return handleManaDrawPowered(state, effect as ManaDrawPoweredEffect);
  });

  registerEffect(EFFECT_MANA_DRAW_PICK_DIE, (state, _playerId, effect) => {
    return handleManaDrawPickDie(state, effect as ManaDrawPickDieEffect);
  });

  registerEffect(EFFECT_MANA_DRAW_SET_COLOR, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return applyManaDrawSetColor(state, playerIndex, player, effect as ManaDrawSetColorEffect);
  });

  // ========================================================================
  // COMBAT ENEMY TARGETING EFFECTS
  // ========================================================================

  registerEffect(EFFECT_SELECT_COMBAT_ENEMY, (state, _playerId, effect) => {
    return resolveSelectCombatEnemy(state, effect as SelectCombatEnemyEffect);
  });

  registerEffect(EFFECT_RESOLVE_COMBAT_ENEMY_TARGET, (state, playerId, effect, sourceCardId) => {
    return resolveCombatEnemyTarget(
      state,
      playerId,
      effect as ResolveCombatEnemyTargetEffect,
      sourceCardId
    );
  });

  // ========================================================================
  // SKILL-RELATED EFFECTS
  // ========================================================================

  registerEffect(EFFECT_HEAL_UNIT, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleHealUnit(state, playerIndex, player, effect as HealUnitEffect);
  });

  registerEffect(EFFECT_DISCARD_CARD, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleDiscardCard(state, playerIndex, player, effect as DiscardCardEffect);
  });

  registerEffect(EFFECT_REVEAL_TILES, (state, playerId, effect) => {
    const { player } = getPlayerContext(state, playerId);
    return handleRevealTiles(state, player, effect as RevealTilesEffect);
  });

  registerEffect(EFFECT_PAY_MANA, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handlePayMana(state, playerIndex, player, effect as PayManaCostEffect);
  });

  // ========================================================================
  // TERRAIN-BASED EFFECTS
  // ========================================================================

  registerEffect(EFFECT_TERRAIN_BASED_BLOCK, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveTerrainBasedBlock(state, playerIndex, player, effect as TerrainBasedBlockEffect);
  });
}

// Register all effects when this module is imported
registerAllEffects();
