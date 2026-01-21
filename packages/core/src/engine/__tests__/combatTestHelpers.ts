/**
 * Shared helpers for combat tests
 *
 * Contains utility functions used across multiple combat test files.
 */

import type { BlockSource } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";

/**
 * Helper to set up block sources in the player's combatAccumulator.
 * Tests call this before DECLARE_BLOCK_ACTION since blocks are now
 * read from server-side state, not the action payload.
 */
export function withBlockSources(
  state: GameState,
  playerId: string,
  blocks: readonly BlockSource[],
  enemyInstanceId: string = "enemy_0"
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  const totalBlock = blocks.reduce((sum, b) => sum + b.value, 0);

  // Calculate block by element for new system
  const blockByElement = { physical: 0, fire: 0, ice: 0, coldFire: 0 };
  for (const block of blocks) {
    switch (block.element) {
      case "physical":
        blockByElement.physical += block.value;
        break;
      case "fire":
        blockByElement.fire += block.value;
        break;
      case "ice":
        blockByElement.ice += block.value;
        break;
      case "cold_fire":
        blockByElement.coldFire += block.value;
        break;
    }
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      block: totalBlock,
      blockSources: blocks,
      blockElements: blockByElement,
      assignedBlock: totalBlock,
      assignedBlockElements: blockByElement,
    },
  };

  // Also set up pendingBlock in combat state for the new system
  const combat = state.combat;
  if (!combat) {
    return { ...state, players: updatedPlayers };
  }

  return {
    ...state,
    players: updatedPlayers,
    combat: {
      ...combat,
      pendingBlock: {
        ...combat.pendingBlock,
        [enemyInstanceId]: blockByElement,
      },
    },
  };
}

/**
 * Helper to set up siege attack in the player's combatAccumulator.
 * Tests call this before DECLARE_ATTACK_ACTION with COMBAT_TYPE_SIEGE
 * since the validator now checks that siege attack is actually accumulated.
 */
export function withSiegeAttack(
  state: GameState,
  playerId: string,
  value: number
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  if (!player) throw new Error(`Player not found at index: ${playerIndex}`);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        siege: value,
      },
    },
  };

  return { ...state, players: updatedPlayers };
}
