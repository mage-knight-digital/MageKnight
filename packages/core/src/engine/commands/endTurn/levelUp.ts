/**
 * Level Up Processing for End Turn
 *
 * Processes pending level ups accumulated during the turn.
 *
 * @module commands/endTurn/levelUp
 */

import type { Player, PendingLevelUpReward } from "../../../types/player.js";
import type { GameEvent, SkillId } from "@mage-knight/shared";
import {
  LEVEL_UP,
  LEVEL_UP_REWARDS_PENDING,
  COMMAND_SLOT_GAINED,
  getLevelUpType,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
} from "@mage-knight/shared";
import type { LevelUpResult } from "./types.js";
import type { RngState } from "../../../utils/rng.js";
import { shuffleWithRng } from "../../../utils/rng.js";

/**
 * Draw 2 skills from the player's remaining hero skill pool.
 * Returns the drawn skills and updated remaining skills.
 */
function drawSkillsForLevelUp(
  remainingSkills: readonly SkillId[],
  rng: RngState
): {
  drawnSkills: readonly SkillId[];
  remainingSkills: readonly SkillId[];
  rng: RngState;
} {
  if (remainingSkills.length === 0) {
    // No skills left to draw
    return { drawnSkills: [], remainingSkills: [], rng };
  }

  // Shuffle remaining skills and take the first 2 (or fewer if not enough)
  const { result: shuffled, rng: newRng } = shuffleWithRng(remainingSkills, rng);
  const drawCount = Math.min(2, shuffled.length);
  const drawnSkills = shuffled.slice(0, drawCount);
  const remaining = shuffled.slice(drawCount);

  return {
    drawnSkills,
    remainingSkills: remaining,
    rng: newRng,
  };
}

/**
 * Process pending level ups for a player.
 * Updates stats and generates appropriate events.
 * For even levels, draws 2 skills and sets up pending level up rewards.
 */
export function processLevelUps(player: Player, rng: RngState): LevelUpResult {
  if (player.pendingLevelUps.length === 0) {
    return { player, events: [], rng };
  }

  const events: GameEvent[] = [];
  let updatedPlayer = { ...player };
  let currentRng = rng;
  const evenLevels: number[] = [];
  const pendingRewards: PendingLevelUpReward[] = [];

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
      // Even levels: draw 2 skills and queue for player choice
      evenLevels.push(newLevel);

      const drawResult = drawSkillsForLevelUp(
        updatedPlayer.remainingHeroSkills,
        currentRng
      );

      // Update remaining skills
      updatedPlayer = {
        ...updatedPlayer,
        remainingHeroSkills: drawResult.remainingSkills,
      };
      currentRng = drawResult.rng;

      // Queue pending reward with drawn skills
      pendingRewards.push({
        level: newLevel,
        drawnSkills: drawResult.drawnSkills,
      });
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

  // Clear pending level ups and set pending rewards
  updatedPlayer = {
    ...updatedPlayer,
    pendingLevelUps: [],
    pendingLevelUpRewards: [
      ...updatedPlayer.pendingLevelUpRewards,
      ...pendingRewards,
    ],
  };

  return { player: updatedPlayer, events, rng: currentRng };
}
