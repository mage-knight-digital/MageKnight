/**
 * Unit-related modifier effective value calculations
 *
 * Functions for calculating effective unit values based on active modifiers.
 * Used for resistance grants (Veil of Mist) and other unit-affecting modifiers.
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";
import type {
  ActiveModifier,
  GrantResistancesModifier,
  LeadershipBonusModifier,
  UnitAttackBonusModifier,
  UnitCombatBonusModifier,
  UnitArmorBonusModifier,
  UnitBlockBonusModifier,
  BannerGloryFameTrackingModifier,
} from "../../types/modifiers.js";
import type { ResistanceType } from "@mage-knight/shared";
import { getUnit } from "@mage-knight/shared";
import {
  EFFECT_GRANT_RESISTANCES,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_UNIT_COMBAT_BONUS,
  EFFECT_LEADERSHIP_BONUS,
  EFFECT_UNIT_ARMOR_BONUS,
  EFFECT_UNIT_BLOCK_BONUS,
  EFFECT_BANNER_GLORY_FAME_TRACKING,
  SCOPE_ALL_UNITS,
} from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";
import { getBannerResistances } from "../rules/banners.js";

/**
 * Get effective resistances for a unit, including granted resistances from modifiers
 * and banner-granted resistances.
 *
 * Sources:
 * - Base resistances from unit definition
 * - Modifier-granted resistances (e.g., Veil of Mist: all units all resistances)
 * - Banner of Protection: Fire Resistance + Ice Resistance
 */
export function getEffectiveUnitResistances(
  state: GameState,
  playerId: string,
  unit: PlayerUnit
): readonly ResistanceType[] {
  const unitDef = getUnit(unit.unitId);
  const baseResistances = unitDef.resistances;

  // Find all resistance grant modifiers affecting this unit
  const resistanceModifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => {
      if (m.effect.type !== EFFECT_GRANT_RESISTANCES) return false;

      // Check scope - only ALL_UNITS scope is currently used
      // SCOPE_ONE_UNIT would require checking unitIndex, but Veil of Mist uses ALL_UNITS
      return m.scope.type === SCOPE_ALL_UNITS;
    })
    .map((m) => m.effect as GrantResistancesModifier);

  // Check banner-granted resistances (Banner of Protection)
  const player = state.players.find((p) => p.id === playerId);
  const bannerResistances = player ? getBannerResistances(player, unit.instanceId) : [];

  // If no modifiers and no banner resistances, return base (avoid unnecessary allocation)
  if (resistanceModifiers.length === 0 && bannerResistances.length === 0) {
    return baseResistances;
  }

  // Combine all granted resistances
  const combined = new Set<ResistanceType>(baseResistances);
  for (const mod of resistanceModifiers) {
    for (const resistance of mod.resistances) {
      combined.add(resistance);
    }
  }
  for (const resistance of bannerResistances) {
    combined.add(resistance);
  }

  return Array.from(combined);
}

/**
 * Get the total unit attack bonus from active modifiers.
 * Returns the sum of all EFFECT_UNIT_ATTACK_BONUS modifiers
 * scoped to ALL_UNITS (or ONE_UNIT matching the given unit).
 *
 * Used by Shocktroops' Coordinated Fire ability which grants
 * +1 to all unit attacks per activation.
 */
export function getUnitAttackBonus(
  state: GameState,
  playerId: string,
): number {
  const playerModifiers = getModifiersForPlayer(state, playerId);

  let bonus = 0;

  // Sum EFFECT_UNIT_ATTACK_BONUS modifiers (Coordinated Fire)
  for (const m of playerModifiers) {
    if (m.effect.type === EFFECT_UNIT_ATTACK_BONUS && m.scope.type === SCOPE_ALL_UNITS) {
      bonus += (m.effect as UnitAttackBonusModifier).amount;
    }
  }

  // Sum EFFECT_UNIT_COMBAT_BONUS attack bonuses (Into the Heat)
  for (const m of playerModifiers) {
    if (m.effect.type === EFFECT_UNIT_COMBAT_BONUS && m.scope.type === SCOPE_ALL_UNITS) {
      bonus += (m.effect as UnitCombatBonusModifier).attackBonus;
    }
  }

  return bonus;
}

/**
 * Find an active Leadership bonus modifier for a player.
 * Returns the modifier and its ActiveModifier wrapper if found.
 *
 * Used by activateUnitCommand to check if Leadership should apply
 * and to consume (remove) the modifier after use.
 */
export function getLeadershipBonusModifier(
  state: GameState,
  playerId: string,
): { modifier: LeadershipBonusModifier; activeModifier: ActiveModifier } | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const found = modifiers.find(
    (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
  );

  if (!found) {
    return null;
  }

  return {
    modifier: found.effect as LeadershipBonusModifier,
    activeModifier: found,
  };
}

/**
 * Get the total unit armor bonus from active modifiers.
 * Returns the sum of all EFFECT_UNIT_ARMOR_BONUS modifiers
 * scoped to ALL_UNITS.
 *
 * Used by Banner of Glory powered effect which grants
 * +1 armor to all units this turn.
 */
export function getUnitArmorBonus(
  state: GameState,
  playerId: string,
): number {
  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => {
      if (m.effect.type !== EFFECT_UNIT_ARMOR_BONUS) return false;
      return m.scope.type === SCOPE_ALL_UNITS;
    })
    .map((m) => m.effect as UnitArmorBonusModifier);

  let bonus = 0;
  for (const mod of modifiers) {
    bonus += mod.amount;
  }

  return bonus;
}

/**
 * Get the total unit block bonus from active modifiers.
 * Returns the sum of EFFECT_UNIT_BLOCK_BONUS (Banner of Glory)
 * and EFFECT_UNIT_COMBAT_BONUS block bonuses (Into the Heat)
 * scoped to ALL_UNITS.
 */
export function getUnitBlockBonus(
  state: GameState,
  playerId: string,
): number {
  const playerModifiers = getModifiersForPlayer(state, playerId);

  let bonus = 0;

  // Sum EFFECT_UNIT_BLOCK_BONUS modifiers (Banner of Glory)
  for (const m of playerModifiers) {
    if (m.effect.type === EFFECT_UNIT_BLOCK_BONUS && m.scope.type === SCOPE_ALL_UNITS) {
      bonus += (m.effect as UnitBlockBonusModifier).amount;
    }
  }

  // Sum EFFECT_UNIT_COMBAT_BONUS block bonuses (Into the Heat)
  for (const m of playerModifiers) {
    if (m.effect.type === EFFECT_UNIT_COMBAT_BONUS && m.scope.type === SCOPE_ALL_UNITS) {
      bonus += (m.effect as UnitCombatBonusModifier).blockBonus;
    }
  }

  return bonus;
}

/**
 * Get the Banner of Glory fame tracking modifier, if active.
 */
export function getBannerGloryFameTracker(
  state: GameState,
  playerId: string,
): BannerGloryFameTrackingModifier | undefined {
  const modifier = getModifiersForPlayer(state, playerId)
    .find((m) => m.effect.type === EFFECT_BANNER_GLORY_FAME_TRACKING);

  return modifier?.effect as BannerGloryFameTrackingModifier | undefined;
}
