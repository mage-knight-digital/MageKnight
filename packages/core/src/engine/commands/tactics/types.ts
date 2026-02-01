/**
 * Shared types for tactic decision handlers
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, ResolveTacticDecisionPayload } from "@mage-knight/shared";

/**
 * Result of resolving a tactic decision
 */
export interface TacticResolutionResult {
  readonly updatedState: GameState;
  readonly events: GameEvent[];
}

/**
 * Validator function for a specific tactic decision type
 * Returns null if valid, or an error message string if invalid
 */
export type TacticValidator<T extends ResolveTacticDecisionPayload = ResolveTacticDecisionPayload> = (
  state: GameState,
  player: Player,
  decision: T
) => string | null;

/**
 * Resolver function for a specific tactic decision type
 * Assumes validation has already passed
 */
export type TacticResolver<T extends ResolveTacticDecisionPayload = ResolveTacticDecisionPayload> = (
  state: GameState,
  player: Player,
  decision: T
) => TacticResolutionResult;
