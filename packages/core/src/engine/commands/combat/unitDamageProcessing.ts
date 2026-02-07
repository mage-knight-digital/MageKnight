/**
 * Unit damage processing for damage assignment
 *
 * Handles damage assigned to units, including:
 * - Armor absorption
 * - Resistance mechanics (resistant units can absorb once without wound)
 * - Poison effects (unit destroyed immediately)
 * - Paralyze effects (unit destroyed immediately)
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerUnit } from "../../../types/unit.js";
import type { GameEvent, Element } from "@mage-knight/shared";
import {
  getUnit,
  UNIT_WOUNDED,
  UNIT_DESTROYED,
  UNIT_DESTROY_REASON_DOUBLE_WOUND,
  UNIT_DESTROY_REASON_POISON,
  UNIT_DESTROY_REASON_PARALYZE,
} from "@mage-knight/shared";
import { isAttackResisted } from "../../combat/elementalCalc.js";
import { getEffectiveUnitResistances, getUnitArmorBonus } from "../../modifiers/index.js";
import { getEffectiveUnitArmor } from "../../rules/banners.js";
import type { Player } from "../../../types/player.js";

/**
 * Result of processing damage to a unit.
 */
export interface UnitDamageResult {
  /** Updated unit state */
  unit: PlayerUnit;
  /** Damage remaining after unit absorption (to be taken by hero) */
  damageRemaining: number;
  /** Events generated from this damage */
  events: GameEvent[];
  /** Whether the unit was destroyed */
  destroyed: boolean;
}

/**
 * Process damage assigned to a unit.
 * Returns the updated unit, any remaining damage, and events.
 *
 * Poison: If a unit would be wounded by a poison attack, it receives 2 wounds
 * and is immediately destroyed (since units can only take 1 wound before death).
 *
 * Paralyze: If a unit would be wounded by a paralyze attack, it is immediately
 * destroyed (similar to poison, but the unit still absorbs its armor value).
 *
 * @param state - Game state (for checking modifier-granted resistances)
 * @param player - Optional player for banner armor bonus calculation
 */
export function processUnitDamage(
  state: GameState,
  unit: PlayerUnit,
  damageAmount: number,
  attackElement: Element,
  playerId: string,
  isPoisoned: boolean,
  isParalyzed: boolean,
  player?: Player
): UnitDamageResult {
  const unitDef = getUnit(unit.unitId);
  const events: GameEvent[] = [];
  // Banner of Glory attached: +1 armor to attached unit
  // Banner of Glory powered modifier: +1 armor to all units this turn
  const bannerArmor = player ? getEffectiveUnitArmor(player, unit) : unitDef.armor;
  const modifierArmorBonus = getUnitArmorBonus(state, playerId);
  const effectiveArmor = bannerArmor + modifierArmorBonus;

  // Check if unit has resistance to this attack element
  // Uses effective resistances which includes modifier-granted resistances (e.g., Veil of Mist)
  const effectiveResistances = getEffectiveUnitResistances(state, playerId, unit);
  const isResistant = isAttackResisted(attackElement, effectiveResistances);

  let damageRemaining = damageAmount;
  let unitWounded = unit.wounded;
  let usedResistance = unit.usedResistanceThisCombat;
  let destroyed = false;
  let destroyReason:
    | typeof UNIT_DESTROY_REASON_DOUBLE_WOUND
    | typeof UNIT_DESTROY_REASON_POISON
    | typeof UNIT_DESTROY_REASON_PARALYZE = UNIT_DESTROY_REASON_DOUBLE_WOUND;

  if (isResistant && !unit.wounded && !unit.usedResistanceThisCombat) {
    // Resistant unit (not previously wounded, hasn't used resistance this combat):
    // First, reduce damage by armor
    damageRemaining = Math.max(0, damageRemaining - effectiveArmor);

    if (damageRemaining > 0) {
      // Still damage remaining after first armor reduction: wound the unit
      unitWounded = true;

      // Paralyze: if unit would be wounded, it is immediately destroyed
      if (isParalyzed) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_PARALYZE;
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
        // Poison: if unit would be wounded, it gets 2 wounds = destroyed
      } else if (isPoisoned) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_POISON;
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
      } else {
        // Apply armor reduction again for wounded unit
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
      }
    } else {
      // Absorbed without wound, mark resistance as used for this combat
      usedResistance = true;
    }
  } else {
    // Non-resistant OR already wounded/used resistance:
    // If already wounded, this is a second wound = destroyed
    if (unit.wounded) {
      destroyed = true;
      // Destroyed units don't absorb anything beyond what causes destruction
      damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
    } else {
      // First wound: apply armor and wound
      unitWounded = true;

      // Paralyze: if unit would be wounded, it is immediately destroyed
      if (isParalyzed) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_PARALYZE;
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
        // Poison: if unit would be wounded, it gets 2 wounds = destroyed
      } else if (isPoisoned) {
        destroyed = true;
        destroyReason = UNIT_DESTROY_REASON_POISON;
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
      } else {
        damageRemaining = Math.max(0, damageRemaining - effectiveArmor);
      }
    }
  }

  // Generate events
  const damageAbsorbed = damageAmount - damageRemaining;

  if (destroyed) {
    events.push({
      type: UNIT_DESTROYED,
      playerId,
      unitInstanceId: unit.instanceId,
      reason: destroyReason,
    });
  } else if (unitWounded && !unit.wounded) {
    // Only emit wound event if unit wasn't already wounded
    events.push({
      type: UNIT_WOUNDED,
      playerId,
      unitInstanceId: unit.instanceId,
      damageAbsorbed,
    });
  }

  const updatedUnit: PlayerUnit = {
    ...unit,
    wounded: unitWounded,
    usedResistanceThisCombat: usedResistance,
  };

  return {
    unit: updatedUnit,
    damageRemaining,
    events,
    destroyed,
  };
}
