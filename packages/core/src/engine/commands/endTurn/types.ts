/**
 * Types for End Turn Command
 *
 * @module commands/endTurn/types
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, BasicManaColor, CardId } from "@mage-knight/shared";
import type { RngState } from "../../../utils/rng.js";

export interface EndTurnCommandParams {
  readonly playerId: string;
  /** If true, skip the Magical Glade wound check (used after resolving glade wound choice) */
  readonly skipGladeWoundCheck?: boolean;
  /** If true, skip the Deep Mine crystal check (used after resolving deep mine choice) */
  readonly skipDeepMineCheck?: boolean;
  /** If true, skip the Crystal Joy reclaim check (used after resolving reclaim choice) */
  readonly skipCrystalJoyReclaim?: boolean;
}

/**
 * Result of a site check (Magical Glade or Mine)
 */
export interface SiteCheckResult {
  /** If true, a pending choice was set and turn should not continue */
  readonly pendingChoice: boolean;
  /** Updated player (may have pending choice set or crystal gained) */
  readonly player: Player;
  /** Events generated (e.g., crystal gained) */
  readonly events: GameEvent[];
}

/**
 * Result of processing card flow (play area to discard, draw cards)
 */
export interface CardFlowResult {
  readonly hand: readonly CardId[];
  readonly deck: readonly CardId[];
  readonly discard: readonly CardId[];
  readonly playArea: readonly CardId[];
  readonly cardsDrawn: number;
}

/**
 * Result of dice management (reroll used dice, return mana draw dice)
 */
export interface DiceManagementResult {
  readonly source: GameState["source"];
  readonly rng: RngState;
  /** Updated players (may have tactic state cleared) */
  readonly players: Player[];
}

/**
 * Result of determining the next player
 */
export interface NextPlayerResult {
  readonly nextPlayerId: string | null;
  readonly currentPlayerIndex: number;
  readonly shouldTriggerRoundEnd: boolean;
  readonly shouldTriggerGameEnd: boolean;
  readonly playersWithFinalTurn: readonly string[];
  readonly finalTurnsRemaining: number | null;
}

/**
 * Result of setting up the next player for their turn
 */
export interface NextPlayerSetupResult {
  readonly players: Player[];
  readonly gladeManaEvent: GameEvent | null;
}

/**
 * Result of processing level ups
 */
export interface LevelUpResult {
  readonly player: Player;
  readonly events: GameEvent[];
  readonly rng: RngState;
}

/**
 * Crystal gained from a mine
 */
export interface CrystalGain {
  readonly color: BasicManaColor;
  readonly isDeepMine: boolean;
}
