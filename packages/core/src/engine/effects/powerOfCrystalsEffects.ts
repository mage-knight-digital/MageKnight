import type { BasicManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type {
  CardEffect,
  DrawCardsEffect,
  GainCrystalEffect,
  GainHealingEffect,
  GainMoveEffect,
  PowerOfCrystalsBasicEffect,
  PowerOfCrystalsPoweredEffect,
} from "../../types/cards.js";
import {
  EFFECT_DRAW_CARDS,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MOVE,
  EFFECT_POWER_OF_CRYSTALS_BASIC,
  EFFECT_POWER_OF_CRYSTALS_POWERED,
} from "../../types/effectTypes.js";
import type { EffectResolutionResult } from "./types.js";
import { getPlayerContext } from "./effectHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import type { EffectResolver } from "./compound.js";

const BASIC_COLORS: readonly BasicManaColor[] = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];

export function handlePowerOfCrystalsBasic(
  state: GameState,
  playerId: string,
  _effect: PowerOfCrystalsBasicEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);
  const missingColors = BASIC_COLORS.filter((color) => player.crystals[color] === 0);

  if (missingColors.length === 0) {
    return {
      state,
      description: "No missing crystal color available",
    };
  }

  if (missingColors.length === 1) {
    const color = missingColors[0]!;
    const gainEffect: GainCrystalEffect = {
      type: EFFECT_GAIN_CRYSTAL,
      color,
    };
    return resolveEffect(state, playerId, gainEffect);
  }

  const options: GainCrystalEffect[] = missingColors.map((color) => ({
    type: EFFECT_GAIN_CRYSTAL,
    color,
  }));

  return {
    state,
    description: "Choose a crystal color you do not already own",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

export function registerPowerOfCrystalsEffects(resolver: EffectResolver): void {
  registerEffect(EFFECT_POWER_OF_CRYSTALS_BASIC, (state, playerId, effect) => {
    return handlePowerOfCrystalsBasic(
      state,
      playerId,
      effect as PowerOfCrystalsBasicEffect,
      resolver
    );
  });

  registerEffect(EFFECT_POWER_OF_CRYSTALS_POWERED, (state, playerId, effect) => {
    return handlePowerOfCrystalsPowered(
      state,
      playerId,
      effect as PowerOfCrystalsPoweredEffect,
      resolver
    );
  });
}

export function handlePowerOfCrystalsPowered(
  state: GameState,
  playerId: string,
  _effect: PowerOfCrystalsPoweredEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);
  const completeCrystalSets = Math.min(
    player.crystals.red,
    player.crystals.blue,
    player.crystals.green,
    player.crystals.white
  );

  const moveEffect: GainMoveEffect = {
    type: EFFECT_GAIN_MOVE,
    amount: 4 + completeCrystalSets * 2,
  };

  if (state.combat) {
    return resolveEffect(state, playerId, moveEffect);
  }

  const healEffect: GainHealingEffect = {
    type: EFFECT_GAIN_HEALING,
    amount: 2 + completeCrystalSets,
  };
  const drawEffect: DrawCardsEffect = {
    type: EFFECT_DRAW_CARDS,
    amount: 2 + completeCrystalSets,
  };
  const options: CardEffect[] = [moveEffect, healEffect, drawEffect];

  return {
    state,
    description: "Choose one: Move, Heal, or Draw",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}
