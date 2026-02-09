/**
 * Assign damage command
 *
 * Handles damage assignment to hero and/or units.
 * Units can absorb damage based on their armor value.
 * Resistant units can absorb damage without being wounded if damage <= armor.
 *
 * Multi-attack support:
 * - For multi-attack enemies, attackIndex specifies which attack's damage to assign
 * - Each attack's damage is handled separately
 * - Enemy is only marked as "fully assigned" when all unblocked attacks have damage assigned
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, DamageAssignment } from "@mage-knight/shared";
import {
  DAMAGE_ASSIGNED,
  DAMAGE_TARGET_HERO,
  DAMAGE_TARGET_UNIT,
  UNIT_WOUNDED,
  UNIT_DESTROYED,
} from "@mage-knight/shared";
import {
  getEnemyAttack,
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
  getEffectiveEnemyAttackElement,
  findFirstUnassignedAttack,
} from "../../combat/enemyAttackHelpers.js";
import {
  getEffectiveDamage,
  isPoisonActive,
  isParalyzeActive,
} from "./abilityHelpers.js";
import { processUnitDamage } from "./unitDamageProcessing.js";
import { applyHeroWounds } from "./heroDamageProcessing.js";
import { detachBannerFromUnit } from "../banners/bannerDetachment.js";
import {
  BANNER_DETACH_REASON_UNIT_DESTROYED,
  CARD_BANNER_OF_FORTITUDE,
  BANNER_FORTITUDE_PREVENTED_WOUND,
} from "@mage-knight/shared";
import {
  isVampiricActive,
  getVampiricArmorBonus,
} from "../../combat/vampiricHelpers.js";
import { getBannerForUnit, markBannerUsed } from "../../rules/banners.js";
import { getHeroDamageReduction } from "../../modifiers/index.js";
import { removeModifier } from "../../modifiers/index.js";
import { markDuelingUnitInvolvement } from "../../combat/duelingHelpers.js";

export const ASSIGN_DAMAGE_COMMAND = "ASSIGN_DAMAGE" as const;

export interface AssignDamageCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, specifies which attack's damage to assign (0-indexed).
   * Defaults to 0 for single-attack enemies or when not specified.
   */
  readonly attackIndex?: number;
  readonly assignments?: readonly DamageAssignment[];
}

