/**
 * Play card command - handles playing a card from hand with undo support
 *
 * Supports both basic and powered card plays:
 * - Basic: uses card's basicEffect
 * - Powered: uses card's poweredEffect, consumes mana from source
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId, BasicActionCardId, ManaSourceInfo, ManaColor } from "@mage-knight/shared";
import { MANA_BLACK } from "@mage-knight/shared";
import {
  CARD_PLAYED,
  createCardPlayUndoneEvent,
} from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { resolveEffect, reverseEffect } from "../effects/index.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";
import { getBasicActionCard } from "../../data/basicActions/index.js";
import { getCard } from "../validActions/cards/index.js";
import { getSpellCard } from "../../data/spells/index.js";
import { PLAY_CARD_COMMAND } from "./commandTypes.js";
import type { CardEffect, DeedCard } from "../../types/cards.js";

import { consumeMultipleMana, restoreMana } from "./helpers/manaConsumptionHelpers.js";
import {
  getChoiceOptions,
  handleChoiceEffect,
} from "./playCard/choiceHandling.js";
import { handleArtifactDestruction } from "./playCard/artifactDestruction.js";

export { PLAY_CARD_COMMAND };

export interface PlayCardCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly handIndex: number; // For undo — where the card was
  readonly powered?: boolean;
  readonly manaSource?: ManaSourceInfo; // For action cards (single mana)
  readonly manaSources?: readonly ManaSourceInfo[]; // For spells (black + color)
  readonly previousPlayedCardFromHand: boolean; // For undo - restore minimum turn state
}

/**
 * Create a play card command.
 *
 * The handIndex is passed in because it was captured at creation time.
 * This ensures undo restores the card to the exact previous position in hand.
 */
