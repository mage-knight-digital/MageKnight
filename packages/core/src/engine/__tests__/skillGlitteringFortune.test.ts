/**
 * Tests for Glittering Fortune skill (Goldyx)
 *
 * Skill effect: Once a turn, during interaction: Get Influence 1
 * for each different color crystal in your inventory.
 *
 * Key rules:
 * - Once per turn (flip to activate)
 * - Only usable during interaction (at inhabited site)
 * - Counts distinct crystal colors, not quantities
 * - Returns 0 influence with no crystals
 * - Maximum of 4 influence (all four colors present)
 * - Crystals counted at activation; can be spent afterward
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
  createTestHex,
  createVillageSite,
} from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  CARD_MARCH,
  hexKey,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_GLITTERING_FORTUNE } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { TERRAIN_PLAINS } from "@mage-knight/shared";

describe("Glittering Fortune skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Helper to create a game state where the player is at a village (interaction site).
   */
  function createInteractionState(overrides: {
    crystals?: { red: number; blue: number; green: number; white: number };
    skillCooldowns?: {
      usedThisRound: readonly string[];
      usedThisTurn: readonly string[];
      usedThisCombat: readonly string[];
      activeUntilNextTurn: readonly string[];
    };
    skills?: readonly string[];
  } = {}) {
    const player = createTestPlayer({
      hero: Hero.Goldyx,
      skills: overrides.skills ?? [SKILL_GOLDYX_GLITTERING_FORTUNE],
      skillCooldowns: overrides.skillCooldowns ?? {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      hand: [CARD_MARCH],
      crystals: overrides.crystals ?? { red: 0, blue: 0, green: 0, white: 0 },
      influencePoints: 0,
      position: { q: 0, r: 0 },
    });

    const hexWithVillage = createTestHex(0, 0, TERRAIN_PLAINS, createVillageSite());

    return createTestGameState({
      players: [player],
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hexWithVillage,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
    });
  }

  describe("activation and influence calculation", () => {
    it("should grant 0 influence with no crystals", () => {
      const state = createInteractionState({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
        })
      );

      expect(result.state.players[0].influencePoints).toBe(0);
    });

    it("should grant 1 influence with one crystal color", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(1);
    });

    it("should grant 2 influence with two distinct crystal colors", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 0, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(2);
    });

    it("should grant 3 influence with three distinct crystal colors", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 1, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(3);
    });

    it("should grant 4 influence with all four crystal colors", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(4);
    });

    it("should count distinct colors, not total crystal quantity", () => {
      // 3 blue crystals = only 1 distinct color = 1 influence
      const state = createInteractionState({
        crystals: { red: 0, blue: 3, green: 0, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(1);
    });

    it("should count distinct colors regardless of quantity per color", () => {
      // 3 red + 2 blue + 1 green = 3 distinct colors = 3 influence
      const state = createInteractionState({
        crystals: { red: 3, blue: 2, green: 1, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.state.players[0].influencePoints).toBe(3);
    });
  });

  describe("cooldown tracking", () => {
    it("should add skill to usedThisTurn cooldown", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_GOLDYX_GLITTERING_FORTUNE);
    });

    it("should reject if skill already used this turn", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_GOLDYX_GLITTERING_FORTUNE],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill not learned", () => {
      const state = createInteractionState({
        skills: [],
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("interaction restriction", () => {
    it("should reject when player is not at an inhabited site", () => {
      // Player at a plain hex with no site
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_GLITTERING_FORTUNE],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
        position: { q: 0, r: 0 },
      });

      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when at interaction site", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
        })
      );
    });

    it("should not show skill when not at interaction site", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_GLITTERING_FORTUNE],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
          })
        );
      }
    });

    it("should not show skill when on cooldown", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_GOLDYX_GLITTERING_FORTUNE],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable after activation", () => {
      const state = createInteractionState({
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_GLITTERING_FORTUNE,
      });

      // Verify activation happened
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_GOLDYX_GLITTERING_FORTUNE);
      expect(afterSkill.state.players[0].influencePoints).toBe(4);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_GOLDYX_GLITTERING_FORTUNE);

      // Influence should be reverted
      expect(afterUndo.state.players[0].influencePoints).toBe(0);
    });
  });
});
