/**
 * Unit recruitment options computation.
 *
 * Determines which units can be recruited based on:
 * - Player's current location (must be at a recruit site)
 * - Site ownership (keeps/mage towers must be conquered by player, cities must be conquered)
 * - Unit's recruit sites vs current site type
 * - Player's influence points and reputation modifier
 * - Command token limit
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { UnitOptions, RecruitableUnit } from "@mage-knight/shared";
import {
  UNITS,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  RECRUIT_SITE_CAMP,
  MIN_REPUTATION,
  MAX_REPUTATION,
  type RecruitSite,
  type UnitId,
  type UnitDefinition,
} from "@mage-knight/shared";
import { SiteType } from "../../../types/map.js";

/**
 * Reputation cost modifier based on player's reputation track position.
 * Higher reputation = lower costs, lower reputation = higher costs.
 *
 * Per rulebook:
 * -7: +5 | -6: +3 | -5: +3 | -4: +2 | -3: +2 | -2: +1 | -1: +1
 *  0: 0
 * +1: -1 | +2: -1 | +3: -2 | +4: -2 | +5: -3 | +6: -3 | +7: -5
 */
export function getReputationCostModifier(reputation: number): number {
  // Clamp to valid range
  const rep = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation));

  if (rep === 0) return 0;
  if (rep === MIN_REPUTATION) return 5;
  if (rep === MAX_REPUTATION) return -5;

  // Symmetric pattern: ±1-2 = ±1, ±3-4 = ±2, ±5-6 = ±3
  const absRep = Math.abs(rep);
  let modifier: number;
  if (absRep <= 2) {
    modifier = 1;
  } else if (absRep <= 4) {
    modifier = 2;
  } else {
    modifier = 3;
  }

  return rep < 0 ? modifier : -modifier;
}

/**
 * Map site type to recruit site constant.
 * Returns null if the site type doesn't support recruitment.
 * Note: RefugeeCamp returns "camp" - it can recruit any unit but with tiered costs.
 */
export function siteTypeToRecruitSite(siteType: SiteType): RecruitSite | null {
  switch (siteType) {
    case SiteType.Village:
      return RECRUIT_SITE_VILLAGE;
    case SiteType.Keep:
      return RECRUIT_SITE_KEEP;
    case SiteType.MageTower:
      return RECRUIT_SITE_MAGE_TOWER;
    case SiteType.Monastery:
      return RECRUIT_SITE_MONASTERY;
    case SiteType.City:
      return RECRUIT_SITE_CITY;
    case SiteType.RefugeeCamp:
      return RECRUIT_SITE_CAMP;
    default:
      return null;
  }
}

/**
 * Check if a site is accessible for recruitment.
 *
 * Villages are always accessible.
 * Refugee Camps are always accessible (like Villages).
 * Keeps/Mage Towers must be conquered by the player.
 * Cities must be conquered (any player).
 * Monasteries must not be burned and must be conquered if fortified.
 */
export function isSiteAccessibleForRecruitment(
  siteType: SiteType,
  isConquered: boolean,
  owner: string | null,
  playerId: string,
  isBurned: boolean
): boolean {
  switch (siteType) {
    case SiteType.Village:
    case SiteType.RefugeeCamp:
      // Villages and Refugee Camps are always accessible
      return true;

    case SiteType.Keep:
    case SiteType.MageTower:
      // Fortified sites must be conquered by this player
      return isConquered && owner === playerId;

    case SiteType.City:
      // Cities must be conquered (by any player)
      return isConquered;

    case SiteType.Monastery:
      // Monasteries can't be burned, and must be conquered if fortified
      // (Monasteries in base game aren't fortified, but check anyway)
      return !isBurned;

    default:
      return false;
  }
}

/**
 * Get the number of command tokens used by current units.
 * Each unit costs 1 command token.
 */
export function getUsedCommandTokens(player: Player): number {
  return player.units.length;
}

