/**
 * Site helper functions for accessing player position and site information
 */

import type { GameState } from "../../state/GameState.js";
import type { Site, SiteType } from "../../types/map.js";
import { hexKey } from "@mage-knight/shared";
import { getPlayerById } from "./playerHelpers.js";

/**
 * Get the site at the player's current position
 * Returns null if player is not on map or not at a site
 */
export function getPlayerSite(
  state: GameState,
  playerId: string
): Site | null {
  const player = getPlayerById(state, playerId);
  if (!player?.position) return null;

  const hexKeyStr = hexKey(player.position);
  const hex = state.map.hexes[hexKeyStr];

  return hex?.site ?? null;
}

/**
 * Check if the player is at a specific site type
 */
export function isPlayerAtSiteType(
  state: GameState,
  playerId: string,
  siteType: SiteType
): boolean {
  const site = getPlayerSite(state, playerId);
  return site?.type === siteType;
}
