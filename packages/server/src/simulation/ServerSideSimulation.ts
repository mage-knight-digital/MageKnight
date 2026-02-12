/**
 * Server-side simulation runner
 *
 * Runs entire games on the server without WebSocket messaging,
 * eliminating per-step overhead for batch simulations.
 */

import { randomUUID } from "node:crypto";
import type {
  GameState,
  MageKnightEngine,
  ActionResult,
} from "@mage-knight/core";
import {
  createEngine,
  createInitialGameState,
} from "@mage-knight/core";
import type { HeroId, ScenarioId } from "@mage-knight/shared";
import {
  SCENARIO_FIRST_RECONNAISSANCE,
  GAME_OUTCOME_ENDED,
  ROUND_PHASE_TACTICS_SELECTION,
} from "@mage-knight/shared";
import { toClientState } from "../stateFilters.js";
import type {
  RunSimulationRequest,
  RunSimulationResponse,
  ServerPolicy,
  SimOutcome,
} from "./types.js";
import {
  SIM_OUTCOME_ENDED,
  SIM_OUTCOME_MAX_STEPS,
  SIM_OUTCOME_STALLED,
} from "./types.js";
import { createPolicy } from "./policies.js";
import { createGameServer } from "../GameServer.js";

/**
 * Detect if the game is in a stall state
 * (same draw pile count for N consecutive turns)
 */
class StallDetector {
  private readonly turnThreshold: number;
  private playerLastDrawCounts: Map<string, number> = new Map();
  private playerStallTurnCount: Map<string, number> = new Map();

  constructor(turnThreshold: number = 5) {
    this.turnThreshold = turnThreshold;
  }

  check(state: GameState): boolean {
    for (const player of state.players) {
      const currentDrawCount = player.deck.length;
      const lastCount = this.playerLastDrawCounts.get(player.id);

      if (lastCount !== undefined && lastCount === currentDrawCount) {
        // Draw pile unchanged - increment stall counter
        const stallCount = (this.playerStallTurnCount.get(player.id) ?? 0) + 1;
        this.playerStallTurnCount.set(player.id, stallCount);

        if (stallCount >= this.turnThreshold) {
          // Stalled for too many turns
          return true;
        }
      } else {
        // Draw pile changed - reset stall counter
        this.playerStallTurnCount.set(player.id, 0);
      }

      this.playerLastDrawCounts.set(player.id, currentDrawCount);
    }

    return false;
  }
}

/**
 * Check if the game has reached a terminal state
 */
function isTerminal(state: GameState): boolean {
  return state.outcome !== null && state.outcome !== undefined;
}

/**
 * Extract fame per player from final state
 */
function extractFame(state: GameState): Record<string, number> {
  const fame: Record<string, number> = {};
  for (const player of state.players) {
    fame[player.id] = player.fame;
  }
  return fame;
}

/**
 * Determine simulation outcome
 */
function determineOutcome(
  state: GameState,
  steps: number,
  maxSteps: number,
  stalled: boolean
): SimOutcome {
  if (stalled) {
    return SIM_OUTCOME_STALLED;
  }

  if (isTerminal(state)) {
    return SIM_OUTCOME_ENDED;
  }

  if (steps >= maxSteps) {
    return SIM_OUTCOME_MAX_STEPS;
  }

  // Should not reach here
  return SIM_OUTCOME_MAX_STEPS;
}

/**
 * Server-side simulation runner
 *
 * Executes an entire game without WebSocket messaging,
 * using a policy to choose actions.
 */
export class ServerSideSimulation {
  private readonly engine: MageKnightEngine;

  constructor() {
    this.engine = createEngine();
  }

  /**
   * Run a simulation from start to finish
   *
   * @param request - Simulation configuration
   * @returns Simulation result with final state and metadata
   */
  run(request: RunSimulationRequest): RunSimulationResponse {
    const startTime = Date.now();

    // Generate game ID
    const gameId = `g_${randomUUID().replaceAll("-", "").slice(0, 10)}`;

    // Create initial game state using GameServer
    const server = createGameServer(request.seed);
    const playerIds = Array.from(
      { length: request.playerCount },
      (_, i) => `player-${i + 1}`
    );

    const scenarioId = request.scenarioId ?? SCENARIO_FIRST_RECONNAISSANCE;
    const heroIds = request.heroIds;

    server.initializeGame(playerIds, heroIds, scenarioId);

    // Get initial state
    let state: GameState = server.getState();

    // Create policy
    const policy: ServerPolicy = createPolicy(request.policyType);

    // Create stall detector
    const stallDetector = new StallDetector(5);

    // Run simulation loop
    let step = 0;
    let stalled = false;

    while (!isTerminal(state) && step < request.maxSteps && !stalled) {
      // Get current player (same logic as toClientState)
      const actingPlayerId =
        state.roundPhase === ROUND_PHASE_TACTICS_SELECTION
          ? state.currentTacticSelector
          : state.turnOrder[state.currentPlayerIndex];

      if (!actingPlayerId) {
        // No current player (e.g., game ended)
        console.warn(
          `[ServerSideSimulation] No acting player at step ${step}, phase: ${state.phase}, roundPhase: ${state.roundPhase}`
        );
        break;
      }

      // Choose action via policy
      const action = policy.choose(state, actingPlayerId);

      if (!action) {
        // No valid actions - game might be stuck
        console.warn(
          `[ServerSideSimulation] No valid actions for ${actingPlayerId} at step ${step}`
        );
        break;
      }

      // Execute action (no undo support for speed)
      let result: ActionResult;
      try {
        result = this.engine.processAction(state, actingPlayerId, action);
      } catch (error) {
        console.error(
          `[ServerSideSimulation] Error processing action at step ${step}:`,
          error
        );
        break;
      }

      state = result.state;
      step++;

      // Check for stall every turn (when current player changes)
      const newActingPlayerId =
        state.roundPhase === ROUND_PHASE_TACTICS_SELECTION
          ? state.currentTacticSelector
          : state.turnOrder[state.currentPlayerIndex];
      if (newActingPlayerId !== actingPlayerId) {
        stalled = stallDetector.check(state);
      }
    }

    // Determine outcome
    const outcome = determineOutcome(state, step, request.maxSteps, stalled);

    // Extract final fame
    const fame = extractFame(state);

    // Get final client state (filtered for player-1)
    const finalState = toClientState(state, "player-1");

    const executionTimeMs = Date.now() - startTime;

    return {
      gameId,
      seed: request.seed,
      outcome,
      steps: step,
      finalState,
      fame,
      executionTimeMs,
    };
  }
}
