/**
 * Shared unit recruitment rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { Player } from "../../types/player.js";
import type { GameState } from "../../state/GameState.js";
import type { RecruitDiscountModifier } from "../../types/modifiers.js";
import {
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  RECRUIT_SITE_CAMP,
  RECRUIT_SITE_MAGICAL_GLADE,
  MIN_REPUTATION,
  MAX_REPUTATION,
  UNIT_THUGS,
  getUnit,
  isHeroUnitId,
  type RecruitSite,
  type UnitId,
  type UnitDefinition,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import {
  EFFECT_RECRUIT_DISCOUNT,
  EFFECT_RECRUITMENT_BONUS,
  EFFECT_INTERACTION_BONUS,
  EFFECT_LEARNING_DISCOUNT,
  RULE_IGNORE_REPUTATION,
} from "../../types/modifierConstants.js";
import type { UnitRecruitmentBonusModifier, InteractionBonusModifier, LearningDiscountModifier } from "../../types/modifiers.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { isRuleActive } from "../modifiers/index.js";

/**
 * Check if reputation effects should be ignored for the player.
 * Used by Arcane Disguise.
 */
export function shouldIgnoreReputationEffects(
  state: GameState,
  playerId: string
): boolean {
  return isRuleActive(state, playerId, RULE_IGNORE_REPUTATION);
}

/**
 * Reputation cost modifier based on player's reputation track position.
 * Higher reputation = lower costs, lower reputation = higher costs.
 *
 * Per rulebook:
 * -7: +5 | -6: +3 | -5: +3 | -4: +2 | -3: +2 | -2: +1 | -1: +1
 *  0: 0
 * +1: -1 | +2: -1 | +3: -2 | +4: -2 | +5: -3 | +6: -3 | +7: -5
 *
 * For Heroes units, the modifier is DOUBLED (per rulebook).
 * The doubled modifier is only applied once per interaction (first Hero recruited).
 *
 * For Thugs (reversedReputation = true), the modifier is REVERSED:
 * negative reputation makes them cheaper, positive makes them more expensive.
 * The reversed modifier is fixed at interaction start per FAQ.
 *
 * @param reputation - The player's current reputation value
 * @param unitId - Optional unit ID to check for special rules
 * @param hasRecruitedHeroThisInteraction - Whether a Hero has already been recruited
 *        at this site during the current interaction (for doubled reputation tracking)
 */
export function getReputationCostModifier(
  reputation: number,
  unitId?: UnitId,
  hasRecruitedHeroThisInteraction?: boolean,
  ignoreReputationEffects: boolean = false
): number {
  if (ignoreReputationEffects) {
    return 0;
  }

  // Clamp to valid range
  const rep = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation));

  let baseModifier: number;
  if (rep === 0) {
    baseModifier = 0;
  } else if (rep === MIN_REPUTATION) {
    baseModifier = 5;
  } else if (rep === MAX_REPUTATION) {
    baseModifier = -5;
  } else {
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
    baseModifier = rep < 0 ? modifier : -modifier;
  }

  // Thugs special rule: reputation modifier is REVERSED
  // Per rulebook, low reputation = easier to recruit, high reputation = harder
  if (unitId) {
    const unitDef = getUnit(unitId);
    if (unitDef.reversedReputation && baseModifier !== 0) {
      baseModifier = -baseModifier;
    }
  }

  // Heroes special rule: reputation modifier is doubled
  // Per rulebook, this applies once per interaction (FAQ clarification)
  // The doubled modifier only applies to the first Hero recruited at a site
  if (unitId && isHeroUnitId(unitId) && !hasRecruitedHeroThisInteraction) {
    return baseModifier * 2;
  }

  return baseModifier;
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
    case SiteType.MagicalGlade:
      return RECRUIT_SITE_MAGICAL_GLADE;
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
    case SiteType.MagicalGlade:
      // Villages, Refugee Camps, and Magical Glades are always accessible
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
 * Check if recruiting a unit would violate Heroes/Thugs exclusion rule.
 *
 * Per rulebook: Cannot recruit Heroes and Thugs during the same interaction
 * (same site visit). If Heroes were already recruited, Thugs are blocked and vice versa.
 *
 * @param unitId - The unit being considered for recruitment
 * @param unitsRecruitedThisInteraction - Units already recruited at this site
 * @returns true if recruitment would violate the exclusion rule
 */
export function violatesHeroesThugsExclusion(
  unitId: UnitId,
  unitsRecruitedThisInteraction: readonly UnitId[]
): boolean {
  // Check if recruiting a Hero when Thugs were already recruited
  if (isHeroUnitId(unitId)) {
    return unitsRecruitedThisInteraction.includes(UNIT_THUGS);
  }
  // Check if recruiting Thugs when any Hero was already recruited
  if (unitId === UNIT_THUGS) {
    return unitsRecruitedThisInteraction.some((id) => isHeroUnitId(id));
  }
  return false;
}

