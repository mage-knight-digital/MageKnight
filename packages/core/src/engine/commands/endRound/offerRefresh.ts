/**
 * Offer Refresh for End Round
 *
 * Handles refreshing all offers at the end of a round:
 * - Unit offer
 * - Advanced Action offer
 * - Spell offer
 * - Monastery Advanced Actions
 *
 * @module commands/endRound/offerRefresh
 */

import type { GameState } from "../../../state/GameState.js";
import type { HexState } from "../../../types/map.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  OFFER_REFRESHED,
  OFFER_TYPE_UNITS,
  OFFER_TYPE_ADVANCED_ACTIONS,
  OFFER_TYPE_SPELLS,
} from "@mage-knight/shared";
import type { RngState } from "../../../utils/rng.js";
import { refreshUnitOffer } from "../../../data/unitDeckSetup.js";
import { refreshAdvancedActionOffer } from "../../../data/advancedActionDeckSetup.js";
import { refreshSpellOffer } from "../../../data/spellDeckSetup.js";
import { countUnburnedMonasteries } from "../../helpers/monasteryHelpers.js";
import type { OfferRefreshResult } from "./types.js";

/**
 * Check if any core tile has been revealed on the map.
 * Core tiles have IDs starting with "core_".
 */
function hasCoreTileRevealed(state: GameState): boolean {
  for (const tile of state.map.tiles) {
    if (tile.revealed && tile.tileId.startsWith("core_")) {
      return true;
    }
  }
  return false;
}

/**
 * Refresh all offers at the end of a round.
 */
export function processOfferRefresh(
  state: GameState,
  updatedHexes: Record<string, HexState>,
  rng: RngState
): OfferRefreshResult {
  const events: GameEvent[] = [];
  const playerCount = state.players.length;

  // 1. Refresh unit offer
  const coreTileRevealed = hasCoreTileRevealed(state);
  const {
    decks: refreshedDecks,
    unitOffer: refreshedUnitOffer,
    rng: rngAfterUnitRefresh,
  } = refreshUnitOffer(
    state.offers.units,
    state.decks,
    playerCount,
    coreTileRevealed,
    state.scenarioConfig.eliteUnitsEnabled,
    rng
  );

  events.push({
    type: OFFER_REFRESHED,
    offerType: OFFER_TYPE_UNITS,
  });

  // 2. Refresh Advanced Action offer
  const { offer: refreshedAAOffer, deck: refreshedAADeck } =
    refreshAdvancedActionOffer(
      state.offers.advancedActions,
      refreshedDecks.advancedActions
    );

  events.push({
    type: OFFER_REFRESHED,
    offerType: OFFER_TYPE_ADVANCED_ACTIONS,
  });

  // 3. Refresh Spell offer
  const { offer: refreshedSpellOffer, deck: refreshedSpellDeck } =
    refreshSpellOffer(state.offers.spells, refreshedDecks.spells);

  events.push({
    type: OFFER_REFRESHED,
    offerType: OFFER_TYPE_SPELLS,
  });

  // 4. Refresh Monastery AA offer
  // Per rulebook: "If there are some Advanced Action cards in the Unit offer,
  // put them to the bottom of the Advanced Action deck."
  // Then: "If there are any monasteries on the map, add one Advanced Action
  // card to the Unit offer for each monastery that has not been burned."

  // Return old monastery AAs to bottom of AA deck
  let currentAADeck = [...refreshedAADeck];
  for (const oldAA of state.offers.monasteryAdvancedActions) {
    currentAADeck.push(oldAA);
  }

  // Count unburned monasteries on the map
  const hexArray = Object.values(updatedHexes);
  const unburnedMonasteryCount = countUnburnedMonasteries(hexArray);

  // Draw new monastery AAs (one per unburned monastery)
  const newMonasteryAAs: CardId[] = [];
  for (let i = 0; i < unburnedMonasteryCount && currentAADeck.length > 0; i++) {
    const [drawnAA, ...remainingDeck] = currentAADeck;
    if (drawnAA !== undefined) {
      newMonasteryAAs.push(drawnAA);
      currentAADeck = remainingDeck;
    }
  }

  return {
    decks: {
      ...refreshedDecks,
      advancedActions: currentAADeck,
      spells: refreshedSpellDeck,
    },
    unitOffer: refreshedUnitOffer,
    advancedActionOffer: refreshedAAOffer,
    spellOffer: refreshedSpellOffer,
    monasteryAdvancedActions: newMonasteryAAs,
    rng: rngAfterUnitRefresh,
    events,
  };
}
