/**
 * Shared combat blocking declaration rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy, PendingElementalDamage } from "../../types/combat.js";
import type { Element } from "@mage-knight/shared";
import { createEmptyPendingDamage } from "../../types/combat.js";
import { getFinalBlockValue } from "../combat/elementalCalc.js";
import {
  findFirstUnblockedAttack,
  getEnemyAttack,
  getEnemyAttackCount,
  getEffectiveEnemyAttackElement,
  isAttackBlocked,
  isAttackCancelled,
} from "../combat/enemyAttackHelpers.js";
import { doesEnemyAttackThisCombat, getEffectiveEnemyAttack, getNaturesVengeanceAttackBonus } from "../modifiers/index.js";
import { getCumbersomeReducedAttack } from "../combat/cumbersomeHelpers.js";
import { isSwiftActive } from "../combat/swiftHelpers.js";
import { getColdToughnessBlockBonus } from "../combat/coldToughnessHelpers.js";

function pendingBlockToSources(
  pending: PendingElementalDamage
): { element: Element; value: number }[] {
  const sources: { element: Element; value: number }[] = [];

  if (pending.physical > 0) sources.push({ element: "physical" as Element, value: pending.physical });
  if (pending.fire > 0) sources.push({ element: "fire" as Element, value: pending.fire });
  if (pending.ice > 0) sources.push({ element: "ice" as Element, value: pending.ice });
  if (pending.coldFire > 0) sources.push({ element: "cold_fire" as Element, value: pending.coldFire });

  return sources;
}

export interface BlockDeclarationStatus {
  readonly canDeclare: boolean;
  readonly attackIndex: number;
  readonly requiredBlock: number;
  readonly availableEffectiveBlock: number;
}

/**
 * Check if current pending block is sufficient to declare block against an enemy attack.
 */
export function getBlockDeclarationStatus(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy,
  attackIndex?: number
): BlockDeclarationStatus {
  const resolvedAttackIndex = attackIndex ?? findFirstUnblockedAttack(enemy);
  const noBlock: BlockDeclarationStatus = {
    canDeclare: false,
    attackIndex: resolvedAttackIndex,
    requiredBlock: 0,
    availableEffectiveBlock: 0,
  };

  if (!state.combat) return noBlock;
  if (resolvedAttackIndex < 0 || resolvedAttackIndex >= getEnemyAttackCount(enemy)) {
    return noBlock;
  }
  if (enemy.isDefeated || enemy.isSummonerHidden) return noBlock;
  if (isAttackBlocked(enemy, resolvedAttackIndex)) return noBlock;
  if (isAttackCancelled(enemy, resolvedAttackIndex)) return noBlock;
  if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) return noBlock;

  const swiftActive = isSwiftActive(state, playerId, enemy);
  const attack = getEnemyAttack(enemy, resolvedAttackIndex);
  const naturesVengeanceBonus = getNaturesVengeanceAttackBonus(state, playerId);
  const effectiveAttackBeforeCumbersome =
    getEffectiveEnemyAttack(
      state,
      enemy.instanceId,
      attack.damage,
      resolvedAttackIndex
    ) + naturesVengeanceBonus;
  const effectiveAttack = getCumbersomeReducedAttack(
    state,
    playerId,
    enemy,
    effectiveAttackBeforeCumbersome
  );

  if (effectiveAttack <= 0) {
    return {
      canDeclare: true,
      attackIndex: resolvedAttackIndex,
      requiredBlock: 0,
      availableEffectiveBlock: 0,
    };
  }

  const requiredBlock = swiftActive ? effectiveAttack * 2 : effectiveAttack;
  const pendingBlock =
    state.combat.pendingBlock[enemy.instanceId] ?? createEmptyPendingDamage();
  const pendingSwiftBlock =
    state.combat.pendingSwiftBlock[enemy.instanceId] ?? createEmptyPendingDamage();

  const baseSources = pendingBlockToSources(pendingBlock);
  const coldToughnessBonus = getColdToughnessBlockBonus(state, playerId, enemy);
  const sourcesWithBonus =
    coldToughnessBonus > 0
      ? [...baseSources, { element: "ice" as Element, value: coldToughnessBonus }]
      : baseSources;
  const sources = swiftActive
    ? [...sourcesWithBonus, ...pendingBlockToSources(pendingSwiftBlock)]
    : sourcesWithBonus;

  const effectiveElement = getEffectiveEnemyAttackElement(state, enemy, attack.element);
  const availableEffectiveBlock = getFinalBlockValue(
    sources,
    effectiveElement,
    state,
    playerId
  );

  return {
    canDeclare: availableEffectiveBlock >= requiredBlock,
    attackIndex: resolvedAttackIndex,
    requiredBlock,
    availableEffectiveBlock,
  };
}