/**
 * Check if a Hero has already been recruited during the current interaction.
 * Used for tracking the doubled reputation modifier (applies once per interaction).
 */
export function hasRecruitedHeroThisInteraction(
  unitsRecruitedThisInteraction: readonly UnitId[]
): boolean {
  return unitsRecruitedThisInteraction.some((id) => isHeroUnitId(id));
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
 * Check if recruitment at a Magical Glade.
 * Magical Glade recruitment counts as an action (not interaction),
 * reputation has no impact on cost, and interaction-only effects don't trigger.
 */
export function isGladeRecruitment(siteType: SiteType): boolean {
  return siteType === SiteType.MagicalGlade;
}

/**
 * Get the number of command tokens used by current units.
 * Each unit costs 1 command token.
 */
export function getUsedCommandTokens(player: Player): number {
  return player.units.length;
}

/**
 * Get the active recruit discount for a player, if any.
 * Returns the first recruit discount modifier found, or null if none.
 *
 * Used by recruitment validators and validActions to apply discount.
 */
export function getActiveRecruitDiscount(
  state: GameState,
  playerId: string,
): RecruitDiscountModifier | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const discountMod = modifiers.find((m) => m.effect.type === EFFECT_RECRUIT_DISCOUNT);
  if (!discountMod) return null;
  return discountMod.effect as RecruitDiscountModifier;
}

/**
 * Get the active recruit discount modifier ID, for removing it after use.
 */
export function getActiveRecruitDiscountModifierId(
  state: GameState,
  playerId: string,
): string | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const discountMod = modifiers.find((m) => m.effect.type === EFFECT_RECRUIT_DISCOUNT);
  return discountMod?.id ?? null;
}

/**
 * Get active recruitment bonus modifiers for a player.
 * Returns the combined reputation and fame bonuses from all active modifiers.
 * Unlike recruit discount, these modifiers are NOT consumed — they trigger on every recruitment.
 *
 * Used by Heroic Tale card.
 */
export function getActiveRecruitmentBonus(
  state: GameState,
  playerId: string,
): { reputationPerRecruit: number; famePerRecruit: number } | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const bonusMods = modifiers.filter((m) => m.effect.type === EFFECT_RECRUITMENT_BONUS);
  if (bonusMods.length === 0) return null;

  let totalReputation = 0;
  let totalFame = 0;
  for (const mod of bonusMods) {
    const effect = mod.effect as UnitRecruitmentBonusModifier;
    totalReputation += effect.reputationPerRecruit;
    totalFame += effect.famePerRecruit;
  }

  return { reputationPerRecruit: totalReputation, famePerRecruit: totalFame };
}

/**
 * Get the active interaction bonus for a player, if any.
 * Returns the combined fame and reputation from all active interaction bonus modifiers.
 * Used by Noble Manners card — consumed on first interaction.
 */
export function getActiveInteractionBonus(
  state: GameState,
  playerId: string,
): { fame: number; reputation: number } | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const bonusMods = modifiers.filter((m) => m.effect.type === EFFECT_INTERACTION_BONUS);
  if (bonusMods.length === 0) return null;

  let totalFame = 0;
  let totalReputation = 0;
  for (const mod of bonusMods) {
    const effect = mod.effect as InteractionBonusModifier;
    totalFame += effect.fame;
    totalReputation += effect.reputation;
  }

  return { fame: totalFame, reputation: totalReputation };
}

/**
 * Get the IDs of all active interaction bonus modifiers for a player.
 * Used to consume (remove) the modifiers after the first interaction.
 */
export function getActiveInteractionBonusModifierIds(
  state: GameState,
  playerId: string,
): readonly string[] {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers
    .filter((m) => m.effect.type === EFFECT_INTERACTION_BONUS)
    .map((m) => m.id);
}

/**
 * Get the active learning discount for a player, if any.
 * Returns the first learning discount modifier found, or null if none.
 *
 * Used by Learning card — once per turn, pay influence for AA from regular offer.
 */
export function getActiveLearningDiscount(
  state: GameState,
  playerId: string,
): LearningDiscountModifier | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const discountMod = modifiers.find((m) => m.effect.type === EFFECT_LEARNING_DISCOUNT);
  if (!discountMod) return null;
  return discountMod.effect as LearningDiscountModifier;
}

/**
 * Get the active learning discount modifier ID, for removing it after use.
 */
export function getActiveLearningDiscountModifierId(
  state: GameState,
  playerId: string,
): string | null {
  const modifiers = getModifiersForPlayer(state, playerId);
  const discountMod = modifiers.find((m) => m.effect.type === EFFECT_LEARNING_DISCOUNT);
  return discountMod?.id ?? null;
}
