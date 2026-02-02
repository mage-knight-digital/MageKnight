/**
 * Unit-related modifier effective value calculations
 *
 * Functions for calculating effective unit values based on active modifiers.
 * Used for resistance grants (Veil of Mist) and other unit-affecting modifiers.
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { GrantResistancesModifier } from "../../types/modifiers.js";
import type { ResistanceType } from "@mage-knight/shared";
import { getUnit } from "@mage-knight/shared";
import { EFFECT_GRANT_RESISTANCES, SCOPE_ALL_UNITS } from "../modifierConstants.js";
import { getModifiersForPlayer } from "./queries.js";

/**
 * Get effective resistances for a unit, including granted resistances from modifiers.
 * Combines base resistances from unit definition with any granted resistances.
 *
 * Used by Veil of Mist spell which grants all units all resistances.
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

  // If no modifiers, return base resistances (avoid unnecessary allocation)
  if (resistanceModifiers.length === 0) {
    return baseResistances;
  }

  // Combine all granted resistances
  const combined = new Set<ResistanceType>(baseResistances);
  for (const mod of resistanceModifiers) {
    for (const resistance of mod.resistances) {
      combined.add(resistance);
    }
  }

  return Array.from(combined);
}
