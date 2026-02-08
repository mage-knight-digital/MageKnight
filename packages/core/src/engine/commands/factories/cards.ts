/**
 * Card Command Factories
 *
 * Factory functions that translate card-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/cards
 *
 * @remarks Factories in this module:
 * - createPlayCardCommandFromAction - Play a card from hand
 * - createPlayCardSidewaysCommandFromAction - Play a card sideways for move/influence/attack/block
 * - createResolveChoiceCommandFromAction - Resolve a pending choice from a card effect
 * - createResolveDiscardCommandFromAction - Resolve a pending discard cost
 */

import type { CommandFactory } from "./types.js";
import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, CardId, ManaSourceInfo } from "@mage-knight/shared";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  RESOLVE_CHOICE_ACTION,
  RESOLVE_DISCARD_ACTION,
  RESOLVE_DISCARD_FOR_ATTACK_ACTION,
  RESOLVE_DISCARD_FOR_CRYSTAL_ACTION,
  RESOLVE_DECOMPOSE_ACTION,
  RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION,
  MANA_BLACK,
} from "@mage-knight/shared";
import { createPlayCardCommand } from "../playCardCommand.js";
import {
  createPlayCardSidewaysCommand,
  type SidewaysAs,
} from "../playCardSidewaysCommand.js";
import { createResolveChoiceCommand } from "../resolveChoiceCommand.js";
import { createResolveDiscardCommand } from "../resolveDiscardCommand.js";
import { createResolveDiscardForAttackCommand } from "../resolveDiscardForAttackCommand.js";
import { createResolveDiscardForCrystalCommand } from "../resolveDiscardForCrystalCommand.js";
import { createResolveArtifactCrystalColorCommand } from "../resolveArtifactCrystalColorCommand.js";
import { createResolveDecomposeCommand } from "../resolveDecomposeCommand.js";
import { getCard } from "../../validActions/cards/index.js";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { getAvailableManaSourcesForColor } from "../../validActions/mana.js";
import type { Player } from "../../../types/player.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Helper to get card id from play card action.
 */
function getCardIdFromAction(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

/**
 * Helper to get card id from sideways action.
 */
function getCardIdFromSidewaysAction(action: PlayerAction): CardId | null {
  if (action.type === PLAY_CARD_SIDEWAYS_ACTION && "cardId" in action) {
    return action.cardId;
  }
  return null;
}

/**
 * Helper to get sideways choice from action.
 */
function getSidewaysChoice(action: PlayerAction): SidewaysAs | null {
  if (action.type === PLAY_CARD_SIDEWAYS_ACTION && "as" in action) {
    return action.as as SidewaysAs;
  }
  return null;
}

/**
 * Helper to get powered status and mana source from action.
 */
function getPlayCardDetails(action: PlayerAction): {
  powered: boolean;
  manaSource: ManaSourceInfo | undefined;
  manaSources: readonly ManaSourceInfo[] | undefined;
} | null {
  if (action.type === PLAY_CARD_ACTION) {
    return {
      powered: action.powered,
      manaSource: action.manaSource,
      manaSources: action.manaSources,
    };
  }
  return null;
}

/**
 * Auto-infer mana source for spell basic plays when no source is specified.
 * If there's exactly one valid mana source, use it automatically.
 */
function autoInferSpellBasicManaSource(
  state: GameState,
  player: Player,
  cardId: CardId
): ManaSourceInfo | undefined {
  const card = getCard(cardId);
  if (!card) return undefined;

  // Only auto-infer for spells
  if (card.cardType !== DEED_CARD_TYPE_SPELL) return undefined;

  // Find the spell's color (non-black color in poweredBy)
  const spellColor = card.poweredBy.find((c) => c !== MANA_BLACK);
  if (!spellColor) return undefined;

  // Get all available sources for this color
  const sources = getAvailableManaSourcesForColor(state, player, spellColor);

  // Only auto-infer if there's exactly one source
  if (sources.length === 1) {
    return sources[0];
  }

  return undefined;
}

/**
 * Helper to get choice index from action.
 */
function getChoiceIndexFromAction(action: PlayerAction): number | null {
  if (action.type === RESOLVE_CHOICE_ACTION && "choiceIndex" in action) {
    return action.choiceIndex;
  }
  return null;
}

/**
 * Play card command factory.
 * Creates a command to play a card from the player's hand.
 */
export const createPlayCardCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  const cardId = getCardIdFromAction(action);
  if (!cardId) return null;

  const details = getPlayCardDetails(action);
  if (!details) return null;

  const player = getPlayerById(state, playerId);
  if (!player) return null;

  const handIndex = player.hand.indexOf(cardId);
  if (handIndex === -1) return null;

  // Capture current state for undo
  const previousPlayedCardFromHand = player.playedCardFromHandThisTurn;

  // Handle spell with manaSources (plural)
  if (details.manaSources && details.manaSources.length > 0) {
    return createPlayCardCommand({
      playerId,
      cardId,
      handIndex,
      powered: details.powered,
      manaSources: details.manaSources,
      previousPlayedCardFromHand,
    });
  }

  // Handle action card with manaSource (singular)
  if (details.manaSource) {
    return createPlayCardCommand({
      playerId,
      cardId,
      handIndex,
      powered: details.powered,
      manaSource: details.manaSource,
      previousPlayedCardFromHand,
    });
  }

  // For spell basic plays without manaSource, try to auto-infer
  if (!details.powered && !details.manaSource) {
    const inferredSource = autoInferSpellBasicManaSource(state, player, cardId);
    if (inferredSource) {
      return createPlayCardCommand({
        playerId,
        cardId,
        handIndex,
        powered: false,
        manaSource: inferredSource,
        previousPlayedCardFromHand,
      });
    }
  }

  return createPlayCardCommand({
    playerId,
    cardId,
    handIndex,
    powered: details.powered,
    previousPlayedCardFromHand,
  });
};

