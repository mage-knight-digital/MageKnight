/**
 * Tests for In Need card - wound-count scaling for influence
 *
 * Basic: Influence 3. +1 per wound in hand and on units.
 * Powered: Influence 5. +2 per wound in hand and on units.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { evaluateScalingFactor } from "../effects/scalingEvaluator.js";
import { resolveEffect } from "../effects/index.js";
import { SCALING_PER_WOUND_TOTAL } from "../../types/scaling.js";
import { createPlayerUnit } from "../../types/unit.js";
import { IN_NEED } from "../../data/advancedActions/green/in-need.js";
import {
  CARD_WOUND,
  CARD_MARCH,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  CARD_IN_NEED,
} from "@mage-knight/shared";
import { EFFECT_SCALING } from "../../types/effectTypes.js";
import type { ScalingEffect } from "../../types/cards.js";

describe("In Need", () => {
  describe("card definition", () => {
    it("should have scaling basic effect", () => {
      expect(IN_NEED.basicEffect.type).toBe(EFFECT_SCALING);
      const effect = IN_NEED.basicEffect as ScalingEffect;
      expect(effect.baseEffect.amount).toBe(3);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_WOUND_TOTAL);
      expect(effect.amountPerUnit).toBe(1);
    });

    it("should have scaling powered effect", () => {
      expect(IN_NEED.poweredEffect.type).toBe(EFFECT_SCALING);
      const effect = IN_NEED.poweredEffect as ScalingEffect;
      expect(effect.baseEffect.amount).toBe(5);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_WOUND_TOTAL);
      expect(effect.amountPerUnit).toBe(2);
    });
  });

  describe("SCALING_PER_WOUND_TOTAL evaluator", () => {
    it("should return 0 when no wounds anywhere", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_MARCH],
        units: [createPlayerUnit(UNIT_PEASANTS)],
      });
      const state = createTestGameState({ players: [player] });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_TOTAL });
      expect(count).toBe(0);
    });

    it("should count wounds in hand only", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH, CARD_WOUND],
        units: [createPlayerUnit(UNIT_PEASANTS)],
      });
      const state = createTestGameState({ players: [player] });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_TOTAL });
      expect(count).toBe(2);
    });

    it("should count wounded units only", () => {
      const woundedUnit = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [createPlayerUnit(UNIT_FORESTERS), woundedUnit],
      });
      const state = createTestGameState({ players: [player] });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_TOTAL });
      expect(count).toBe(1);
    });

    it("should count wounds in hand and on units combined", () => {
      const woundedUnit1 = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const woundedUnit2 = { ...createPlayerUnit(UNIT_FORESTERS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [
          createPlayerUnit(UNIT_PEASANTS),
          woundedUnit1,
          woundedUnit2,
        ],
      });
      const state = createTestGameState({ players: [player] });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_TOTAL });
      expect(count).toBe(5); // 3 in hand + 2 wounded units
    });

    it("should return 0 with no units and no wounds in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_TOTAL });
      expect(count).toBe(0);
    });
  });

  describe("basic effect resolution", () => {
    it("should give base influence 3 with no wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.basicEffect, CARD_IN_NEED);

      // 3 base + (1 × 0 wounds) = 3
      expect(result.state.players[0]?.influencePoints).toBe(3);
    });

    it("should scale by wounds in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.basicEffect, CARD_IN_NEED);

      // 3 base + (1 × 2 wounds) = 5
      expect(result.state.players[0]?.influencePoints).toBe(5);
    });

    it("should scale by wounded units", () => {
      const woundedUnit = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [woundedUnit, createPlayerUnit(UNIT_FORESTERS)],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.basicEffect, CARD_IN_NEED);

      // 3 base + (1 × 1 wounded unit) = 4
      expect(result.state.players[0]?.influencePoints).toBe(4);
    });

    it("should scale by combined wounds in hand and on units", () => {
      const woundedUnit = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [woundedUnit, createPlayerUnit(UNIT_FORESTERS)],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.basicEffect, CARD_IN_NEED);

      // 3 base + (1 × 3 total wounds) = 6
      expect(result.state.players[0]?.influencePoints).toBe(6);
    });
  });

  describe("powered effect resolution", () => {
    it("should give base influence 5 with no wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.poweredEffect, CARD_IN_NEED);

      // 5 base + (2 × 0 wounds) = 5
      expect(result.state.players[0]?.influencePoints).toBe(5);
    });

    it("should scale by +2 per wound in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.poweredEffect, CARD_IN_NEED);

      // 5 base + (2 × 2 wounds) = 9
      expect(result.state.players[0]?.influencePoints).toBe(9);
    });

    it("should scale by +2 per wounded unit", () => {
      const woundedUnit1 = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const woundedUnit2 = { ...createPlayerUnit(UNIT_FORESTERS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [woundedUnit1, woundedUnit2],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.poweredEffect, CARD_IN_NEED);

      // 5 base + (2 × 2 wounded units) = 9
      expect(result.state.players[0]?.influencePoints).toBe(9);
    });

    it("should scale by combined wounds at +2 each", () => {
      const woundedUnit = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [woundedUnit, createPlayerUnit(UNIT_FORESTERS)],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.poweredEffect, CARD_IN_NEED);

      // 5 base + (2 × 4 total wounds) = 13
      expect(result.state.players[0]?.influencePoints).toBe(13);
    });
  });

  describe("timing", () => {
    it("should count wounds at effect resolution time", () => {
      // Wounds are counted when the effect resolves, not when the card is played.
      // This test verifies that the scaling evaluator reads the current state,
      // meaning any wounds added before resolution (e.g., from Mana Exploit) count.
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", IN_NEED.basicEffect, CARD_IN_NEED);

      // 3 wounds at resolution time: 3 base + (1 × 3) = 6
      expect(result.state.players[0]?.influencePoints).toBe(6);
      expect(result.containsScaling).toBe(true);
    });
  });
});
