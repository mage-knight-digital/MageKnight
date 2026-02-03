/**
 * Tests for Secret Ways skill (Braevalar)
 *
 * Skill effect: Move 1. Mountains cost 5 and are safe. Optional blue mana:
 * lakes cost 2 and are safe this turn.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  MANA_BLUE,
  MANA_TOKEN_SOURCE_CARD,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_SECRET_WAYS } from "../../data/skills/index.js";
import { getEffectiveTerrainCost, isTerrainSafe } from "../modifiers/index.js";

describe("Secret Ways skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  function createStateWithTerrain(
    playerOverrides: Partial<ReturnType<typeof createTestPlayer>> = {}
  ) {
    const player = createTestPlayer({
      hero: Hero.Braevalar,
      ...playerOverrides,
    });

    const hexes = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_MOUNTAIN),
      [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_LAKE),
    };

    return createTestGameState({
      players: [player],
      map: {
        hexes,
        tiles: [],
        tileDeck: { countryside: [], core: [] },
        tileSlots: {},
      },
    });
  }

  it("should grant Move 1 and track once-per-turn cooldown", () => {
    const state = createStateWithTerrain({
      skills: [SKILL_BRAEVALAR_SECRET_WAYS],
      movePoints: 0,
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_BRAEVALAR_SECRET_WAYS,
    });

    expect(result.state.players[0].movePoints).toBe(1);
    expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
      SKILL_BRAEVALAR_SECRET_WAYS
    );
  });

  it("should apply passive mountain cost and safety", () => {
    const withSkill = createStateWithTerrain({
      skills: [SKILL_BRAEVALAR_SECRET_WAYS],
    });

    expect(
      getEffectiveTerrainCost(withSkill, TERRAIN_MOUNTAIN, "player1")
    ).toBe(5);
    expect(isTerrainSafe(withSkill, "player1", TERRAIN_MOUNTAIN)).toBe(true);

    const withoutSkill = createStateWithTerrain({ skills: [] });

    expect(
      getEffectiveTerrainCost(withoutSkill, TERRAIN_MOUNTAIN, "player1")
    ).toBe(Infinity);
    expect(isTerrainSafe(withoutSkill, "player1", TERRAIN_MOUNTAIN)).toBe(false);
  });

  it("should skip lake access when no blue mana is available", () => {
    const state = createStateWithTerrain({
      skills: [SKILL_BRAEVALAR_SECRET_WAYS],
      pureMana: [],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_BRAEVALAR_SECRET_WAYS,
    });

    expect(result.state.players[0].pendingChoice).toBeNull();
    expect(
      getEffectiveTerrainCost(result.state, TERRAIN_LAKE, "player1")
    ).toBe(Infinity);
    expect(isTerrainSafe(result.state, "player1", TERRAIN_LAKE)).toBe(false);
  });

  it("should allow paying blue mana for lake access this turn", () => {
    const state = createStateWithTerrain({
      skills: [SKILL_BRAEVALAR_SECRET_WAYS],
      pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_BRAEVALAR_SECRET_WAYS,
    });

    expect(afterUse.state.players[0].pendingChoice?.options).toHaveLength(2);

    const afterPay = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1, // Pay blue mana
    });

    expect(afterPay.state.players[0].pureMana).toHaveLength(0);
    expect(
      getEffectiveTerrainCost(afterPay.state, TERRAIN_LAKE, "player1")
    ).toBe(2);
    expect(isTerrainSafe(afterPay.state, "player1", TERRAIN_LAKE)).toBe(true);
  });
});
