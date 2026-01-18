/**
 * Commands Module
 *
 * This module provides the command pattern implementation for game actions.
 * Commands translate PlayerAction objects into executable state changes
 * with full undo support.
 *
 * ## Architecture
 *
 * - **Factory functions** in `./factories/` translate PlayerAction → Command
 * - **Command implementations** handle execute() and undo()
 * - **Registry** maps action types to factories for dispatching
 *
 * ## Usage
 *
 * ```typescript
 * import { createCommandForAction } from './commands';
 *
 * const command = createCommandForAction(state, playerId, action);
 * if (command) {
 *   const result = command.execute(state);
 * }
 * ```
 *
 * @module commands
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { Command } from "../commands.js";
import { commandFactoryRegistry } from "./factories/index.js";

// Re-export CommandFactory type
export type { CommandFactory } from "./factories/index.js";

/**
 * Create a command for a player action.
 *
 * Uses the command factory registry to dispatch to the appropriate
 * factory function based on the action type.
 *
 * @param state - Current game state
 * @param playerId - ID of the player performing the action
 * @param action - The player action to translate
 * @returns A Command object or null if the action type is not supported
 */
export function createCommandForAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const factory = commandFactoryRegistry[action.type];
  if (!factory) {
    return null;
  }
  return factory(state, playerId, action);
}

// ============================================================================
// RE-EXPORTS - Command types and implementations
// ============================================================================

// Core command types
export * from "../commands.js";

// Move command
export { createMoveCommand, type MoveCommandParams } from "./moveCommand.js";

// Reveal tile command
export {
  createRevealTileCommand,
  type RevealTileCommandParams,
} from "./revealTileCommand.js";

// End turn command
export {
  createEndTurnCommand,
  type EndTurnCommandParams,
} from "./endTurn/index.js";

// Explore command
export {
  createExploreCommand,
  type ExploreCommandParams,
} from "./exploreCommand.js";

// Play card command
export {
  createPlayCardCommand,
  type PlayCardCommandParams,
} from "./playCardCommand.js";

// Play card sideways command
export {
  createPlayCardSidewaysCommand,
  type PlayCardSidewaysCommandParams,
  type SidewaysAs,
} from "./playCardSidewaysCommand.js";

// Resolve choice command
export {
  createResolveChoiceCommand,
  type ResolveChoiceCommandParams,
} from "./resolveChoiceCommand.js";

// Rest command
export {
  createRestCommand,
  type RestCommandParams,
} from "./restCommand.js";

// Combat commands
export * from "./combat/index.js";

// Unit commands
export * from "./units/index.js";

// Interact command
export {
  createInteractCommand,
  type InteractCommandParams,
  INTERACT_COMMAND,
} from "./interactCommand.js";

// Round lifecycle commands
export {
  createAnnounceEndOfRoundCommand,
  type AnnounceEndOfRoundCommandParams,
  ANNOUNCE_END_OF_ROUND_COMMAND,
} from "./announceEndOfRoundCommand.js";

export {
  createEndRoundCommand,
  END_ROUND_COMMAND,
} from "./endRoundCommand.js";

// Conquest commands
export {
  createConquerSiteCommand,
  type ConquerSiteCommandParams,
  CONQUER_SITE_COMMAND,
} from "./conquerSiteCommand.js";

// Adventure site commands
export {
  createEnterSiteCommand,
  type EnterSiteCommandParams,
  ENTER_SITE_COMMAND,
} from "./enterSiteCommand.js";

// Tactics commands
export {
  createSelectTacticCommand,
  type SelectTacticCommandArgs,
  SELECT_TACTIC_COMMAND,
} from "./selectTacticCommand.js";

// Reward selection commands
export {
  createSelectRewardCommand,
  type SelectRewardCommandParams,
  SELECT_REWARD_COMMAND,
} from "./selectRewardCommand.js";

// Tactic activation commands
export {
  createActivateTacticCommand,
  type ActivateTacticCommandArgs,
  ACTIVATE_TACTIC_COMMAND,
} from "./activateTacticCommand.js";

// Tactic decision resolution commands
export {
  createResolveTacticDecisionCommand,
  type ResolveTacticDecisionCommandArgs,
  RESOLVE_TACTIC_DECISION_COMMAND,
} from "./resolveTacticDecisionCommand.js";

// Mana Search reroll command
export {
  createRerollSourceDiceCommand,
  type RerollSourceDiceCommandArgs,
  REROLL_SOURCE_DICE_COMMAND,
} from "./rerollSourceDiceCommand.js";

// Magical Glade wound discard command
export {
  createResolveGladeWoundCommand,
  type ResolveGladeWoundCommandParams,
  RESOLVE_GLADE_WOUND_COMMAND,
} from "./resolveGladeWoundCommand.js";

// Deep Mine crystal choice command
export {
  createResolveDeepMineChoiceCommand,
  type ResolveDeepMineChoiceCommandParams,
  RESOLVE_DEEP_MINE_COMMAND,
} from "./resolveDeepMineChoiceCommand.js";

// Buy spell command
export {
  createBuySpellCommand,
  type BuySpellCommandParams,
  BUY_SPELL_COMMAND,
} from "./buySpellCommand.js";

// Learn advanced action command
export {
  createLearnAdvancedActionCommand,
  type LearnAdvancedActionCommandParams,
  LEARN_ADVANCED_ACTION_COMMAND,
} from "./learnAdvancedActionCommand.js";
