/**
 * Combat Enemy Targeting Effect Resolution
 *
 * Handles effects that target specific enemies in combat:
 * - EFFECT_SELECT_COMBAT_ENEMY: Entry point, generates enemy selection choices
 * - EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: Applies template to selected enemy
 *
 * @module effects/combatEffects
 *
 * @remarks Combat Targeting Overview
 * - Used by spells like Tremor, Chill, Whirlwind, Tornado
 * - Player selects an enemy from combat
 * - Selected enemy receives modifiers and/or is defeated
 * - Templates define what happens to the target (modifiers, defeat)
 *
 * @example Resolution Flow
 * ```
 * SELECT_COMBAT_ENEMY (template: {modifiers: [...], defeat: false})
 *   └─► Find eligible enemies in combat
 *       └─► Generate RESOLVE_COMBAT_ENEMY_TARGET options
 *           └─► Player selects an enemy
 *               └─► RESOLVE_COMBAT_ENEMY_TARGET
 *                   ├─► Apply modifiers to enemy
 *                   └─► If defeat=true, mark defeated and award fame
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import { ABILITY_ARCANE_IMMUNITY } from "@mage-knight/shared";
import type {
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  CombatEnemyTargetTemplate,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CombatEnemy } from "../../types/combat.js";
import { EFFECT_RESOLVE_COMBAT_ENEMY_TARGET } from "../../types/effectTypes.js";
import { addModifier } from "../modifiers.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../modifierConstants.js";

// ============================================================================
// ARCANE IMMUNITY HELPERS
// ============================================================================

/**
 * Check if an enemy has Arcane Immunity ability.
 */
function hasArcaneImmunity(enemy: CombatEnemy): boolean {
  return enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY);
}

/**
 * Check if a combat enemy target template contains restricted effects.
 * Arcane Immunity blocks non-Attack/Block effects, which includes:
 * - Modifiers that change enemy stats (armor/attack reduction)
 * - Modifiers that prevent enemy from attacking
 * - Direct defeat effects
 *
 * Attack and Block effects target the player's values, not the enemy,
 * so they are allowed.
 */
function templateHasRestrictedEffects(template: CombatEnemyTargetTemplate): boolean {
  // Modifiers to enemy stats are restricted
  if (template.modifiers && template.modifiers.length > 0) {
    return true;
  }
  // Direct defeat is restricted
  if (template.defeat) {
    return true;
  }
  return false;
}

// ============================================================================
// SELECT COMBAT ENEMY (Entry Point)
// ============================================================================

/**
 * Entry point for combat enemy targeting - finds eligible enemies and generates selection.
 *
 * Scans combat state for eligible enemies based on effect parameters:
 * - includeDefeated: whether to include already-defeated enemies
 * - requiredPhase: limit to specific combat phase (e.g., Tornado = Attack only)
 *
 * Generates RESOLVE_COMBAT_ENEMY_TARGET choice options for each eligible enemy.
 *
 * @param state - Current game state
 * @param effect - The select combat enemy effect with template
 * @returns Choice options for enemy selection, or error if not in combat
 *
 * @example
 * ```typescript
 * // Combat has Orc (alive) and Skeleton (defeated)
 * // includeDefeated=false → only Orc is an option
 * // includeDefeated=true → both are options
 * ```
 */