/**
 * Play card sideways command factory.
 * Creates a command to play a card sideways for move/influence/attack/block.
 */
export const createPlayCardSidewaysCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  const cardId = getCardIdFromSidewaysAction(action);
  if (!cardId) return null;

  const sidewaysChoice = getSidewaysChoice(action);
  if (!sidewaysChoice) return null;

  const player = getPlayerById(state, playerId);
  if (!player) return null;

  const handIndex = player.hand.indexOf(cardId);
  if (handIndex === -1) return null;

  return createPlayCardSidewaysCommand({
    playerId,
    cardId,
    handIndex,
    as: sidewaysChoice,
    previousPlayedCardFromHand: player.playedCardFromHandThisTurn,
  });
};

/**
 * Resolve choice command factory.
 * Creates a command to resolve a pending choice from a card effect.
 */
export const createResolveChoiceCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  const choiceIndex = getChoiceIndexFromAction(action);
  if (choiceIndex === null) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingChoice) return null;

  return createResolveChoiceCommand({
    playerId,
    choiceIndex,
    previousPendingChoice: player.pendingChoice,
  });
};

/**
 * Resolve discard command factory.
 * Creates a command to resolve a pending discard cost from a card effect.
 */
export const createResolveDiscardCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_DISCARD_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingDiscard) return null;

  return createResolveDiscardCommand({
    playerId,
    cardIds: action.cardIds,
  });
};

/**
 * Resolve discard-for-attack command factory.
 * Creates a command to resolve a pending discard-for-attack (Sword of Justice).
 */
export const createResolveDiscardForAttackCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_DISCARD_FOR_ATTACK_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingDiscardForAttack) return null;

  return createResolveDiscardForAttackCommand({
    playerId,
    cardIds: action.cardIds,
  });
};

/**
 * Resolve discard-for-crystal command factory.
 * Creates a command to resolve a pending discard-for-crystal (Savage Harvesting).
 */
export const createResolveDiscardForCrystalCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_DISCARD_FOR_CRYSTAL_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingDiscardForCrystal) return null;

  return createResolveDiscardForCrystalCommand({
    playerId,
    cardId: action.cardId,
  });
};

/**
 * Resolve artifact crystal color command factory.
 * Creates a command to resolve crystal color selection after discarding an artifact.
 */
export const createResolveArtifactCrystalColorCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingDiscardForCrystal?.awaitingColorChoice) return null;

  return createResolveArtifactCrystalColorCommand({
    playerId,
    color: action.color,
  });
};

/**
 * Resolve decompose command factory.
 * Creates a command to resolve a pending decompose (throw away action card for crystals).
 */
export const createResolveDecomposeCommandFromAction: CommandFactory = (
  state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_DECOMPOSE_ACTION) return null;

  const player = getPlayerById(state, playerId);
  if (!player?.pendingDecompose) return null;

  return createResolveDecomposeCommand({
    playerId,
    cardId: action.cardId,
  });
};
