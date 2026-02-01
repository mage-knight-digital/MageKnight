/**
 * Mana Draw powered effect handlers
 *
 * Implements the multi-step state machine for Mana Draw and Mana Pull cards:
 *
 * Flow diagram:
 * ```
 * MANA_DRAW_POWERED (entry point)
 *   ├─ Only 1 die available? → skip to SET_COLOR
 *   └─ Multiple dice? → PICK_DIE (player chooses which die)
 *         ↓
 *      SET_COLOR (player chooses color: red/blue/green/white)
 *         ├─ remainingDiceToSelect > 0? → loop back to PICK_DIE
 *         └─ Done? → return final state with mana tokens
 * ```
 *
 * State is threaded through effect parameters:
 * - remainingDiceToSelect: how many more dice to pick (for Mana Pull)
 * - alreadySelectedDieIds: prevents re-picking same die
 * - tokensPerDie: 1 for Mana Draw, 2 for Mana Pull
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import type { BasicManaColor } from "@mage-knight/shared";
import type { ManaDrawPoweredEffect, ManaDrawPickDieEffect, ManaDrawSetColorEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { MANA_TOKEN_SOURCE_CARD, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { EFFECT_MANA_DRAW_POWERED, EFFECT_MANA_DRAW_PICK_DIE, EFFECT_MANA_DRAW_SET_COLOR } from "../../types/effectTypes.js";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";

/**
 * Entry point for Mana Draw/Mana Pull powered effect.
 * Initiates die selection or skips to color choice if only one die available.
 */
export function handleManaDrawPowered(
  state: GameState,
  effect: ManaDrawPoweredEffect
): EffectResolutionResult {
  const { diceCount, tokensPerDie } = effect;

  // Filter out already-taken dice
  const availableDice = state.source.dice.filter(
    (d) => d.takenByPlayerId === null
  );

  if (availableDice.length === 0) {
    return {
      state,
      description: "No dice available in the Source",
    };
  }

  const remainingDiceToSelect = diceCount - 1; // After picking this die
  const alreadySelectedDieIds: readonly SourceDieId[] = [];

  // Auto-select if there's no meaningful choice:
  // - Only one die available
  // - Need one die (diceCount=1)
  // - Available dice exactly matches what we need (e.g., need 2 and have 2)
  if (availableDice.length <= diceCount) {
    const die = availableDice[0];
    if (!die) {
      throw new Error("Expected at least one available die");
    }
    // Generate color choice options directly
    const colorOptions = generateColorOptions(die.id, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds);
    return {
      state,
      description: `Choose color for the ${die.color} die`,
      requiresChoice: true,
      dynamicChoiceOptions: colorOptions,
    };
  }

  // Multiple dice available and need to pick — player must first choose which die
  const dieOptions: ManaDrawPickDieEffect[] = availableDice.map((die) => ({
    type: EFFECT_MANA_DRAW_PICK_DIE,
    dieId: die.id,
    dieColor: die.color,
    remainingDiceToSelect,
    tokensPerDie,
    alreadySelectedDieIds,
  }));

  return {
    state,
    description: "Choose a die from the Source",
    requiresChoice: true,
    dynamicChoiceOptions: dieOptions,
  };
}

/**
 * Handle die selection - player picked a die, now choose its color.
 */
export function handleManaDrawPickDie(
  state: GameState,
  effect: ManaDrawPickDieEffect
): EffectResolutionResult {
  const { dieId, remainingDiceToSelect, tokensPerDie, alreadySelectedDieIds } = effect;

  const colorOptions = generateColorOptions(dieId, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds);

  // Find the die to show its current color in description
  const selectedDie = state.source.dice.find((d) => d.id === dieId);
  const dieColor = selectedDie?.color ?? "unknown";

  return {
    state,
    description: `Choose color for the ${dieColor} die`,
    requiresChoice: true,
    dynamicChoiceOptions: colorOptions,
  };
}

/**
 * Apply the final resolution for one die:
 * - Set the die color to the chosen color
 * - Mark die as taken by player (unavailable to others until turn ends)
 * - Gain mana tokens of the chosen color (tokensPerDie count)
 * - If more dice to select, chain to next die selection
 *
 * Note: At end of turn, dice are returned WITHOUT rerolling.
 * This is tracked via player.manaDrawDieIds array. The endTurnCommand will
 * clear takenByPlayerId without rerolling for these dice.
 */
