/**
 * Possess Effect Resolution (Charm/Possess White Spell Powered Effect)
 *
 * Handles the Possess powered effect:
 * 1. EFFECT_POSSESS: Entry point - select an enemy to possess (excludes Arcane Immune)
 * 2. EFFECT_RESOLVE_POSSESS_TARGET: Apply skip attack modifier and grant enemy's attack value
 *
 * @module effects/possessEffects
 *
 * @remarks Possess Mechanics
 * - Target enemy does not attack this combat (skip attack modifier)
 * - Player gains Attack equal to enemy's attack value (including elements)
 * - Special abilities are excluded (Brutal, Poisonous, Paralyze, etc.)
 * - Gained attack can only target OTHER enemies (not the possessed one)
 * - If solo enemy: skip attack applies but no attack gained (no other targets)
 * - Cannot target Arcane Immune enemies
 */

import type { GameState } from "../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import { ABILITY_ARCANE_IMMUNITY, ELEMENT_PHYSICAL } from "@mage-knight/shared";
import type {
  ResolvePossessTargetEffect,
  CardEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import {
  EFFECT_POSSESS,
  EFFECT_RESOLVE_POSSESS_TARGET,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";
import { getEnemyAttacks } from "../combat/enemyAttackHelpers.js";

// ============================================================================
// POSSESS (Entry Point)
// ============================================================================

/**
 * Entry point for the Possess effect — finds eligible enemies and generates selection.
 *
 * Filters out:
 * - Defeated enemies
 * - Arcane Immune enemies (cannot be possessed)
 *
 * @param state - Current game state
 * @returns Choice options for enemy selection
 */
function handlePossess(
  state: GameState,
): EffectResolutionResult {
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  // Filter eligible enemies (not defeated, not Arcane Immune)
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    if (e.isDefeated) return false;
    if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    return true;
  });

  if (eligibleEnemies.length === 0) {
    return {
      state,
      description: "No valid enemy targets (all are Arcane Immune or defeated)",
    };
  }

  // Generate choice options — one per eligible enemy
  const choiceOptions: CardEffect[] = eligibleEnemies.map(
    (enemy) =>
      ({
        type: EFFECT_RESOLVE_POSSESS_TARGET,
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
      }) as ResolvePossessTargetEffect,
  );

  return {
    state,
    description: "Select an enemy to possess",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE POSSESS TARGET
// ============================================================================

/**
 * Resolves the selected enemy target for Possess:
 * 1. Apply "enemy skip attack" modifier
 * 2. If other (non-defeated) enemies exist, grant attack equal to enemy's attack value
 * 3. If solo enemy, only skip attack applies (no attack gained)
 *
 * Elements are preserved (fire attack → fire attack, ice → ice, etc.).
 * Special abilities are NOT copied — only raw damage + element.
 */
function handleResolvePossessTarget(
  state: GameState,
  playerId: string,
  effect: ResolvePossessTargetEffect,
  sourceCardId: string | undefined,
  resolver: EffectResolver,
): EffectResolutionResult {
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  const enemy = state.combat.enemies.find(
    (e) => e.instanceId === effect.enemyInstanceId,
  );
  if (!enemy) {
    return {
      state,
      description: "Enemy not found",
    };
  }

  let currentState = state;
  const descriptions: string[] = [];

  // 1. Apply skip attack modifier to the possessed enemy
  currentState = addModifier(currentState, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "unknown") as CardId,
      playerId,
    },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
    effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
    createdAtRound: currentState.round,
    createdByPlayerId: playerId,
  });
  descriptions.push(`${effect.enemyName} does not attack`);

  // 2. Check if there are other (non-possessed, non-defeated) enemies
  const otherEnemies = currentState.combat!.enemies.filter(
    (e) => e.instanceId !== effect.enemyInstanceId && !e.isDefeated,
  );

  if (otherEnemies.length === 0) {
    // Solo enemy: only prevent attack, no attack gained
    descriptions.push("No other enemies — no attack gained");
    return {
      state: currentState,
      description: descriptions.join("; "),
    };
  }

  // 3. Read enemy's attack(s) and grant them as melee attacks
  // Special abilities are excluded — only damage value + element are copied
  const attacks = getEnemyAttacks(enemy);
  for (const atk of attacks) {
    if (atk.damage > 0) {
      const gainAttackEffect: CardEffect =
        atk.element !== ELEMENT_PHYSICAL
          ? {
              type: EFFECT_GAIN_ATTACK,
              amount: atk.damage,
              combatType: COMBAT_TYPE_MELEE,
              element: atk.element,
            }
          : {
              type: EFFECT_GAIN_ATTACK,
              amount: atk.damage,
              combatType: COMBAT_TYPE_MELEE,
            };

      const result = resolver(
        currentState,
        playerId,
        gainAttackEffect,
        sourceCardId,
      );
      currentState = result.state;

      const elementName =
        atk.element !== ELEMENT_PHYSICAL ? ` ${atk.element}` : "";
      descriptions.push(
        `Gained${elementName} Attack ${atk.damage} from ${effect.enemyName}`,
      );
    }
  }

  return {
    state: currentState,
    description: descriptions.join("; "),
  };
}

// ============================================================================
// TYPES
// ============================================================================

type EffectResolver = (
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string,
) => EffectResolutionResult;

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Possess effect handlers with the effect registry.
 * Called during effect system initialization.
 *
 * @param resolver - The main resolveEffect function for recursive resolution
 */
export function registerPossessEffects(resolver: EffectResolver): void {
  registerEffect(EFFECT_POSSESS, (state) => {
    return handlePossess(state);
  });

  registerEffect(
    EFFECT_RESOLVE_POSSESS_TARGET,
    (state, playerId, effect, sourceCardId) => {
      return handleResolvePossessTarget(
        state,
        playerId,
        effect as ResolvePossessTargetEffect,
        sourceCardId,
        resolver,
      );
    },
  );
}