export function createAssignDamageCommand(
  params: AssignDamageCommandParams
): Command {
  return {
    type: ASSIGN_DAMAGE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === params.enemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.enemyInstanceId}`);
      }

      // Get the attack index (auto-resolve to first unassigned for multi-attack enemies)
      const attackIndex = params.attackIndex ?? findFirstUnassignedAttack(enemy);
      const attackCount = getEnemyAttackCount(enemy);

      // Validate attack index
      if (attackIndex < 0 || attackIndex >= attackCount) {
        throw new Error(
          `Attack index ${attackIndex} out of range (enemy has ${attackCount} attacks)`
        );
      }

      // Check if this specific attack is blocked
      if (isAttackBlocked(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} is blocked - no damage to assign`);
      }

      // Check if this specific attack already has damage assigned
      if (isAttackDamageAssigned(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} already has damage assigned`);
      }

      if (enemy.isDefeated) {
        throw new Error("Enemy is defeated");
      }

      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Get the attack being resolved
      const attackBeingResolved = getEnemyAttack(enemy, attackIndex);

      // Get effective damage (Brutal doubles damage)
      let totalDamage = getEffectiveDamage(
        enemy,
        attackIndex,
        state,
        params.playerId
      );
      const attackElement = getEffectiveEnemyAttackElement(
        state, enemy, attackBeingResolved.element
      );

      // Apply hero damage reduction (Elemental Resistance, Battle Hardened)
      // Happens AFTER Brutal doubling, reduces total damage from this attack.
      // The modifier is consumed (removed) after use.
      let currentState = state;
      const damageReduction = getHeroDamageReduction(
        currentState,
        params.playerId,
        attackElement
      );
      if (damageReduction && totalDamage > 0) {
        totalDamage = Math.max(0, totalDamage - damageReduction.modifier.amount);
        currentState = removeModifier(currentState, damageReduction.activeModifier.id);
      }

      const isPoisoned = isPoisonActive(currentState, params.playerId, enemy);
      const isParalyzed = isParalyzeActive(currentState, params.playerId, enemy);
      const events: GameEvent[] = [];

      let updatedPlayer: Player = player;
      let heroWounds = 0;

      // If no assignments provided, all damage goes to hero (backwards compatible)
      const assignments: readonly DamageAssignment[] = params.assignments ?? [
        { target: DAMAGE_TARGET_HERO, amount: totalDamage },
      ];

      // Process each assignment
      let unitDamageAssigned = false;
      for (const assignment of assignments) {
        if (assignment.target === DAMAGE_TARGET_UNIT) {
          unitDamageAssigned = true;
          const result = processUnitAssignment(
            currentState,
            updatedPlayer,
            assignment,
            attackElement,
            params.playerId,
            isPoisoned,
            isParalyzed
          );
          updatedPlayer = result.player;
          heroWounds += result.heroWounds;
          events.push(...result.events);
        } else {
          // Hero damage
          heroWounds += Math.ceil(assignment.amount / updatedPlayer.armor);
        }
      }

      // Mark Dueling unit involvement when damage from enemy is assigned to a unit
      // (including resistant units that absorb damage - per FAQ S3)
      if (unitDamageAssigned) {
        currentState = markDuelingUnitInvolvement(
          currentState,
          params.playerId,
          params.enemyInstanceId
        );
      }

      // Apply hero wounds
      if (heroWounds > 0) {
        const woundResult = applyHeroWounds(
          updatedPlayer,
          heroWounds,
          params.playerId,
          isPoisoned,
          isParalyzed,
          currentState.combat.woundsThisCombat
        );
        updatedPlayer = woundResult.player;
        events.push(...woundResult.events);
      }

      // Emit the main damage assigned event (include attackIndex)
      // woundsTaken reflects wounds to hand (poison adds equal wounds to discard)
      events.unshift({
        type: DAMAGE_ASSIGNED,
        enemyInstanceId: params.enemyInstanceId,
        attackIndex,
        damage: totalDamage,
        woundsTaken: heroWounds,
      });

      const updatedPlayers = currentState.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Mark attack as having damage assigned
      const updatedEnemies = updateEnemyDamageAssigned(
        currentState.combat.enemies,
        params.enemyInstanceId,
        attackIndex,
        attackCount
      );

      // Only wounds to HAND count for knockout tracking
      const combatWoundsThisCombat = currentState.combat.woundsThisCombat + heroWounds;

      // Track Vampiric armor bonus: count total wounds dealt (hero + units)
      // Only count wounds that actually happened, not poison extra wounds to discard
      let updatedVampiricArmorBonus = currentState.combat.vampiricArmorBonus;

      if (isVampiricActive(currentState, params.playerId, enemy)) {
        // Count wounds from all sources:
        // - heroWounds: wounds to hero's hand
        // - Unit wounds: each UNIT_WOUNDED or UNIT_DESTROYED event = 1 wound
        const unitWoundCount = events.filter(
          (e) => e.type === UNIT_WOUNDED || e.type === UNIT_DESTROYED
        ).length;

        const totalWoundsDealt = heroWounds + unitWoundCount;

        if (totalWoundsDealt > 0) {
          const currentBonus = getVampiricArmorBonus(currentState, params.enemyInstanceId);
          const newBonus = currentBonus + totalWoundsDealt;

          updatedVampiricArmorBonus = {
            ...currentState.combat.vampiricArmorBonus,
            [params.enemyInstanceId]: newBonus,
          };
        }
      }

      const updatedCombat = {
        ...currentState.combat,
        enemies: updatedEnemies,
        woundsThisCombat: combatWoundsThisCombat,
        woundsAddedToHandThisCombat:
          currentState.combat.woundsAddedToHandThisCombat || heroWounds > 0,
        vampiricArmorBonus: updatedVampiricArmorBonus,
      };

      return {
        state: { ...currentState, combat: updatedCombat, players: updatedPlayers },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ASSIGN_DAMAGE");
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface UnitAssignmentResult {
  player: Player;
  heroWounds: number;
  events: GameEvent[];
}

/**
 * Process a damage assignment to a unit.
 */
function processUnitAssignment(
  state: GameState,
  player: Player,
  assignment: DamageAssignment,
  attackElement: import("@mage-knight/shared").Element,
  playerId: string,
  isPoisoned: boolean,
  isParalyzed: boolean
): UnitAssignmentResult {
  if (!assignment.unitInstanceId) {
    throw new Error("Unit instance ID required for unit damage");
  }

  const unitIndex = player.units.findIndex(
    (u) => u.instanceId === assignment.unitInstanceId
  );
  if (unitIndex === -1) {
    throw new Error(`Unit not found: ${assignment.unitInstanceId}`);
  }

  const unit = player.units[unitIndex];
  if (!unit) {
    throw new Error(`Unit not found at index: ${unitIndex}`);
  }

  // Banner of Fortitude wound prevention: intercept before normal damage processing.
  // When a unit with Banner of Fortitude attached would be wounded, the banner
  // flips (isUsedThisRound = true) to prevent the wound AND all additional effects
  // (poison, paralyze, vampiric). This counts as the unit's damage assignment.
  const banner = getBannerForUnit(player, unit.instanceId);
  if (
    banner &&
    banner.bannerId === CARD_BANNER_OF_FORTITUDE &&
    !banner.isUsedThisRound
  ) {
    const updatedBanners = markBannerUsed(
      player.attachedBanners,
      CARD_BANNER_OF_FORTITUDE
    );

    return {
      player: { ...player, attachedBanners: updatedBanners },
      heroWounds: 0,
      events: [
        {
          type: BANNER_FORTITUDE_PREVENTED_WOUND,
          playerId,
          unitInstanceId: unit.instanceId,
          damageNegated: assignment.amount,
        },
      ],
    };
  }

  const result = processUnitDamage(
    state,
    unit,
    assignment.amount,
    attackElement,
    playerId,
    isPoisoned,
    isParalyzed,
    player
  );

  let updatedPlayer: Player;
  const allEvents: GameEvent[] = [...result.events];
  if (result.destroyed) {
    const destroyedUnit = player.units[unitIndex]!;
    // Detach any banner from the destroyed unit
    const bannerResult = detachBannerFromUnit(
      player,
      destroyedUnit.instanceId,
      BANNER_DETACH_REASON_UNIT_DESTROYED
    );
    // Clear Bonds slot if the destroyed unit was the Bonds unit
    const updatedBondsSlot =
      player.bondsOfLoyaltyUnitInstanceId === destroyedUnit.instanceId
        ? null
        : player.bondsOfLoyaltyUnitInstanceId;
    // Remove destroyed unit
    updatedPlayer = {
      ...player,
      units: player.units.filter((_, i) => i !== unitIndex),
      discard: bannerResult.updatedDiscard,
      attachedBanners: bannerResult.updatedAttachedBanners,
      bondsOfLoyaltyUnitInstanceId: updatedBondsSlot,
    };
    allEvents.push(...bannerResult.events);
  } else {
    // Update unit state
    const updatedUnits = [...player.units];
    updatedUnits[unitIndex] = result.unit;
    updatedPlayer = { ...player, units: updatedUnits };
  }

  // Any remaining damage after unit absorption goes to hero
  const heroWounds =
    result.damageRemaining > 0
      ? Math.ceil(result.damageRemaining / player.armor)
      : 0;

  return {
    player: updatedPlayer,
    heroWounds,
    events: allEvents,
  };
}

/**
 * Update enemy state to mark attack damage as assigned.
 */
function updateEnemyDamageAssigned(
  enemies: readonly import("../../../types/combat.js").CombatEnemy[],
  enemyInstanceId: string,
  attackIndex: number,
  attackCount: number
): import("../../../types/combat.js").CombatEnemy[] {
  return enemies.map((e) => {
    if (e.instanceId !== enemyInstanceId) return e;

    // For multi-attack enemies, update the attacksDamageAssigned array
    if (attackCount > 1) {
      // Initialize attacksDamageAssigned if not present
      const currentAttacksDamageAssigned =
        e.attacksDamageAssigned ?? new Array(attackCount).fill(false);
      const newAttacksDamageAssigned = [...currentAttacksDamageAssigned];
      newAttacksDamageAssigned[attackIndex] = true;

      // Check if ALL unblocked attacks now have damage assigned
      let allUnblockedAssigned = true;
      for (let i = 0; i < attackCount; i++) {
        if (!isAttackBlocked(e, i) && !newAttacksDamageAssigned[i]) {
          allUnblockedAssigned = false;
          break;
        }
      }

      return {
        ...e,
        attacksDamageAssigned: newAttacksDamageAssigned,
        damageAssigned: allUnblockedAssigned, // Legacy flag: true only when all unblocked attacks assigned
      };
    }

    // For single-attack enemies, just set damageAssigned
    return { ...e, damageAssigned: true };
  });
}
