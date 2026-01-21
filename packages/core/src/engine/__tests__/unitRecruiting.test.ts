/**
 * Unit Recruiting tests
 *
 * Tests for recruiting units at villages and monasteries,
 * command slot limits, and influence requirements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createStateWithVillage } from "./testHelpers.js";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_RECRUITED,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_STATE_READY,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";

describe("Unit Recruiting", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  it("should recruit unit when command slots available", () => {
    const state = createStateWithVillage({
      units: [],
      commandTokens: 1,
    });

    const result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4, // Peasants cost 4
    });

    expect(result.state.players[0].units).toHaveLength(1);
    expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);
    expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    expect(result.state.players[0].units[0].wounded).toBe(false);

    // Check event was emitted
    const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
    expect(recruitEvent).toBeDefined();
    if (recruitEvent && recruitEvent.type === UNIT_RECRUITED) {
      expect(recruitEvent.unitId).toBe(UNIT_PEASANTS);
      expect(recruitEvent.influenceSpent).toBe(4);
    }
  });

  it("should reject recruit when no command slots available", () => {
    const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_unit");
    const state = createStateWithVillage({
      units: [existingUnit],
      commandTokens: 1, // Only 1 slot, already full
    });

    const result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4,
    });

    // Should still have only 1 unit
    expect(result.state.players[0].units).toHaveLength(1);

    // Check for invalid action event
    const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
    expect(invalidEvent).toBeDefined();
    if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
      expect(invalidEvent.reason).toContain("command slot");
    }
  });

  it("should reject recruit with insufficient influence", () => {
    const state = createStateWithVillage({
      units: [],
      commandTokens: 1,
    });

    const result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 2, // Less than cost of 4
    });

    // Should not have any units
    expect(result.state.players[0].units).toHaveLength(0);

    // Check for invalid action event
    const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
    expect(invalidEvent).toBeDefined();
    if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
      expect(invalidEvent.reason).toContain("influence");
    }
  });

  it("should recruit with exactly the right influence", () => {
    const state = createStateWithVillage({
      units: [],
      commandTokens: 2,
    });

    const result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4, // Exactly the cost
    });

    expect(result.state.players[0].units).toHaveLength(1);
  });

  it("should allow recruiting multiple units up to command limit", () => {
    let state = createStateWithVillage({
      units: [],
      commandTokens: 3,
    });

    // Recruit first unit
    let result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4,
    });
    state = result.state;
    expect(state.players[0].units).toHaveLength(1);

    // Recruit second unit
    result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4,
    });
    state = result.state;
    expect(state.players[0].units).toHaveLength(2);

    // Recruit third unit
    result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4,
    });
    state = result.state;
    expect(state.players[0].units).toHaveLength(3);

    // Fourth should fail
    result = engine.processAction(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_PEASANTS,
      influenceSpent: 4,
    });
    expect(result.state.players[0].units).toHaveLength(3);
    expect(result.events.some((e) => e.type === INVALID_ACTION)).toBe(true);
  });
});
