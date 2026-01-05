/**
 * Shared game-state constants and types.
 *
 * These values are used across client/server/core and should not drift.
 */

// === Game phase ===
export const GAME_PHASE_SETUP = "setup" as const;
export const GAME_PHASE_ROUND = "round" as const;
export const GAME_PHASE_END = "end" as const;

export type GamePhase =
  | typeof GAME_PHASE_SETUP
  | typeof GAME_PHASE_ROUND
  | typeof GAME_PHASE_END;

// === Time of day ===
export const TIME_OF_DAY_DAY = "day" as const;
export const TIME_OF_DAY_NIGHT = "night" as const;

export type TimeOfDay = typeof TIME_OF_DAY_DAY | typeof TIME_OF_DAY_NIGHT;

// === Round phase (sub-phase within GAME_PHASE_ROUND) ===
export const ROUND_PHASE_TACTICS_SELECTION = "tactics_selection" as const;
export const ROUND_PHASE_PLAYER_TURNS = "player_turns" as const;

export type RoundPhase =
  | typeof ROUND_PHASE_TACTICS_SELECTION
  | typeof ROUND_PHASE_PLAYER_TURNS;
