/**
 * Shared site interaction rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { Site, HexState } from "../../types/map.js";
import { SiteType } from "../../types/map.js";
import {
  SITE_PROPERTIES,
  getHealingCost,
  MONASTERY_AA_PURCHASE_COST,
} from "../../data/siteProperties.js";
import type { EnemyColor } from "@mage-knight/shared";
import {
  getRuinsTokenDefinition,
  isEnemyToken,
} from "@mage-knight/shared";
import { getAdventureSiteEnemies } from "../helpers/enemy/siteMapping.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Check if player can interact with this site (inhabited sites).
 *
 * This checks if the site is an inhabited site.
 * Accessibility checks (conquest, ownership, burned) are handled separately.
 */
export function canInteractWithSite(
  site: Site
): boolean {
  const props = SITE_PROPERTIES[site.type];
  return props.inhabited;
}

/**
 * Check if site has dungeon/tomb style combat restrictions.
 * These sites prevent night mana from being used and don't allow units in combat.
 */
export function hasCombatRestrictions(siteType: SiteType): boolean {
  return siteType === SiteType.Dungeon || siteType === SiteType.Tomb;
}

/**
 * Check if a site can be entered as an adventure site.
 *
 * Unconquered adventure sites can always be entered.
 * Conquered adventure sites can only be re-entered for fame at Dungeons and Tombs.
 */
export function canEnterAdventureSite(site: Site): boolean {
  const props = SITE_PROPERTIES[site.type];

  // Only adventure sites can be "entered"
  if (!props.adventureSite) return false;

  // For conquered adventure sites, can re-enter for fame (dungeon/tomb only)
  if (site.isConquered) {
    return site.type === SiteType.Dungeon || site.type === SiteType.Tomb;
  }

  // Unconquered adventure site - can always enter
  return true;
}

function getAvailableEnemyTokenCount(
  state: GameState,
  color: EnemyColor
): number {
  return (
    state.enemyTokens.drawPiles[color].length +
    state.enemyTokens.discardPiles[color].length
  );
}

/**
 * Check if entering this adventure site can produce at least one combat enemy.
 *
 * This prevents offering/validating ENTER_SITE when required draw piles are empty.
 */
export function hasEnemiesAvailableForAdventureSite(
  state: GameState,
  hex: HexState
): boolean {
  const site = hex.site;
  if (!site) return false;

  // Ancient Ruins draw based on revealed token definition.
  if (site.type === SiteType.AncientRuins) {
    if (!hex.ruinsToken) return false;
    const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
    if (!tokenDef || !isEnemyToken(tokenDef)) {
      return false;
    }
    return tokenDef.enemies.some((color) => getAvailableEnemyTokenCount(state, color) > 0);
  }

  const adventureEnemies = getAdventureSiteEnemies(site.type);
  if (!adventureEnemies) {
    return hex.enemies.length > 0;
  }

  // Dungeons/Tombs always draw fresh; must have drawable tokens.
  if (site.type === SiteType.Dungeon || site.type === SiteType.Tomb) {
    return getAvailableEnemyTokenCount(state, adventureEnemies.color) > 0;
  }

  // Monster Den/Spawning Grounds can re-fight existing enemies.
  if (hex.enemies.length > 0) {
    return true;
  }

  // Otherwise must be able to draw at least one enemy.
  return getAvailableEnemyTokenCount(state, adventureEnemies.color) > 0;
}

/**
 * Check if site allows healing interactions.
 * Most sites allow healing unless they are burned.
 *
 * Returns the healing cost if healing is available, null if not available.
 */
export function canHealAtSite(siteType: SiteType, isBurned: boolean): boolean {
  if (isBurned) return false;
  return getHealingCost(siteType) !== undefined;
}

/**
 * Check if a site is a recruitment site.
 */
export function isRecruitmentSite(siteType: SiteType): boolean {
  const props = SITE_PROPERTIES[siteType];
  return props.inhabited;
}

/**
 * Check if a Mage Tower is conquered and can sell spells.
 */
export function canBuySpellsAtMageTower(site: Site): boolean {
  return site.type === SiteType.MageTower && site.isConquered;
}

/**
 * Check if a Monastery is not burned and can sell advanced actions.
 */
export function canBuyAdvancedActionsAtMonastery(site: Site): boolean {
  return site.type === SiteType.Monastery && !site.isBurned;
}

/**
 * Check if the player can afford a Monastery advanced action purchase.
 */
export function canAffordMonasteryAdvancedAction(influencePoints: number): boolean {
  return influencePoints >= MONASTERY_AA_PURCHASE_COST;
}

/**
 * Check if a player is at an inhabited site where they can interact.
 * Combines inhabited check with accessibility check.
 * Used by skill activation rules and condition evaluators.
 */
export function isPlayerAtInteractionSite(
  site: Site,
  playerId: string
): boolean {
  return canInteractWithSite(site) && isSiteAccessibleForInteraction(site, playerId);
}

/**
 * Validate site is accessible based on site type and state.
 *
 * Returns true if accessible, false otherwise. The caller determines the error message.
 * Used by both validators and validActions to ensure alignment.
 */
export function isSiteAccessibleForInteraction(
  site: Site,
  playerId: string
): boolean {
  const props = SITE_PROPERTIES[site.type];

  // Fortified sites require conquest
  if (props.fortified && !site.isConquered) {
    return false;
  }

  // Keeps specifically require ownership (not just conquest)
  if (site.type === SiteType.Keep && site.owner !== playerId) {
    return false;
  }

  // Burned monasteries can't be interacted with
  if (site.type === SiteType.Monastery && site.isBurned) {
    return false;
  }

  return true;
}
