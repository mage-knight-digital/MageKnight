/**
 * Pending reward valid actions computation.
 *
 * Returns the pending_reward mode when a player has unresolved site rewards.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PendingRewardState } from "@mage-knight/shared";
import {
  SITE_REWARD_SPELL,
  SITE_REWARD_ADVANCED_ACTION,
  SITE_REWARD_UNIT,
  SITE_REWARD_ARTIFACT,
  type SiteReward,
} from "@mage-knight/shared";
import { getEffectiveCommandTokens } from "../rules/bondsOfLoyalty.js";

export function getPendingRewardOptions(
  state: GameState,
  player: Player,
): PendingRewardState {
  const reward = player.pendingRewards[0]!;
  return {
    mode: "pending_reward",
    turn: { canUndo: false },
    reward: buildRewardOptions(state, player, reward, 0),
  };
}

function buildRewardOptions(
  state: GameState,
  player: Player,
  reward: SiteReward,
  rewardIndex: number,
): PendingRewardState["reward"] {
  switch (reward.type) {
    case SITE_REWARD_SPELL:
      return {
        rewardIndex,
        rewardType: reward.type,
        availableCards: state.offers.spells.cards,
      };
    case SITE_REWARD_ADVANCED_ACTION:
      return {
        rewardIndex,
        rewardType: reward.type,
        availableCards: state.offers.advancedActions.cards,
      };
    case SITE_REWARD_ARTIFACT:
      return {
        rewardIndex,
        rewardType: reward.type,
        availableCards: [], // Artifacts are drawn from deck, not selected from offer
      };
    case SITE_REWARD_UNIT: {
      const commandTokens = getEffectiveCommandTokens(player);
      const currentUnitCount = player.units.length;
      const disbandableUnits = player.units.map((u) => ({
        instanceId: u.instanceId,
        unitId: u.unitId,
      }));
      return {
        rewardIndex,
        rewardType: reward.type,
        availableCards: [],
        availableUnits: state.offers.units,
        commandTokens,
        currentUnitCount,
        disbandableUnits,
      };
    }
    default:
      // crystal_roll, fame, compound — these resolve automatically or
      // decompose into sub-rewards; provide minimal info
      return {
        rewardIndex,
        rewardType: reward.type,
        availableCards: [],
      };
  }
}
