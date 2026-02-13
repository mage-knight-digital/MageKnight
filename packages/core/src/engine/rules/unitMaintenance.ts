/**
 * Shared unit maintenance rules (Magic Familiars round-start).
 *
 * These pure functions are imported by both validators and validActions
 * to prevent rule drift.
 */

import type { Player } from "../../types/player.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";

const ALL_BASIC_COLORS: readonly BasicManaColor[] = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];

/**
 * Check if player has pending unit maintenance to resolve.
 */
export function hasPendingUnitMaintenance(player: Player): boolean {
  return player.pendingUnitMaintenance !== null && player.pendingUnitMaintenance.length > 0;
}

/**
 * Check if a unit instance is in the player's pending maintenance list.
 */
export function isUnitInMaintenanceList(player: Player, unitInstanceId: string): boolean {
  if (!player.pendingUnitMaintenance) {
    return false;
  }
  return player.pendingUnitMaintenance.some((m) => m.unitInstanceId === unitInstanceId);
}

/**
 * Get the basic mana colors for which the player has crystals available.
 */
export function getAvailableCrystalColorsForMaintenance(player: Player): BasicManaColor[] {
  return ALL_BASIC_COLORS.filter((color) => player.crystals[color] > 0);
}

/**
 * Check if the player has a crystal of the specified color.
 */
export function hasCrystalAvailable(player: Player, color: BasicManaColor): boolean {
  return player.crystals[color] > 0;
}
