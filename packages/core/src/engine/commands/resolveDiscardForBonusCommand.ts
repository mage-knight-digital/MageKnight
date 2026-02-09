/**
 * Resolve Discard For Bonus Command
 *
 * Handles player resolution of a pending discard-for-bonus (Stout Resolve).
 * Player can discard 0 or more cards to increase a chosen effect (Move/Influence/Attack/Block).
 *
 * Flow:
 * 1. Card played creates pendingDiscardForBonus state via EFFECT_DISCARD_FOR_BONUS
 * 2. Player sends RESOLVE_DISCARD_FOR_BONUS action with cardIds and choiceIndex
 * 3. This command validates selection, moves cards to discard, clears pending state
 * 4. Resolves chosen effect with bonus applied
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import { createCardDiscardedEvent, CARD_WOUND } from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import type { CardEffect } from "../../types/cards.js";
import { getCardsEligibleForDiscardForBonus } from "../effects/stoutResolveEffects.js";
import { addBonusToEffect } from "../effects/cardBoostEffects.js";
import { resolveEffect } from "../effects/index.js";
import {
  consumeMovementCardBonus,
  getModifiersForPlayer,
  getAttackBlockCardBonus,
  consumeAttackBlockCardBonus,
} from "../modifiers/index.js";
import { EFFECT_MOVEMENT_CARD_BONUS, EFFECT_ATTACK_BLOCK_CARD_BONUS } from "../../types/modifierConstants.js";
import type { ActiveModifier } from "../../types/modifiers.js";

export const RESOLVE_DISCARD_FOR_BONUS_COMMAND = "RESOLVE_DISCARD_FOR_BONUS" as const;

export interface ResolveDiscardForBonusCommandParams {
  readonly playerId: string;
  /** Card IDs to discard. Can be empty array (discard 0 cards, gain 0 bonus). */
  readonly cardIds: readonly CardId[];
  /** Which choice option to select (0-indexed) */
  readonly choiceIndex: number;
}

