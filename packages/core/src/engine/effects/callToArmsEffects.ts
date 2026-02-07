/**
 * Call to Arms Effect Handlers
 *
 * Handles the Call to Arms spell basic effect which borrows a Unit ability
 * from the Units Offer without recruiting the unit.
 *
 * Flow:
 * 1. EFFECT_CALL_TO_ARMS → Lists eligible units from offer
 * 2. EFFECT_RESOLVE_CALL_TO_ARMS_UNIT → Lists abilities of selected unit
 * 3. EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY → Resolves the chosen ability
 *
 * Excluded: Magic Familiars and Delphana Masters (have no abilities).
 * The borrowed unit cannot receive damage (not in player's roster).
 *
 * @module effects/callToArmsEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ResolveCallToArmsUnitEffect,
  ResolveCallToArmsAbilityEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import type { UnitAbility } from "@mage-knight/shared";
import {
  UNITS,
  UNIT_MAGIC_FAMILIARS,
  UNIT_DELPHANA_MASTERS,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_EFFECT,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import type { UnitId } from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_CALL_TO_ARMS,
  EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
  EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import type { CardEffect } from "../../types/cards.js";
import { getUnitAbilityEffect } from "../../data/unitAbilityEffects.js";

// Units excluded from Call to Arms (no usable abilities)
const EXCLUDED_UNITS: readonly UnitId[] = [
  UNIT_MAGIC_FAMILIARS,
  UNIT_DELPHANA_MASTERS,
];

// Passive abilities that cannot be manually activated
const PASSIVE_ABILITIES = new Set([
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
]);

/**
 * Get eligible units from the offer for Call to Arms.
 * Excludes Magic Familiars, Delphana Masters, and units with no activatable abilities.
 */
function getEligibleUnits(state: GameState): UnitId[] {
  return state.offers.units.filter((unitId) => {
    if (EXCLUDED_UNITS.includes(unitId)) return false;
    const unitDef = UNITS[unitId];
    if (!unitDef) return false;
    // Must have at least one non-passive ability
    return unitDef.abilities.some((a) => !PASSIVE_ABILITIES.has(a.type));
  });
}

/**
 * Get activatable abilities for a unit (excluding passive abilities).
 */
function getActivatableAbilities(unitId: UnitId): { ability: UnitAbility; index: number }[] {
  const unitDef = UNITS[unitId];
  if (!unitDef) return [];
  return unitDef.abilities
    .map((ability, index) => ({ ability, index }))
    .filter(({ ability }) => !PASSIVE_ABILITIES.has(ability.type));
}

/**
 * Describe an ability for display in the choice options.
 */
function describeAbility(ability: UnitAbility, unitName: string): string {
  if (ability.displayName) return `${unitName}: ${ability.displayName}`;

  const elementStr = ability.element && ability.element !== ELEMENT_PHYSICAL
    ? ` ${ability.element.charAt(0).toUpperCase() + ability.element.slice(1)}`
    : "";
  const value = ability.value ?? 0;

  switch (ability.type) {
    case UNIT_ABILITY_ATTACK:
      return `${unitName}:${elementStr} Attack ${value}`;
    case UNIT_ABILITY_RANGED_ATTACK:
      return `${unitName}:${elementStr} Ranged Attack ${value}`;
    case UNIT_ABILITY_SIEGE_ATTACK:
      return `${unitName}:${elementStr} Siege Attack ${value}`;
    case UNIT_ABILITY_BLOCK:
      return `${unitName}:${elementStr} Block ${value}`;
    case UNIT_ABILITY_MOVE:
      return `${unitName}: Move ${value}`;
    case UNIT_ABILITY_INFLUENCE:
      return `${unitName}: Influence ${value}`;
    case UNIT_ABILITY_HEAL:
      return `${unitName}: Heal ${value}`;
    default:
      return `${unitName}: ${ability.type} ${value}`;
  }
}

/**
 * Convert a value-based unit ability to a CardEffect.
 */
function abilityToCardEffect(ability: UnitAbility): CardEffect | null {
  const value = ability.value ?? 0;
  switch (ability.type) {
    case UNIT_ABILITY_ATTACK:
      return {
        type: EFFECT_GAIN_ATTACK,
        amount: value,
        combatType: COMBAT_TYPE_MELEE,
        element: ability.element,
      };
    case UNIT_ABILITY_RANGED_ATTACK:
      return {
        type: EFFECT_GAIN_ATTACK,
        amount: value,
        combatType: COMBAT_TYPE_RANGED,
        element: ability.element,
      };
    case UNIT_ABILITY_SIEGE_ATTACK:
      return {
        type: EFFECT_GAIN_ATTACK,
        amount: value,
        combatType: COMBAT_TYPE_SIEGE,
        element: ability.element,
      };
    case UNIT_ABILITY_BLOCK:
      return {
        type: EFFECT_GAIN_BLOCK,
        amount: value,
        element: ability.element,
      };
    case UNIT_ABILITY_MOVE:
      return { type: EFFECT_GAIN_MOVE, amount: value };
    case UNIT_ABILITY_INFLUENCE:
      return { type: EFFECT_GAIN_INFLUENCE, amount: value };
    case UNIT_ABILITY_HEAL:
      return { type: EFFECT_GAIN_HEALING, amount: value };
    default:
      return null;
  }
}

// ============================================================================
// CALL TO ARMS ENTRY POINT
// ============================================================================

