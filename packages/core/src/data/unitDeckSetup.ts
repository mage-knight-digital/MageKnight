/**
 * Unit deck setup utilities for Mage Knight
 *
 * Creates and shuffles unit decks based on scenario configuration.
 * Handles the distinction between regular (silver) and elite (gold) units.
 * Populates the initial unit offer based on player count and scenario rules.
 */

import type { ScenarioConfig, UnitId } from "@mage-knight/shared";
import {
  UNITS,
  UNIT_TYPE_REGULAR,
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
} from "@mage-knight/shared";
import type { GameDecks } from "../types/decks.js";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";

/**
 * Result of unit deck and offer initialization
 */
export interface UnitDeckSetupResult {
  readonly decks: {
    readonly regularUnits: readonly UnitId[];
    readonly eliteUnits: readonly UnitId[];
  };
  readonly unitOffer: readonly UnitId[];
  readonly rng: RngState;
}

/**
 * Build the regular unit deck from UNITS definitions.
 * Each unit appears `copies` times in the deck.
 */
function buildRegularUnitDeck(): UnitId[] {
  const deck: UnitId[] = [];
  for (const unit of Object.values(UNITS)) {
    if (unit.type === UNIT_TYPE_REGULAR) {
      for (let i = 0; i < unit.copies; i++) {
        deck.push(unit.id);
      }
    }
  }
  return deck;
}

/**
 * Build the elite unit deck from UNITS definitions.
 * Each unit appears `copies` times in the deck.
 */
function buildEliteUnitDeck(): UnitId[] {
  const deck: UnitId[] = [];
  for (const unit of Object.values(UNITS)) {
    if (unit.type === UNIT_TYPE_ELITE) {
      for (let i = 0; i < unit.copies; i++) {
        deck.push(unit.id);
      }
    }
  }
  return deck;
}

/**
 * Check if a unit can be recruited at a village.
 * Used for the First Reconnaissance rule that requires at least one village unit.
 */
function isVillageUnit(unitId: UnitId): boolean {
  const unit = UNITS[unitId];
  return unit.recruitSites.includes(RECRUIT_SITE_VILLAGE);
}

/**
 * Create unit decks and populate the initial unit offer.
 *
 * Per the rulebook:
 * - Regular units (silver back) and Elite units (gold back) are separate decks
 * - Initial unit offer is playerCount + 2 cards from the Regular deck
 * - For First Reconnaissance: must have at least one village-type unit in offer
 * - For First Reconnaissance: Elite units are not used
 *
 * @param config - Scenario configuration
 * @param playerCount - Number of players
 * @param rng - Seeded RNG state
 * @returns Unit decks, initial offer, and updated RNG state
 */
export function createUnitDecksAndOffer(
  config: ScenarioConfig,
  playerCount: number,
  rng: RngState
): UnitDeckSetupResult {
  // Build and shuffle regular unit deck
  const regularDeck = buildRegularUnitDeck();
  const { result: shuffledRegular, rng: rng1 } = shuffleWithRng(
    regularDeck,
    rng
  );

  // Build and shuffle elite unit deck (only if scenario allows)
  let shuffledElite: UnitId[] = [];
  let currentRng = rng1;

  if (config.eliteUnitsEnabled) {
    const eliteDeck = buildEliteUnitDeck();
    const { result, rng: rng2 } = shuffleWithRng(eliteDeck, currentRng);
    shuffledElite = result;
    currentRng = rng2;
  }

  // Calculate offer size: playerCount + 2
  const offerSize = playerCount + 2;

  // Draw initial offer from regular deck
  let unitOffer = shuffledRegular.slice(0, offerSize);
  let remainingRegular = shuffledRegular.slice(offerSize);

  // For First Reconnaissance, ensure at least one village unit in offer
  // "For the first game, there should be at least one Unit in the offer
  // with the village icon on the left side of the card. If not, shuffle
  // the cards and deal them until this is true."
  if (config.id === "first_reconnaissance") {
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loop

    while (!unitOffer.some(isVillageUnit) && attempts < maxAttempts) {
      // Combine offer and remaining, reshuffle, redeal
      const allRegular = [...unitOffer, ...remainingRegular];
      const { result: reshuffled, rng: newRng } = shuffleWithRng(
        allRegular,
        currentRng
      );
      currentRng = newRng;
      unitOffer = reshuffled.slice(0, offerSize);
      remainingRegular = reshuffled.slice(offerSize);
      attempts++;
    }
  }

  return {
    decks: {
      regularUnits: remainingRegular,
      eliteUnits: shuffledElite,
    },
    unitOffer,
    rng: currentRng,
  };
}

