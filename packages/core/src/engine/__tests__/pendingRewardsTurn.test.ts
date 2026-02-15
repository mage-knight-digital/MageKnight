/**
 * Turn end validation alignment
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { getTurnOptions } from "../validActions/turn.js";
import { getValidActions } from "../validActions/index.js";
import { validateNoPendingRewards } from "../validators/rewardValidators.js";
import { validateRestCompleted } from "../validators/restValidators.js";
import { validateMinimumTurnRequirement } from "../validators/turnValidators.js";
import {
  END_TURN_ACTION,
  CARD_WOUND,
  CARD_MARCH,
  SITE_REWARD_SPELL,
  SITE_REWARD_ADVANCED_ACTION,
  type SiteReward,
  type CardId,
} from "@mage-knight/shared";
import {
  PENDING_REWARDS_NOT_RESOLVED,
  MUST_COMPLETE_REST,
  MUST_PLAY_OR_DISCARD_CARD,
} from "../validators/validationCodes.js";

describe("Turn end options", () => {
  it("disables end turn when pending rewards exist", () => {
    const player = createTestPlayer({
      pendingRewards: [{ type: SITE_REWARD_SPELL, count: 1 }] as SiteReward[],
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(false);

    const validation = validateNoPendingRewards(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(PENDING_REWARDS_NOT_RESOLVED);
    }
  });

  it("disables end turn while resting", () => {
    const player = createTestPlayer({ isResting: true });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(false);

    const validation = validateRestCompleted(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(MUST_COMPLETE_REST);
    }
  });

  it("keeps complete rest available while resting even when deck+hand are empty", () => {
    const player = createTestPlayer({
      isResting: true,
      deck: [],
      hand: [],
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canCompleteRest).toBe(true);
  });

  it("keeps end turn available when minimum turn requirement is unmet (discard resolved during end turn)", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      playedCardFromHandThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(true);

    const validation = validateMinimumTurnRequirement(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(MUST_PLAY_OR_DISCARD_CARD);
    }
  });

  it("keeps end turn available when hand has only wounds and no card was played", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      playedCardFromHandThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(true);

    const validation = validateMinimumTurnRequirement(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(MUST_PLAY_OR_DISCARD_CARD);
    }
  });
});

describe("Pending reward mode", () => {
  it("returns pending_reward mode when player has pending spell reward", () => {
    const player = createTestPlayer({
      pendingRewards: [{ type: SITE_REWARD_SPELL, count: 1 }] as SiteReward[],
    });
    const spellCards = ["spell_fireball" as CardId, "spell_mana_bolt" as CardId];
    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: [] },
        spells: { cards: spellCards },
        commonSkills: [],
        monasteryAdvancedActions: [],
        bondsOfLoyaltyBonusUnits: [],
      },
    });

    const validActions = getValidActions(state, player.id);
    expect(validActions.mode).toBe("pending_reward");
    if (validActions.mode === "pending_reward") {
      expect(validActions.reward.rewardType).toBe(SITE_REWARD_SPELL);
      expect(validActions.reward.rewardIndex).toBe(0);
      expect(validActions.reward.availableCards).toEqual(spellCards);
    }
  });

  it("returns pending_reward mode when player has pending advanced action reward", () => {
    const player = createTestPlayer({
      pendingRewards: [{ type: SITE_REWARD_ADVANCED_ACTION, count: 1 }] as SiteReward[],
    });
    const aaCards = ["aa_ice_bolt" as CardId];
    const state = createTestGameState({
      players: [player],
      offers: {
        units: [],
        advancedActions: { cards: aaCards },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
        bondsOfLoyaltyBonusUnits: [],
      },
    });

    const validActions = getValidActions(state, player.id);
    expect(validActions.mode).toBe("pending_reward");
    if (validActions.mode === "pending_reward") {
      expect(validActions.reward.rewardType).toBe(SITE_REWARD_ADVANCED_ACTION);
      expect(validActions.reward.availableCards).toEqual(aaCards);
    }
  });
});
