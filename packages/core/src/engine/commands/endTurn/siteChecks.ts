/**
 * Site Checks for End Turn
 *
 * Handles Magical Glade wound discard opportunity and Mine crystal rewards.
 *
 * @module commands/endTurn/siteChecks
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, BasicManaColor } from "@mage-knight/shared";
import {
  hexKey,
  CARD_WOUND,
  CRYSTAL_GAINED,
  DEEP_MINE_CRYSTAL_GAINED,
} from "@mage-knight/shared";
import { SiteType, mineColorToBasicManaColor, type MineColor } from "../../../types/map.js";
import type { SiteCheckResult } from "./types.js";

const MAX_CRYSTALS_PER_COLOR = 3;

/**
 * Check if player is on a Magical Glade and has wounds to discard.
 * If so, sets pendingGladeWoundChoice on the player.
 *
 * Note: If the glade requires liberation (Shades of Tezla scenarios),
 * the wound discard is blocked until the glade is liberated.
 *
 * @returns SiteCheckResult with pendingChoice=true if waiting for player choice
 */
export function checkMagicalGladeWound(
  state: GameState,
  player: Player,
  skipCheck: boolean
): SiteCheckResult {
  // Skip if already has pending choice or check is disabled
  if (!player.position || player.pendingGladeWoundChoice || skipCheck) {
    return { pendingChoice: false, player, events: [] };
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (hex?.site?.type !== SiteType.MagicalGlade) {
    return { pendingChoice: false, player, events: [] };
  }

  // If glade requires liberation and isn't liberated, block effect
  if (hex.site.requiresLiberation && !hex.site.isLiberated) {
    return { pendingChoice: false, player, events: [] };
  }

  const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
  const hasWoundsInDiscard = player.discard.some((c) => c === CARD_WOUND);

  if (hasWoundsInHand || hasWoundsInDiscard) {
    const updatedPlayer: Player = {
      ...player,
      pendingGladeWoundChoice: true,
    };
    return { pendingChoice: true, player: updatedPlayer, events: [] };
  }

  return { pendingChoice: false, player, events: [] };
}

/**
 * Process mine rewards when ending turn on a Mine or Deep Mine.
 *
 * @returns SiteCheckResult with pendingChoice=true if Deep Mine needs color choice
 */
export function processMineRewards(
  state: GameState,
  player: Player,
  skipDeepMineCheck: boolean
): SiteCheckResult {
  if (!player.position) {
    return { pendingChoice: false, player, events: [] };
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) {
    return { pendingChoice: false, player, events: [] };
  }

  // Deep Mine: multiple colors, may need choice
  if (hex.site.type === SiteType.DeepMine && hex.site.deepMineColors && !skipDeepMineCheck) {
    return processDeepMine(player, hex.site.deepMineColors);
  }

  // Regular Mine: single color, auto-grant
  if (hex.site.type === SiteType.Mine && hex.site.mineColor) {
    return processRegularMine(player, hex.site.mineColor);
  }

  return { pendingChoice: false, player, events: [] };
}

/**
 * Process Deep Mine crystal gain.
 * If multiple colors available under max, needs player choice.
 */
function processDeepMine(
  player: Player,
  availableColors: readonly MineColor[]
): SiteCheckResult {
  // Filter to colors where player can still gain crystals
  const gainableColors = availableColors.filter((mineColor) => {
    const manaColor = mineColorToBasicManaColor(mineColor);
    return player.crystals[manaColor] < MAX_CRYSTALS_PER_COLOR;
  });

  if (gainableColors.length > 1) {
    // Multiple colors - need player choice
    const updatedPlayer: Player = {
      ...player,
      pendingDeepMineChoice: gainableColors,
    };
    return { pendingChoice: true, player: updatedPlayer, events: [] };
  }

  if (gainableColors.length === 1) {
    // Single color - auto-grant
    const singleColor = gainableColors[0];
    if (!singleColor) {
      return { pendingChoice: false, player, events: [] };
    }
    const manaColor = mineColorToBasicManaColor(singleColor);
    return grantCrystal(player, manaColor, true);
  }

  // No gainable colors (all maxed)
  return { pendingChoice: false, player, events: [] };
}

/**
 * Process regular Mine crystal gain.
 */
function processRegularMine(
  player: Player,
  mineColor: MineColor
): SiteCheckResult {
  const manaColor: BasicManaColor = mineColorToBasicManaColor(mineColor);
  const currentCount = player.crystals[manaColor];

  if (currentCount >= MAX_CRYSTALS_PER_COLOR) {
    return { pendingChoice: false, player, events: [] };
  }

  return grantCrystal(player, manaColor, false);
}

/**
 * Grant a crystal to the player.
 */
function grantCrystal(
  player: Player,
  color: BasicManaColor,
  isDeepMine: boolean
): SiteCheckResult {
  const currentCount = player.crystals[color];
  const updatedPlayer: Player = {
    ...player,
    crystals: {
      ...player.crystals,
      [color]: currentCount + 1,
    },
  };

  const event: GameEvent = isDeepMine
    ? {
        type: DEEP_MINE_CRYSTAL_GAINED,
        playerId: player.id,
        color,
      }
    : {
        type: CRYSTAL_GAINED,
        playerId: player.id,
        color,
        source: "crystal_mine",
      };

  return { pendingChoice: false, player: updatedPlayer, events: [event] };
}
