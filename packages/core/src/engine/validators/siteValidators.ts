/**
 * Adventure site validators
 *
 * Validators for entering adventure sites (dungeons, tombs, ruins, etc.)
 */

import type { ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { ENTER_SITE_ACTION, hexKey, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  NO_SITE,
  NOT_ADVENTURE_SITE,
  SITE_ALREADY_CONQUERED,
  NO_ENEMIES_AT_SITE,
} from "./validationCodes.js";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { SiteType } from "../../types/map.js";

/**
 * Must be at an adventure site
 */
export function validateAtAdventureSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_SITE_ACTION) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) {
    return invalid(NO_SITE, "You are not at a site");
  }

  const props = SITE_PROPERTIES[site.type];
  if (!props.adventureSite) {
    return invalid(NOT_ADVENTURE_SITE, "This is not an adventure site");
  }

  return valid();
}

/**
 * Site must not already be conquered (except dungeon/tomb)
 *
 * Dungeons and Tombs can be re-entered even after conquest for fame grinding.
 * Other adventure sites cannot be re-entered once conquered.
 */
export function validateSiteNotConquered(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_SITE_ACTION) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) return valid(); // Handled by validateAtAdventureSite

  // Dungeons and Tombs CAN be re-entered when conquered (for fame grinding)
  if (site.type === SiteType.Dungeon || site.type === SiteType.Tomb) {
    return valid(); // Always allow entry
  }

  if (site.isConquered) {
    return invalid(SITE_ALREADY_CONQUERED, "This site has already been conquered");
  }

  return valid();
}

/**
 * Must have enemies to fight (or be dungeon/tomb that draws on enter)
 *
 * Dungeons and Tombs always draw enemies when you enter, so they're always valid.
 * Other adventure sites (monster den, spawning grounds, ruins) need enemies present.
 * Ruins at day with no enemies is a special case - instant conquest, handled in command.
 */
export function validateSiteHasEnemiesOrDraws(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_SITE_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player?.position) return valid();

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) return valid();

  const site = hex.site;

  // Dungeons and tombs draw enemies on enter — always valid
  if (site.type === SiteType.Dungeon || site.type === SiteType.Tomb) {
    return valid();
  }

  // Ruins at day with no enemies = instant conquest (valid action)
  if (site.type === SiteType.AncientRuins && state.timeOfDay !== TIME_OF_DAY_NIGHT) {
    // At day, ruins may have no enemies - this is valid (instant conquest)
    return valid();
  }

  // Other sites need enemies present
  if (hex.enemies.length === 0) {
    return invalid(NO_ENEMIES_AT_SITE, "There are no enemies at this site");
  }

  return valid();
}
