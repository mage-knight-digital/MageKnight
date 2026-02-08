/**
 * Crystal Mastery Effect Handlers
 *
 * Implements the Crystal Mastery advanced action card:
 *
 * Basic: Gain a crystal of a color you already own.
 *   - Presents a choice of colors matching crystals the player currently has.
 *   - If only one color is owned, auto-resolves.
 *   - If no crystals are owned, effect cannot resolve.
 *
 * Powered: At end of turn, spent crystals are returned to inventory.
 *   - Sets crystalMasteryPoweredActive flag on the player.
 *   - Actual return is handled during end-of-turn processing in siteChecks.ts.
 *   - Crystals spent via MANA_SOURCE_CRYSTAL are tracked in spentCrystalsThisTurn.
 *   - Crystal conversions (Sacrifice, Polarize) do NOT count as spending.
 *
 * @module effects/crystalMasteryEffects
 */

import type { GameState } from "../../state/GameState.js";
import type {
  CrystalMasteryBasicEffect,
  CrystalMasteryPoweredEffect,
  GainCrystalEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
  EFFECT_GAIN_CRYSTAL,
} from "../../types/effectTypes.js";

const MAX_CRYSTALS_PER_COLOR = 3;
const BASIC_COLORS: readonly BasicManaColor[] = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];

// ============================================================================
// BASIC EFFECT: GAIN CRYSTAL OF COLOR YOU OWN
// ============================================================================

/**
 * Handle EFFECT_CRYSTAL_MASTERY_BASIC.
 * Presents a choice of crystal colors that the player already owns.
 * Only colors where the player has at least 1 crystal AND is below the cap (3) are eligible.
 */
export function handleCrystalMasteryBasic(
  state: GameState,
  playerId: string,
  _effect: CrystalMasteryBasicEffect
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);

  // Find colors the player owns at least 1 crystal of AND can still gain more
  const eligibleColors = BASIC_COLORS.filter(
    (color) => player.crystals[color] > 0 && player.crystals[color] < MAX_CRYSTALS_PER_COLOR
  );

  if (eligibleColors.length === 0) {
    // Player has no crystals, or all owned colors are at max
    return {
      state,
      description: "No eligible crystal colors to duplicate",
    };
  }

  if (eligibleColors.length === 1) {
    // Auto-resolve: only one eligible color
    const color = eligibleColors[0]!;
    const { playerIndex } = getPlayerContext(state, playerId);
    const updatedPlayer = {
      ...player,
      crystals: {
        ...player.crystals,
        [color]: player.crystals[color] + 1,
      },
    };
    const resolvedEffect: GainCrystalEffect = {
      type: EFFECT_GAIN_CRYSTAL,
      color,
    };
    return {
      state: updatePlayer(state, playerIndex, updatedPlayer),
      description: `Crystal Mastery: Gained ${color} crystal (matching owned)`,
      resolvedEffect,
    };
  }

  // Multiple eligible colors - present choice
  const options: GainCrystalEffect[] = eligibleColors.map((color) => ({
    type: EFFECT_GAIN_CRYSTAL,
    color,
  }));

  return {
    state,
    description: "Choose a crystal color you already own to gain",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// POWERED EFFECT: RETURN SPENT CRYSTALS AT END OF TURN
// ============================================================================

/**
 * Handle EFFECT_CRYSTAL_MASTERY_POWERED.
 * Sets the crystalMasteryPoweredActive flag. The actual crystal return
 * happens during end-of-turn processing.
 */
export function handleCrystalMasteryPowered(
  state: GameState,
  playerId: string,
  _effect: CrystalMasteryPoweredEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  const updatedPlayer = {
    ...player,
    crystalMasteryPoweredActive: true,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: "Crystal Mastery powered: Crystals spent this turn will be returned at end of turn",
  };
}

// ============================================================================
// END-OF-TURN CRYSTAL RETURN
// ============================================================================

/**
 * Return spent crystals at end of turn if Crystal Mastery powered was played.
 * Called during end-of-turn processing (before player reset).
 *
 * @returns Updated player with crystals returned, or unchanged player if not active
 */
export function returnSpentCrystals(player: import("../../../types/player.js").Player): import("../../../types/player.js").Player {
  if (!player.crystalMasteryPoweredActive) {
    return player;
  }

  const { spentCrystalsThisTurn } = player;
  const totalSpent = spentCrystalsThisTurn.red + spentCrystalsThisTurn.blue +
    spentCrystalsThisTurn.green + spentCrystalsThisTurn.white;

  if (totalSpent === 0) {
    return player;
  }

  // Return each spent crystal, capped at max 3 per color
  const updatedCrystals = {
    red: Math.min(MAX_CRYSTALS_PER_COLOR, player.crystals.red + spentCrystalsThisTurn.red),
    blue: Math.min(MAX_CRYSTALS_PER_COLOR, player.crystals.blue + spentCrystalsThisTurn.blue),
    green: Math.min(MAX_CRYSTALS_PER_COLOR, player.crystals.green + spentCrystalsThisTurn.green),
    white: Math.min(MAX_CRYSTALS_PER_COLOR, player.crystals.white + spentCrystalsThisTurn.white),
  };

  return {
    ...player,
    crystals: updatedCrystals,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Crystal Mastery effect handlers with the effect registry.
 */
export function registerCrystalMasteryEffects(): void {
  registerEffect(EFFECT_CRYSTAL_MASTERY_BASIC, (state, playerId, effect) => {
    return handleCrystalMasteryBasic(
      state,
      playerId,
      effect as CrystalMasteryBasicEffect
    );
  });

  registerEffect(EFFECT_CRYSTAL_MASTERY_POWERED, (state, playerId, effect) => {
    return handleCrystalMasteryPowered(
      state,
      playerId,
      effect as CrystalMasteryPoweredEffect
    );
  });
}
