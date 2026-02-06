/**
 * Mana Overload trigger detection and application.
 *
 * When Mana Overload is in the center, the first player who powers a Deed card
 * with the marked color that provides Move/Influence/Attack/Block gets +4.
 * The skill then returns to the owner face-down.
 *
 * Does NOT trigger from:
 * - Unit activations (units are not "cards")
 * - Mana payment effects (Pure Magic, Mana Bolt basic)
 * - Indirect effects (Concentration, Into the Heat, Maximal Effect)
 */

import type { GameState, ManaOverloadCenter } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import type { ManaSourceInfo } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { createManaOverloadTriggeredEvent } from "@mage-knight/shared";
import { returnManaOverloadToOwner } from "../skills/manaOverloadEffect.js";
import {
  effectHasMove,
  effectHasInfluence,
  effectHasAttack,
  effectHasBlock,
} from "../../rules/effectDetection/index.js";

const MANA_OVERLOAD_BONUS = 4;

/**
 * Determine which effect types are applicable for the +4 bonus.
 * Returns an array of applicable bonus type strings.
 */
function getApplicableBonusTypes(effect: CardEffect): readonly string[] {
  const types: string[] = [];
  if (effectHasMove(effect)) types.push("move");
  if (effectHasInfluence(effect)) types.push("influence");
  if (effectHasAttack(effect)) types.push("attack");
  if (effectHasBlock(effect)) types.push("block");
  return types;
}

/**
 * Check if the powered card triggers Mana Overload.
 *
 * Conditions:
 * 1. manaOverloadCenter is active
 * 2. One of the mana sources used to power the card matches the marked color
 * 3. The powered effect provides Move, Influence, Attack, or Block
 */
export function checkManaOverloadTrigger(
  center: ManaOverloadCenter,
  manaSources: readonly ManaSourceInfo[],
  poweredEffect: CardEffect
): { triggers: boolean; bonusTypes: readonly string[] } {
  // Check if any mana source matches the marked color
  const hasMatchingColor = manaSources.some(
    (s) => s.color === center.markedColor
  );
  if (!hasMatchingColor) {
    return { triggers: false, bonusTypes: [] };
  }

  // Check if the powered effect provides applicable types
  const bonusTypes = getApplicableBonusTypes(poweredEffect);
  if (bonusTypes.length === 0) {
    return { triggers: false, bonusTypes: [] };
  }

  return { triggers: true, bonusTypes };
}

/**
 * Apply the Mana Overload +4 bonus to the player.
 *
 * When there's only one applicable type, auto-applies it.
 * When multiple types are applicable, applies to the first type.
 * (Future: could create a pending choice for the player to pick.)
 *
 * Returns the updated state and events.
 */
export function applyManaOverloadTrigger(
  state: GameState,
  playerId: string,
  playerIndex: number,
  bonusTypes: readonly string[]
): { state: GameState; events: GameEvent[] } {
  const center = state.manaOverloadCenter;
  if (!center) {
    return { state, events: [] };
  }

  // Pick the first applicable type for auto-apply
  const bonusType = bonusTypes[0];
  if (!bonusType) {
    return { state, events: [] };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { state, events: [] };
  }

  // Apply the +4 bonus
  let updatedPlayer: Player;
  switch (bonusType) {
    case "move":
      updatedPlayer = {
        ...player,
        movePoints: player.movePoints + MANA_OVERLOAD_BONUS,
      };
      break;
    case "influence":
      updatedPlayer = {
        ...player,
        influencePoints: player.influencePoints + MANA_OVERLOAD_BONUS,
      };
      break;
    case "attack":
      updatedPlayer = {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: {
            ...player.combatAccumulator.attack,
            normal:
              player.combatAccumulator.attack.normal + MANA_OVERLOAD_BONUS,
            normalElements: {
              ...player.combatAccumulator.attack.normalElements,
              physical:
                player.combatAccumulator.attack.normalElements.physical +
                MANA_OVERLOAD_BONUS,
            },
          },
        },
      };
      break;
    case "block":
      updatedPlayer = {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block:
            player.combatAccumulator.block + MANA_OVERLOAD_BONUS,
          blockElements: {
            ...player.combatAccumulator.blockElements,
            physical:
              player.combatAccumulator.blockElements.physical +
              MANA_OVERLOAD_BONUS,
          },
        },
      };
      break;
    default:
      return { state, events: [] };
  }

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  let updatedState: GameState = { ...state, players };

  // Return the skill to its owner face-down
  updatedState = returnManaOverloadToOwner(updatedState);

  const events: GameEvent[] = [
    createManaOverloadTriggeredEvent(
      playerId,
      center.ownerId,
      bonusType,
      MANA_OVERLOAD_BONUS
    ),
  ];

  return { state: updatedState, events };
}
