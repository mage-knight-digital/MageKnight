/**
 * Game configuration types
 *
 * GameConfig is passed from the setup screen to the game server
 * to initialize a game with specific player and hero selections.
 */

import type { HeroId } from "./hero.js";
import type { ScenarioId } from "./scenarios.js";

/**
 * Configuration for initializing a game.
 * Created by the setup screen and passed to GameServer.initializeGame().
 */
export interface GameConfig {
  /** Player IDs (e.g., ["player1", "player2"]) */
  readonly playerIds: readonly string[];

  /** Hero IDs corresponding to each player (same length as playerIds) */
  readonly heroIds: readonly HeroId[];

  /** Scenario to play */
  readonly scenarioId: ScenarioId;
}
