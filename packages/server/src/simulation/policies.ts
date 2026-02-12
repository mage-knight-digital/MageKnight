/**
 * Server-side policies for action selection
 *
 * Policies choose actions during server-side simulations.
 * They have access to full GameState (unlike client policies which only see ClientGameState).
 */

import type { GameState } from "@mage-knight/core";
import { getValidActions } from "@mage-knight/core";
import type { ServerPolicy } from "./types.js";
import type { PlayerAction } from "@mage-knight/shared";
import { enumerateActions } from "./actionEnumerator.js";

/**
 * Random policy: chooses uniformly from valid actions
 *
 * This is equivalent to the Python SDK's SimpleRandomPolicy,
 * but runs server-side for faster execution.
 */
export class RandomServerPolicy implements ServerPolicy {
  choose(state: GameState, playerId: string): PlayerAction | null {
    const validActions = getValidActions(state, playerId);
    const actions = enumerateActions(validActions);

    if (actions.length === 0) {
      return null;
    }

    // Choose random action from all available actions
    // Note: This uses Math.random() for simplicity (not seeded RNG)
    // For deterministic simulations, we'd need to thread RNG state through the policy
    const randomIndex = Math.floor(Math.random() * actions.length);

    return actions[randomIndex] ?? null;
  }
}

/**
 * Create a policy instance from policy type string
 */
export function createPolicy(policyType: string): ServerPolicy {
  if (policyType === "random") {
    return new RandomServerPolicy();
  }

  throw new Error(`Unknown policy type: ${policyType}`);
}