export function createPlayCardCommand(params: PlayCardCommandParams): Command {
  // Store the effect that was applied so we can reverse it on undo
  let appliedEffect: CardEffect | null = null;
  // Store mana sources consumed for undo
  let consumedManaSources: readonly ManaSourceInfo[] = [];
  // Store spell color tracked for undo (null if no new color was tracked)
  let trackedSpellColor: ManaColor | null = null;

  return {
    type: PLAY_CARD_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo playing a card (before irreversible action)

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Get card definition
      const card = getCard(params.cardId) ?? getBasicActionCard(params.cardId as BasicActionCardId);

      // Determine if powered and which effect to use
      const manaSources = getManaSources(params);
      const isPowered = params.powered === true && manaSources.length > 0;
      const effectToApply = isPowered ? card.poweredEffect : card.basicEffect;

      // Store for undo
      appliedEffect = effectToApply;
      consumedManaSources = manaSources;

      // Move card from hand to play area
      let updatedPlayer = moveCardToPlayArea(player, params.cardId, params.handIndex);

      // Track spell color for Ring artifacts fame bonus
      if (isPowered) {
        const spellColor = getSpellColor(card);
        if (spellColor && !updatedPlayer.spellColorsCastThisTurn.includes(spellColor)) {
          trackedSpellColor = spellColor;
          updatedPlayer = trackSpellColor(updatedPlayer, spellColor);
        }
      }

      // Track source updates
      let updatedSource = state.source;

      // Handle mana consumption if powered
      if (manaSources.length > 0) {
        const manaResult = consumeMultipleMana(
          updatedPlayer,
          updatedSource,
          manaSources,
          params.playerId
        );
        updatedPlayer = manaResult.player;
        updatedSource = manaResult.source;
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;
      const newState: GameState = { ...state, players, source: updatedSource };

      // Resolve the effect
      const effectResult = resolveEffect(newState, params.playerId, effectToApply);

      // Check if this is a choice effect
      if (effectResult.requiresChoice) {
        const choiceOptions = getChoiceOptions(effectResult, effectToApply);

        if (choiceOptions) {
          const choiceResult = handleChoiceEffect(
            newState,
            params.playerId,
            playerIndex,
            params.cardId,
            isPowered,
            effectResult,
            choiceOptions
          );

          // Track resolved effect for undo if auto-resolved
          if (choiceResult.resolvedEffect) {
            appliedEffect = choiceResult.resolvedEffect;
          }

          return choiceResult;
        }

        // Unknown choice type - return as-is
        return createCardPlayedResult(
          effectResult.state,
          params.playerId,
          params.cardId,
          isPowered,
          effectResult.description
        );
      }

      // Track resolved effect if chained internally
      if (effectResult.resolvedEffect) {
        appliedEffect = effectResult.resolvedEffect;
      }

      // Handle artifact destruction if this was a powered play of a destroyOnPowered card
      let finalState = effectResult.state;
      const events: GameEvent[] = [
        {
          type: CARD_PLAYED,
          playerId: params.playerId,
          cardId: params.cardId,
          powered: isPowered,
          sideways: false,
          effect: effectResult.description,
        },
      ];

      if (isPowered && card.destroyOnPowered) {
        const destructionResult = handleArtifactDestruction(
          finalState,
          params.playerId,
          params.cardId
        );
        finalState = destructionResult.state;
        events.push(...destructionResult.events);
      }

      return { state: finalState, events };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Move card from play area back to hand
      let updatedPlayer = moveCardBackToHand(
        player,
        params.cardId,
        params.handIndex,
        params.previousPlayedCardFromHand
      );

      // Reverse the effect if we stored one (only if it wasn't a choice effect)
      if (appliedEffect && appliedEffect.type !== EFFECT_CHOICE) {
        updatedPlayer = reverseEffect(updatedPlayer, appliedEffect);
      }

      // Restore mana if consumed
      let updatedSource = state.source;
      for (const manaSource of consumedManaSources) {
        const manaResult = restoreMana(updatedPlayer, updatedSource, manaSource);
        updatedPlayer = manaResult.player;
        updatedSource = manaResult.source;
      }

      // Restore spell color tracking if we tracked a new color
      if (trackedSpellColor) {
        updatedPlayer = {
          ...updatedPlayer,
          spellColorsCastThisTurn: updatedPlayer.spellColorsCastThisTurn.filter(
            (c) => c !== trackedSpellColor
          ),
        };
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players, source: updatedSource },
        events: [createCardPlayUndoneEvent(params.playerId, params.cardId)],
      };
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the list of mana sources to consume for this card play.
 */
function getManaSources(params: PlayCardCommandParams): readonly ManaSourceInfo[] {
  if (params.manaSources && params.manaSources.length > 0) {
    return params.manaSources;
  }
  if (params.manaSource) {
    return [params.manaSource];
  }
  return [];
}

/**
 * Move a card from hand to play area.
 */
function moveCardToPlayArea(
  player: Player,
  cardId: CardId,
  handIndex: number
): Player {
  const newHand = player.hand.filter((_, i) => i !== handIndex);
  const newPlayArea = [...player.playArea, cardId];

  return {
    ...player,
    hand: newHand,
    playArea: newPlayArea,
    playedCardFromHandThisTurn: true,
  };
}

/**
 * Move a card from play area back to hand (for undo).
 */
function moveCardBackToHand(
  player: Player,
  cardId: CardId,
  handIndex: number,
  previousPlayedCardFromHand: boolean
): Player {
  const cardIndexInPlayArea = player.playArea.indexOf(cardId);
  const newPlayArea = player.playArea.filter((_, i) => i !== cardIndexInPlayArea);

  const newHand = [...player.hand];
  newHand.splice(handIndex, 0, cardId);

  return {
    ...player,
    hand: newHand,
    playArea: newPlayArea,
    pendingChoice: null,
    playedCardFromHandThisTurn: previousPlayedCardFromHand,
  };
}

/**
 * Create a simple card played result.
 */
function createCardPlayedResult(
  state: GameState,
  playerId: string,
  cardId: CardId,
  isPowered: boolean,
  effectDescription: string
): CommandResult {
  return {
    state,
    events: [
      {
        type: CARD_PLAYED,
        playerId,
        cardId,
        powered: isPowered,
        sideways: false,
        effect: effectDescription,
      },
    ],
  };
}

/**
 * Get the spell color from a spell card (the non-black mana color).
 * Returns null if the card is not a spell or has no color.
 */
function getSpellColor(card: DeedCard): ManaColor | null {
  // Check if this is a spell card
  const spell = getSpellCard(card.id);
  if (!spell) {
    return null;
  }

  // Find the non-black color from poweredBy
  // Spells are powered by [MANA_BLACK, colorMana]
  for (const color of card.poweredBy) {
    if (color !== MANA_BLACK) {
      return color;
    }
  }

  return null;
}

/**
 * Track the spell color for fame bonus calculation (Ring artifacts).
 * Only tracks if the color is not already tracked this turn.
 */
function trackSpellColor(player: Player, color: ManaColor): Player {
  if (player.spellColorsCastThisTurn.includes(color)) {
    return player;
  }

  return {
    ...player,
    spellColorsCastThisTurn: [...player.spellColorsCastThisTurn, color],
  };
}
