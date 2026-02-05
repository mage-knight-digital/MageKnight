/**
 * Play card sideways command - handles playing a card sideways for basic resources
 *
 * Any non-wound card can be played sideways to gain Move 1, Influence 1, Attack 1, or Block 1.
 * The value can be modified by skills/effects.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId, BlockSource } from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  CARD_PLAYED,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  ELEMENT_PHYSICAL,
  CARD_WOUND,
  createCardPlayUndoneEvent,
} from "@mage-knight/shared";
import {
  getEffectiveSidewaysValue,
  consumeMovementCardBonus,
  getModifiersForPlayer,
} from "../modifiers/index.js";
import { EFFECT_MOVEMENT_CARD_BONUS, SOURCE_SKILL } from "../../types/modifierConstants.js";
import { PLAY_CARD_SIDEWAYS_COMMAND } from "./commandTypes.js";
import {
  SKILL_ARYTHEA_RITUAL_OF_PAIN,
  SKILL_ARYTHEA_POWER_OF_PAIN,
} from "../../data/skills/index.js";

export { PLAY_CARD_SIDEWAYS_COMMAND };

export type SidewaysAs =
  | typeof PLAY_SIDEWAYS_AS_MOVE
  | typeof PLAY_SIDEWAYS_AS_INFLUENCE
  | typeof PLAY_SIDEWAYS_AS_ATTACK
  | typeof PLAY_SIDEWAYS_AS_BLOCK;

export interface PlayCardSidewaysCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly handIndex: number;
  readonly as: SidewaysAs;
  readonly previousPlayedCardFromHand: boolean; // For undo - restore minimum turn state
}

/**
 * Get a human-readable description of the sideways effect.
 */
function describeSidewaysEffect(as: SidewaysAs, value: number): string {
  switch (as) {
    case PLAY_SIDEWAYS_AS_MOVE:
      return `Gained ${value} Move (sideways)`;
    case PLAY_SIDEWAYS_AS_INFLUENCE:
      return `Gained ${value} Influence (sideways)`;
    case PLAY_SIDEWAYS_AS_ATTACK:
      return `Gained ${value} Attack (sideways)`;
    case PLAY_SIDEWAYS_AS_BLOCK:
      return `Gained ${value} Block (sideways)`;
    default:
      return `Played sideways`;
  }
}

/**
 * Apply the sideways effect to a player.
 */
function applySidewaysEffect(
  player: Player,
  as: SidewaysAs,
  value: number
): Player {
  switch (as) {
    case PLAY_SIDEWAYS_AS_MOVE:
      return {
        ...player,
        movePoints: player.movePoints + value,
      };

    case PLAY_SIDEWAYS_AS_INFLUENCE:
      return {
        ...player,
        influencePoints: player.influencePoints + value,
      };

    case PLAY_SIDEWAYS_AS_ATTACK:
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: {
            ...player.combatAccumulator.attack,
            normal: player.combatAccumulator.attack.normal + value,
          },
        },
      };

    case PLAY_SIDEWAYS_AS_BLOCK: {
      // Sideways block is always physical element
      const blockSource: BlockSource = {
        element: ELEMENT_PHYSICAL,
        value: value,
      };
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block: player.combatAccumulator.block + value,
          blockElements: {
            ...player.combatAccumulator.blockElements,
            physical: player.combatAccumulator.blockElements.physical + value,
          },
          blockSources: [...player.combatAccumulator.blockSources, blockSource],
        },
      };
    }

    default:
      return player;
  }
}

/**
 * Reverse the sideways effect on a player (for undo).
 */
function reverseSidewaysEffect(
  player: Player,
  as: SidewaysAs,
  value: number
): Player {
  switch (as) {
    case PLAY_SIDEWAYS_AS_MOVE:
      return {
        ...player,
        movePoints: player.movePoints - value,
      };

    case PLAY_SIDEWAYS_AS_INFLUENCE:
      return {
        ...player,
        influencePoints: player.influencePoints - value,
      };

    case PLAY_SIDEWAYS_AS_ATTACK:
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: {
            ...player.combatAccumulator.attack,
            normal: player.combatAccumulator.attack.normal - value,
          },
        },
      };

    case PLAY_SIDEWAYS_AS_BLOCK: {
      // Remove the last block source (we added one when applying)
      const newBlockSources = player.combatAccumulator.blockSources.slice(0, -1);
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block: player.combatAccumulator.block - value,
          blockElements: {
            ...player.combatAccumulator.blockElements,
            physical: Math.max(0, player.combatAccumulator.blockElements.physical - value),
          },
          blockSources: newBlockSources,
        },
      };
    }

    default:
      return player;
  }
}

/**
 * Create a play card sideways command.
 */
