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
import { getFortificationLevel } from "../rules/combatTargeting.js";
import type {
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  CardEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { EFFECT_SELECT_COMBAT_ENEMY, EFFECT_RESOLVE_COMBAT_ENEMY_TARGET, EFFECT_NOOP } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_DEFEAT_IF_BLOCKED,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

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
  effect: SelectCombatEnemyEffect,
  playerId?: string,
  alreadyTargeted?: readonly string[]
): EffectResolutionResult {
  // Entry effect for selecting an enemy in combat
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  // Get eligible enemies
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    if (!effect.includeDefeated && e.isDefeated) return false;

    // Filter out already-targeted enemies (multi-target mode)
    if (alreadyTargeted && alreadyTargeted.includes(e.instanceId)) return false;

    // Filter out fortified enemies if requested (checks effective fortification after modifiers)
    if (effect.excludeFortified && playerId) {
      const fortLevel = getFortificationLevel(
        e,
        state.combat!.isAtFortifiedSite,
        state,
        playerId
      );
      if (fortLevel > 0) return false;
    }

    // Filter out Arcane Immune enemies if requested
    if (effect.excludeArcaneImmune) {
      if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    }

    // Filter out enemies with a specific resistance type
    if (effect.excludeResistance) {
      if (e.definition.resistances.includes(effect.excludeResistance)) return false;
    }

    return true;
  });

  if (eligibleEnemies.length === 0) {
    return {
      state,
      description: "No valid enemy targets",
    };
  }

  const maxTargets = effect.maxTargets ?? 1;
  const targetsSoFar = alreadyTargeted?.length ?? 0;
  const remaining = maxTargets - targetsSoFar - 1; // -1 because current selection counts

  // Generate choice options - one per eligible enemy
  const choiceOptions: CardEffect[] = eligibleEnemies.map(
    (enemy) => ({
      type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      template: effect.template,
      // Multi-target tracking
      ...(maxTargets > 1 && {
        multiTargetSource: effect,
        remainingTargets: remaining,
        alreadyTargeted: alreadyTargeted ?? [],
      }),
    } as ResolveCombatEnemyTargetEffect)
  );

  // In multi-target mode with at least one target already selected, add "done" option
  if (maxTargets > 1 && targetsSoFar > 0) {
    choiceOptions.push({ type: EFFECT_NOOP } as CardEffect);
  }

  return {
    state,
    description: maxTargets > 1
      ? `Select an enemy to target (${targetsSoFar}/${maxTargets} selected)`
      : "Select an enemy to target",
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

  // Check for Arcane Immunity - if enemy has it, modifiers cannot be applied
  // Note: Arcane Immunity blocks non-Attack/non-Block effects, but the Ranged Attack
  // portion of Expose can still target them. Only the modifier effects are blocked.
  const hasArcaneImmunity = enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY);

  let currentState = state;
  const descriptions: string[] = [];

  // Apply modifiers from template (blocked by Arcane Immunity)
  if (effect.template.modifiers) {
    if (hasArcaneImmunity) {
      // Arcane Immunity blocks non-Attack/Block effects
      descriptions.push(`${effect.enemyName} has Arcane Immunity (modifiers blocked)`);
    } else {
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
  }

  // Handle defeat (blocked by Arcane Immunity - instant kill is a magic effect targeting the enemy)
  if (effect.template.defeat && currentState.combat) {
    if (hasArcaneImmunity) {
      descriptions.push(`${effect.enemyName} has Arcane Immunity (defeat blocked)`);
    } else {
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
  }

  // Handle defeatIfBlocked (Delphana Masters' red mana ability)
  // Applies a modifier that marks the enemy for defeat if fully blocked.
  // Blocked by Arcane Immunity (magical effect targeting enemy).
  if (effect.template.defeatIfBlocked && currentState.combat) {
    if (hasArcaneImmunity) {
      descriptions.push(`${effect.enemyName} has Arcane Immunity (defeat-if-blocked blocked)`);
    } else {
      currentState = addModifier(currentState, {
        source: {
          type: SOURCE_CARD,
          cardId: (sourceCardId ?? "unknown") as CardId,
          playerId,
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
        effect: { type: EFFECT_DEFEAT_IF_BLOCKED },
        createdAtRound: currentState.round,
        createdByPlayerId: playerId,
      });
      descriptions.push(`${effect.enemyName} will be destroyed if fully blocked`);
    }
  }

  // Handle damage redirect (Shocktroops' Taunt)
  // NOT blocked by Arcane Immunity - it's a defensive ability on the player's side
  if (effect.template.setDamageRedirectFromUnit && currentState.combat) {
    const unitInstanceId = effect.template.setDamageRedirectFromUnit;
    currentState = {
      ...currentState,
      combat: {
        ...currentState.combat,
        damageRedirects: {
          ...currentState.combat.damageRedirects,
          [effect.enemyInstanceId]: unitInstanceId,
        },
      },
    };
    descriptions.push(`Damage from ${effect.enemyName} redirected to unit`);
  }

  return {
    state: currentState,
    description: descriptions.join("; ") || `Targeted ${effect.enemyName}`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Type for effect resolver function passed during registration.
 */
type EffectResolver = (
  state: GameState,
  playerId: string,
  effect: import("../../types/cards.js").CardEffect,
  sourceCardId?: string
) => EffectResolutionResult;

/**
 * Register all combat enemy targeting effect handlers with the effect registry.
 * Called during effect system initialization.
 *
 * @param resolver - Optional resolver function for bundled effects (required for bundledEffect support)
 */
export function registerCombatEffects(resolver?: EffectResolver): void {
  registerEffect(EFFECT_SELECT_COMBAT_ENEMY, (state, playerId, effect) => {
    return resolveSelectCombatEnemy(state, effect as SelectCombatEnemyEffect, playerId);
  });

  registerEffect(EFFECT_RESOLVE_COMBAT_ENEMY_TARGET, (state, playerId, effect, sourceCardId) => {
    const typedEffect = effect as ResolveCombatEnemyTargetEffect;

    // First resolve the base target (modifiers/defeat)
    const baseResult = resolveCombatEnemyTarget(state, playerId, typedEffect, sourceCardId);

    // If there's a bundled effect and we have a resolver, resolve it too
    // Bundled effects (like ranged attack) are NOT blocked by Arcane Immunity
    if (typedEffect.template.bundledEffect && resolver) {
      const bundledResult = resolver(
        baseResult.state,
        playerId,
        typedEffect.template.bundledEffect,
        sourceCardId
      );
      return {
        state: bundledResult.state,
        description: [baseResult.description, bundledResult.description].filter(Boolean).join("; "),
      };
    }

    // Multi-target: if more targets can be selected, re-enter selection
    if (typedEffect.multiTargetSource && typedEffect.remainingTargets !== undefined && typedEffect.remainingTargets > 0) {
      const updatedAlreadyTargeted = [
        ...(typedEffect.alreadyTargeted ?? []),
        typedEffect.enemyInstanceId,
      ];
      const continuationResult = resolveSelectCombatEnemy(
        baseResult.state,
        typedEffect.multiTargetSource,
        playerId,
        updatedAlreadyTargeted
      );

      // If no more eligible targets, just return the base result
      if (!continuationResult.requiresChoice) {
        return baseResult;
      }

      return {
        state: continuationResult.state,
        description: baseResult.description,
        requiresChoice: continuationResult.requiresChoice,
        dynamicChoiceOptions: continuationResult.dynamicChoiceOptions,
      };
    }

    return baseResult;
  });
}
