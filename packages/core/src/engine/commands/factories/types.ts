/**
 * Command Factory Types
 *
 * Type definitions for command factory functions that translate
 * PlayerAction objects into executable Command objects.
 *
 * @module commands/factories/types
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { Command } from "../types.js";

/**
 * Factory function type for creating Commands from PlayerActions.
 *
 * Each factory function:
 * 1. Validates the action has required fields
 * 2. Extracts parameters from the action
 * 3. Creates and returns the appropriate Command object
 *
 * @param state - Current game state
 * @param playerId - ID of the player performing the action
 * @param action - The player action to translate
 * @returns A Command object or null if the action cannot be translated
 */
export type CommandFactory = (
  state: GameState,
  playerId: string,
  action: PlayerAction
) => Command | null;
