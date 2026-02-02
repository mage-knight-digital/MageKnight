/**
 * Pending state option helpers.
 *
 * Handles special pending states that require player resolution:
 * - Glade wound discard choices
 * - Deep mine crystal color choices
 * - Discard as cost choices
 * - Discard for attack choices (Sword of Justice)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  GladeWoundOptions,
  DeepMineOptions,
  BasicManaColor,
  DiscardCostOptions,
  DiscardForAttackOptions,
} from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { CARD_WOUND, hexKey } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import { getCardsEligibleForDiscardCost } from "../effects/discardEffects.js";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";

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

/**
 * Get discard cost options for the player.
 * Returns options if player has a pending discard cost to resolve.
 */
export function getDiscardCostOptions(
  _state: GameState,
  player: Player
): DiscardCostOptions | undefined {
  // Check if player has a pending discard cost
  if (!player.pendingDiscard) {
    return undefined;
  }

  const { sourceCardId, count, optional, filterWounds } = player.pendingDiscard;

  // Get eligible cards from hand
  const availableCardIds = getCardsEligibleForDiscardCost(player.hand, filterWounds);

  return {
    sourceCardId,
    availableCardIds,
    count,
    optional,
  };
}

/**
 * Get discard for attack options for the player.
 * Returns options if player has a pending discard-for-attack state (Sword of Justice).
 */
export function getDiscardForAttackOptions(
  _state: GameState,
  player: Player
): DiscardForAttackOptions | undefined {
  // Check if player has a pending discard-for-attack
  if (!player.pendingDiscardForAttack) {
    return undefined;
  }

  const { sourceCardId, attackPerCard, combatType } = player.pendingDiscardForAttack;

  // Get eligible cards from hand (non-wound cards)
  const availableCardIds = getCardsEligibleForDiscardForAttack(player.hand);

  return {
    sourceCardId,
    availableCardIds,
    attackPerCard,
    combatType,
  };
}
