/**
 * Sacrifice Effect Handlers (Offering powered effect)
 *
 * Implements the Sacrifice powered spell:
 * 1. Player chooses a combination of crystal colors
 * 2. Count complete crystal pairs of chosen colors
 * 3. Grant combined attack based on pairs:
 *    - green+red pair → Siege Fire Attack 4 per pair
 *    - green+blue pair → Siege Ice Attack 4 per pair
 *    - white+red pair → Ranged Fire Attack 6 per pair
 *    - white+blue pair → Ranged Ice Attack 6 per pair
 * 4. Convert ALL complete crystal pairs to mana tokens (immediately usable)
 *
 * @module effects/sacrificeEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { ManaToken, Crystals } from "../../types/player.js";
import type {
  SacrificeEffect,
  ResolveSacrificeEffect,
  GainAttackEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { applyGainAttack } from "./atomicCombatEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_SACRIFICE,
  EFFECT_RESOLVE_SACRIFICE,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_SIEGE,
  COMBAT_TYPE_RANGED,
} from "../../types/effectTypes.js";
import { ELEMENT_FIRE, ELEMENT_ICE } from "../../types/modifierConstants.js";

// ============================================================================
// SACRIFICE ENTRY POINT
// ============================================================================

/**
 * Handle EFFECT_SACRIFICE — present all 4 color combination options.
 *
 * The player picks one of 4 combinations (green/white × red/blue),
 * then EFFECT_RESOLVE_SACRIFICE handles the calculation and conversion.
 */
export function handleSacrifice(
  state: GameState,
  _playerId: string,
  _effect: SacrificeEffect
): EffectResolutionResult {
  const options: ResolveSacrificeEffect[] = [
    {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_GREEN,
      elementColor: MANA_RED,
    },
    {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_GREEN,
      elementColor: MANA_BLUE,
    },
    {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_WHITE,
      elementColor: MANA_RED,
    },
    {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_WHITE,
      elementColor: MANA_BLUE,
    },
  ];

  return {
    state,
    description: "Choose crystal colors for Sacrifice",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// RESOLVE SACRIFICE
// ============================================================================

/**
 * Resolve after color choice — calculate attack from crystal pairs,
 * convert pairs to mana tokens.
 *
 * Attack values per pair:
 * - green+red → Siege Fire 4
 * - green+blue → Siege Ice 4
 * - white+red → Ranged Fire 6
 * - white+blue → Ranged Ice 6
 *
 * All complete pairs are converted: crystals become mana tokens.
 */
export function resolveSacrifice(
  state: GameState,
  playerId: string,
  effect: ResolveSacrificeEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  const { attackColor, elementColor } = effect;

  // Count complete pairs (minimum of the two crystal counts)
  const attackCrystalCount = player.crystals[attackColor];
  const elementCrystalCount = player.crystals[elementColor];
  const pairCount = Math.min(attackCrystalCount, elementCrystalCount);

  if (pairCount === 0) {
    return {
      state,
      description: `Sacrifice: No ${attackColor}/${elementColor} crystal pairs to convert`,
    };
  }

  // Determine attack parameters
  const isRanged = attackColor === MANA_WHITE;
  const combatType = isRanged ? COMBAT_TYPE_RANGED : COMBAT_TYPE_SIEGE;
  const attackPerPair = isRanged ? 6 : 4;
  const totalAttack = pairCount * attackPerPair;
  const element = elementColor === MANA_RED ? ELEMENT_FIRE : ELEMENT_ICE;

  // Remove crystals (convert pairs)
  const updatedCrystals: Crystals = {
    ...player.crystals,
    [attackColor]: player.crystals[attackColor] - pairCount,
    [elementColor]: player.crystals[elementColor] - pairCount,
  };

  // Create mana tokens from converted crystals
  const newTokens: ManaToken[] = [];
  for (let i = 0; i < pairCount; i++) {
    newTokens.push({ color: attackColor, source: MANA_TOKEN_SOURCE_CARD });
    newTokens.push({ color: elementColor, source: MANA_TOKEN_SOURCE_CARD });
  }

  // Apply crystal reduction and mana gain
  const updatedPlayer = {
    ...player,
    crystals: updatedCrystals,
    pureMana: [...player.pureMana, ...newTokens],
  };

  const stateAfterConversion = updatePlayer(state, playerIndex, updatedPlayer);

  // Apply attack using the standard applyGainAttack (handles Altem Mages modifiers etc.)
  const attackEffect: GainAttackEffect = {
    type: EFFECT_GAIN_ATTACK,
    amount: totalAttack,
    combatType,
    element,
  };

  const playerAfterConversion = stateAfterConversion.players[playerIndex]!;
  const attackResult = applyGainAttack(
    stateAfterConversion,
    playerIndex,
    playerAfterConversion,
    attackEffect
  );

  const attackTypeName = isRanged ? "Ranged" : "Siege";
  const elementName = elementColor === MANA_RED ? "Fire" : "Ice";

  return {
    state: attackResult.state,
    description: `Sacrifice: ${pairCount} ${attackColor}/${elementColor} pair(s) → ${attackTypeName} ${elementName} Attack ${totalAttack}. Converted ${pairCount * 2} crystals to mana tokens`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Sacrifice effect handlers with the effect registry.
 */
export function registerSacrificeEffects(): void {
  registerEffect(
    EFFECT_SACRIFICE,
    (state, playerId, effect) => {
      return handleSacrifice(state, playerId, effect as SacrificeEffect);
    }
  );

  registerEffect(
    EFFECT_RESOLVE_SACRIFICE,
    (state, playerId, effect) => {
      return resolveSacrifice(state, playerId, effect as ResolveSacrificeEffect);
    }
  );
}
