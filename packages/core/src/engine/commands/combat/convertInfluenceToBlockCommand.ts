/**
 * Convert Influence to Block Command
 *
 * Allows player to spend accumulated influence points during BLOCK phase
 * to gain block when the Diplomacy influence-to-block conversion modifier is active.
 *
 * Basic Diplomacy: 1 influence = 1 physical block
 * Powered Diplomacy: 1 influence = 1 ice block OR 1 fire block (chosen at play time)
 *
 * REVERSIBLE: Can be undone until the block is committed.
 *
 * @module engine/commands/combat/convertInfluenceToBlockCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { InfluenceToBlockConversionModifier } from "../../../types/modifiers.js";
import type { ElementalAttackValues, BlockSource } from "../../../types/player.js";
import type { Element } from "@mage-knight/shared";
import {
  INFLUENCE_CONVERTED_TO_BLOCK,
} from "@mage-knight/shared";
import {
  EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
  ELEMENT_PHYSICAL,
} from "../../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../../modifiers/index.js";

export const CONVERT_INFLUENCE_TO_BLOCK_COMMAND = "CONVERT_INFLUENCE_TO_BLOCK" as const;

export interface ConvertInfluenceToBlockCommandParams {
  readonly playerId: string;
  readonly influencePointsToSpend: number;
}

export function createConvertInfluenceToBlockCommand(
  params: ConvertInfluenceToBlockCommandParams
): Command {
  let previousInfluencePoints = 0;
  let previousBlock = 0;
  let previousBlockElements: ElementalAttackValues;
  let previousBlockSources: readonly BlockSource[];

  return {
    type: CONVERT_INFLUENCE_TO_BLOCK_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      const modifiers = getModifiersForPlayer(state, params.playerId);
      const modifier = modifiers.find(
        (m) => m.effect.type === EFFECT_INFLUENCE_TO_BLOCK_CONVERSION
      );

      if (!modifier) {
        throw new Error("No active influence-to-block conversion modifier");
      }

      const effect = modifier.effect as InfluenceToBlockConversionModifier;
      const blockGained = Math.floor(params.influencePointsToSpend / effect.costPerPoint);
      const effectiveElement: Element = effect.element ?? ELEMENT_PHYSICAL;
      const blockElementName = effect.element ?? "physical";

      // Capture for undo
      previousInfluencePoints = player.influencePoints;
      previousBlock = player.combatAccumulator.block;
      previousBlockElements = player.combatAccumulator.blockElements;
      previousBlockSources = player.combatAccumulator.blockSources;

      // Deduct influence points
      const updatedInfluencePoints = player.influencePoints - params.influencePointsToSpend;

      // Add block to accumulator
      const updatedBlock = player.combatAccumulator.block + blockGained;
      const updatedBlockElements: ElementalAttackValues = {
        ...player.combatAccumulator.blockElements,
        [blockElementName]: (player.combatAccumulator.blockElements[blockElementName as keyof ElementalAttackValues] ?? 0) + blockGained,
      };

      const blockSource: BlockSource = {
        element: effectiveElement,
        value: blockGained,
      };

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              influencePoints: updatedInfluencePoints,
              combatAccumulator: {
                ...p.combatAccumulator,
                block: updatedBlock,
                blockElements: updatedBlockElements,
                blockSources: [...p.combatAccumulator.blockSources, blockSource],
              },
            }
          : p
      );

      return {
        state: { ...state, players: updatedPlayers },
        events: [
          {
            type: INFLUENCE_CONVERTED_TO_BLOCK,
            influencePointsSpent: params.influencePointsToSpend,
            blockGained,
            blockElement: blockElementName as "physical" | "fire" | "ice",
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

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              influencePoints: previousInfluencePoints,
              combatAccumulator: {
                ...p.combatAccumulator,
                block: previousBlock,
                blockElements: previousBlockElements,
                blockSources: previousBlockSources,
              },
            }
          : p
      );

      return {
        state: { ...state, players: updatedPlayers },
        events: [],
      };
    },
  };
}
