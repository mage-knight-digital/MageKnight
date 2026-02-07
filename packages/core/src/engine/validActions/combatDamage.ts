/**
 * Combat damage assignment options computation for ValidActions.
 *
 * Handles damage assignment computation for the ASSIGN_DAMAGE phase.
 */

import type {
  DamageAssignmentOption,
  UnitDamageTarget,
} from "@mage-knight/shared";
import type { Element } from "@mage-knight/shared";
import {
  ABILITY_BRUTAL,
  getUnit,
} from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { isBondsUnit } from "../rules/bondsOfLoyalty.js";
import { getEffectiveUnitArmor } from "../rules/banners.js";
import { getUnitArmorBonus } from "../modifiers/index.js";
import {
  getEffectiveEnemyAttack,
  doesEnemyAttackThisCombat,
} from "../modifiers/index.js";
import { isAttackResisted } from "../combat/elementalCalc.js";
import { isAssassinationActive, getDamageRedirectUnit, cannotAssignDamageToUnits } from "../rules/combatTargeting.js";
import {
  getEnemyAttack,
  getEnemyAttacks,
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
  isEnemyFullyDamageAssigned,
} from "../combat/enemyAttackHelpers.js";

// ============================================================================
// Unit Damage Target Computation
// ============================================================================

/**
 * Compute available unit targets for damage assignment.
 *
 * Rules:
 * - Only unwounded units can be assigned damage
 * - Units that already had damage assigned this combat cannot be assigned again
 *   (even if they weren't wounded due to resistance)
 * - Units not present in combat (dungeons/tombs/mazes) are excluded
 * - Thugs units require 2 Influence payment before damage can be assigned
 *
 * @param player - Player whose units to check
 * @param attackElement - Element of the enemy's attack
 * @param unitsAllowed - Whether units are allowed in this combat
 * @param paidThugsDamageInfluence - Map of unit instance IDs that have had Thugs influence paid
 */
export function computeAvailableUnitTargets(
  player: Player,
  attackElement: Element,
  unitsAllowed: boolean,
  paidThugsDamageInfluence?: Readonly<Record<string, boolean>>,
  state?: GameState,
  playerId?: string
): readonly UnitDamageTarget[] {
  const modifierArmorBonus = (state && playerId) ? getUnitArmorBonus(state, playerId) : 0;
  // If units are not allowed in this combat (dungeon/tomb), only Bonds unit can be targeted
  if (!unitsAllowed) {
    const bondsUnits = player.units.filter((u) => isBondsUnit(player, u.instanceId));
    if (bondsUnits.length === 0) return [];
    return bondsUnits.map((unit) => {
      const unitDef = getUnit(unit.unitId);
      const resistances = unitDef.resistances;
      const isResistantToAttack = isAttackResisted(attackElement, resistances);
      const requiresInfluencePayment = (unitDef.damageInfluenceCost ?? 0) > 0;
      const influencePaymentMade = paidThugsDamageInfluence?.[unit.instanceId] ?? false;
      const canBeAssigned = !unit.wounded && !unit.usedResistanceThisCombat
        && (!requiresInfluencePayment || influencePaymentMade);

      const base: UnitDamageTarget = {
        unitInstanceId: unit.instanceId,
        unitId: unit.unitId,
        unitName: unitDef.name,
        armor: getEffectiveUnitArmor(player, unit) + modifierArmorBonus,
        isResistantToAttack,
        alreadyAssignedThisCombat: unit.usedResistanceThisCombat,
        isWounded: unit.wounded,
        canBeAssigned,
      };

      if (requiresInfluencePayment) {
        return { ...base, requiresInfluencePayment: true, influencePaymentMade };
      }
      return base;
    });
  }

  return player.units.map((unit) => {
    const unitDef = getUnit(unit.unitId);
    const resistances = unitDef.resistances;

    // Check if unit is resistant to this attack element
    const isResistantToAttack = isAttackResisted(attackElement, resistances);

    // Check if this is a Thugs unit requiring influence payment
    const requiresInfluencePayment = (unitDef.damageInfluenceCost ?? 0) > 0;
    const influencePaymentMade = paidThugsDamageInfluence?.[unit.instanceId] ?? false;

    // Unit can be assigned if not wounded AND hasn't been assigned this combat
    // AND if Thugs, influence must have been paid
    const canBeAssigned = !unit.wounded && !unit.usedResistanceThisCombat
      && (!requiresInfluencePayment || influencePaymentMade);

    const base: UnitDamageTarget = {
      unitInstanceId: unit.instanceId,
      unitId: unit.unitId,
      unitName: unitDef.name,
      armor: getEffectiveUnitArmor(player, unit) + modifierArmorBonus,
      isResistantToAttack,
      alreadyAssignedThisCombat: unit.usedResistanceThisCombat,
      isWounded: unit.wounded,
      canBeAssigned,
    };

    // Only include Thugs-specific fields when relevant
    if (requiresInfluencePayment) {
      return {
        ...base,
        requiresInfluencePayment: true,
        influencePaymentMade,
      };
    }

    return base;
  });
}

// ============================================================================
// Damage Assignment Options
// ============================================================================

/**
 * Get damage assignment options for assign damage phase.
 * Filters out enemies that don't attack (due to Chill/Whirlwind).
 * Filters out hidden summoners (damage comes from their summoned enemy instead).
 * Uses effective attack values (after modifiers).
 * Includes unit targets for damage assignment.
 *
 * For multi-attack enemies, returns separate DamageAssignmentOption for each unblocked,
 * unassigned attack.
 */