export function applyManaDrawSetColor(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: ManaDrawSetColorEffect
): EffectResolutionResult {
  const { dieId, color, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds } = effect;

  // Find and update the die
  const dieIndex = state.source.dice.findIndex((d) => d.id === dieId);
  const originalDie = state.source.dice[dieIndex];
  if (dieIndex === -1 || !originalDie) {
    return {
      state,
      description: `Die not found: ${dieId}`,
    };
  }

  // Update the die: set color, mark as taken by player
  // isDepleted = false since basic colors are never depleted
  const updatedDice = [...state.source.dice];
  updatedDice[dieIndex] = {
    ...originalDie,
    color,
    isDepleted: false,
    takenByPlayerId: player.id, // Taken until turn ends
  };

  const stateWithUpdatedDie: GameState = {
    ...state,
    source: {
      ...state.source,
      dice: updatedDice,
    },
  };

  // Gain mana tokens of the chosen color (1 or 2 depending on card)
  const newTokens = Array.from({ length: tokensPerDie }, () => ({
    color,
    source: MANA_TOKEN_SOURCE_CARD,
  }));

  // Track this die for no-reroll at turn end
  const updatedManaDrawDieIds = [...player.manaDrawDieIds, dieId];

  const updatedPlayer: Player = {
    ...player,
    pureMana: [...player.pureMana, ...newTokens],
    manaDrawDieIds: updatedManaDrawDieIds,
  };

  const stateAfterTokens = updatePlayer(stateWithUpdatedDie, playerIndex, updatedPlayer);
  const tokenText = tokensPerDie === 1 ? `1 ${color} mana` : `2 ${color} mana`;

  // If more dice to select (Mana Pull), chain to next die selection
  if (remainingDiceToSelect > 0) {
    return chainToNextDieSelection(
      stateAfterTokens,
      dieId,
      color,
      tokenText,
      tokensPerDie,
      remainingDiceToSelect,
      alreadySelectedDieIds
    );
  }

  // No more dice to select, we're done
  return {
    state: stateAfterTokens,
    description: `Set die to ${color}, gained ${tokenText}`,
  };
}

// === Helper functions ===

/**
 * Generate the four color choice options for a die.
 */
function generateColorOptions(
  dieId: SourceDieId,
  tokensPerDie: 1 | 2,
  remainingDiceToSelect: number,
  alreadySelectedDieIds: readonly SourceDieId[]
): ManaDrawSetColorEffect[] {
  return [
    { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_RED, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
    { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_BLUE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
    { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_GREEN, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
    { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_WHITE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
  ];
}

/**
 * After setting one die's color, chain to selecting the next die (for Mana Pull).
 */
function chainToNextDieSelection(
  state: GameState,
  justSelectedDieId: SourceDieId,
  color: BasicManaColor,
  tokenText: string,
  tokensPerDie: 1 | 2,
  remainingDiceToSelect: number,
  alreadySelectedDieIds: readonly SourceDieId[]
): EffectResolutionResult {
  const newAlreadySelected: SourceDieId[] = [...alreadySelectedDieIds, justSelectedDieId];

  // Find available dice (not taken, not already selected in this chain)
  const availableDice = state.source.dice.filter(
    (d) => d.takenByPlayerId === null && !newAlreadySelected.includes(d.id)
  );

  if (availableDice.length === 0) {
    // No more dice available, end here
    return {
      state,
      description: `Set die to ${color}, gained ${tokenText} (no more dice available)`,
    };
  }

  const nextRemainingDice = remainingDiceToSelect - 1;

  // If only one die left, auto-select and go to color choice
  if (availableDice.length === 1) {
    const die = availableDice[0];
    if (!die) {
      throw new Error("Expected at least one available die");
    }
    const colorOptions = generateColorOptions(die.id, tokensPerDie, nextRemainingDice, newAlreadySelected);
    return {
      state,
      description: `Set die to ${color}, gained ${tokenText}. Choose color for next die (${die.color})`,
      requiresChoice: true,
      dynamicChoiceOptions: colorOptions,
    };
  }

  // Multiple dice available, let player choose
  const dieOptions: ManaDrawPickDieEffect[] = availableDice.map((die) => ({
    type: EFFECT_MANA_DRAW_PICK_DIE,
    dieId: die.id,
    dieColor: die.color,
    remainingDiceToSelect: nextRemainingDice,
    tokensPerDie,
    alreadySelectedDieIds: newAlreadySelected,
  }));

  return {
    state,
    description: `Set die to ${color}, gained ${tokenText}. Choose another die`,
    requiresChoice: true,
    dynamicChoiceOptions: dieOptions,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all mana draw effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerManaDrawEffects(): void {
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
}
