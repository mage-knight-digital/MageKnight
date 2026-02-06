/**
 * Pending state option helpers.
 *
 * Handles special pending states that require player resolution:
 * - Glade wound discard choices
 * - Deep mine crystal color choices
 * - Discard as cost choices
 * - Discard for attack choices (Sword of Justice)
 * - Crystal Joy reclaim choices
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  GladeWoundOptions,
  DeepMineOptions,
  BasicManaColor,
  DiscardCostOptions,
  DiscardForAttackOptions,
  DiscardForCrystalOptions,
  ArtifactCrystalColorOptions,
  CrystalJoyReclaimOptions,
  CardId,
} from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { CARD_WOUND, hexKey, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import { getCardsEligibleForDiscardCost } from "../effects/discardEffects.js";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";
import { getCardsEligibleForDiscardForCrystal } from "../effects/discardForCrystalEffects.js";
import { getCard } from "../helpers/cardLookup.js";
import { isCardEligibleForReclaim } from "../rules/crystalJoyReclaim.js";

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

  const { sourceCardId, count, optional, filterWounds, colorMatters, allowNoColor } = player.pendingDiscard;

  // Get eligible cards from hand
  const availableCardIds = getCardsEligibleForDiscardCost(
    player.hand,
    filterWounds,
    colorMatters ?? false,
    allowNoColor ?? false
  );

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

/**
 * Get discard for crystal options for the player.
 * Returns options if player has a pending discard-for-crystal state (Savage Harvesting).
 */
export function getDiscardForCrystalOptions(
  _state: GameState,
  player: Player
): DiscardForCrystalOptions | undefined {
  // Check if player has a pending discard-for-crystal (not awaiting color choice)
  if (!player.pendingDiscardForCrystal || player.pendingDiscardForCrystal.awaitingColorChoice) {
    return undefined;
  }

  const { sourceCardId, optional } = player.pendingDiscardForCrystal;

  // Get eligible cards from hand (non-wound cards)
  const availableCardIds = getCardsEligibleForDiscardForCrystal(player.hand);

  return {
    sourceCardId,
    availableCardIds,
    optional,
  };
}

/**
 * Get artifact crystal color options for the player.
 * Returns options if player has a pending artifact color choice (Savage Harvesting).
 */
export function getArtifactCrystalColorOptions(
  _state: GameState,
  player: Player
): ArtifactCrystalColorOptions | undefined {
  // Check if player is awaiting color choice after artifact discard
  if (!player.pendingDiscardForCrystal?.awaitingColorChoice) {
    return undefined;
  }

  return {
    availableColors: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  };
}

/**
 * Get Crystal Joy reclaim options for the player.
 * Returns eligible cards from discard pile if player has a pending reclaim choice.
 */
export function getCrystalJoyReclaimOptions(
  _state: GameState,
  player: Player
): CrystalJoyReclaimOptions {
  const { version } = player.pendingCrystalJoyReclaim!;

  const eligibleCardIds: CardId[] = [];

  for (const cardId of player.discard) {
    const card = getCard(cardId);
    if (card && isCardEligibleForReclaim(card, version)) {
      eligibleCardIds.push(cardId);
    }
  }

  return {
    version,
    eligibleCardIds,
  };
}
