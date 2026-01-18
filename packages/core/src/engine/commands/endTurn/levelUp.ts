/**
 * Level Up Processing for End Turn
 *
 * Processes pending level ups accumulated during the turn.
 *
 * @module commands/endTurn/levelUp
 */

import type { Player } from "../../../types/player.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  LEVEL_UP,
  LEVEL_UP_REWARDS_PENDING,
  COMMAND_SLOT_GAINED,
  getLevelUpType,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
} from "@mage-knight/shared";
import type { LevelUpResult } from "./types.js";

/**
 * Process pending level ups for a player.
 * Updates stats and generates appropriate events.
 */
export function processLevelUps(player: Player): LevelUpResult {
  if (player.pendingLevelUps.length === 0) {
    return { player, events: [] };
  }

  const events: GameEvent[] = [];
  let updatedPlayer = { ...player };
  const evenLevels: number[] = [];

  for (const newLevel of player.pendingLevelUps) {
    const levelUpType = getLevelUpType(newLevel);
    const stats = LEVEL_STATS[newLevel];

    // Skip if no stats for this level (shouldn't happen)
    if (!stats) {
      continue;
    }

    // Update base stats
    updatedPlayer = {
      ...updatedPlayer,
      level: newLevel,
      armor: stats.armor,
      handLimit: stats.handLimit,
      commandTokens: stats.commandSlots,
    };

    events.push({
      type: LEVEL_UP,
      playerId: player.id,
      oldLevel: newLevel - 1,
      newLevel,
      levelUpType,
    });

    if (levelUpType === LEVEL_UP_TYPE_ODD) {
      // Odd levels: immediate stat gains, no choices needed
      events.push({
        type: COMMAND_SLOT_GAINED,
        playerId: player.id,
        newTotal: stats.commandSlots,
      });
    } else {
      // Even levels: need player choice for skill + advanced action
      evenLevels.push(newLevel);
    }
  }

  // If there are even levels, emit pending event for choices
  if (evenLevels.length > 0) {
    events.push({
      type: LEVEL_UP_REWARDS_PENDING,
      playerId: player.id,
      pendingLevels: evenLevels,
    });
  }

  // Clear pending level ups
  updatedPlayer = {
    ...updatedPlayer,
    pendingLevelUps: [],
  };

  return { player: updatedPlayer, events };
}
