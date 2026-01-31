/**
 * Achievement Score Calculators
 *
 * Implements the 6 standard achievement category calculations for Mage Knight:
 * - Greatest Knowledge: +2 per Spell, +1 per Advanced Action
 * - Greatest Loot: +2 per Artifact, +1 per 2 crystals
 * - Greatest Leader: +1 per unit level (wounded = half, floor)
 * - Greatest Conqueror: +2 per shield on keep/mage tower/monastery
 * - Greatest Adventurer: +2 per shield on adventure site
 * - Greatest Beating: -2 per wound in deck (penalty)
 *
 * Based on rulebook text for Standard Achievements Scoring.
 */

import type { Player } from "../../types/player.js";
import type { GameState } from "../../state/GameState.js";
import type { HexState } from "../../types/map.js";
import {
  DEED_CARD_TYPE_SPELL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import { getCard } from "../validActions/cards/index.js";
import { isAdventureSite } from "../../data/siteProperties.js";
import { UNITS } from "@mage-knight/shared";
import {
  CARD_WOUND,
  POINTS_PER_SPELL,
  POINTS_PER_ADVANCED_ACTION,
  POINTS_PER_ARTIFACT,
  CRYSTALS_PER_POINT,
  POINTS_PER_FORTIFIED_SHIELD,
  POINTS_PER_ADVENTURE_SHIELD,
  POINTS_PER_WOUND,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";

/**
 * Get all cards in a player's deed deck (hand + deck + discard).
 * Excludes removed cards (destroyed artifacts, etc.).
 */
function getAllPlayerCards(player: Player): readonly string[] {
  return [...player.hand, ...player.deck, ...player.discard];
}

/**
 * Count cards of a specific type in the player's deck.
 */
function countCardsByType(
  player: Player,
  cardType:
    | typeof DEED_CARD_TYPE_SPELL
    | typeof DEED_CARD_TYPE_ADVANCED_ACTION
    | typeof DEED_CARD_TYPE_ARTIFACT
): number {
  const allCards = getAllPlayerCards(player);
  let count = 0;

  for (const cardId of allCards) {
    const card = getCard(cardId);
    if (card && card.cardType === cardType) {
      count++;
    }
  }

  return count;
}

/**
 * Calculate Greatest Knowledge score.
 * +2 Fame per Spell, +1 Fame per Advanced Action in deck.
 */
export function calculateGreatestKnowledge(player: Player): number {
  const spellCount = countCardsByType(player, DEED_CARD_TYPE_SPELL);
  const advancedActionCount = countCardsByType(
    player,
    DEED_CARD_TYPE_ADVANCED_ACTION
  );

  return spellCount * POINTS_PER_SPELL + advancedActionCount * POINTS_PER_ADVANCED_ACTION;
}

/**
 * Calculate Greatest Loot score.
 * +2 Fame per Artifact in deck or on Units, +1 Fame per 2 crystals (floor).
 *
 * Note: The rulebook says "in their deck or on their Units". Units can have
 * artifacts attached (e.g., banner artifacts). We count both.
 */
export function calculateGreatestLoot(player: Player): number {
  // Count artifacts in deed deck
  const artifactsInDeck = countCardsByType(player, DEED_CARD_TYPE_ARTIFACT);

  // TODO: Count artifacts on units (banners) when that feature is implemented
  // For now, this is 0 since units don't have artifact attachment yet
  const artifactsOnUnits = 0;

  // Count total crystals (all 4 colors)
  const totalCrystals =
    player.crystals.red +
    player.crystals.blue +
    player.crystals.green +
    player.crystals.white;

  // Calculate score
  const artifactPoints = (artifactsInDeck + artifactsOnUnits) * POINTS_PER_ARTIFACT;
  const crystalPoints = Math.floor(totalCrystals / CRYSTALS_PER_POINT);

  return artifactPoints + crystalPoints;
}

/**
 * Calculate Greatest Leader score.
 * +1 Fame per unit level. Wounded units count as half level (floor).
 */
export function calculateGreatestLeader(player: Player): number {
  let totalScore = 0;

  for (const unit of player.units) {
    const unitDef = UNITS[unit.unitId];
    if (!unitDef) continue;

    if (unit.wounded) {
      // Wounded units count as half level, rounded down
      totalScore += Math.floor(unitDef.level / 2);
    } else {
      totalScore += unitDef.level;
    }
  }

  return totalScore;
}

/**
 * Get shield counts for a player on different site types.
 */
function getPlayerShieldCounts(
  state: GameState,
  playerId: string
): { fortified: number; adventure: number } {
  let fortifiedCount = 0;
  let adventureCount = 0;

  // Iterate through all hexes on the map
  for (const hex of Object.values(state.map.hexes) as HexState[]) {
    // Check if player has a shield on this hex
    if (!hex.shieldTokens.includes(playerId)) {
      continue;
    }

    // Check the site type (if any)
    if (!hex.site) {
      continue;
    }

    const siteType = hex.site.type;

    // Conqueror sites: Keep, Mage Tower, Monastery (not City per rulebook)
    // Note: The rulebook says "keep, mage tower or monastery" - not cities
    if (
      siteType === SiteType.Keep ||
      siteType === SiteType.MageTower ||
      siteType === SiteType.Monastery
    ) {
      // Count each shield (usually 1 per site, but count the actual shields)
      fortifiedCount += hex.shieldTokens.filter((id) => id === playerId).length;
    }

    // Adventure sites
    if (isAdventureSite(siteType)) {
      adventureCount += hex.shieldTokens.filter((id) => id === playerId).length;
    }
  }

  return { fortified: fortifiedCount, adventure: adventureCount };
}

/**
 * Calculate Greatest Conqueror score.
 * +2 Fame per shield token on a keep, mage tower, or monastery.
 */
export function calculateGreatestConqueror(
  player: Player,
  state: GameState
): number {
  const { fortified } = getPlayerShieldCounts(state, player.id);
  return fortified * POINTS_PER_FORTIFIED_SHIELD;
}

/**
 * Calculate Greatest Adventurer score.
 * +2 Fame per shield token on an adventure site.
 */
export function calculateGreatestAdventurer(
  player: Player,
  state: GameState
): number {
  const { adventure } = getPlayerShieldCounts(state, player.id);
  return adventure * POINTS_PER_ADVENTURE_SHIELD;
}

/**
 * Count wounds in a player's deed deck (not on units).
 */
function countWoundsInDeck(player: Player): number {
  const allCards = getAllPlayerCards(player);
  return allCards.filter((cardId) => cardId === CARD_WOUND).length;
}

/**
 * Calculate Greatest Beating score.
 * -2 Fame per wound card in deck (not on units).
 * This is a negative score (penalty).
 */
export function calculateGreatestBeating(player: Player): number {
  const woundCount = countWoundsInDeck(player);
  if (woundCount === 0) {
    return 0; // Avoid JavaScript -0 edge case
  }
  return woundCount * POINTS_PER_WOUND; // POINTS_PER_WOUND is already negative
}

/**
 * All achievement calculators mapped by category.
 */
export const ACHIEVEMENT_CALCULATORS = {
  greatest_knowledge: (player: Player, _state: GameState) =>
    calculateGreatestKnowledge(player),
  greatest_loot: (player: Player, _state: GameState) =>
    calculateGreatestLoot(player),
  greatest_leader: (player: Player, _state: GameState) =>
    calculateGreatestLeader(player),
  greatest_conqueror: (player: Player, state: GameState) =>
    calculateGreatestConqueror(player, state),
  greatest_adventurer: (player: Player, state: GameState) =>
    calculateGreatestAdventurer(player, state),
  greatest_beating: (player: Player, _state: GameState) =>
    calculateGreatestBeating(player),
} as const;