export function createResolveDiscardForBonusCommand(
  params: ResolveDiscardForBonusCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDiscardForBonus: Player["pendingDiscardForBonus"] = null;
  let previousHand: readonly CardId[] = [];
  let previousDiscard: readonly CardId[] = [];
  let previousMovePoints = 0;
  let previousInfluencePoints = 0;
  let previousCombatAccumulator: Player["combatAccumulator"] | null = null;
  let movementBonusModifiersSnapshot: readonly ActiveModifier[] | null = null;
  let attackBlockBonusModifiersSnapshot: readonly ActiveModifier[] | null = null;

  return {
    type: RESOLVE_DISCARD_FOR_BONUS_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingDiscardForBonus) {
        throw new Error("No pending discard-for-bonus to resolve");
      }

      const pendingState = player.pendingDiscardForBonus;

      // Validate choice index
      if (params.choiceIndex < 0 || params.choiceIndex >= pendingState.choiceOptions.length) {
        throw new Error(`Invalid choice index: ${params.choiceIndex}`);
      }

      // Store for undo
      previousPendingDiscardForBonus = pendingState;
      previousHand = player.hand;
      previousDiscard = player.discard;
      previousMovePoints = player.movePoints;
      previousInfluencePoints = player.influencePoints;
      previousCombatAccumulator = player.combatAccumulator;

      const events: GameEvent[] = [];

      // Validate all cards are eligible
      const eligibleCards = getCardsEligibleForDiscardForBonus(
        player.hand,
        pendingState.discardFilter
      );
      for (const cardId of params.cardIds) {
        if (!eligibleCards.includes(cardId)) {
          throw new Error(
            `Card ${cardId} is not eligible for discard-for-bonus`
          );
        }
      }

      // Validate max discards
      if (params.cardIds.length > pendingState.maxDiscards) {
        throw new Error(
          `Cannot discard more than ${pendingState.maxDiscards} cards`
        );
      }

      // Validate max 1 wound for "any_max_one_wound" filter
      if (pendingState.discardFilter === "any_max_one_wound") {
        const woundCount = params.cardIds.filter((id) => id === CARD_WOUND).length;
        if (woundCount > 1) {
          throw new Error("Cannot discard more than 1 wound");
        }
      }

      // Move cards from hand to discard pile
      const updatedHand = [...player.hand];
      const discardedCards: CardId[] = [];

      for (const cardId of params.cardIds) {
        const index = updatedHand.indexOf(cardId);
        if (index === -1) {
          throw new Error(`Card ${cardId} not found in hand`);
        }
        updatedHand.splice(index, 1);
        discardedCards.push(cardId);

        events.push(createCardDiscardedEvent(params.playerId, cardId));
      }

      const updatedDiscardPile = [...player.discard, ...discardedCards];

      // Calculate bonus
      const bonus = params.cardIds.length * pendingState.bonusPerCard;

      // Get the chosen effect and apply bonus
      const chosenEffect = pendingState.choiceOptions[params.choiceIndex]!;
      const boostedEffect: CardEffect = bonus > 0
        ? addBonusToEffect(chosenEffect, bonus)
        : chosenEffect;

      // Snapshot modifier IDs before resolution for card bonus tracking
      const movementBonusModifierIdsBefore = new Set(
        getModifiersForPlayer(state, params.playerId)
          .filter((m) => m.effect.type === EFFECT_MOVEMENT_CARD_BONUS)
          .map((m) => m.id)
      );
      const attackBlockBonusModifierIdsBefore = new Set(
        getModifiersForPlayer(state, params.playerId)
          .filter((m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS)
          .map((m) => m.id)
      );

      // Clear pending state and update hand/discard
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        discard: updatedDiscardPile,
        pendingDiscardForBonus: null,
      };

      let newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      // Resolve the boosted effect
      const effectResult = resolveEffect(
        newState,
        params.playerId,
        boostedEffect,
        pendingState.sourceCardId
      );
      newState = effectResult.state;

      // Handle movement card bonus (if this was a move effect and modifiers are active)
      if (movementBonusModifierIdsBefore.size > 0) {
        const movePointsAfter = newState.players[playerIndex]!.movePoints;
        const movePointsBefore = updatedPlayer.movePoints;
        if (movePointsAfter > movePointsBefore) {
          const modifiersSnapshot = newState.activeModifiers;
          const bonusResult = consumeMovementCardBonus(
            newState,
            params.playerId,
            movementBonusModifierIdsBefore
          );
          if (bonusResult.bonus > 0) {
            movementBonusModifiersSnapshot = modifiersSnapshot;

            const currentPlayer = bonusResult.state.players[playerIndex]!;
            const updatedPlayerWithBonus: Player = {
              ...currentPlayer,
              movePoints: currentPlayer.movePoints + bonusResult.bonus,
            };
            const updatedPlayers = [...bonusResult.state.players];
            updatedPlayers[playerIndex] = updatedPlayerWithBonus;
            newState = { ...bonusResult.state, players: updatedPlayers };
          } else {
            newState = bonusResult.state;
          }
        }
      }

      // Handle attack/block card bonus
      if (attackBlockBonusModifierIdsBefore.size > 0) {
        const currentPlayer = newState.players[playerIndex]!;
        const totalAttackAfter = currentPlayer.combatAccumulator.attack.normal +
          currentPlayer.combatAccumulator.attack.ranged +
          currentPlayer.combatAccumulator.attack.siege;
        const totalBlockAfter = currentPlayer.combatAccumulator.block;
        const prevTotalAttack = updatedPlayer.combatAccumulator.attack.normal +
          updatedPlayer.combatAccumulator.attack.ranged +
          updatedPlayer.combatAccumulator.attack.siege;
        const prevTotalBlock = updatedPlayer.combatAccumulator.block;

        const attackGained = totalAttackAfter > prevTotalAttack;
        const blockGained = totalBlockAfter > prevTotalBlock;

        if (attackGained || blockGained) {
          const forAttack = attackGained;
          const { bonus: abBonus, modifierId } = getAttackBlockCardBonus(
            newState,
            params.playerId,
            forAttack,
            attackBlockBonusModifierIdsBefore
          );

          if (abBonus > 0 && modifierId) {
            attackBlockBonusModifiersSnapshot = newState.activeModifiers;

            newState = consumeAttackBlockCardBonus(newState, modifierId);
            const playerToBoost = newState.players[playerIndex]!;

            let boostedPlayer: Player;
            if (forAttack) {
              boostedPlayer = {
                ...playerToBoost,
                combatAccumulator: {
                  ...playerToBoost.combatAccumulator,
                  attack: {
                    ...playerToBoost.combatAccumulator.attack,
                    normal: playerToBoost.combatAccumulator.attack.normal + abBonus,
                    normalElements: {
                      ...playerToBoost.combatAccumulator.attack.normalElements,
                      physical: playerToBoost.combatAccumulator.attack.normalElements.physical + abBonus,
                    },
                  },
                },
              };
            } else {
              boostedPlayer = {
                ...playerToBoost,
                combatAccumulator: {
                  ...playerToBoost.combatAccumulator,
                  block: playerToBoost.combatAccumulator.block + abBonus,
                  blockElements: {
                    ...playerToBoost.combatAccumulator.blockElements,
                    physical: playerToBoost.combatAccumulator.blockElements.physical + abBonus,
                  },
                },
              };
            }

            const updatedPlayers = [...newState.players];
            updatedPlayers[playerIndex] = boostedPlayer;
            newState = { ...newState, players: updatedPlayers };
          }
        }
      }

      return {
        state: newState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      let newState = state;

      // Restore attack/block card bonus modifiers if they were consumed
      if (attackBlockBonusModifiersSnapshot) {
        newState = { ...newState, activeModifiers: attackBlockBonusModifiersSnapshot };
        attackBlockBonusModifiersSnapshot = null;
      }

      // Restore movement card bonus modifiers if they were consumed
      if (movementBonusModifiersSnapshot) {
        newState = { ...newState, activeModifiers: movementBonusModifiersSnapshot };
        movementBonusModifiersSnapshot = null;
      }

      // Restore player state
      const restoredPlayer: Player = {
        ...newState.players[playerIndex]!,
        hand: previousHand,
        discard: previousDiscard,
        pendingDiscardForBonus: previousPendingDiscardForBonus,
        movePoints: previousMovePoints,
        influencePoints: previousInfluencePoints,
        combatAccumulator: previousCombatAccumulator!,
      };

      newState = {
        ...newState,
        players: newState.players.map((p, i) =>
          i === playerIndex ? restoredPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },
  };
}
