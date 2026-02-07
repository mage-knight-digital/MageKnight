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
import { UNITS, MIN_REPUTATION, type UnitId } from "@mage-knight/shared";
import { SiteType } from "../../../types/map.js";
import { mustAnnounceEndOfRound } from "../helpers.js";
import {
  siteTypeToRecruitSite,
  isSiteAccessibleForRecruitment,
  hasRecruitedHeroThisInteraction,
  violatesHeroesThugsExclusion,
  getReputationCostModifier,
  getRefugeeCampCostModifier,
  getActiveRecruitDiscount,
} from "../../rules/unitRecruitment.js";
import { getEffectiveCommandTokens, isBondsSlotEmpty, BONDS_INFLUENCE_DISCOUNT } from "../../rules/bondsOfLoyalty.js";


/**
 * Compute unit options for a player at a recruitment site.
 *
 * Returns recruitable units from the offer that match:
 * - Current site type
 * - Site ownership requirements
 * - Cost calculation with reputation modifier (doubled for Heroes)
 * - Heroes/Thugs exclusion (cannot recruit both in same interaction)
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

  // Must announce end of round before taking other actions
  if (mustAnnounceEndOfRound(state, player)) {
    return undefined;
  }

  // At "X" reputation (MIN_REPUTATION), inhabitants refuse to interact
  if (player.reputation <= MIN_REPUTATION) {
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

  // Check command token availability (including Bonds of Loyalty extra slot)
  const effectiveTokens = getEffectiveCommandTokens(player);
  const hasCommandTokens = player.units.length < effectiveTokens;

  // Track if Hero has been recruited this interaction (for doubled reputation)
  const heroAlreadyRecruited = hasRecruitedHeroThisInteraction(
    player.unitsRecruitedThisInteraction
  );

  // Check for active recruit discount (Ruthless Coercion)
  const discountMod = getActiveRecruitDiscount(state, player.id);

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

    // Check Heroes/Thugs exclusion rule
    if (
      violatesHeroesThugsExclusion(
        unit.id,
        player.unitsRecruitedThisInteraction
      )
    ) {
      continue;
    }

    // Calculate base cost
    const baseCost = unit.influence;

    // Add Refugee Camp tiered cost modifier if applicable
    const refugeeCampModifier = isRefugeeCamp
      ? getRefugeeCampCostModifier(unit)
      : 0;

    // Calculate reputation modifier (doubled for Heroes, but only for first Hero)
    const reputationModifier = getReputationCostModifier(
      player.reputation,
      unit.id,
      heroAlreadyRecruited
    );

    // Apply recruit discount if available (Ruthless Coercion)
    const recruitDiscountAmount = discountMod ? discountMod.discount : 0;

    // Apply Bonds of Loyalty discount if the Bonds slot is empty
    const bondsDiscount = isBondsSlotEmpty(player) ? BONDS_INFLUENCE_DISCOUNT : 0;

    // Calculate final cost with reputation modifier and discount (minimum 0)
    const adjustedCost = Math.max(
      0,
      baseCost + refugeeCampModifier + reputationModifier - recruitDiscountAmount - bondsDiscount
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
