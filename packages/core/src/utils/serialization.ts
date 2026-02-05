/**
 * Game state serialization utilities
 *
 * Handles serializing GameState to JSON and back.
 * The main challenge is CommandStack.commands which contains functions.
 */

import type { GameState } from "../state/GameState.js";
import { createEmptyCommandStack } from "../engine/commands/stack.js";

/**
 * Serialize GameState to a JSON string.
 * Strips command stack commands (which contain functions).
 */
export function serializeGameState(state: GameState): string {
  // Create a copy with empty commands array (functions can't serialize)
  const serializable = {
    ...state,
    commandStack: {
      commands: [] as const,
      checkpoint: state.commandStack.checkpoint,
    },
  };
  return JSON.stringify(serializable);
}

/**
 * Deserialize a JSON string back to GameState.
 * Restores an empty command stack (undo history is lost on load).
 */
export function deserializeGameState(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  // Ensure command stack is properly initialized (parsed one has empty array)
  return {
    ...parsed,
    commandStack: createEmptyCommandStack(),
  };
}
