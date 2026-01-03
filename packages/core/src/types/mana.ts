/**
 * Mana source types for Mage Knight
 */

export type { SpecialManaColor } from "@mage-knight/shared";
import type { ManaColor } from "@mage-knight/shared";

// Represents a die in the source
export interface SourceDie {
  readonly id: string;
  readonly color: ManaColor;
  readonly isDepleted: boolean; // gold depleted at night, black depleted at day
  readonly takenByPlayerId: string | null; // which player used this die this turn
}

// The mana source (dice pool)
export interface ManaSource {
  readonly dice: readonly SourceDie[];
  // Number of dice = number of actual players + 2
}

// Player's crystal inventory (max 3 of each color)
// Note: Using explicit properties since mapped types can't be used in interfaces
export interface CrystalInventory {
  readonly red: number;
  readonly blue: number;
  readonly green: number;
  readonly white: number;
}

// Helper to create an empty mana source
export function createEmptyManaSource(): ManaSource {
  return {
    dice: [],
  };
}

// Helper to create empty crystal inventory
export function createEmptyCrystalInventory(): CrystalInventory {
  return {
    red: 0,
    blue: 0,
    green: 0,
    white: 0,
  };
}
