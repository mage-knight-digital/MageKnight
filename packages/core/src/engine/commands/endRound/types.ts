/**
 * Types for End Round Command
 *
 * @module commands/endRound/types
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type {
  GameEvent,
  TacticId,
  CardId,
  UnitId,
  FinalScoreResult,
} from "@mage-knight/shared";
import type { RngState } from "../../../utils/rng.js";
import type { HexState } from "../../../types/map.js";
import type { GameDecks } from "../../../types/decks.js";
import type { CardOffer } from "../../../types/offers.js";

/**
 * Result of checking for game end (during final turns)
 */
export interface GameEndCheckResult {
  /** If true, the game has ended */
  readonly gameEnded: boolean;
  /** Events generated (ROUND_ENDED, GAME_ENDED) */
  readonly events: GameEvent[];
  /** Updated state if game ended */
  readonly state?: Partial<GameState>;
  /** Final score result if game ended */
  readonly finalScoreResult?: FinalScoreResult;
}

/**
 * Result of time transition (day/night toggle)
 */
export interface TimeTransitionResult {
  /** New time of day */
  readonly newTime: GameState["timeOfDay"];
  /** Updated hexes (may have revealed ruins tokens at dawn) */
  readonly updatedHexes: Record<string, HexState>;
  /** Events generated (TIME_OF_DAY_CHANGED) */
  readonly events: GameEvent[];
}

/**
 * Result of mana source reset
 */
export interface ManaResetResult {
  /** New mana source */
  readonly source: GameState["source"];
  /** Updated RNG state */
  readonly rng: RngState;
  /** Events generated (MANA_SOURCE_RESET) */
  readonly events: GameEvent[];
}

/**
 * Result of refreshing all offers
 */
export interface OfferRefreshResult {
  /** Updated decks */
  readonly decks: GameDecks;
  /** Updated unit offer */
  readonly unitOffer: readonly UnitId[];
  /** Updated advanced action offer */
  readonly advancedActionOffer: CardOffer;
  /** Updated spell offer */
  readonly spellOffer: CardOffer;
  /** Updated monastery advanced actions */
  readonly monasteryAdvancedActions: readonly CardId[];
  /** Updated RNG state */
  readonly rng: RngState;
  /** Events generated (OFFER_REFRESHED for each offer type) */
  readonly events: GameEvent[];
}

/**
 * Result of player round reset (deck shuffle, units ready, turn state reset)
 */
export interface PlayerRoundResetResult {
  /** Updated players */
  readonly players: Player[];
  /** Updated RNG state */
  readonly rng: RngState;
  /** Events generated (DECKS_RESHUFFLED, UNITS_READIED for each player) */
  readonly events: GameEvent[];
}

/**
 * Result of tactics setup for new round
 */
export interface TacticsSetupResult {
  /** Updated removed tactics */
  readonly removedTactics: readonly TacticId[];
  /** Available tactics for the new round */
  readonly availableTactics: readonly TacticId[];
  /** Order of players for tactics selection */
  readonly tacticsSelectionOrder: readonly string[];
  /** First player to select a tactic */
  readonly currentTacticSelector: string | null;
  /** Dummy player's tactic (for solo mode, null until assigned) */
  readonly dummyPlayerTactic: TacticId | null;
}
