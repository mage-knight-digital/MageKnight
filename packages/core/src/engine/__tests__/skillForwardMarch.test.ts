/**
 * Tests for Forward March skill (Norowas)
 *
 * Skill effect: Move 1 for each Ready and Unwounded Unit (max Move 3)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { createPlayerUnit } from "../../types/unit.js";
import {
  USE_SKILL_ACTION,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  UNIT_HERBALIST,
  UNIT_STATE_SPENT,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_FORWARD_MARCH } from "../../data/skills/index.js";
import { evaluateScalingFactor } from "../effects/scalingEvaluator.js";
import { SCALING_PER_UNIT } from "../../types/scaling.js";

describe("Forward March skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  function createForwardMarchState(
    units: ReturnType<typeof createPlayerUnit>[],
    movePoints = 0
  ) {
    const player = createTestPlayer({
      hero: Hero.Norowas,
      skills: [SKILL_NOROWAS_FORWARD_MARCH],
      units,
      movePoints,
    });
    return createTestGameState({ players: [player] });
  }

  describe("scaling factor evaluation with filters", () => {
    const filter = { wounded: false, state: "ready" as const };

    it("should return 0 with no units", () => {
      const state = createForwardMarchState([]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(0);
    });

    it("should count 1 ready unwounded unit", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
      ]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(1);
    });

    it("should count 3 ready unwounded units", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        createPlayerUnit(UNIT_FORESTERS, "f1"),
        createPlayerUnit(UNIT_HERBALIST, "h1"),
      ]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(3);
    });

    it("should not count wounded units", () => {
      const wounded = { ...createPlayerUnit(UNIT_PEASANTS, "p2"), wounded: true };
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        wounded,
        createPlayerUnit(UNIT_FORESTERS, "f1"),
      ]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(2);
    });

    it("should not count spent units", () => {
      const spent = { ...createPlayerUnit(UNIT_PEASANTS, "p2"), state: UNIT_STATE_SPENT };
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        spent,
        createPlayerUnit(UNIT_FORESTERS, "f1"),
      ]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(2);
    });

    it("should not count units that are both wounded and spent", () => {
      const woundedSpent = {
        ...createPlayerUnit(UNIT_PEASANTS, "p2"),
        wounded: true,
        state: UNIT_STATE_SPENT,
      };
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        woundedSpent,
      ]);
      const count = evaluateScalingFactor(state, "player1", {
        type: SCALING_PER_UNIT,
        filter,
      });
      expect(count).toBe(1);
    });
  });

  describe("skill activation via engine", () => {
    it("should grant Move 0 with 0 units", () => {
      const state = createForwardMarchState([]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(0);
    });

    it("should grant Move 1 with 1 ready unwounded unit", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(1);
    });

    it("should grant Move 3 with 3 ready unwounded units", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        createPlayerUnit(UNIT_FORESTERS, "f1"),
        createPlayerUnit(UNIT_HERBALIST, "h1"),
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(3);
    });

    it("should cap at Move 3 with 5 ready unwounded units", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        createPlayerUnit(UNIT_FORESTERS, "f1"),
        createPlayerUnit(UNIT_HERBALIST, "h1"),
        createPlayerUnit(UNIT_PEASANTS, "p2"),
        createPlayerUnit(UNIT_FORESTERS, "f2"),
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(3);
    });

    it("should grant Move 1 with 2 ready units where 1 is wounded", () => {
      const wounded = { ...createPlayerUnit(UNIT_FORESTERS, "f1"), wounded: true };
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        wounded,
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(1);
    });

    it("should grant Move 1 with 2 unwounded units where 1 is spent", () => {
      const spent = { ...createPlayerUnit(UNIT_FORESTERS, "f1"), state: UNIT_STATE_SPENT };
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
        spent,
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(1);
    });

    it("should add to existing move points", () => {
      const state = createForwardMarchState(
        [
          createPlayerUnit(UNIT_PEASANTS, "p1"),
          createPlayerUnit(UNIT_FORESTERS, "f1"),
        ],
        2
      );

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].movePoints).toBe(4);
    });

    it("should track once-per-turn cooldown", () => {
      const state = createForwardMarchState([
        createPlayerUnit(UNIT_PEASANTS, "p1"),
      ]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_FORWARD_MARCH,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_NOROWAS_FORWARD_MARCH
      );
    });
  });
});