/**
 * Calculate the tiered recruitment cost modifier for a unit at a Refugee Camp.
 *
 * Per rulebook:
 * - Village-recruitable units: +0 (normal cost)
 * - Keep/MageTower/Monastery-recruitable units (not Village): +1
 * - City-only units: +3
 *
 * For units recruitable at multiple sites, use the cheapest applicable cost (lowest tier).
 */
export function getRefugeeCampCostModifier(unit: UnitDefinition): number {
  // Check sites in order of cost tier (cheapest first)
  // Tier 0: Village = +0
  if (unit.recruitSites.includes(RECRUIT_SITE_VILLAGE)) {
    return 0;
  }

  // Tier 1: Keep, Mage Tower, or Monastery = +1
  if (
    unit.recruitSites.includes(RECRUIT_SITE_KEEP) ||
    unit.recruitSites.includes(RECRUIT_SITE_MAGE_TOWER) ||
    unit.recruitSites.includes(RECRUIT_SITE_MONASTERY)
  ) {
    return 1;
  }

  // Tier 2: City-only = +3
  if (unit.recruitSites.includes(RECRUIT_SITE_CITY)) {
    return 3;
  }

  // Fallback (shouldn't happen for valid units)
  return 0;
}

/**
 * Compute unit options for a player at a recruitment site.
 *
 * Returns recruitable units from the offer that match:
 * - Current site type
 * - Site ownership requirements
 * - Cost calculation with reputation modifier
 * - Command token availability
 */
export function getUnitOptions(
  state: GameState,
  player: Player
): UnitOptions | undefined {
  // Player must be on the map
  if (!player.position) {
    return undefined;
  }

  // Get hex at player's position
  const hexKey = `${player.position.q},${player.position.r}`;
  const hex = state.map.hexes[hexKey];
  if (!hex || !hex.site) {
    return undefined;
  }

  // Check if site type supports recruitment
  const recruitSite = siteTypeToRecruitSite(hex.site.type);
  if (!recruitSite) {
    return undefined;
  }

  // Check if site is accessible for recruitment
  if (
    !isSiteAccessibleForRecruitment(
      hex.site.type,
      hex.site.isConquered,
      hex.site.owner,
      player.id,
      hex.site.isBurned
    )
  ) {
    return undefined;
  }

  // Calculate reputation modifier
  const reputationModifier = getReputationCostModifier(player.reputation);

  // Check command token availability
  const usedTokens = getUsedCommandTokens(player);
  const hasCommandTokens = usedTokens < player.commandTokens;

  // Build list of recruitable units from the offer
  const recruitable: RecruitableUnit[] = [];
  const isRefugeeCamp = hex.site.type === SiteType.RefugeeCamp;

  for (const unitId of state.offers.units) {
    const unit = UNITS[unitId as UnitId];
    if (!unit) continue;

    // At Refugee Camp, all units can be recruited with tiered costs
    // At other sites, only units with matching recruitSites can be recruited
    if (!isRefugeeCamp && !unit.recruitSites.includes(recruitSite)) {
      continue;
    }

    // Calculate base cost
    const baseCost = unit.influence;

    // Add Refugee Camp tiered cost modifier if applicable
    const refugeeCampModifier = isRefugeeCamp
      ? getRefugeeCampCostModifier(unit)
      : 0;

    // Calculate final cost with reputation modifier (minimum 0)
    const adjustedCost = Math.max(
      0,
      baseCost + refugeeCampModifier + reputationModifier
    );

    // Check if player can afford it
    const canAfford =
      hasCommandTokens && player.influencePoints >= adjustedCost;

    recruitable.push({
      unitId: unit.id,
      cost: adjustedCost,
      canAfford,
    });
  }

  // If no units are recruitable at this site, return undefined
  if (recruitable.length === 0) {
    return undefined;
  }

  return {
    recruitable,
    activatable: [], // Recruitment context - no activation here
  };
}
