/**
 * Atomic combat effect handlers
 *
 * Handles effects that modify the combat accumulator:
 * - GainAttack (normal, ranged, siege with optional element)
 * - GainBlock (with optional element)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, AccumulatedAttack } from "../../types/player.js";
import type { Element, BlockSource, CombatType } from "@mage-knight/shared";
import type { GainAttackEffect, GainAttackBowResolvedEffect, GainBlockEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { ELEMENT_PHYSICAL, ELEMENT_COLD_FIRE, COMBAT_TYPE_RANGED, COMBAT_TYPE_SIEGE, COMBAT_PHASE_RANGED_SIEGE } from "@mage-knight/shared";
import { updatePlayer, updateElementalValue } from "./atomicHelpers.js";
import { getModifiersForPlayer } from "../modifiers/index.js";
import { EFFECT_TRANSFORM_ATTACKS_COLD_FIRE, EFFECT_ADD_SIEGE_TO_ATTACKS, EFFECT_BOW_ATTACK_TRANSFORMATION } from "../../types/modifierConstants.js";
import { EFFECT_GAIN_ATTACK_BOW_RESOLVED } from "../../types/effectTypes.js";

// ============================================================================
// ATTACK HELPERS
// ============================================================================

/**
 * Get the display name for an attack type based on combat type and element.
 */
function getAttackTypeName(
  combatType: CombatType | undefined,
  element: Element | undefined
): string {
  const elementPrefix = element ? `${element} ` : "";

  switch (combatType) {
    case COMBAT_TYPE_RANGED:
      return `${elementPrefix}Ranged Attack`;
    case COMBAT_TYPE_SIEGE:
      return `${elementPrefix}Siege Attack`;
    default:
      return `${elementPrefix}Attack`;
  }
}

/**
 * Update attack values for a specific combat type and element.
 */
