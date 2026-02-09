/**
 * Krang's Curse skill effects.
 *
 * Flow:
 * 1) EFFECT_KRANG_CURSE → choose an eligible enemy
 * 2) EFFECT_RESOLVE_KRANG_CURSE_TARGET → choose attack or armor reduction
 * 3) If multi-attack and attack reduction chosen:
 *    EFFECT_RESOLVE_KRANG_CURSE_ATTACK_INDEX → choose which attack to reduce
 */

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";
import type {
  KrangCurseEffect,
  ResolveKrangCurseTargetEffect,
  ResolveKrangCurseAttackIndexEffect,
  ApplyKrangCurseAttackEffect,
  ApplyKrangCurseArmorEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import {
  EFFECT_KRANG_CURSE,
  EFFECT_RESOLVE_KRANG_CURSE_TARGET,
  EFFECT_RESOLVE_KRANG_CURSE_ATTACK_INDEX,
  EFFECT_APPLY_KRANG_CURSE_ATTACK,
  EFFECT_APPLY_KRANG_CURSE_ARMOR,
} from "../../types/effectTypes.js";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";
import { getFortificationLevel } from "../rules/combatTargeting.js";
import {
  ABILITY_ARCANE_IMMUNITY,
} from "@mage-knight/shared";
import { getEnemyAttacks } from "../combat/enemyAttackHelpers.js";
import { addModifier } from "../modifiers/index.js";
import { SKILL_KRANG_CURSE } from "../../data/skills/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

function isEnemyVisibleToPlayer(state: GameState, playerId: string, enemyInstanceId: string): boolean {
  const combat = state.combat;
  if (!combat?.enemyAssignments) return true;
  const assigned = combat.enemyAssignments[playerId];
  return assigned ? assigned.includes(enemyInstanceId) : false;
}

function getEligibleCurseTargets(state: GameState, playerId: string) {
  const combat = state.combat;
  if (!combat) return [];

  return combat.enemies
    .filter((e) => !e.isDefeated)
    .filter((e) => isEnemyVisibleToPlayer(state, playerId, e.instanceId))
    .filter((e) => {
      if (combat.phase !== COMBAT_PHASE_RANGED_SIEGE) return true;
      const fortLevel = getFortificationLevel(e, combat.isAtFortifiedSite, state, playerId);
      return fortLevel === 0;
    });
}

export function canActivateKrangCurse(state: GameState, playerId: string): boolean {
  return getEligibleCurseTargets(state, playerId).length > 0;
}

function resolveKrangCurse(
  state: GameState,
  playerId: string,
  _effect: KrangCurseEffect
): EffectResolutionResult {
  if (!state.combat) {
    return { state, description: "Not in combat" };
  }

  const eligibleEnemies = getEligibleCurseTargets(state, playerId);
  if (eligibleEnemies.length === 0) {
    return { state, description: "No valid enemy targets" };
  }

  const options: CardEffect[] = eligibleEnemies.map((enemy) => ({
    type: EFFECT_RESOLVE_KRANG_CURSE_TARGET,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
  } as ResolveKrangCurseTargetEffect));

  return {
    state,
    description: "Select an enemy to curse",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

function resolveKrangCurseTarget(
  state: GameState,
  playerId: string,
  effect: ResolveKrangCurseTargetEffect
): EffectResolutionResult {
  const combat = state.combat;
  if (!combat) {
    return { state, description: "Not in combat" };
  }

  if (!isEnemyVisibleToPlayer(state, playerId, effect.enemyInstanceId)) {
    return { state, description: "Enemy not targetable" };
  }

  const enemy = combat.enemies.find((e) => e.instanceId === effect.enemyInstanceId);
  if (!enemy || enemy.isDefeated) {
    return { state, description: "Enemy not found" };
  }

  if (combat.phase === COMBAT_PHASE_RANGED_SIEGE) {
    const fortLevel = getFortificationLevel(enemy, combat.isAtFortifiedSite, state, playerId);
    if (fortLevel > 0) {
      return { state, description: "Enemy is fortified (cannot be cursed in Ranged/Siege)" };
    }
  }

  const hasArcaneImmunity = enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY);
  const attacks = getEnemyAttacks(enemy);

  const options: CardEffect[] = [];

  // Attack reduction (works vs Arcane Immunity; affects only one attack for multi-attack enemies)
  if (attacks.length > 1) {
    options.push({
      type: EFFECT_RESOLVE_KRANG_CURSE_ATTACK_INDEX,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
    } as ResolveKrangCurseAttackIndexEffect);
  } else {
    options.push({
      type: EFFECT_APPLY_KRANG_CURSE_ATTACK,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      description: "Reduce enemy attack by 2 (min 0)",
    } as ApplyKrangCurseAttackEffect);
  }

  // Armor reduction (blocked by Arcane Immunity)
  if (!hasArcaneImmunity) {
    options.push({
      type: EFFECT_APPLY_KRANG_CURSE_ARMOR,
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      description: "Reduce enemy armor by 1 (min 1)",
    } as ApplyKrangCurseArmorEffect);
  }

  return {
    state,
    description: `Choose a curse for ${effect.enemyName}`,
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

function resolveKrangCurseAttackIndex(
  state: GameState,
  playerId: string,
  effect: ResolveKrangCurseAttackIndexEffect
): EffectResolutionResult {
  const combat = state.combat;
  if (!combat) {
    return { state, description: "Not in combat" };
  }

  if (!isEnemyVisibleToPlayer(state, playerId, effect.enemyInstanceId)) {
    return { state, description: "Enemy not targetable" };
  }

  const enemy = combat.enemies.find((e) => e.instanceId === effect.enemyInstanceId);
  if (!enemy || enemy.isDefeated) {
    return { state, description: "Enemy not found" };
  }

  const attacks = getEnemyAttacks(enemy);
  if (attacks.length <= 1) {
    return {
      state,
      description: "Enemy has only one attack",
    };
  }

  const options: CardEffect[] = attacks.map((attack, attackIndex) => ({
    type: EFFECT_APPLY_KRANG_CURSE_ATTACK,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    attackIndex,
    description: `Reduce attack ${attackIndex + 1} by 2 (min 0): ${attack.damage} ${attack.element}`,
  } as ApplyKrangCurseAttackEffect));

  return {
    state,
    description: `Select which attack to reduce for ${effect.enemyName}`,
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

function resolveApplyKrangCurseAttack(
  state: GameState,
  playerId: string,
  effect: ApplyKrangCurseAttackEffect
): EffectResolutionResult {
  const combat = state.combat;
  if (!combat) return { state, description: "Not in combat" };
  if (!isEnemyVisibleToPlayer(state, playerId, effect.enemyInstanceId)) {
    return { state, description: "Enemy not targetable" };
  }

  const enemy = combat.enemies.find((e) => e.instanceId === effect.enemyInstanceId);
  if (!enemy || enemy.isDefeated) {
    return { state, description: "Enemy not found" };
  }

  if (combat.phase === COMBAT_PHASE_RANGED_SIEGE) {
    const fortLevel = getFortificationLevel(enemy, combat.isAtFortifiedSite, state, playerId);
    if (fortLevel > 0) {
      return { state, description: "Enemy is fortified (cannot be cursed in Ranged/Siege)" };
    }
  }

  const newState = addModifier(state, {
    source: { type: SOURCE_SKILL, skillId: SKILL_KRANG_CURSE, playerId },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: enemy.instanceId },
    effect: {
      type: EFFECT_ENEMY_STAT,
      stat: ENEMY_STAT_ATTACK,
      amount: -2,
      minimum: 0,
      ...(effect.attackIndex !== undefined ? { attackIndex: effect.attackIndex } : {}),
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return { state: newState, description: effect.description };
}

function resolveApplyKrangCurseArmor(
  state: GameState,
  playerId: string,
  effect: ApplyKrangCurseArmorEffect
): EffectResolutionResult {
  const combat = state.combat;
  if (!combat) return { state, description: "Not in combat" };
  if (!isEnemyVisibleToPlayer(state, playerId, effect.enemyInstanceId)) {
    return { state, description: "Enemy not targetable" };
  }

  const enemy = combat.enemies.find((e) => e.instanceId === effect.enemyInstanceId);
  if (!enemy || enemy.isDefeated) {
    return { state, description: "Enemy not found" };
  }

  if (combat.phase === COMBAT_PHASE_RANGED_SIEGE) {
    const fortLevel = getFortificationLevel(enemy, combat.isAtFortifiedSite, state, playerId);
    if (fortLevel > 0) {
      return { state, description: "Enemy is fortified (cannot be cursed in Ranged/Siege)" };
    }
  }

  if (enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) {
    return { state, description: `${enemy.definition.name} has Arcane Immunity (armor curse blocked)` };
  }

  const newState = addModifier(state, {
    source: { type: SOURCE_SKILL, skillId: SKILL_KRANG_CURSE, playerId },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: enemy.instanceId },
    effect: {
      type: EFFECT_ENEMY_STAT,
      stat: ENEMY_STAT_ARMOR,
      amount: -1,
      minimum: 1,
    },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return { state: newState, description: effect.description };
}

export function registerKrangCurseEffects(): void {
  registerEffect(EFFECT_KRANG_CURSE, (state, playerId, effect) => {
    return resolveKrangCurse(state, playerId, effect as KrangCurseEffect);
  });

  registerEffect(EFFECT_RESOLVE_KRANG_CURSE_TARGET, (state, playerId, effect) => {
    return resolveKrangCurseTarget(state, playerId, effect as ResolveKrangCurseTargetEffect);
  });

  registerEffect(EFFECT_RESOLVE_KRANG_CURSE_ATTACK_INDEX, (state, playerId, effect) => {
    return resolveKrangCurseAttackIndex(state, playerId, effect as ResolveKrangCurseAttackIndexEffect);
  });

  registerEffect(EFFECT_APPLY_KRANG_CURSE_ATTACK, (state, playerId, effect) => {
    return resolveApplyKrangCurseAttack(state, playerId, effect as ApplyKrangCurseAttackEffect);
  });

  registerEffect(EFFECT_APPLY_KRANG_CURSE_ARMOR, (state, playerId, effect) => {
    return resolveApplyKrangCurseArmor(state, playerId, effect as ApplyKrangCurseArmorEffect);
  });
}