/**
 * Refresh the unit offer at the start of a new round.
 *
 * Per the rulebook:
 * - Take all Unit cards currently in the offer and put them on the bottom of their corresponding decks
 * - If no Core tile has been revealed: deal Regular (silver) Units only
 * - If at least one Core tile has been revealed: alternate Elite (gold) and Regular (silver)
 *   (Elite, Regular, Elite, Regular, etc.)
 * - For each unburned monastery on the map, add one Advanced Action card to the Unit offer
 *
 * @param currentOffer - Current units in offer (to return to decks)
 * @param decks - Current game decks
 * @param playerCount - Number of players
 * @param coreTileRevealed - Whether any core tile has been revealed
 * @param eliteUnitsEnabled - Whether elite units are enabled for this scenario
 * @param rng - Seeded RNG state
 * @returns Updated decks, new offer, and updated RNG state
 */
export function refreshUnitOffer(
  currentOffer: readonly UnitId[],
  decks: GameDecks,
  playerCount: number,
  coreTileRevealed: boolean,
  eliteUnitsEnabled: boolean,
  rng: RngState
): {
  decks: GameDecks;
  unitOffer: readonly UnitId[];
  rng: RngState;
} {
  // Return current offer cards to bottom of their respective decks
  const regularToReturn: UnitId[] = [];
  const eliteToReturn: UnitId[] = [];

  for (const unitId of currentOffer) {
    const unit = UNITS[unitId];
    if (unit.type === UNIT_TYPE_REGULAR) {
      regularToReturn.push(unitId);
    } else {
      eliteToReturn.push(unitId);
    }
  }

  // Put returned cards at bottom of decks
  let updatedRegularDeck = [...decks.regularUnits, ...regularToReturn];
  let updatedEliteDeck = [...decks.eliteUnits, ...eliteToReturn];

  // Calculate offer size
  const offerSize = playerCount + 2;
  const newOffer: UnitId[] = [];

  // Deal new offer
  if (coreTileRevealed && eliteUnitsEnabled) {
    // Alternate Elite, Regular, Elite, Regular...
    let dealElite = true;
    for (let i = 0; i < offerSize; i++) {
      if (dealElite && updatedEliteDeck.length > 0) {
        const [unit, ...rest] = updatedEliteDeck;
        if (unit !== undefined) {
          newOffer.push(unit);
          updatedEliteDeck = rest;
        }
      } else if (updatedRegularDeck.length > 0) {
        const [unit, ...rest] = updatedRegularDeck;
        if (unit !== undefined) {
          newOffer.push(unit);
          updatedRegularDeck = rest;
        }
      }
      dealElite = !dealElite;
    }
  } else {
    // Regular units only
    for (let i = 0; i < offerSize && updatedRegularDeck.length > 0; i++) {
      const [unit, ...rest] = updatedRegularDeck;
      if (unit !== undefined) {
        newOffer.push(unit);
        updatedRegularDeck = rest;
      }
    }
  }

  return {
    decks: {
      ...decks,
      regularUnits: updatedRegularDeck,
      eliteUnits: updatedEliteDeck,
    },
    unitOffer: newOffer,
    rng, // RNG unchanged since no shuffling during refresh
  };
}

/**
 * Remove a unit from the offer (when recruited).
 * The offer is NOT replenished until the next round.
 *
 * @param unitId - The unit to remove
 * @param currentOffer - Current offer
 * @returns Updated offer without the recruited unit
 */
export function removeUnitFromOffer(
  unitId: UnitId,
  currentOffer: readonly UnitId[]
): readonly UnitId[] {
  const index = currentOffer.indexOf(unitId);
  if (index === -1) {
    return currentOffer; // Unit not in offer
  }
  // Remove just the first occurrence
  return [...currentOffer.slice(0, index), ...currentOffer.slice(index + 1)];
}
