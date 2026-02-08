/**
 * Spell Forge Effect Handlers
 *
 * Implements the Spell Forge advanced action card:
 *
 * Basic: Choose one spell card from the Spells Offer, gain a crystal of that spell's color.
 * Powered: Choose two different spell cards from the Spells Offer, gain a crystal for each.
 *
 * "Two different Spell cards" means distinct cards from the offer, not necessarily
 * different colors. If there are two blue spells, both can be picked.
 *
 * @module effects/spellForgeEffects
 */

import type { GameState } from "../../state/GameState.js";
import type {
  SpellForgeBasicEffect,
  SpellForgePoweredEffect,
  ResolveSpellForgeCrystalEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor } from "@mage-knight/shared";
import {
  EFFECT_SPELL_FORGE_BASIC,
  EFFECT_SPELL_FORGE_POWERED,
  EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
} from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import { gainCrystalWithOverflow } from "../helpers/crystalHelpers.js";
import { getSpellColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";

// ============================================================================
// HELPERS
// ============================================================================

function cardColorToManaColor(color: string): BasicManaColor {
  const map: Record<string, BasicManaColor> = {
    red: "red",
    blue: "blue",
    green: "green",
    white: "white",
  };
  const result = map[color];
  if (!result) {
    throw new Error(`Unknown card color: ${color}`);
  }
  return result;
}

/**
 * Build choice options from the spell offer, optionally excluding a specific index.
 */
function buildSpellOfferOptions(
  state: GameState,
  excludeIndex: number | null,
  chainSecondChoice: boolean
): ResolveSpellForgeCrystalEffect[] {
  const options: ResolveSpellForgeCrystalEffect[] = [];

  for (let i = 0; i < state.offers.spells.cards.length; i++) {
    if (i === excludeIndex) continue;

    const cardId = state.offers.spells.cards[i];
    if (!cardId) continue;

    const spellColor = getSpellColor(cardId);
    if (spellColor === null) continue;

    const card = getCard(cardId);
    const spellName = card?.name ?? cardId;
    const manaColor = cardColorToManaColor(spellColor);

    options.push({
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: manaColor,
      spellName,
      offerIndex: i,
      chainSecondChoice,
    });
  }

  return options;
}

// ============================================================================
// BASIC EFFECT: CHOOSE ONE SPELL, GAIN CRYSTAL
// ============================================================================

function handleSpellForgeBasic(
  state: GameState,
  playerId: string,
  _effect: SpellForgeBasicEffect
): EffectResolutionResult {
  const options = buildSpellOfferOptions(state, null, false);

  if (options.length === 0) {
    return {
      state,
      description: "No spells in offer to choose from",
    };
  }

  if (options.length === 1) {
    const singleOption = options[0]!;
    const result = resolveSpellForgeCrystal(state, playerId, singleOption);
    return {
      ...result,
      resolvedEffect: singleOption,
    };
  }

  return {
    state,
    description: "Choose a spell card from the Spells Offer to gain a crystal of its color",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// POWERED EFFECT: CHOOSE TWO DIFFERENT SPELLS, GAIN CRYSTALS
// ============================================================================

function handleSpellForgePowered(
  state: GameState,
  playerId: string,
  _effect: SpellForgePoweredEffect
): EffectResolutionResult {
  const options = buildSpellOfferOptions(state, null, true);

  if (options.length === 0) {
    return {
      state,
      description: "No spells in offer to choose from",
    };
  }

  // If only one spell in offer, can only gain one crystal (no second choice possible)
  if (options.length === 1) {
    const singleOption: ResolveSpellForgeCrystalEffect = {
      ...options[0]!,
      chainSecondChoice: false,
    };
    const result = resolveSpellForgeCrystal(state, playerId, singleOption);
    return {
      ...result,
      resolvedEffect: singleOption,
    };
  }

  return {
    state,
    description: "Choose first spell card from the Spells Offer (gain crystal of its color)",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

// ============================================================================
// RESOLVE: GAIN CRYSTAL + OPTIONAL CHAIN
// ============================================================================

function resolveSpellForgeCrystal(
  state: GameState,
  playerId: string,
  effect: ResolveSpellForgeCrystalEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Gain crystal of the spell's color
  const { player: updatedPlayer } = gainCrystalWithOverflow(player, effect.color);
  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  if (!effect.chainSecondChoice) {
    return {
      state: updatedState,
      description: `Gained ${effect.color} crystal (${effect.spellName})`,
    };
  }

  // Chain to second choice — exclude the spell we just picked
  const secondOptions = buildSpellOfferOptions(updatedState, effect.offerIndex, false);

  if (secondOptions.length === 0) {
    return {
      state: updatedState,
      description: `Gained ${effect.color} crystal (${effect.spellName}), no other spells to choose`,
    };
  }

  if (secondOptions.length === 1) {
    const singleOption = secondOptions[0]!;
    const secondResult = resolveSpellForgeCrystal(updatedState, playerId, singleOption);
    return {
      ...secondResult,
      description: `Gained ${effect.color} crystal (${effect.spellName}), then ${secondResult.description}`,
      resolvedEffect: singleOption,
    };
  }

  return {
    state: updatedState,
    description: "Choose second spell card (different from first) to gain another crystal",
    requiresChoice: true,
    dynamicChoiceOptions: secondOptions,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

export function registerSpellForgeEffects(): void {
  registerEffect(EFFECT_SPELL_FORGE_BASIC, (state, playerId, effect) => {
    return handleSpellForgeBasic(state, playerId, effect as SpellForgeBasicEffect);
  });

  registerEffect(EFFECT_SPELL_FORGE_POWERED, (state, playerId, effect) => {
    return handleSpellForgePowered(state, playerId, effect as SpellForgePoweredEffect);
  });

  registerEffect(EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL, (state, playerId, effect) => {
    return resolveSpellForgeCrystal(state, playerId, effect as ResolveSpellForgeCrystalEffect);
  });
}