export function resolveSelectCombatEnemy(
  state: GameState,
  effect: SelectCombatEnemyEffect
): EffectResolutionResult {
  // Entry effect for selecting an enemy in combat
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  // Check if this effect has restricted components (modifiers/defeat)
  const hasRestrictedEffects = templateHasRestrictedEffects(effect.template);

  // Get eligible enemies
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    // Filter by defeated status
    if (!effect.includeDefeated && e.isDefeated) {
      return false;
    }

    // Filter out Arcane Immune enemies if effect has restricted components
    // Per rulebook: "The enemy is not affected by any non-Attack/non-Block effects"
    if (hasRestrictedEffects && hasArcaneImmunity(e)) {
      return false;
    }

    return true;
  });

  if (eligibleEnemies.length === 0) {
    // Check if all enemies are immune
    const allEnemiesImmune = state.combat.enemies.every(
      (e) => e.isDefeated || (hasRestrictedEffects && hasArcaneImmunity(e))
    );

    if (allEnemiesImmune && hasRestrictedEffects) {
      return {
        state,
        description: "All enemies are immune to this effect (Arcane Immunity)",
      };
    }

    return {
      state,
      description: "No valid enemy targets",
    };
  }

  // Generate choice options - one per eligible enemy
  const choiceOptions: ResolveCombatEnemyTargetEffect[] = eligibleEnemies.map(
    (enemy) => ({
      type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      template: effect.template,
    })
  );

  return {
    state,
    description: "Select an enemy to target",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE COMBAT ENEMY TARGET
// ============================================================================

/**
 * Resolves the selected enemy target - applies template effects.
 *
 * Applies the template to the targeted enemy:
 * 1. Adds any modifiers from the template (with enemy scope)
 * 2. If defeat=true, marks enemy as defeated and awards fame
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The resolve combat enemy target effect with template
 * @param sourceCardId - Optional ID of the source card (for modifier tracking)
 * @returns Updated state with modifiers applied and/or enemy defeated
 *
 * @remarks Modifier Scope
 * Modifiers from templates are scoped to the specific enemy (SCOPE_ONE_ENEMY).
 * They typically last for the duration of combat (DURATION_COMBAT).
 *
 * @example
 * ```typescript
 * // Template: { modifiers: [{ modifier: reduceArmor, duration: combat }] }
 * // Result: Enemy gets armor reduction modifier until combat ends
 *
 * // Template: { defeat: true }
 * // Result: Enemy marked defeated, player gains fame
 * ```
 */
export function resolveCombatEnemyTarget(
  state: GameState,
  playerId: string,
  effect: ResolveCombatEnemyTargetEffect,
  sourceCardId?: string
): EffectResolutionResult {
  // Apply the template to the targeted enemy
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  const enemyIndex = state.combat.enemies.findIndex(
    (e) => e.instanceId === effect.enemyInstanceId
  );
  if (enemyIndex === -1) {
    return {
      state,
      description: "Enemy not found",
    };
  }

  const enemy = state.combat.enemies[enemyIndex];
  if (!enemy) {
    return {
      state,
      description: "Enemy not found at index",
    };
  }

  // Check Arcane Immunity - safety net in case enemy was selected manually
  // Per rulebook: "The enemy is not affected by any non-Attack/non-Block effects"
  if (hasArcaneImmunity(enemy) && templateHasRestrictedEffects(effect.template)) {
    return {
      state,
      description: `${effect.enemyName} is immune to this effect (Arcane Immunity)`,
    };
  }

  let currentState = state;
  const descriptions: string[] = [];

  // Apply modifiers from template
  if (effect.template.modifiers) {
    for (const mod of effect.template.modifiers) {
      currentState = addModifier(currentState, {
        source: {
          type: SOURCE_CARD,
          cardId: (sourceCardId ?? "unknown") as CardId,
          playerId,
        },
        duration: mod.duration ?? DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
        effect: mod.modifier,
        createdAtRound: currentState.round,
        createdByPlayerId: playerId,
      });
      if (mod.description) {
        descriptions.push(mod.description);
      }
    }
  }

  // Handle defeat
  if (effect.template.defeat && currentState.combat) {
    // Mark enemy defeated, award fame
    const updatedEnemies = currentState.combat.enemies.map((e, i) =>
      i === enemyIndex ? { ...e, isDefeated: true } : e
    );

    const fameValue = enemy.definition.fame;
    const currentPlayer = currentState.players.find((p) => p.id === playerId);
    const newFame = currentPlayer ? currentPlayer.fame + fameValue : fameValue;

    currentState = {
      ...currentState,
      combat: {
        ...currentState.combat,
        enemies: updatedEnemies,
        fameGained: currentState.combat.fameGained + fameValue,
      },
      players: currentState.players.map((p) =>
        p.id === playerId ? { ...p, fame: newFame } : p
      ),
    };
    descriptions.push(`Defeated ${effect.enemyName} (+${fameValue} fame)`);
  }

  return {
    state: currentState,
    description: descriptions.join("; ") || `Targeted ${effect.enemyName}`,
  };
}