function updateAttackForType(
  currentAttack: AccumulatedAttack,
  combatType: CombatType | undefined,
  element: Element | undefined,
  amount: number
): AccumulatedAttack {
  switch (combatType) {
    case COMBAT_TYPE_RANGED:
      if (element) {
        return {
          ...currentAttack,
          rangedElements: updateElementalValue(currentAttack.rangedElements, element, amount),
        };
      }
      return { ...currentAttack, ranged: currentAttack.ranged + amount };

    case COMBAT_TYPE_SIEGE:
      if (element) {
        return {
          ...currentAttack,
          siegeElements: updateElementalValue(currentAttack.siegeElements, element, amount),
        };
      }
      return { ...currentAttack, siege: currentAttack.siege + amount };

    default:
      if (element) {
        return {
          ...currentAttack,
          normalElements: updateElementalValue(currentAttack.normalElements, element, amount),
        };
      }
      return { ...currentAttack, normal: currentAttack.normal + amount };
  }
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Check if a player has an active Bow of Starsdawn attack transformation modifier.
 * Only applies during Ranged/Siege phase, not Attack phase.
 */
function hasBowAttackTransformation(state: GameState, playerId: string): boolean {
  if (!state.combat || state.combat.phase !== COMBAT_PHASE_RANGED_SIEGE) {
    return false;
  }
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some((m) => m.effect.type === EFFECT_BOW_ATTACK_TRANSFORMATION);
}

/**
 * Create choice options for Bow of Starsdawn attack transformation.
 * For Ranged attacks: choice to double OR convert to Siege of same element.
 * For Siege attacks: choice to keep as-is OR double (becomes Ranged of same element).
 *
 * Uses EFFECT_GAIN_ATTACK_BOW_RESOLVED to prevent re-triggering the
 * transformation when the chosen option is resolved.
 */
function createBowTransformationOptions(
  effect: GainAttackEffect
): readonly GainAttackBowResolvedEffect[] | null {
  const { amount, combatType, element } = effect;

  if (combatType === COMBAT_TYPE_RANGED) {
    // Ranged → Double (Ranged 2X) OR Convert (Siege X, same element)
    return [
      {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: amount * 2,
        combatType: COMBAT_TYPE_RANGED,
        element,
      },
      {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount,
        combatType: COMBAT_TYPE_SIEGE,
        element,
      },
    ];
  }

  if (combatType === COMBAT_TYPE_SIEGE) {
    // Siege → Keep as-is (Siege X) OR Double (Ranged 2X, same element)
    return [
      {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount,
        combatType: COMBAT_TYPE_SIEGE,
        element,
      },
      {
        type: EFFECT_GAIN_ATTACK_BOW_RESOLVED,
        amount: amount * 2,
        combatType: COMBAT_TYPE_RANGED,
        element,
      },
    ];
  }

  // Melee attacks are not affected
  return null;
}

/**
 * Check if a player has an active "Transform Attacks to Cold Fire" modifier.
 */
function hasTransformToColdFire(state: GameState, playerId: string): boolean {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some((m) => m.effect.type === EFFECT_TRANSFORM_ATTACKS_COLD_FIRE);
}

/**
 * Check if a player has an active "Add Siege to Attacks" modifier.
 */
function hasAddSiegeToAttacks(state: GameState, playerId: string): boolean {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some((m) => m.effect.type === EFFECT_ADD_SIEGE_TO_ATTACKS);
}

/**
 * Apply a GainAttack effect to the combat accumulator.
 *
 * Supports all combinations of:
 * - Combat type: normal, ranged, siege
 * - Element: physical (default), fire, ice, cold_fire
 *
 * Also applies Altem Mages' attack modifiers:
 * - Transform to Cold Fire: changes element to Cold Fire
 * - Add Siege: duplicates the attack into the siege pool
 */
export function applyGainAttack(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainAttackEffect
): EffectResolutionResult {
  const { amount, combatType } = effect;
  const playerId = player.id;

  // Check for Bow of Starsdawn attack transformation.
  // When active during Ranged/Siege phase, Ranged/Siege attacks get a choice:
  // - Ranged: double OR convert to Siege (same element)
  // - Siege: keep as-is OR double (becomes Ranged, same element)
  if (hasBowAttackTransformation(state, playerId) &&
      (combatType === COMBAT_TYPE_RANGED || combatType === COMBAT_TYPE_SIEGE)) {
    const transformOptions = createBowTransformationOptions(effect);
    if (transformOptions) {
      return {
        state,
        description: "Bow of Starsdawn: choose attack transformation",
        dynamicChoiceOptions: transformOptions,
        requiresChoice: true,
      };
    }
  }

  // Apply "Transform to Cold Fire" modifier: override element
  const effectiveElement = hasTransformToColdFire(state, playerId)
    ? ELEMENT_COLD_FIRE
    : effect.element;

  const currentAttack = player.combatAccumulator.attack;
  let updatedAttack = updateAttackForType(currentAttack, combatType, effectiveElement, amount);

  // Apply "Add Siege" modifier: also add attack to siege pool
  // Only applies to non-siege attacks (melee and ranged)
  if (hasAddSiegeToAttacks(state, playerId) && combatType !== COMBAT_TYPE_SIEGE) {
    updatedAttack = updateAttackForType(
      updatedAttack,
      COMBAT_TYPE_SIEGE,
      effectiveElement,
      amount
    );
  }

  const attackTypeName = getAttackTypeName(combatType, effectiveElement);

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

/**
 * Apply a Bow-resolved GainAttack effect to the combat accumulator.
 *
 * Identical to applyGainAttack but skips the Bow transformation check
 * to prevent infinite recursion. Still applies Cold Fire and Add Siege modifiers.
 */
export function applyGainBowResolvedAttack(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainAttackBowResolvedEffect
): EffectResolutionResult {
  const { amount, combatType } = effect;
  const playerId = player.id;

  // Apply "Transform to Cold Fire" modifier: override element
  const effectiveElement = hasTransformToColdFire(state, playerId)
    ? ELEMENT_COLD_FIRE
    : effect.element;

  const currentAttack = player.combatAccumulator.attack;
  let updatedAttack = updateAttackForType(currentAttack, combatType, effectiveElement, amount);

  // Apply "Add Siege" modifier: also add attack to siege pool
  // Only applies to non-siege attacks (melee and ranged)
  if (hasAddSiegeToAttacks(state, playerId) && combatType !== COMBAT_TYPE_SIEGE) {
    updatedAttack = updateAttackForType(
      updatedAttack,
      COMBAT_TYPE_SIEGE,
      effectiveElement,
      amount
    );
  }

  const attackTypeName = getAttackTypeName(combatType, effectiveElement);

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

/**
 * Apply a GainBlock effect to the combat accumulator.
 *
 * Updates both the block total and element-specific tracking for
 * elemental efficiency calculations.
 */
export function applyGainBlock(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainBlockEffect
): EffectResolutionResult {
  const { amount, element } = effect;
  const effectiveElement = element ?? ELEMENT_PHYSICAL;

  // Create a block source for tracking (for elemental efficiency calculations)
  const blockSource: BlockSource = {
    element: effectiveElement,
    value: amount,
  };

  // Always update both block total and blockElements for consistency with:
  // 1. activateUnitCommand (which updates both for all block types)
  // 2. UI which checks acc.block to determine if accumulator should render
  // 3. Valid actions computation which reads from blockElements
  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      block: player.combatAccumulator.block + amount,
      blockElements: updateElementalValue(
        player.combatAccumulator.blockElements,
        effectiveElement,
        amount
      ),
      blockSources: [...player.combatAccumulator.blockSources, blockSource],
    },
  };

  const blockTypeName = element ? `${element} Block` : "Block";

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} ${blockTypeName}`,
  };
}
