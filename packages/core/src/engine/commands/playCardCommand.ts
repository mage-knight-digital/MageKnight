/**
 * Play card command - handles playing a card from hand with undo support
 *
 * Supports both basic and powered card plays:
 * - Basic: uses card's basicEffect
 * - Powered: uses card's poweredEffect, consumes mana from source
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, Crystals } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import type { CardId, BasicActionCardId, ManaSourceInfo, BasicManaColor } from "@mage-knight/shared";
import {
  CARD_PLAYED,
  CHOICE_REQUIRED,
  createCardPlayUndoneEvent,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { resolveEffect, reverseEffect, isEffectResolvable } from "../effects/resolveEffect.js";
import { describeEffect } from "../effects/describeEffect.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";
import type { ChoiceEffect } from "../../types/cards.js";
import { getBasicActionCard } from "../../data/basicActions.js";
import { getCard } from "../validActions/cards.js";
import { PLAY_CARD_COMMAND } from "./commandTypes.js";
import type { CardEffect } from "../../types/cards.js";

export { PLAY_CARD_COMMAND };

export interface PlayCardCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly handIndex: number; // For undo — where the card was
  readonly powered?: boolean;
  readonly manaSource?: ManaSourceInfo;
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
  // Store mana consumption info for undo
  let consumedMana: ManaSourceInfo | null = null;

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

      // Get card definition - try getCard first (handles both basic and advanced), fall back to basic
      const card = getCard(params.cardId) ?? getBasicActionCard(params.cardId as BasicActionCardId);

      // Determine if powered and which effect to use
      const isPowered = params.powered === true && params.manaSource !== undefined;
      const effectToApply = isPowered ? card.poweredEffect : card.basicEffect;

      // Store the effect for undo
      appliedEffect = effectToApply;

      // Remove card from hand, add to play area
      const newHand = player.hand.filter((_, i) => i !== params.handIndex);
      const newPlayArea = [...player.playArea, params.cardId];

      let updatedPlayer: Player = {
        ...player,
        hand: newHand,
        playArea: newPlayArea,
      };

      // Track source updates (for die usage)
      let updatedSource = state.source;

      // Handle mana consumption if powered
      if (isPowered && params.manaSource) {
        consumedMana = params.manaSource;
        const { type: sourceType, color } = params.manaSource;

        // Track mana usage for conditional effects (e.g., "if you used red mana this turn")
        updatedPlayer = {
          ...updatedPlayer,
          manaUsedThisTurn: [...updatedPlayer.manaUsedThisTurn, color],
        };

        switch (sourceType) {
          case MANA_SOURCE_DIE: {
            // Mark player as having used die this turn, accumulate to the list
            // Die stays in source (will be rerolled at end of turn by end turn command)
            const dieId = params.manaSource.dieId as SourceDieId;
            if (!dieId) {
              throw new Error("Die ID required when using mana from source");
            }

            // Check if this is the Mana Steal stored die
            const storedDie = updatedPlayer.tacticState.storedManaDie;
            if (storedDie && storedDie.dieId === dieId) {
              // Using the stolen Mana Steal die - mark it as used this turn
              // It will be returned to source at end of turn
              updatedPlayer = {
                ...updatedPlayer,
                tacticState: {
                  ...updatedPlayer.tacticState,
                  manaStealUsedThisTurn: true,
                },
              };
              // Don't mark usedManaFromSource - stolen die is independent
              break;
            }

            // Only add if not already in the list (avoid duplicates)
            const alreadyUsed = updatedPlayer.usedDieIds.includes(dieId);
            updatedPlayer = {
              ...updatedPlayer,
              usedManaFromSource: true,
              usedDieIds: alreadyUsed
                ? updatedPlayer.usedDieIds
                : [...updatedPlayer.usedDieIds, dieId],
            };
            // Mark the die as taken in the source
            const updatedDice = state.source.dice.map((die) =>
              die.id === dieId
                ? { ...die, takenByPlayerId: params.playerId }
                : die
            );
            updatedSource = { dice: updatedDice };
            break;
          }

          case MANA_SOURCE_CRYSTAL: {
            // Remove crystal from inventory (validators ensured it's a basic color)
            const basicColor = color as BasicManaColor;
            const newCrystals: Crystals = {
              ...updatedPlayer.crystals,
              [basicColor]: updatedPlayer.crystals[basicColor] - 1,
            };
            updatedPlayer = { ...updatedPlayer, crystals: newCrystals };
            break;
          }

          case MANA_SOURCE_TOKEN: {
            // Remove mana token from play area
            const tokenIndex = updatedPlayer.pureMana.findIndex(
              (t) => t.color === color
            );
            if (tokenIndex !== -1) {
              const newPureMana = [...updatedPlayer.pureMana];
              newPureMana.splice(tokenIndex, 1);
              updatedPlayer = { ...updatedPlayer, pureMana: newPureMana };
            }
            break;
          }
        }
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      const newState: GameState = { ...state, players, source: updatedSource };

      // Resolve the effect
      const effectResult = resolveEffect(
        newState,
        params.playerId,
        effectToApply
      );

      if (effectResult.requiresChoice) {
        // Determine the choice options - either dynamic (from card boost) or static (from choice effect)
        let choiceOptions: readonly CardEffect[];

        if (effectResult.dynamicChoiceOptions) {
          // Dynamic choices from effects like EFFECT_CARD_BOOST
          choiceOptions = effectResult.dynamicChoiceOptions;
        } else if (effectToApply.type === EFFECT_CHOICE) {
          // Static choice effect
          const choiceEffect = effectToApply as ChoiceEffect;
          choiceOptions = choiceEffect.options;
        } else {
          // Unknown choice type - return as-is
          return {
            state: effectResult.state,
            events: [
              {
                type: CARD_PLAYED,
                playerId: params.playerId,
                cardId: params.cardId,
                powered: isPowered,
                sideways: false,
                effect: effectResult.description,
              },
            ],
          };
        }

        // Filter options to only include resolvable ones
        const resolvableOptions = choiceOptions.filter((opt) =>
          isEffectResolvable(newState, params.playerId, opt)
        );

        // If no options are resolvable, skip the choice entirely
        if (resolvableOptions.length === 0) {
          return {
            state: effectResult.state,
            events: [
              {
                type: CARD_PLAYED,
                playerId: params.playerId,
                cardId: params.cardId,
                powered: isPowered,
                sideways: false,
                effect: "No available options",
              },
            ],
          };
        }

        // If only one option is resolvable, auto-resolve it
        if (resolvableOptions.length === 1) {
          const singleOption = resolvableOptions[0];
          if (!singleOption) {
            throw new Error("Expected single resolvable option");
          }
          const autoResolveResult = resolveEffect(
            newState,
            params.playerId,
            singleOption
          );
          return {
            state: autoResolveResult.state,
            events: [
              {
                type: CARD_PLAYED,
                playerId: params.playerId,
                cardId: params.cardId,
                powered: isPowered,
                sideways: false,
                effect: autoResolveResult.description,
              },
            ],
          };
        }

        // Multiple options available - present choice to player
        const playerWithChoice: Player = {
          ...updatedPlayer,
          pendingChoice: {
            cardId: params.cardId,
            options: resolvableOptions,
          },
        };

        // Update state with pending choice
        const playersWithChoice = [...effectResult.state.players];
        playersWithChoice[playerIndex] = playerWithChoice;

        return {
          state: { ...effectResult.state, players: playersWithChoice },
          events: [
            {
              type: CARD_PLAYED,
              playerId: params.playerId,
              cardId: params.cardId,
              powered: isPowered,
              sideways: false,
              effect: "Choice required",
            },
            {
              type: CHOICE_REQUIRED,
              playerId: params.playerId,
              cardId: params.cardId,
              options: resolvableOptions.map((opt) => describeEffect(opt)),
            },
          ],
        };
      }

      // If resolveEffect internally chained to a different effect (e.g., auto-resolved),
      // update appliedEffect so undo knows what actually resolved
      if (effectResult.resolvedEffect) {
        appliedEffect = effectResult.resolvedEffect;
      }

      return {
        state: effectResult.state,
        events: [
          {
            type: CARD_PLAYED,
            playerId: params.playerId,
            cardId: params.cardId,
            powered: isPowered,
            sideways: false,
            effect: effectResult.description,
          },
        ],
      };
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

      // Remove card from play area
      const cardIndexInPlayArea = player.playArea.indexOf(params.cardId);
      const newPlayArea = player.playArea.filter(
        (_, i) => i !== cardIndexInPlayArea
      );

      // Add card back to hand at original position
      const newHand = [...player.hand];
      newHand.splice(params.handIndex, 0, params.cardId);

      let updatedPlayer: Player = {
        ...player,
        hand: newHand,
        playArea: newPlayArea,
        pendingChoice: null, // Clear any pending choice
      };

      // Reverse the effect if we stored one (only if it wasn't a choice effect)
      if (appliedEffect && appliedEffect.type !== EFFECT_CHOICE) {
        updatedPlayer = reverseEffect(updatedPlayer, appliedEffect);
      }

      // Track source updates for undo
      let updatedSource = state.source;

      // Restore mana if it was consumed
      if (consumedMana) {
        const { type: sourceType, color } = consumedMana;

        // Remove the mana color from tracking (reverse of tracking addition)
        const manaIndex = updatedPlayer.manaUsedThisTurn.indexOf(color);
        if (manaIndex !== -1) {
          const newManaUsed = [...updatedPlayer.manaUsedThisTurn];
          newManaUsed.splice(manaIndex, 1);
          updatedPlayer = { ...updatedPlayer, manaUsedThisTurn: newManaUsed };
        }

        switch (sourceType) {
          case MANA_SOURCE_DIE: {
            // Remove this die from usedDieIds and clear takenByPlayerId
            const dieId = consumedMana.dieId as SourceDieId;
            if (dieId) {
              const newUsedDieIds = updatedPlayer.usedDieIds.filter(
                (id) => id !== dieId
              );
              updatedPlayer = {
                ...updatedPlayer,
                usedManaFromSource: newUsedDieIds.length > 0,
                usedDieIds: newUsedDieIds,
              };
              // Clear the takenByPlayerId on the die
              const updatedDice = state.source.dice.map((die) =>
                die.id === dieId ? { ...die, takenByPlayerId: null } : die
              );
              updatedSource = { dice: updatedDice };
            }
            break;
          }

          case MANA_SOURCE_CRYSTAL: {
            // Restore crystal to inventory
            const basicColor = color as BasicManaColor;
            const newCrystals: Crystals = {
              ...updatedPlayer.crystals,
              [basicColor]: updatedPlayer.crystals[basicColor] + 1,
            };
            updatedPlayer = { ...updatedPlayer, crystals: newCrystals };
            break;
          }

          case MANA_SOURCE_TOKEN: {
            // Restore mana token to play area
            // We need to get the source from the original player state
            // For simplicity, we create a new token with a generic source
            const newPureMana = [
              ...updatedPlayer.pureMana,
              { color, source: "die" as const }, // Default source for restored tokens
            ];
            updatedPlayer = { ...updatedPlayer, pureMana: newPureMana };
            break;
          }
        }
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
