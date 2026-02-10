/**
 * Turn end validation alignment
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { getTurnOptions } from "../validActions/turn.js";
import { validateNoPendingRewards } from "../validators/rewardValidators.js";
import { validateRestCompleted } from "../validators/restValidators.js";
import { validateMinimumTurnRequirement } from "../validators/turnValidators.js";
import {
  END_TURN_ACTION,
  CARD_WOUND,
  CARD_MARCH,
  SITE_REWARD_SPELL,
  type SiteReward,
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

  it("disables end turn when minimum turn requirement not met", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      playedCardFromHandThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(false);

    const validation = validateMinimumTurnRequirement(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(MUST_PLAY_OR_DISCARD_CARD);
    }
  });

  it("disables end turn when hand has only wounds and no card was played", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      playedCardFromHandThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    const turnOptions = getTurnOptions(state, player);
    expect(turnOptions.canEndTurn).toBe(false);

    const validation = validateMinimumTurnRequirement(state, player.id, {
      type: END_TURN_ACTION,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.error.code).toBe(MUST_PLAY_OR_DISCARD_CARD);
    }
  });
});
