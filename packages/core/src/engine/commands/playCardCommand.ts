/**
 * Play card command - handles playing a card from hand with undo support
 *
 * Supports both basic and powered card plays:
 * - Basic: uses card's basicEffect
 * - Powered: uses card's poweredEffect, consumes mana from source
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId, BasicActionCardId, ManaSourceInfo, ManaColor } from "@mage-knight/shared";
import { MANA_BLACK } from "@mage-knight/shared";
import {
  CARD_PLAYED,
  createCardPlayUndoneEvent,
  CARD_GOLDYX_CRYSTAL_JOY,
} from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { resolveEffect, reverseEffect } from "../effects/index.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";
import { getBasicActionCard } from "../../data/basicActions/index.js";
import { getCard } from "../validActions/cards/index.js";
import { getSpellCard } from "../../data/spells/index.js";
import { PLAY_CARD_COMMAND } from "./commandTypes.js";
import type { CardEffect, DeedCard } from "../../types/cards.js";
import type { ActiveModifier } from "../../types/modifiers.js";

import { consumeMultipleMana, restoreMana } from "./helpers/manaConsumptionHelpers.js";
import { checkManaCurseWound } from "../effects/manaClaimEffects.js";
import {
  getChoiceOptions,
  handleChoiceEffect,
} from "./playCard/choiceHandling.js";
import { handleArtifactDestruction } from "./playCard/artifactDestruction.js";
import { checkManaOverloadTrigger, applyManaOverloadTrigger } from "./playCard/manaOverloadTrigger.js";
import { consumeMovementCardBonus, getModifiersForPlayer } from "../modifiers/index.js";
import { EFFECT_MOVEMENT_CARD_BONUS } from "../../types/modifierConstants.js";
import type { CardEffectKind } from "../helpers/cardCategoryHelpers.js";
import { getCombatFilteredEffect } from "../rules/cardPlay.js";

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
  // Store movement bonus application for undo
  let movementBonusAppliedAmount = 0;
  // Snapshot of activeModifiers BEFORE effect resolution — always restored on undo.
  // This correctly reverts any modifier-adding effects (Noble Manners, Heroic Tale,
  // Ruthless Coercion, Agility, etc.) without needing per-effect reverse logic.
  let preEffectModifiersSnapshot: readonly ActiveModifier[] | null = null;
  // Store Mana Overload trigger info for undo
  let manaOverloadTriggered = false;
  let manaOverloadBonusType: string | null = null;
  let manaOverloadPreviousCenter: GameState["manaOverloadCenter"] = null;

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
      const effectType: CardEffectKind = isPowered ? "powered" : "basic";
      const effectToApply = getCombatFilteredEffect(
        card,
        effectType,
        state.combat !== null
      );

      // Store for undo
      appliedEffect = effectToApply;
      consumedManaSources = manaSources;

      // Move card from hand to play area
      let updatedPlayer = moveCardToPlayArea(player, params.cardId, params.handIndex);

      // Track spell color for Ring artifacts fame bonus
      // This tracks EVERY spell cast (not just unique colors) for count-based fame bonuses
      if (isPowered) {
        const spellColor = getSpellColor(card);
        if (spellColor) {
          // Store the color for undo purposes
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
      let newState: GameState = { ...state, players, source: updatedSource };

      // Check for Mana Curse wounds after mana consumption
      if (manaSources.length > 0) {
        for (const manaSource of manaSources) {
          newState = checkManaCurseWound(newState, params.playerId, manaSource.color);
        }
      }

      // Snapshot modifiers BEFORE effect resolution for undo
      preEffectModifiersSnapshot = newState.activeModifiers;

      const movePointsBefore = newState.players[playerIndex]?.movePoints ?? 0;
      const movementBonusModifierIdsBefore = new Set(
        getModifiersForPlayer(newState, params.playerId)
          .filter((m) => m.effect.type === EFFECT_MOVEMENT_CARD_BONUS)
          .map((m) => m.id)
      );

      // Resolve the effect (pass cardId for effects that need to know their source)
      const effectResult = resolveEffect(newState, params.playerId, effectToApply, params.cardId);

      const applyMovementBonusIfGained = (stateToUpdate: GameState): GameState => {
        const playerAfter = stateToUpdate.players[playerIndex];
        if (!playerAfter) {
          return stateToUpdate;
        }

        if (playerAfter.movePoints <= movePointsBefore) {
          return stateToUpdate;
        }

        if (movementBonusModifierIdsBefore.size === 0) {
          return stateToUpdate;
        }

        const bonusResult = consumeMovementCardBonus(
          stateToUpdate,
          params.playerId,
          movementBonusModifierIdsBefore
        );
        if (bonusResult.bonus <= 0) {
          return stateToUpdate;
        }

        movementBonusAppliedAmount = bonusResult.bonus;

        const updatedPlayerWithBonus: Player = {
          ...playerAfter,
          movePoints: playerAfter.movePoints + bonusResult.bonus,
        };

        const updatedPlayers = [...bonusResult.state.players];
        updatedPlayers[playerIndex] = updatedPlayerWithBonus;

        return { ...bonusResult.state, players: updatedPlayers };
      };

      const updatePendingChoiceMovementBonus = (
        stateToUpdate: GameState,
        movementBonusApplied: boolean
      ): GameState => {
        const currentPlayer = stateToUpdate.players[playerIndex];
        if (!currentPlayer?.pendingChoice) {
          return stateToUpdate;
        }

        if (currentPlayer.pendingChoice.movementBonusApplied === movementBonusApplied) {
          return stateToUpdate;
        }

        const updatedPlayerWithChoice: Player = {
          ...currentPlayer,
          pendingChoice: {
            ...currentPlayer.pendingChoice,
            movementBonusApplied,
          },
        };

        const updatedPlayers = [...stateToUpdate.players];
        updatedPlayers[playerIndex] = updatedPlayerWithChoice;

        return { ...stateToUpdate, players: updatedPlayers };
      };

      // Check if this is a choice effect
      if (effectResult.requiresChoice) {
        const choiceOptions = getChoiceOptions(effectResult, effectToApply);

        if (choiceOptions) {
          const choiceResult = handleChoiceEffect(
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

          let updatedState = applyMovementBonusIfGained(choiceResult.state);
          updatedState = updatePendingChoiceMovementBonus(
            updatedState,
            movementBonusAppliedAmount > 0
          );

          // Check Mana Overload trigger for choice cards too
          const choiceEvents = [...(choiceResult.events ?? [])];
          if (isPowered && updatedState.manaOverloadCenter) {
            const triggerCheck = checkManaOverloadTrigger(
              updatedState.manaOverloadCenter,
              manaSources,
              effectToApply
            );
            if (triggerCheck.triggers) {
              manaOverloadTriggered = true;
              manaOverloadBonusType = triggerCheck.bonusTypes[0] ?? null;
              manaOverloadPreviousCenter = updatedState.manaOverloadCenter;
              const playerIdx = updatedState.players.findIndex(
                (p) => p.id === params.playerId
              );
              if (playerIdx !== -1) {
                const triggerResult = applyManaOverloadTrigger(
                  updatedState,
                  params.playerId,
                  playerIdx,
                  triggerCheck.bonusTypes
                );
                updatedState = triggerResult.state;
                choiceEvents.push(...triggerResult.events);
              }
            }
          }

          // Handle artifact destruction for choice-based powered effects
          if (isPowered && card.destroyOnPowered) {
            const destructionResult = handleArtifactDestruction(
              updatedState,
              params.playerId,
              params.cardId
            );
            updatedState = destructionResult.state;
            choiceEvents.push(...destructionResult.events);
          }

          return { ...choiceResult, state: updatedState, events: choiceEvents };
        }

        // Unknown choice type - return as-is
        let updatedState = applyMovementBonusIfGained(effectResult.state);
        updatedState = updatePendingChoiceMovementBonus(
          updatedState,
          movementBonusAppliedAmount > 0
        );
        return createCardPlayedResult(
          updatedState,
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
      let finalState = applyMovementBonusIfGained(effectResult.state);
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

      // Set Crystal Joy reclaim pending flag after card is played
      if (params.cardId === CARD_GOLDYX_CRYSTAL_JOY) {
        const playerIdx = finalState.players.findIndex(
          (p) => p.id === params.playerId
        );
        if (playerIdx !== -1) {
          const updatedPlayer: Player = {
            ...finalState.players[playerIdx],
            pendingCrystalJoyReclaim: { version: isPowered ? "powered" : "basic" },
          };
          const updatedPlayers = [...finalState.players];
          updatedPlayers[playerIdx] = updatedPlayer;
          finalState = { ...finalState, players: updatedPlayers };
        }
      }

      // Check Mana Overload trigger (powered cards only)
      if (isPowered && finalState.manaOverloadCenter) {
        const triggerCheck = checkManaOverloadTrigger(
          finalState.manaOverloadCenter,
          manaSources,
          effectToApply
        );
        if (triggerCheck.triggers) {
          manaOverloadTriggered = true;
          manaOverloadBonusType = triggerCheck.bonusTypes[0] ?? null;
          manaOverloadPreviousCenter = finalState.manaOverloadCenter;
          const playerIdx = finalState.players.findIndex(
            (p) => p.id === params.playerId
          );
          if (playerIdx !== -1) {
            const triggerResult = applyManaOverloadTrigger(
              finalState,
              params.playerId,
              playerIdx,
              triggerCheck.bonusTypes
            );
            finalState = triggerResult.state;
            events.push(...triggerResult.events);
          }
        }
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

      // Clear Crystal Joy reclaim pending flag on undo
      if (params.cardId === CARD_GOLDYX_CRYSTAL_JOY) {
        updatedPlayer = {
          ...updatedPlayer,
          pendingCrystalJoyReclaim: undefined,
        };
      }

      // Reverse the effect if we stored one (only if it wasn't a choice effect)
      if (appliedEffect && appliedEffect.type !== EFFECT_CHOICE) {
        updatedPlayer = reverseEffect(updatedPlayer, appliedEffect);
      }
      if (movementBonusAppliedAmount > 0) {
        updatedPlayer = {
          ...updatedPlayer,
          movePoints: updatedPlayer.movePoints - movementBonusAppliedAmount,
        };
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
        // Decrement the count for this color
        const currentCount = updatedPlayer.spellsCastByColorThisTurn[trackedSpellColor] ?? 0;
        const newCount = currentCount - 1;

        // Build new counts object, omitting the color if count is 0
        const spellsCastByColorThisTurn: Partial<Record<ManaColor, number>> = {};
        for (const [color, count] of Object.entries(updatedPlayer.spellsCastByColorThisTurn)) {
          if (color === trackedSpellColor) {
            if (newCount > 0) {
              spellsCastByColorThisTurn[color as ManaColor] = newCount;
            }
          } else {
            spellsCastByColorThisTurn[color as ManaColor] = count;
          }
        }

        // Only remove from unique colors if count is now 0
        const spellColorsCastThisTurn = newCount <= 0
          ? updatedPlayer.spellColorsCastThisTurn.filter((c) => c !== trackedSpellColor)
          : updatedPlayer.spellColorsCastThisTurn;

        updatedPlayer = {
          ...updatedPlayer,
          spellColorsCastThisTurn,
          spellsCastByColorThisTurn,
        };
      }

      // Reverse Mana Overload trigger if it was applied
      if (manaOverloadTriggered && manaOverloadBonusType) {
        switch (manaOverloadBonusType) {
          case "move":
            updatedPlayer = {
              ...updatedPlayer,
              movePoints: updatedPlayer.movePoints - 4,
            };
            break;
          case "influence":
            updatedPlayer = {
              ...updatedPlayer,
              influencePoints: updatedPlayer.influencePoints - 4,
            };
            break;
          case "attack":
            updatedPlayer = {
              ...updatedPlayer,
              combatAccumulator: {
                ...updatedPlayer.combatAccumulator,
                attack: {
                  ...updatedPlayer.combatAccumulator.attack,
                  normal: updatedPlayer.combatAccumulator.attack.normal - 4,
                  normalElements: {
                    ...updatedPlayer.combatAccumulator.attack.normalElements,
                    physical:
                      updatedPlayer.combatAccumulator.attack.normalElements
                        .physical - 4,
                  },
                },
              },
            };
            break;
          case "block":
            updatedPlayer = {
              ...updatedPlayer,
              combatAccumulator: {
                ...updatedPlayer.combatAccumulator,
                block: updatedPlayer.combatAccumulator.block - 4,
                blockElements: {
                  ...updatedPlayer.combatAccumulator.blockElements,
                  physical:
                    updatedPlayer.combatAccumulator.blockElements.physical - 4,
                },
              },
            };
            break;
        }
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      // Always restore the pre-effect modifiers snapshot.
      // This correctly reverts ALL modifier-adding effects (Noble Manners, Heroic Tale,
      // Ruthless Coercion, Agility, movement bonuses, etc.) in one operation.
      let stateWithModifiers = preEffectModifiersSnapshot
        ? { ...state, activeModifiers: preEffectModifiersSnapshot }
        : state;

      // Restore Mana Overload center state and owner's flip state
      if (manaOverloadTriggered && manaOverloadPreviousCenter) {
        stateWithModifiers = {
          ...stateWithModifiers,
          manaOverloadCenter: manaOverloadPreviousCenter,
        };
        // Undo the flip on the owner
        const ownerIdx = players.findIndex(
          (p) => p.id === manaOverloadPreviousCenter?.ownerId
        );
        if (ownerIdx !== -1) {
          const owner = players[ownerIdx];
          if (owner) {
            players[ownerIdx] = {
              ...owner,
              skillFlipState: {
                ...owner.skillFlipState,
                flippedSkills: owner.skillFlipState.flippedSkills.filter(
                  (s) => s !== manaOverloadPreviousCenter?.skillId
                ),
              },
            };
          }
        }
      }

      return {
        state: { ...stateWithModifiers, players, source: updatedSource },
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
 * Updates both the unique color tracking and the count per color.
 */
function trackSpellColor(player: Player, color: ManaColor): Player {
  // Track unique colors (legacy, kept for compatibility)
  const spellColorsCastThisTurn = player.spellColorsCastThisTurn.includes(color)
    ? player.spellColorsCastThisTurn
    : [...player.spellColorsCastThisTurn, color];

  // Track count per color (for Ring artifacts: "Fame +1 per [color] spell cast")
  const currentCount = player.spellsCastByColorThisTurn[color] ?? 0;
  const spellsCastByColorThisTurn = {
    ...player.spellsCastByColorThisTurn,
    [color]: currentCount + 1,
  };

  return {
    ...player,
    spellColorsCastThisTurn,
    spellsCastByColorThisTurn,
  };
}
