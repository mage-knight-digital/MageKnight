/**
 * Shared influence usefulness rules.
 *
 * Determines whether influence is useful for the player this turn.
 * Used by sideways rules to gate "play sideways for influence" option.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { Site } from "../../types/map.js";
import { SiteType } from "../../types/map.js";
import {
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_PEACEFUL_MOMENT,
  getUnit,
  canRecruitAt,
  type CardId,
} from "@mage-knight/shared";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import {
  canInteractWithSite,
  isSiteAccessibleForInteraction,
  canHealAtSite,
  canBuySpellsAtMageTower,
  canBuyAdvancedActionsAtMonastery,
} from "./siteInteraction.js";
import { canTakeActionPhaseAction } from "./turnStructure.js";
import { siteTypeToRecruitSite, getActiveLearningDiscount } from "./unitRecruitment.js";
import { isWoundCard } from "./turnStructure.js";

/**
 * Whether influence is useful for the player this turn.
 *
 * Short-circuits on first match for performance.
 */
export function isInfluenceUseful(
  state: GameState,
  player: Player
): boolean {
  return (
    hasSiteInfluenceSink(state, player) ||
    hasLearningInfluenceSink(state, player) ||
    hasCardInfluenceSink(state, player)
  );
}

/**
 * Whether the player is at an accessible inhabited site where influence
 * can be spent (healing, recruitment, spell purchase, AA purchase).
 */
function hasSiteInfluenceSink(
  state: GameState,
  player: Player
): boolean {
  if (!player.position) return false;

  const site = getPlayerSite(state, player.id);
  if (!site) return false;

  // Must be inhabited and accessible
  if (!canInteractWithSite(site)) return false;
  if (!isSiteAccessibleForInteraction(site, player.id)) return false;

  // Must be able to take an action (site interaction is an action)
  if (!canTakeActionPhaseAction(player)) return false;
  if (player.isResting) return false;

  return (
    canHealWithInfluence(site, player) ||
    canRecruitWithInfluence(state, site) ||
    canBuySpells(state, site) ||
    canBuyAdvancedActions(state, site)
  );
}

/**
 * Healing sink: site supports healing AND player has wounds in hand or wounded units.
 */
function canHealWithInfluence(
  site: Site,
  player: Player
): boolean {
  if (!canHealAtSite(site.type, site.isBurned)) return false;

  const hasWoundsInHand = player.hand.some((cardId) => isWoundCard(cardId));
  const hasWoundedUnits = player.units.some((u) => u.wounded);

  return hasWoundsInHand || hasWoundedUnits;
}

/**
 * Recruitment sink: site maps to a recruit site AND at least one unit in offer
 * is recruitable at that site. Refugee Camps accept all units.
 */
function canRecruitWithInfluence(
  state: GameState,
  site: Site
): boolean {
  const recruitSite = siteTypeToRecruitSite(site.type);
  if (!recruitSite) return false;

  const unitOffer = state.offers.units;
  if (unitOffer.length === 0) return false;

  // Refugee camps accept all units
  if (site.type === SiteType.RefugeeCamp) return true;

  // Check if any unit in the offer can be recruited at this site
  return unitOffer.some((unitId) => {
    const unit = getUnit(unitId);
    return canRecruitAt(unit, recruitSite);
  });
}

/**
 * Spell purchase sink: conquered Mage Tower with spells in offer.
 */
function canBuySpells(
  state: GameState,
  site: Site
): boolean {
  if (!canBuySpellsAtMageTower(site)) return false;
  return state.offers.spells.cards.length > 0;
}

/**
 * AA purchase sink: non-burned Monastery with AAs in monastery offer.
 */
function canBuyAdvancedActions(
  state: GameState,
  site: Site
): boolean {
  if (!canBuyAdvancedActionsAtMonastery(site)) return false;
  return state.offers.monasteryAdvancedActions.length > 0;
}

/**
 * Whether the player has an active Learning discount and AAs available to buy.
 */
function hasLearningInfluenceSink(
  state: GameState,
  player: Player
): boolean {
  if (!getActiveLearningDiscount(state, player.id)) return false;
  return state.offers.advancedActions.cards.length > 0;
}

/**
 * Whether the player has a card in hand that can consume influence.
 *
 * - Ruthless Coercion: powered effect readies units for influence. Always a sink.
 * - Peaceful Moment: action mode converts 2 influence → 1 heal.
 *   Requires action available AND (wounds in hand OR wounded units).
 */
function hasCardInfluenceSink(
  state: GameState,
  player: Player
): boolean {
  for (const cardId of player.hand) {
    if (cardId === (CARD_KRANG_RUTHLESS_COERCION as CardId)) {
      return true;
    }
    if (cardId === (CARD_PEACEFUL_MOMENT as CardId)) {
      if (!canTakeActionPhaseAction(player)) continue;
      const hasWoundsInHand = player.hand.some((c) => isWoundCard(c));
      const hasWoundedUnits = player.units.some((u) => u.wounded);
      if (hasWoundsInHand || hasWoundedUnits) return true;
    }
  }
  return false;
}