export function getDamageAssignmentOptions(
  state: GameState,
  enemies: readonly CombatEnemy[]
): readonly DamageAssignmentOption[] {
  const combat = state.combat;
  if (!combat) return [];

  // Get current player for unit access
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  const options: DamageAssignmentOption[] = [];

  for (const enemy of enemies) {
    // Filter out defeated enemies
    if (enemy.isDefeated) continue;

    // Filter out hidden summoners - damage comes from their summoned enemy instead
    if (enemy.isSummonerHidden) continue;

    // Filter out enemies that don't attack this combat (Chill, Whirlwind)
    if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) continue;

    // Check for Brutal ability (applies to all attacks)
    const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);

    const assassinationActive = currentPlayer
      ? isAssassinationActive(state, currentPlayer.id, enemy)
      : false;

    // Check for damage redirect (Taunt)
    const redirectUnitId = currentPlayer
      ? getDamageRedirectUnit(state, currentPlayer.id, enemy.instanceId)
      : undefined;

    const attacks = getEnemyAttacks(enemy);
    const attackCount = attacks.length;

    // Generate a DamageAssignmentOption for each unblocked, unassigned attack
    for (let attackIndex = 0; attackIndex < attackCount; attackIndex++) {
      // Skip blocked attacks - they don't deal damage
      if (isAttackBlocked(enemy, attackIndex)) continue;

      // Skip attacks that already have damage assigned
      if (isAttackDamageAssigned(enemy, attackIndex)) continue;

      const attack = getEnemyAttack(enemy, attackIndex);

      // Use effective attack (after modifiers)
      const rawAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        attack.damage
      );

      // Filter out attacks with 0 effective attack (no damage to assign)
      if (rawAttack <= 0) continue;

      const totalDamage = isBrutal ? rawAttack * 2 : rawAttack;
      const attackElement = attack.element;

      // Check if player's units cannot absorb damage (Into the Heat)
      const unitsCannotAbsorb = currentPlayer
        ? cannotAssignDamageToUnits(state, currentPlayer.id)
        : false;

      // Compute available unit targets
      // - Units cannot absorb damage (Into the Heat): no units allowed
      // - Assassination: no units allowed (hero only)
      // - Damage redirect: only the redirect unit allowed
      // - Normal: all available units
      let availableUnits: readonly UnitDamageTarget[];
      if (unitsCannotAbsorb || assassinationActive) {
        availableUnits = [];
      } else if (redirectUnitId && currentPlayer) {
        // Only the redirect unit is a valid target
        const allUnits = computeAvailableUnitTargets(currentPlayer, attackElement, combat.unitsAllowed, combat.paidThugsDamageInfluence, state, currentPlayerId);
        availableUnits = allUnits.filter(u => u.unitInstanceId === redirectUnitId);
      } else {
        availableUnits = currentPlayer
          ? computeAvailableUnitTargets(currentPlayer, attackElement, combat.unitsAllowed, combat.paidThugsDamageInfluence, state, currentPlayerId)
          : [];
      }

      // Build the base option
      const baseOption = {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        attackElement,
        isBrutal,
        rawAttackValue: rawAttack,
        totalDamage,
        unassignedDamage: totalDamage, // Deprecated but kept for backwards compatibility
        availableUnits,
        ...(redirectUnitId ? { damageRedirectOnly: true as const } : {}),
      };

      // Only include attackIndex for multi-attack enemies
      if (attackCount > 1) {
        options.push({ ...baseOption, attackIndex });
      } else {
        options.push(baseOption);
      }
    }
  }

  return options;
}

// ============================================================================
// Phase End Check
// ============================================================================

/**
 * Check if the assign damage phase can be ended.
 * Can only end if all unblocked, attacking enemies have had damage assigned.
 * For multi-attack enemies, ALL unblocked attacks must have damage assigned.
 * Enemies that don't attack (due to Chill/Whirlwind) don't need damage assigned.
 * Hidden summoners don't need damage assigned (their summoned enemy deals damage).
 * Enemies with 0 effective attack don't need damage assigned (no damage to take).
 */
export function canEndAssignDamagePhase(
  state: GameState,
  enemies: readonly CombatEnemy[]
): boolean {
  // Check each enemy
  for (const enemy of enemies) {
    // Skip defeated enemies
    if (enemy.isDefeated) continue;

    // Skip hidden summoners - their summoned enemy deals damage
    if (enemy.isSummonerHidden) continue;

    // Skip enemies that don't attack this combat (Chill, Whirlwind)
    if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) continue;

    // For multi-attack enemies, use the helper to check if all unblocked attacks have damage assigned
    if (!isEnemyFullyDamageAssigned(enemy)) {
      // Check if there are any unblocked attacks with non-zero damage
      const attackCount = getEnemyAttackCount(enemy);
      for (let i = 0; i < attackCount; i++) {
        if (isAttackBlocked(enemy, i)) continue;
        if (isAttackDamageAssigned(enemy, i)) continue;

        // This attack is unblocked and unassigned - check if it has damage
        const attack = getEnemyAttack(enemy, i);
        const effectiveAttack = getEffectiveEnemyAttack(
          state,
          enemy.instanceId,
          attack.damage
        );
        if (effectiveAttack > 0) {
          return false; // Can't end phase - this attack needs damage assigned
        }
      }
    }
  }

  return true;
}
