/**
 * Server-side simulation types
 *
 * Defines request/response formats for running simulations entirely on the server,
 * eliminating per-step WebSocket overhead for batch runs.
 */

import type { GameState } from "@mage-knight/core";
import type { ClientGameState, ScenarioId, HeroId } from "@mage-knight/shared";

export const POLICY_TYPE_RANDOM = "random" as const;

export type PolicyType = typeof POLICY_TYPE_RANDOM;

export const SIM_OUTCOME_ENDED = "ended" as const;
export const SIM_OUTCOME_MAX_STEPS = "max_steps" as const;
export const SIM_OUTCOME_STALLED = "stalled" as const;

export type SimOutcome =
  | typeof SIM_OUTCOME_ENDED
  | typeof SIM_OUTCOME_MAX_STEPS
  | typeof SIM_OUTCOME_STALLED;

/**
 * Request to run a simulation server-side
 */
export interface RunSimulationRequest {
  /** Random seed for reproducibility */
  readonly seed: number;

  /** Policy type for action selection */
  readonly policyType: PolicyType;

  /** Maximum steps before terminating */
  readonly maxSteps: number;

  /** Number of players (2-4) */
  readonly playerCount: number;

  /** Allow undo actions (default: false for speed) */
  readonly allowUndo?: boolean;

  /** Optional scenario ID (defaults to First Reconnaissance) */
  readonly scenarioId?: ScenarioId;

  /** Optional hero IDs for each player */
  readonly heroIds?: readonly HeroId[];
}

/**
 * Result of a completed simulation
 */
export interface RunSimulationResponse {
  /** Unique game ID */
  readonly gameId: string;

  /** Random seed used */
  readonly seed: number;

  /** How the simulation ended */
  readonly outcome: SimOutcome;

  /** Total steps executed */
  readonly steps: number;

  /** Final game state (filtered for player-1) */
  readonly finalState: ClientGameState;

  /** Final fame per player */
  readonly fame: Record<string, number>;

  /** Total execution time in milliseconds */
  readonly executionTimeMs: number;
}

/**
 * Server policy interface for selecting actions during simulation
 */
export interface ServerPolicy {
  /**
   * Choose an action from the available valid actions
   * @param state - Current game state
   * @param playerId - Player making the choice
   * @returns PlayerAction to execute (or null if no valid actions)
   */
  choose(state: GameState, playerId: string): import("@mage-knight/shared").PlayerAction | null;
}
