/**
 * Game state types and management
 */

export type GamePhase =
  | "setup"
  | "round"
  | "combat"
  | "end";

export type TimeOfDay = "day" | "night";

export interface MapState {
  readonly _placeholder?: undefined;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly timeOfDay: TimeOfDay;
  readonly round: number;
  readonly currentPlayerIndex: number;
  readonly map: MapState;
}

export function createInitialGameState(): GameState {
  return {
    phase: "setup",
    timeOfDay: "day",
    round: 1,
    currentPlayerIndex: 0,
    map: {},
  };
}
