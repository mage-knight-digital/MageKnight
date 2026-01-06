/**
 * Command factory registry
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexCoord, CardId } from "@mage-knight/shared";
import {
  MOVE_ACTION,
  END_TURN_ACTION,
  EXPLORE_ACTION,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  RESOLVE_CHOICE_ACTION,
  REST_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  RECRUIT_UNIT_ACTION,
  ACTIVATE_UNIT_ACTION,
  INTERACT_ACTION,
  ANNOUNCE_END_OF_ROUND_ACTION,
  ENTER_SITE_ACTION,
  SELECT_TACTIC_ACTION,
  hexKey,
  type TacticId,
} from "@mage-knight/shared";
import type { Command } from "../commands.js";
import { createMoveCommand } from "./moveCommand.js";
import { createEndTurnCommand } from "./endTurnCommand.js";
import { createExploreCommand } from "./exploreCommand.js";
import { createPlayCardCommand } from "./playCardCommand.js";
import { createPlayCardSidewaysCommand } from "./playCardSidewaysCommand.js";
import type { SidewaysAs } from "./playCardSidewaysCommand.js";
import { createResolveChoiceCommand } from "./resolveChoiceCommand.js";
import { createRestCommand } from "./restCommand.js";
import { getEffectiveTerrainCost } from "../modifiers.js";
import {
  createEnterCombatCommand,
  createEndCombatPhaseCommand,
  createDeclareBlockCommand,
  createDeclareAttackCommand,
  createAssignDamageCommand,
} from "./combat/index.js";
import { createRecruitUnitCommand, createActivateUnitCommand } from "./units/index.js";
import { createInteractCommand } from "./interactCommand.js";
import { createAnnounceEndOfRoundCommand } from "./announceEndOfRoundCommand.js";
import { createEnterSiteCommand } from "./enterSiteCommand.js";
import { createSelectTacticCommand } from "./selectTacticCommand.js";

// Command factory function type
type CommandFactory = (
  state: GameState,
  playerId: string,
  action: PlayerAction
) => Command | null;

// Helper to get move target
function getMoveTarget(action: PlayerAction): HexCoord | null {
  if (action.type === MOVE_ACTION && "target" in action) {
    return action.target;
  }
  return null;
}

// Move command factory
function createMoveCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const player = state.players.find((p) => p.id === playerId);
  const target = getMoveTarget(action);

  if (!player?.position || !target) return null;

  const hex = state.map.hexes[hexKey(target)];
  if (!hex) return null;

  const terrainCost = getEffectiveTerrainCost(state, hex.terrain, playerId);

  return createMoveCommand({
    playerId,
    from: player.position,
    to: target,
    terrainCost,
    hadMovedThisTurn: player.hasMovedThisTurn,
  });
}

// End turn command factory
function createEndTurnCommandFromAction(
  _state: GameState,
  playerId: string,
  _action: PlayerAction
): Command {
  return createEndTurnCommand({ playerId });
}

// Explore command factory
function createExploreCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== EXPLORE_ACTION) return null;

  const { direction, fromTileCoord } = action;
  if (!direction || !fromTileCoord) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player?.position) return null;

  // Draw a tile (SIMPLE: take first from countryside, then core)
  const tileId =
    state.map.tileDeck.countryside[0] ?? state.map.tileDeck.core[0];
  if (!tileId) return null;

  return createExploreCommand({
    playerId,
    fromHex: fromTileCoord,
    direction,
    tileId,
  });
}

// Helper to get card id from action
function getCardIdFromAction(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

// Helper to get card id from sideways action
function getCardIdFromSidewaysAction(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_SIDEWAYS_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

// Helper to get sideways choice
function getSidewaysChoice(action: PlayerAction): SidewaysAs | null {
  if (action.type === PLAY_CARD_SIDEWAYS_ACTION && "as" in action) {
    return action.as as SidewaysAs;
  }
  return null;
}

// Helper to get powered status and mana source from action
function getPlayCardDetails(action: PlayerAction): {
  powered: boolean;
  manaSource: import("@mage-knight/shared").ManaSourceInfo | undefined;
} | null {
  if (action.type === PLAY_CARD_ACTION) {
    return {
      powered: action.powered,
      manaSource: action.manaSource,
    };
  }
  return null;
}

// Play card command factory
function createPlayCardCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const cardId = getCardIdFromAction(action);
  if (!cardId) return null;

  const details = getPlayCardDetails(action);
  if (!details) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const handIndex = player.hand.indexOf(cardId);
  if (handIndex === -1) return null;

  // Only include manaSource if it's defined (exactOptionalPropertyTypes)
  if (details.manaSource) {
    return createPlayCardCommand({
      playerId,
      cardId,
      handIndex,
      powered: details.powered,
      manaSource: details.manaSource,
    });
  }

  return createPlayCardCommand({
    playerId,
    cardId,
    handIndex,
    powered: details.powered,
  });
}

// Play card sideways command factory
function createPlayCardSidewaysCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const cardId = getCardIdFromSidewaysAction(action);
  if (!cardId) return null;

  const sidewaysChoice = getSidewaysChoice(action);
  if (!sidewaysChoice) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const handIndex = player.hand.indexOf(cardId);
  if (handIndex === -1) return null;

  return createPlayCardSidewaysCommand({
    playerId,
    cardId,
    handIndex,
    as: sidewaysChoice,
  });
}

// Helper to get choice index from action
function getChoiceIndexFromAction(action: PlayerAction): number | null {
  if (action.type === RESOLVE_CHOICE_ACTION && "choiceIndex" in action) {
    return action.choiceIndex;
  }
  return null;
}

// Resolve choice command factory
function createResolveChoiceCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const choiceIndex = getChoiceIndexFromAction(action);
  if (choiceIndex === null) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player?.pendingChoice) return null;

  return createResolveChoiceCommand({
    playerId,
    choiceIndex,
    previousPendingChoice: player.pendingChoice,
  });
}

// Rest command factory
function createRestCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== REST_ACTION) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  return createRestCommand({
    playerId,
    restType: action.restType,
    discardCardIds: action.discardCardIds,
    announceEndOfRound: action.announceEndOfRound ?? false,
    previousHand: [...player.hand],
    previousDiscard: [...player.discard],
  });
}

// Enter combat command factory
function createEnterCombatCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== ENTER_COMBAT_ACTION) return null;
  return createEnterCombatCommand({
    playerId,
    enemyIds: action.enemyIds,
    ...(action.isAtFortifiedSite === undefined
      ? {}
      : { isAtFortifiedSite: action.isAtFortifiedSite }),
  });
}

// End combat phase command factory
function createEndCombatPhaseCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== END_COMBAT_PHASE_ACTION) return null;
  return createEndCombatPhaseCommand({ playerId });
}

// Declare block command factory
function createDeclareBlockCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== DECLARE_BLOCK_ACTION) return null;
  return createDeclareBlockCommand({
    playerId,
    targetEnemyInstanceId: action.targetEnemyInstanceId,
    blocks: action.blocks,
  });
}

// Declare attack command factory
function createDeclareAttackCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== DECLARE_ATTACK_ACTION) return null;
  return createDeclareAttackCommand({
    playerId,
    targetEnemyInstanceIds: action.targetEnemyInstanceIds,
    attacks: action.attacks,
    attackType: action.attackType,
  });
}

// Assign damage command factory
function createAssignDamageCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return null;

  // Only include assignments if provided
  if (action.assignments) {
    return createAssignDamageCommand({
      playerId,
      enemyInstanceId: action.enemyInstanceId,
      assignments: action.assignments,
    });
  }

  return createAssignDamageCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
  });
}

// Recruit unit command factory
function createRecruitUnitCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== RECRUIT_UNIT_ACTION) return null;
  return createRecruitUnitCommand({
    playerId,
    unitId: action.unitId,
    influenceSpent: action.influenceSpent,
  });
}

// Activate unit command factory
function createActivateUnitCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== ACTIVATE_UNIT_ACTION) return null;
  return createActivateUnitCommand({
    playerId,
    unitInstanceId: action.unitInstanceId,
    abilityIndex: action.abilityIndex,
  });
}

// Interact command factory
function createInteractCommandFromAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== INTERACT_ACTION) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  // For now, influence must be calculated from player's influencePoints
  // In a full implementation, we'd track influence from played cards
  const influenceAvailable = player.influencePoints;

  return createInteractCommand({
    playerId,
    healing: action.healing ?? 0,
    influenceAvailable,
    previousHand: [...player.hand],
  });
}

// Announce end of round command factory
function createAnnounceEndOfRoundCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== ANNOUNCE_END_OF_ROUND_ACTION) return null;
  return createAnnounceEndOfRoundCommand({ playerId });
}

// Enter site command factory
function createEnterSiteCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== ENTER_SITE_ACTION) return null;
  return createEnterSiteCommand({ playerId });
}

// Helper to get tactic id from action
function getTacticIdFromAction(action: PlayerAction): TacticId | null {
  if (action.type === SELECT_TACTIC_ACTION && "tacticId" in action) {
    return action.tacticId;
  }
  return null;
}

// Select tactic command factory
function createSelectTacticCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  const tacticId = getTacticIdFromAction(action);
  if (!tacticId) return null;
  return createSelectTacticCommand({ playerId, tacticId });
}

// Command factory registry
const commandFactoryRegistry: Record<string, CommandFactory> = {
  [MOVE_ACTION]: createMoveCommandFromAction,
  [END_TURN_ACTION]: createEndTurnCommandFromAction,
  [EXPLORE_ACTION]: createExploreCommandFromAction,
  [PLAY_CARD_ACTION]: createPlayCardCommandFromAction,
  [PLAY_CARD_SIDEWAYS_ACTION]: createPlayCardSidewaysCommandFromAction,
  [RESOLVE_CHOICE_ACTION]: createResolveChoiceCommandFromAction,
  [REST_ACTION]: createRestCommandFromAction,
  [ENTER_COMBAT_ACTION]: createEnterCombatCommandFromAction,
  [END_COMBAT_PHASE_ACTION]: createEndCombatPhaseCommandFromAction,
  [DECLARE_BLOCK_ACTION]: createDeclareBlockCommandFromAction,
  [DECLARE_ATTACK_ACTION]: createDeclareAttackCommandFromAction,
  [ASSIGN_DAMAGE_ACTION]: createAssignDamageCommandFromAction,
  [RECRUIT_UNIT_ACTION]: createRecruitUnitCommandFromAction,
  [ACTIVATE_UNIT_ACTION]: createActivateUnitCommandFromAction,
  [INTERACT_ACTION]: createInteractCommandFromAction,
  [ANNOUNCE_END_OF_ROUND_ACTION]: createAnnounceEndOfRoundCommandFromAction,
  [ENTER_SITE_ACTION]: createEnterSiteCommandFromAction,
  [SELECT_TACTIC_ACTION]: createSelectTacticCommandFromAction,
};

// Get command for an action
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

// Re-export command types and individual factories
export * from "../commands.js";
export { createMoveCommand, type MoveCommandParams } from "./moveCommand.js";
export {
  createRevealTileCommand,
  type RevealTileCommandParams,
} from "./revealTileCommand.js";
export {
  createEndTurnCommand,
  type EndTurnCommandParams,
} from "./endTurnCommand.js";
export {
  createExploreCommand,
  type ExploreCommandParams,
} from "./exploreCommand.js";
export {
  createPlayCardCommand,
  type PlayCardCommandParams,
} from "./playCardCommand.js";
export {
  createPlayCardSidewaysCommand,
  type PlayCardSidewaysCommandParams,
  type SidewaysAs,
} from "./playCardSidewaysCommand.js";
export {
  createResolveChoiceCommand,
  type ResolveChoiceCommandParams,
} from "./resolveChoiceCommand.js";
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
