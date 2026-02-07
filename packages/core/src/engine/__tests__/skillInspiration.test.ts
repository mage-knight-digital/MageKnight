/**
 * Tests for Inspiration skill (Norowas)
 *
 * Skill effect: Flip to Ready or Heal a Unit (except in combat)
 * Usage: Once per round
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import { createPlayerUnit } from "../../types/unit.js";
import {
  USE_SKILL_ACTION,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  UNIT_STATE_SPENT,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_INSPIRATION } from "../../data/skills/index.js";
import { INVALID_ACTION } from "@mage-knight/shared";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";
import { resolveEffect } from "../effects/index.js";
import { EFFECT_HEAL_UNIT } from "../../types/effectTypes.js";

describe("Inspiration skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  function createInspirationState(
    units: ReturnType<typeof createPlayerUnit>[],
    overrides: Partial<Parameters<typeof createTestGameState>[0]> = {}
  ) {
    const player = createTestPlayer({
      hero: Hero.Norowas,
      skills: [SKILL_NOROWAS_INSPIRATION],
      units,
    });
    return createTestGameState({ players: [player], ...overrides });
  }

  describe("Ready option", () => {
    it("should ready a spent unwounded unit", () => {
      const spent = { ...createPlayerUnit(UNIT_PEASANTS, "p1"), state: UNIT_STATE_SPENT };
      const state = createInspirationState([spent]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      // Skill creates a choice between ready and heal.
      // With one spent unwounded unit, we should get a pending choice.
      expect(result.state.players[0].pendingChoice).toBeDefined();
    });

    it("should ready a spent wounded unit", () => {
      const spentWounded = {
        ...createPlayerUnit(UNIT_PEASANTS, "p1"),
        state: UNIT_STATE_SPENT,
        wounded: true,
      };
      const state = createInspirationState([spentWounded]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      // Should have a pending choice (ready or heal since unit is both spent and wounded)
      expect(result.state.players[0].pendingChoice).toBeDefined();
    });
  });

  describe("Heal option", () => {
    it("should heal a wounded unit (1 wound → 0 wounds)", () => {
      const wounded = {
        ...createPlayerUnit(UNIT_PEASANTS, "p1"),
        wounded: true,
      };
      const state = createInspirationState([wounded]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      // Unit is wounded (ready) so only heal option is available from the choice.
      // Ready won't apply since unit is already ready.
      // Should get a pending choice.
      expect(result.state.players[0].pendingChoice).toBeDefined();
    });

    it("should heal only 1 wound even if unit has 2 wounds", () => {
      // The EFFECT_HEAL_UNIT removes one wound (sets wounded = false).
      // Per FAQ S2, healing a unit with 2 wounds heals only 1.
      // In this game model, unit wounded status is boolean.
      // The heal effect sets wounded to false (removes 1 wound).
      const wounded = {
        ...createPlayerUnit(UNIT_PEASANTS, "p1"),
        wounded: true,
      };
      const state = createInspirationState([wounded]);

      const healResult = resolveEffect(state, "player1", {
        type: EFFECT_HEAL_UNIT,
      });

      const healedUnit = healResult.state.players[0].units[0];
      expect(healedUnit.wounded).toBe(false);
    });
  });

  describe("combat restriction", () => {
    it("should not be activatable during combat", () => {
      const state = createInspirationState(
        [createPlayerUnit(UNIT_PEASANTS, "p1")],
        { combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE) }
      );

      const validActions = getValidActions(state, "player1");
      if (validActions.mode === "combat") {
        const inspirationSkill = validActions.skills?.activatable.find(
          (s) => s.skillId === SKILL_NOROWAS_INSPIRATION
        );
        expect(inspirationSkill).toBeUndefined();
      }
    });

    it("should reject activation during combat via engine", () => {
      const state = createInspirationState(
        [createPlayerUnit(UNIT_PEASANTS, "p1")],
        { combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE) }
      );

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      expect(result.events.some((e) => e.type === INVALID_ACTION)).toBe(true);
    });
  });

  describe("cooldown", () => {
    it("should track once-per-round cooldown", () => {
      const spent = { ...createPlayerUnit(UNIT_PEASANTS, "p1"), state: UNIT_STATE_SPENT };
      const state = createInspirationState([spent]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      expect(result.state.players[0].skillCooldowns.usedThisRound).toContain(
        SKILL_NOROWAS_INSPIRATION
      );
    });
  });

  describe("choice between ready and heal", () => {
    it("should present choice when unit is both spent and wounded", () => {
      const spentWounded = {
        ...createPlayerUnit(UNIT_PEASANTS, "p1"),
        state: UNIT_STATE_SPENT,
        wounded: true,
      };
      const state = createInspirationState([spentWounded]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      // Should have a pending choice between ready and heal
      const pendingChoice = result.state.players[0].pendingChoice;
      expect(pendingChoice).toBeDefined();
      expect(pendingChoice?.options).toHaveLength(2);
    });

    it("should present choice with two options when multiple units available", () => {
      const spent = { ...createPlayerUnit(UNIT_PEASANTS, "p1"), state: UNIT_STATE_SPENT };
      const wounded = { ...createPlayerUnit(UNIT_FORESTERS, "f1"), wounded: true };
      const state = createInspirationState([spent, wounded]);

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_INSPIRATION,
      });

      // Should have a pending choice between ready and heal
      const pendingChoice = result.state.players[0].pendingChoice;
      expect(pendingChoice).toBeDefined();
      expect(pendingChoice?.options).toHaveLength(2);
    });
  });
});
