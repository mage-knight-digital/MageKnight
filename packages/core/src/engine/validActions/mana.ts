/**
 * Mana availability computation
 *
 * Determines what mana sources are available to a player.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ManaOptions, AvailableDie, BasicManaColor, ManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";

/**
 * Get available mana options for a player.
 *
 * Returns:
 * - Available dice from the mana source (not taken, not depleted)
 * - Whether the player can convert crystals
 * - Which crystal colors are available
 */
export function getManaOptions(
  state: GameState,
  player: Player
): ManaOptions {
  const availableDice: AvailableDie[] = [];

  // Check available dice from source (only if player hasn't used source this turn)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      // Die must not be taken and not depleted
      if (die.takenByPlayerId === null && !die.isDepleted) {
        availableDice.push({
          dieId: die.id,
          color: die.color,
        });
      }
    }
  }

  // Check crystal conversion
  const convertibleColors: BasicManaColor[] = [];

  if (player.crystals.red > 0) {
    convertibleColors.push(MANA_RED);
  }
  if (player.crystals.blue > 0) {
    convertibleColors.push(MANA_BLUE);
  }
  if (player.crystals.green > 0) {
    convertibleColors.push(MANA_GREEN);
  }
  if (player.crystals.white > 0) {
    convertibleColors.push(MANA_WHITE);
  }

  return {
    availableDice,
    canConvertCrystal: convertibleColors.length > 0,
    convertibleColors,
  };
}

/**
 * Check if a player has access to a specific mana color.
 *
 * A player can access a mana color if:
 * 1. There's a die of that color available in the source (and player hasn't used source)
 * 2. The player has a crystal of that color to convert
 * 3. The player has a "pure" mana token of that color in their play area
 * 4. Gold/black mana can substitute for basic colors (with limitations)
 */
export function canPayForMana(
  state: GameState,
  player: Player,
  requiredColor: ManaColor
): boolean {
  // Check pure mana tokens in play area (from cards like Mana Draw)
  for (const token of player.pureMana) {
    if (token.color === requiredColor) {
      return true;
    }
    // Gold mana is wild (can be any basic color)
    if (token.color === MANA_GOLD && isBasicMana(requiredColor)) {
      return true;
    }
    // Black mana is wild (can be any basic color) - but limited in daytime
    if (token.color === MANA_BLACK && isBasicMana(requiredColor)) {
      return true;
    }
  }

  // Check crystals - crystals can be converted to their color
  if (isBasicMana(requiredColor)) {
    const crystalCount = getCrystalCount(player, requiredColor);
    if (crystalCount > 0) {
      return true;
    }
  }

  // Check mana source dice (only if player hasn't used source this turn)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (die.color === requiredColor) {
          return true;
        }
        // Gold dice are wild
        if (die.color === MANA_GOLD && isBasicMana(requiredColor)) {
          return true;
        }
        // Black dice are wild at night (but they're depleted during day)
        if (die.color === MANA_BLACK && isBasicMana(requiredColor)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a mana color is a basic color (not gold/black)
 */
function isBasicMana(color: ManaColor): boolean {
  return (
    color === MANA_RED ||
    color === MANA_BLUE ||
    color === MANA_GREEN ||
    color === MANA_WHITE
  );
}

/**
 * Get the crystal count for a basic mana color
 */
function getCrystalCount(player: Player, color: ManaColor): number {
  switch (color) {
    case MANA_RED:
      return player.crystals.red;
    case MANA_BLUE:
      return player.crystals.blue;
    case MANA_GREEN:
      return player.crystals.green;
    case MANA_WHITE:
      return player.crystals.white;
    default:
      return 0;
  }
}
