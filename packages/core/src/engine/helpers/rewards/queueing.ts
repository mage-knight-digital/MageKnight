/**
 * Reward queueing logic.
 *
 * Handles queuing rewards for later selection vs granting immediately.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { RewardResult } from "./types.js";
import {
  SiteReward,
  SITE_REWARD_FAME,
  SITE_REWARD_CRYSTAL_ROLL,
  SITE_REWARD_COMPOUND,
  GameEvent,
  REWARD_QUEUED,
} from "@mage-knight/shared";
import { grantFameReward, grantCrystalRollReward } from "./handlers.js";

/**
 * Queue a site reward for the player to select at end of turn.
 *
 * Rewards that require player choice (spells, artifacts, advanced actions)
 * are queued for selection. Immediate rewards (fame, crystal rolls) are granted
 * immediately.
 */
export function queueSiteReward(
  state: GameState,
  playerId: string,
  reward: SiteReward
): RewardResult {
  // Some rewards can be granted immediately (no choice required)
  if (reward.type === SITE_REWARD_FAME) {
    return grantFameReward(state, playerId, reward.amount);
  }

  if (reward.type === SITE_REWARD_CRYSTAL_ROLL) {
    return grantCrystalRollReward(state, playerId, reward.count);
  }

  // Compound rewards: queue each sub-reward
  if (reward.type === SITE_REWARD_COMPOUND) {
    let currentState = state;
    const allEvents: GameEvent[] = [];

    for (const subReward of reward.rewards) {
      const { state: newState, events } = queueSiteReward(
        currentState,
        playerId,
        subReward
      );
      currentState = newState;
      allEvents.push(...events);
    }

    return { state: currentState, events: allEvents };
  }

  // Queue rewards that require player choice
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, events: [] };
  }

  const updatedPlayer: Player = {
    ...player,
    pendingRewards: [...player.pendingRewards, reward],
  };

  const updatedState: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? updatedPlayer : p
    ),
  };

  const events: GameEvent[] = [
    {
      type: REWARD_QUEUED,
      playerId,
      rewardType: reward.type,
    },
  ];

  return { state: updatedState, events };
}
