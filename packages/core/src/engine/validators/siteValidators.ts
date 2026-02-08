/**
 * Adventure site validators
 *
 * Validators for entering adventure sites (dungeons, tombs, ruins, etc.)
 */

import type { ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  ENTER_SITE_ACTION,
  ALTAR_TRIBUTE_ACTION,
  hexKey,
  getRuinsTokenDefinition,
  isAltarToken,
  isEnemyToken,
} from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  NO_SITE,
  NOT_ADVENTURE_SITE,
  SITE_ALREADY_CONQUERED,
  NO_ENEMIES_AT_SITE,
  NOT_AT_RUINS,
  NO_ALTAR_TOKEN,
  NOT_ENEMY_TOKEN,
} from "./validationCodes.js";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { SiteType } from "../../types/map.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

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
 * Other adventure sites (monster den, spawning grounds) need enemies present.
 * Ancient Ruins with ENTER_SITE requires an enemy token (altars use ALTAR_TRIBUTE).
 */
export function validateSiteHasEnemiesOrDraws(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_SITE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player?.position) return valid();

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) return valid();

  const site = hex.site;

  // Sites that draw enemies on enter — always valid (enemies drawn by command)
  // Per rules: Dungeon, Tomb, Monster Den, Spawning Grounds all draw when you ENTER
  if (
    site.type === SiteType.Dungeon ||
    site.type === SiteType.Tomb ||
    site.type === SiteType.MonsterDen ||
    site.type === SiteType.SpawningGrounds
  ) {
    return valid();
  }

  // Ancient Ruins: ENTER_SITE requires an enemy token
  // Altar tokens use the ALTAR_TRIBUTE action instead
  if (site.type === SiteType.AncientRuins) {
    if (!hex.ruinsToken) {
      return invalid(NO_ENEMIES_AT_SITE, "No ruins token at this site");
    }
    const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
    if (!tokenDef || !isEnemyToken(tokenDef)) {
      return invalid(NOT_ENEMY_TOKEN, "This ruins token is an altar — use Altar Tribute instead");
    }
    return valid();
  }

  // Other sites need enemies present
  if (hex.enemies.length === 0) {
    return invalid(NO_ENEMIES_AT_SITE, "There are no enemies at this site");
  }

  return valid();
}

/**
 * Must be at Ancient Ruins with a revealed altar token
 */
export function validateAtRuinsWithAltar(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ALTAR_TRIBUTE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player?.position) {
    return invalid(NO_SITE, "You are not at a site");
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) {
    return invalid(NO_SITE, "You are not at a site");
  }

  if (hex.site.type !== SiteType.AncientRuins) {
    return invalid(NOT_AT_RUINS, "You are not at Ancient Ruins");
  }

  if (hex.site.isConquered) {
    return invalid(SITE_ALREADY_CONQUERED, "This site has already been conquered");
  }

  if (!hex.ruinsToken) {
    return invalid(NO_ALTAR_TOKEN, "No ruins token at this site");
  }

  if (!hex.ruinsToken.isRevealed) {
    return invalid(NO_ALTAR_TOKEN, "Ruins token has not been revealed");
  }

  const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
  if (!tokenDef || !isAltarToken(tokenDef)) {
    return invalid(NO_ALTAR_TOKEN, "This ruins token is not an altar");
  }

  return valid();
}
