/**
 * Pending state option helpers.
 *
 * Handles special pending states that require player resolution:
 * - Glade wound discard choices
 * - Deep mine crystal color choices
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GladeWoundOptions, DeepMineOptions, BasicManaColor } from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { CARD_WOUND, hexKey } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";

/**
 * Get Magical Glade wound discard options for the player.
 * Returns options if player is on a glade and has wounds.
 */
export function getGladeWoundOptions(
  state: GameState,
  player: Player
): GladeWoundOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Check if on a Magical Glade
  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site || hex.site.type !== SiteType.MagicalGlade) {
    return undefined;
  }

  // Check for wounds in hand and discard
  const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
  const hasWoundsInDiscard = player.discard.some((c) => c === CARD_WOUND);

  // If no wounds anywhere, no options needed
  if (!hasWoundsInHand && !hasWoundsInDiscard) {
    return undefined;
  }

  return {
    hasWoundsInHand,
    hasWoundsInDiscard,
  };
}

/**
 * Get Deep Mine crystal color choice options for the player.
 * Returns options if player has a pending deep mine choice.
 */
export function getDeepMineOptions(
  _state: GameState,
  player: Player
): DeepMineOptions | undefined {
  // Check if player has a pending deep mine choice
  if (!player.pendingDeepMineChoice || player.pendingDeepMineChoice.length === 0) {
    return undefined;
  }

  // Convert mine colors to basic mana colors
  const availableColors: BasicManaColor[] = player.pendingDeepMineChoice.map(
    mineColorToBasicManaColor
  );

  return {
    availableColors,
  };
}