/**
 * Handle the EFFECT_CALL_TO_ARMS entry point.
 * Finds eligible units in the offer and generates choice options.
 */
function handleCallToArms(
  state: GameState,
  _playerIndex: number,
  _player: Player,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const eligibleUnits = getEligibleUnits(state);

  if (eligibleUnits.length === 0) {
    return {
      state,
      description: "No eligible units in the offer",
    };
  }

  // If only one unit available, go directly to ability selection
  if (eligibleUnits.length === 1) {
    const unitId = eligibleUnits[0]!;
    const unitDef = UNITS[unitId];
    return buildAbilityChoices(state, unitId, unitDef?.name ?? unitId, resolveEffect);
  }

  // Multiple units — generate choice options
  const choiceOptions: ResolveCallToArmsUnitEffect[] = eligibleUnits.map(
    (unitId) => {
      const unitDef = UNITS[unitId];
      return {
        type: EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
        unitId,
        unitName: unitDef?.name ?? unitId,
      };
    }
  );

  return {
    state,
    description: "Select a unit to borrow an ability from",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE UNIT SELECTION
// ============================================================================

/**
 * After selecting a unit, present its abilities as choices.
 */
function resolveCallToArmsUnit(
  state: GameState,
  _playerId: string,
  effect: ResolveCallToArmsUnitEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  return buildAbilityChoices(state, effect.unitId, effect.unitName, resolveEffect);
}

/**
 * Build ability choice options for the selected unit.
 */
function buildAbilityChoices(
  state: GameState,
  unitId: UnitId,
  unitName: string,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const activatable = getActivatableAbilities(unitId);

  if (activatable.length === 0) {
    return {
      state,
      description: `${unitName} has no activatable abilities`,
    };
  }

  // If only one ability, auto-resolve
  if (activatable.length === 1) {
    const { ability } = activatable[0]!;
    const description = describeAbility(ability, unitName);
    return resolveAbilityDirectly(state, unitName, ability, description, resolveEffect);
  }

  // Multiple abilities — generate choice options
  const choiceOptions: ResolveCallToArmsAbilityEffect[] = activatable.map(
    ({ ability, index }) => ({
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId,
      unitName,
      abilityIndex: index,
      abilityDescription: describeAbility(ability, unitName),
    })
  );

  return {
    state,
    description: `Select an ability to use from ${unitName}`,
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE ABILITY SELECTION
// ============================================================================

/**
 * Resolve the selected ability from the borrowed unit.
 */
function resolveCallToArmsAbility(
  state: GameState,
  playerId: string,
  effect: ResolveCallToArmsAbilityEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const unitDef = UNITS[effect.unitId];
  if (!unitDef) {
    return { state, description: `Unit ${effect.unitId} not found` };
  }

  const ability = unitDef.abilities[effect.abilityIndex];
  if (!ability) {
    return { state, description: `Invalid ability index: ${effect.abilityIndex}` };
  }

  return resolveAbilityDirectly(
    state,
    effect.unitName,
    ability,
    effect.abilityDescription,
    resolveEffect,
    playerId
  );
}

/**
 * Resolve a borrowed ability immediately.
 * For value-based abilities: converts to CardEffect and resolves via the main resolver.
 * For effect-based abilities: looks up the effect and resolves via the main resolver.
 */
function resolveAbilityDirectly(
  state: GameState,
  unitName: string,
  ability: UnitAbility,
  description: string,
  resolveEffect: EffectResolver,
  playerId?: string
): EffectResolutionResult {
  // Effect-based abilities (complex effects like Sorcerers, Thugs, etc.)
  if (ability.type === UNIT_ABILITY_EFFECT && ability.effectId) {
    const unitEffect = getUnitAbilityEffect(ability.effectId);
    if (!unitEffect) {
      return { state, description: `Effect not found: ${ability.effectId}` };
    }
    // Resolve the effect through the main resolver
    if (playerId) {
      const result = resolveEffect(state, playerId, unitEffect);
      return {
        ...result,
        resolvedEffect: unitEffect,
      };
    }
    // If no playerId, return the effect for deferred resolution
    return {
      state,
      description,
      resolvedEffect: unitEffect,
    };
  }

  // Value-based abilities (attack, block, move, influence, heal)
  const cardEffect = abilityToCardEffect(ability);
  if (!cardEffect) {
    return { state, description: `Unsupported ability type: ${ability.type}` };
  }

  // Resolve the effect through the main resolver
  if (playerId) {
    const result = resolveEffect(state, playerId, cardEffect);
    return {
      ...result,
      resolvedEffect: cardEffect,
    };
  }

  return {
    state,
    description: `Borrowed ${unitName}'s ability`,
    resolvedEffect: cardEffect,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Call to Arms effect handlers with the effect registry.
 */
export function registerCallToArmsEffects(resolver: EffectResolver): void {
  registerEffect(EFFECT_CALL_TO_ARMS, (state, playerId) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleCallToArms(state, playerIndex, player, resolver);
  });

  registerEffect(EFFECT_RESOLVE_CALL_TO_ARMS_UNIT, (state, playerId, effect) => {
    return resolveCallToArmsUnit(
      state,
      playerId,
      effect as ResolveCallToArmsUnitEffect,
      resolver
    );
  });

  registerEffect(EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY, (state, playerId, effect) => {
    return resolveCallToArmsAbility(
      state,
      playerId,
      effect as ResolveCallToArmsAbilityEffect,
      resolver
    );
  });
}
