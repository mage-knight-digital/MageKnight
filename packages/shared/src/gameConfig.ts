/**
 * Game configuration types
 *
 * GameConfig is passed from the setup screen to the game server
 * to initialize a game with specific player and hero selections.
 */

import type { HeroId } from "./hero.js";
import type { ScenarioId } from "./scenarios.js";

export const GAME_LAUNCH_MODE_SOLO = "solo" as const;
export const GAME_LAUNCH_MODE_HOTSEAT = "hotseat" as const;
export const GAME_LAUNCH_MODE_ONLINE = "online" as const;

export type GameLaunchMode =
  | typeof GAME_LAUNCH_MODE_SOLO
  | typeof GAME_LAUNCH_MODE_HOTSEAT
  | typeof GAME_LAUNCH_MODE_ONLINE;

export const GAME_SEAT_CONTROLLER_LOCAL = "local" as const;

export type GameSeatController = typeof GAME_SEAT_CONTROLLER_LOCAL;

export interface GameSeatConfig {
  readonly playerId: string;
  readonly heroId: HeroId;
  readonly controller: GameSeatController;
}

/**
 * Configuration for initializing a game.
 * Created by the setup screen and passed to GameServer.initializeGame().
 */
export interface GameConfig {
  /** Launch flow for this game. */
  readonly launchMode: GameLaunchMode;

  /** Player IDs (e.g., ["player1", "player2"]) */
  readonly playerIds: readonly string[];

  /** Hero IDs corresponding to each player (same length as playerIds) */
  readonly heroIds: readonly HeroId[];

  /** Explicit player seats. Kept shape-compatible with future lobby joins. */
  readonly seats: readonly GameSeatConfig[];

  /** Scenario to play */
  readonly scenarioId: ScenarioId;

  /** Optional Rust server scenario preset. Omitted for the default full game. */
  readonly serverScenario?: string;

  /** Optional city level override (1-11). Defaults to scenario's defaultCityLevel. */
  readonly cityLevel?: number;
}
