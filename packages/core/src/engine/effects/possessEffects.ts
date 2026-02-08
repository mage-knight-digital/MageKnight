/**
 * Possess Enemy Effect Resolution (Charm/Possess spell powered effect)
 *
 * Handles the powered effect of the Charm spell:
 * - EFFECT_POSSESS_ENEMY: Entry point, finds eligible enemies (non-Arcane Immune), generates selection
 * - EFFECT_RESOLVE_POSSESS_ENEMY: Applies skip-attack modifier, grants player melee attack
 *   equal to enemy's attack value including elements, excluding special abilities.
 *   Adds a restriction modifier so the gained attack cannot target the possessed enemy.
 *
 * @module effects/possessEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { CardId, Element } from "@mage-knight/shared";
import {
  ABILITY_ARCANE_IMMUNITY,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import type {
  PossessEnemyEffect,
  ResolvePossessEnemyEffect,
  CardEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import {
  EFFECT_POSSESS_ENEMY,
  EFFECT_RESOLVE_POSSESS_ENEMY,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_POSSESS_ATTACK_RESTRICTION,
  SCOPE_ONE_ENEMY,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { getEnemyAttacks } from "../combat/enemyAttackHelpers.js";

// ============================================================================
// POSSESS ENEMY (Entry Point)
// ============================================================================

/**
 * Entry point for Possess effect. Finds eligible enemies (non-defeated,
 * non-Arcane Immune) and generates selection choices.
 */
function handlePossessEnemy(
  state: GameState,
  _playerId: string,
  _effect: PossessEnemyEffect
): EffectResolutionResult {
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  // Get eligible enemies: alive and not Arcane Immune
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    if (e.isDefeated) return false;
    if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    return true;
  });

  if (eligibleEnemies.length === 0) {
    return {
      state,
      description: "No valid enemy targets",
    };
  }

  // Generate choice options: one per eligible enemy
  const choiceOptions: CardEffect[] = eligibleEnemies.map((enemy) => ({
    type: EFFECT_RESOLVE_POSSESS_ENEMY,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
  } as ResolvePossessEnemyEffect));

  return {
    state,
    description: "Select an enemy to possess",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// Helper: Map enemy attack element to the effect's Element type
// ============================================================================

function mapAttackElement(attackElement: string): Element | undefined {
  switch (attackElement) {
    case "fire":
      return ELEMENT_FIRE;
    case "ice":
      return ELEMENT_ICE;
    case "cold_fire":
      return ELEMENT_COLD_FIRE;
    case "physical":
      return undefined; // Physical has no element in GainAttackEffect
    default:
      return undefined;
  }
}

// ============================================================================
// RESOLVE POSSESS ENEMY
// ============================================================================

/**
 * Resolve a selected enemy target for Possess.
 * 1. Applies SKIP_ATTACK modifier to the enemy
 * 2. Reads enemy's attack values (excluding special abilities)
 * 3. Grants the player melee Attack equal to the enemy's attack value (with element)
 * 4. Adds a PossessAttackRestriction modifier so the gained attack can't target this enemy
 */
function handleResolvePossessEnemy(
  state: GameState,
  playerId: string,
  effect: ResolvePossessEnemyEffect,
  sourceCardId?: string,
  resolver?: (state: GameState, playerId: string, effect: CardEffect, sourceCardId?: string) => EffectResolutionResult
): EffectResolutionResult {
  if (!state.combat) {
    return { state, description: "Not in combat" };
  }

  const enemy = state.combat.enemies.find(
    (e) => e.instanceId === effect.enemyInstanceId
  );
  if (!enemy) {
    return { state, description: "Enemy not found" };
  }

  let currentState = state;
  const descriptions: string[] = [];
  const cardId = (sourceCardId ?? "charm") as CardId;

  // 1. Apply SKIP_ATTACK modifier to the enemy
  currentState = addModifier(currentState, {
    source: {
      type: SOURCE_CARD,
      cardId,
      playerId,
    },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
    effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
    createdAtRound: currentState.round,
    createdByPlayerId: playerId,
  });
  descriptions.push(`${effect.enemyName} does not attack`);

  // 2. Read enemy's attack values (excluding special abilities)
  const attacks = getEnemyAttacks(enemy);
  let totalAttackAmount = 0;

  // 3. Grant melee attack for each of the enemy's attacks (excluding per-attack abilities)
  for (const atk of attacks) {
    if (atk.damage <= 0) continue;

    const element = mapAttackElement(atk.element);

    // Use the resolver to apply GainAttack effects
    if (resolver) {
      const gainAttackEffect: CardEffect = element
        ? { type: EFFECT_GAIN_ATTACK, amount: atk.damage, combatType: COMBAT_TYPE_MELEE, element }
        : { type: EFFECT_GAIN_ATTACK, amount: atk.damage, combatType: COMBAT_TYPE_MELEE };

      const attackResult = resolver(currentState, playerId, gainAttackEffect, sourceCardId);
      currentState = attackResult.state;

      const elementStr = element && element !== ELEMENT_PHYSICAL ? ` ${atk.element}` : "";
      descriptions.push(`Gained ${atk.damage}${elementStr} Attack from ${effect.enemyName}`);
    }

    totalAttackAmount += atk.damage;
  }

  // 4. Add possession restriction modifier so this attack can't target the possessed enemy
  if (totalAttackAmount > 0) {
    currentState = addModifier(currentState, {
      source: {
        type: SOURCE_CARD,
        cardId,
        playerId,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_POSSESS_ATTACK_RESTRICTION,
        possessedEnemyId: effect.enemyInstanceId,
        attackAmount: totalAttackAmount,
      },
      createdAtRound: currentState.round,
      createdByPlayerId: playerId,
    });
  }

  return {
    state: currentState,
    description: descriptions.join("; "),
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Possess enemy effect handlers with the effect registry.
 * Requires a resolver function for applying GainAttack effects.
 */
export function registerPossessEffects(
  resolver: (state: GameState, playerId: string, effect: CardEffect, sourceCardId?: string) => EffectResolutionResult
): void {
  registerEffect(EFFECT_POSSESS_ENEMY, (state, playerId, effect) => {
    return handlePossessEnemy(state, playerId, effect as PossessEnemyEffect);
  });

  registerEffect(EFFECT_RESOLVE_POSSESS_ENEMY, (state, playerId, effect, sourceCardId) => {
    return handleResolvePossessEnemy(
      state,
      playerId,
      effect as ResolvePossessEnemyEffect,
      sourceCardId,
      resolver
    );
  });
}
