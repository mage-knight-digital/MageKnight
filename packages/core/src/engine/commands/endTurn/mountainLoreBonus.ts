import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { MountainLoreHandLimitModifier } from "../../../types/modifiers.js";
import { getModifiersForPlayer } from "../../modifiers/index.js";
import {
  EFFECT_MOUNTAIN_LORE_HAND_LIMIT,
} from "../../../types/modifierConstants.js";
import {
  TERRAIN_HILLS,
  TERRAIN_MOUNTAIN,
  hexKey,
} from "@mage-knight/shared";

export interface MountainLoreBonusResult {
  readonly state: GameState;
  readonly player: Player;
  readonly appliedBonus: number;
}

/**
 * Apply Mountain Lore end-of-turn hand limit bonus before draw-up.
 * Reads turn-scoped Mountain Lore modifiers and grants the terrain-appropriate
 * bonus to meditationHandLimitBonus so existing draw logic can consume it.
 */
export function applyMountainLoreEndTurnBonus(
  state: GameState,
  player: Player
): MountainLoreBonusResult {
  const position = player.position;
  if (!position) {
    return { state, player, appliedBonus: 0 };
  }

  const terrain = state.map.hexes[hexKey(position)]?.terrain;
  if (!terrain) {
    return { state, player, appliedBonus: 0 };
  }

  const loreModifiers = getModifiersForPlayer(state, player.id)
    .filter((modifier) => modifier.effect.type === EFFECT_MOUNTAIN_LORE_HAND_LIMIT)
    .map((modifier) => modifier.effect as MountainLoreHandLimitModifier);

  if (loreModifiers.length === 0) {
    return { state, player, appliedBonus: 0 };
  }

  const bonus = loreModifiers.reduce((total, modifier) => {
    if (terrain === TERRAIN_MOUNTAIN) {
      return total + modifier.mountainBonus;
    }
    if (terrain === TERRAIN_HILLS) {
      return total + modifier.hillsBonus;
    }
    return total;
  }, 0);

  if (bonus <= 0) {
    return { state, player, appliedBonus: 0 };
  }

  const playerIndex = state.players.findIndex((p) => p.id === player.id);
  if (playerIndex === -1) {
    return { state, player, appliedBonus: 0 };
  }

  const updatedPlayer: Player = {
    ...player,
    meditationHandLimitBonus: player.meditationHandLimitBonus + bonus,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    state: { ...state, players },
    player: updatedPlayer,
    appliedBonus: bonus,
  };
}