export function createPlayCardSidewaysCommand(
  params: PlayCardSidewaysCommandParams
): Command {
  // Store the effective value at execute time for undo
  let appliedValue: number = 1;
  // Store movement bonus application for undo
  let movementBonusAppliedAmount = 0;
  let movementBonusModifiersSnapshot: readonly ActiveModifier[] | null = null;
  // Store ritual modifiers for undo when a wound is played sideways via Ritual of Pain
  let ritualModifiersSnapshot: readonly ActiveModifier[] | null = null;
  // Store Power of Pain modifiers for undo when a wound is played sideways
  let powerOfPainModifiersSnapshot: readonly ActiveModifier[] | null = null;

  return {
    type: PLAY_CARD_SIDEWAYS_COMMAND,
    playerId: params.playerId,
    isReversible: true,

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

      const isWound = params.cardId === CARD_WOUND;

      // Calculate effective sideways value (usually 1, can be modified)
      appliedValue = getEffectiveSidewaysValue(
        state,
        params.playerId,
        isWound,
        player.usedManaFromSource,
        undefined // manaColorMatchesCard not applicable for sideways
      );

      const movementBonusModifierIdsBefore = new Set(
        getModifiersForPlayer(state, params.playerId)
          .filter((m) => m.effect.type === EFFECT_MOVEMENT_CARD_BONUS)
          .map((m) => m.id)
      );

      let currentState = state;
      if (params.as === PLAY_SIDEWAYS_AS_MOVE) {
        if (movementBonusModifierIdsBefore.size > 0) {
          const modifiersSnapshot = state.activeModifiers;
          const bonusResult = consumeMovementCardBonus(
            state,
            params.playerId,
            movementBonusModifierIdsBefore
          );
          if (bonusResult.bonus > 0) {
            movementBonusAppliedAmount = bonusResult.bonus;
            movementBonusModifiersSnapshot = modifiersSnapshot;
            appliedValue += bonusResult.bonus;
            currentState = bonusResult.state;
          }
        }
      }

      // Remove card from hand, add to play area
      const newHand = player.hand.filter((_, i) => i !== params.handIndex);
      const newPlayArea = [...player.playArea, params.cardId];

      let updatedPlayer: Player = {
        ...player,
        hand: newHand,
        playArea: newPlayArea,
        // Mark that a card was played from hand this turn (for minimum turn requirement)
        playedCardFromHandThisTurn: true,
      };

      // Apply the sideways effect
      updatedPlayer = applySidewaysEffect(updatedPlayer, params.as, appliedValue);

      // If a Ritual of Pain wound was played sideways, return the skill to its owner
      if (isWound) {
        const ritualAppliesToPlayer = getModifiersForPlayer(currentState, params.playerId).some(
          (modifier) =>
            modifier.source.type === SOURCE_SKILL &&
            modifier.source.skillId === SKILL_ARYTHEA_RITUAL_OF_PAIN
        );
        if (ritualAppliesToPlayer) {
          ritualModifiersSnapshot = currentState.activeModifiers;
          currentState = {
            ...currentState,
            activeModifiers: currentState.activeModifiers.filter(
              (modifier) =>
                !(
                  modifier.source.type === SOURCE_SKILL &&
                  modifier.source.skillId === SKILL_ARYTHEA_RITUAL_OF_PAIN
                )
            ),
          };
        }

        // If Power of Pain wound was played sideways, consume the modifiers (one wound per activation)
        const powerOfPainAppliesToPlayer = getModifiersForPlayer(currentState, params.playerId).some(
          (modifier) =>
            modifier.source.type === SOURCE_SKILL &&
            modifier.source.skillId === SKILL_ARYTHEA_POWER_OF_PAIN
        );
        if (powerOfPainAppliesToPlayer) {
          powerOfPainModifiersSnapshot = currentState.activeModifiers;
          currentState = {
            ...currentState,
            activeModifiers: currentState.activeModifiers.filter(
              (modifier) =>
                !(
                  modifier.source.type === SOURCE_SKILL &&
                  modifier.source.skillId === SKILL_ARYTHEA_POWER_OF_PAIN &&
                  modifier.source.playerId === params.playerId
                )
            ),
          };
        }
      }

      const players = [...currentState.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...currentState, players },
        events: [
          {
            type: CARD_PLAYED,
            playerId: params.playerId,
            cardId: params.cardId,
            powered: false,
            sideways: true,
            effect: describeSidewaysEffect(params.as, appliedValue),
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
        // Restore minimum turn requirement state
        playedCardFromHandThisTurn: params.previousPlayedCardFromHand,
      };

      // Reverse the sideways effect
      updatedPlayer = reverseSidewaysEffect(updatedPlayer, params.as, appliedValue);

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;
      let stateWithModifiers = state;
      if (movementBonusAppliedAmount > 0 && movementBonusModifiersSnapshot) {
        stateWithModifiers = { ...state, activeModifiers: movementBonusModifiersSnapshot };
      } else if (ritualModifiersSnapshot) {
        stateWithModifiers = { ...state, activeModifiers: ritualModifiersSnapshot };
      } else if (powerOfPainModifiersSnapshot) {
        stateWithModifiers = { ...state, activeModifiers: powerOfPainModifiersSnapshot };
      }

      return {
        state: { ...stateWithModifiers, players },
        events: [createCardPlayUndoneEvent(params.playerId, params.cardId)],
      };
    },
  };
}
