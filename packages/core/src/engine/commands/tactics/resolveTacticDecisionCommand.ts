/**
 * Resolve Tactic Decision command - handles resolving pending tactic decisions
 *
 * This command delegates to specific handlers for each tactic type:
 * - Rethink (Day 2): Choose cards to discard, shuffle discard into deck, draw that many
 * - Mana Steal (Day 3): Choose a die from the source
 * - Preparation (Night 5): Choose a card from deck
 * - Midnight Meditation (Night 4): Choose cards to shuffle into deck
 * - Sparing Power (Night 6): Choose to stash or take
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import {
  INVALID_ACTION,
  TACTIC_DECISION_RESOLVED,
  TACTIC_DECISION_RETHINK,
  TACTIC_DECISION_SPARING_POWER,
  TACTIC_DECISION_MANA_STEAL,
  TACTIC_DECISION_PREPARATION,
  TACTIC_DECISION_MIDNIGHT_MEDITATION,
} from "@mage-knight/shared";
import { RESOLVE_TACTIC_DECISION_COMMAND } from "../commandTypes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { handlePhaseTransitionAfterDecision } from "./helpers.js";
import type { TacticResolutionResult } from "./types.js";

// Import handlers
import { validateRethink, resolveRethink } from "./handlers/rethink.js";
import { validateSparingPower, resolveSparingPower } from "./handlers/sparingPower.js";
import { validateManaSteal, resolveManaSteal } from "./handlers/manaSteal.js";
import { validatePreparation, resolvePreparation } from "./handlers/preparation.js";
import { validateMidnightMeditation, resolveMidnightMeditation } from "./handlers/midnightMeditation.js";

export { RESOLVE_TACTIC_DECISION_COMMAND };

export interface ResolveTacticDecisionCommandArgs {
  readonly playerId: string;
  readonly decision: ResolveTacticDecisionPayload;
}

/**
 * Validate the tactic decision resolution
 */
function validateResolution(
  state: GameState,
  playerId: string,
  decision: ResolveTacticDecisionPayload
): string | null {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return "Player not found";
  }

  // Must have a pending decision
  if (!player.pendingTacticDecision) {
    return "No pending tactic decision to resolve";
  }

  // Decision type must match pending decision type
  if (decision.type !== player.pendingTacticDecision.type) {
    return `Expected decision type ${player.pendingTacticDecision.type}, got ${decision.type}`;
  }

  // Delegate to tactic-specific validation
  switch (decision.type) {
    case TACTIC_DECISION_RETHINK:
      return validateRethink(state, player, decision);

    case TACTIC_DECISION_SPARING_POWER:
      return validateSparingPower(state, player, decision);

    case TACTIC_DECISION_MANA_STEAL:
      return validateManaSteal(state, player, decision);

    case TACTIC_DECISION_PREPARATION:
      return validatePreparation(state, player, decision);

    case TACTIC_DECISION_MIDNIGHT_MEDITATION:
      return validateMidnightMeditation(state, player, decision);

    default:
      // Exhaustive check - TypeScript will error if a case is missed
      return `Unknown tactic decision type: ${(decision satisfies never as { type: string }).type}`;
  }
}

/**
 * Resolve the tactic decision by delegating to the appropriate handler
 */
function resolveDecision(
  state: GameState,
  playerId: string,
  decision: ResolveTacticDecisionPayload
): TacticResolutionResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { updatedState: state, events: [] };
  }

  switch (decision.type) {
    case TACTIC_DECISION_RETHINK:
      return resolveRethink(state, player, decision);

    case TACTIC_DECISION_SPARING_POWER:
      return resolveSparingPower(state, player, decision);

    case TACTIC_DECISION_MANA_STEAL:
      return resolveManaSteal(state, player, decision);

    case TACTIC_DECISION_PREPARATION:
      return resolvePreparation(state, player, decision);

    case TACTIC_DECISION_MIDNIGHT_MEDITATION:
      return resolveMidnightMeditation(state, player, decision);

    default:
      // Exhaustive check - TypeScript will error if a case is missed
      return decision satisfies never;
  }
}

export function createResolveTacticDecisionCommand(
  args: ResolveTacticDecisionCommandArgs
): Command {
  const { playerId, decision } = args;

  return {
    type: RESOLVE_TACTIC_DECISION_COMMAND,
    playerId,
    isReversible: false, // Cannot undo tactic decisions (they involve shuffling)

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateResolution(state, playerId, decision);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: RESOLVE_TACTIC_DECISION_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      // Resolve the decision
      const { updatedState, events: resolutionEvents } = resolveDecision(
        state,
        playerId,
        decision
      );
      events.push(...resolutionEvents);

      // Emit resolution event
      events.push({
        type: TACTIC_DECISION_RESOLVED,
        playerId,
        decisionType: decision.type,
      });

      // Handle phase transition if in tactics selection phase
      const { state: finalState, events: finalEvents } =
        handlePhaseTransitionAfterDecision(updatedState, playerId, events);

      return { state: finalState, events: finalEvents };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_TACTIC_DECISION");
    },
  };
}
