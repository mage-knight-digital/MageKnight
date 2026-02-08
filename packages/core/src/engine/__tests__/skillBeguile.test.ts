/**
 * Tests for Beguile skill (Braevalar)
 *
 * Once per turn: Influence 3 by default, Influence 2 at fortified site,
 * Influence 4 at Magical Glade.
 *
 * Key rules:
 * - Fortified sites (Keep, Mage Tower, City) REDUCE influence to 2 (S1)
 * - Magical Glade INCREASES influence to 4
 * - Default is Influence 3 at any other location
 * - Once per turn
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  TERRAIN_PLAINS,
  TERRAIN_FOREST,
  hexKey,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_BEGUILE } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { SiteType } from "../../types/index.js";
import type { Site } from "../../types/map.js";
import { evaluateCondition } from "../effects/conditionEvaluator.js";
import {
  CONDITION_AT_FORTIFIED_SITE,
  CONDITION_AT_MAGICAL_GLADE,
} from "../../types/conditions.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Beguile skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("condition evaluation", () => {
    describe("AT_FORTIFIED_SITE condition", () => {
      it("should return true when at a Keep", () => {
        const keepSite: Site = {
          type: SiteType.Keep,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS, keepSite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_FORTIFIED_SITE })).toBe(true);
      });

      it("should return true when at a Mage Tower", () => {
        const mageTowerSite: Site = {
          type: SiteType.MageTower,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS, mageTowerSite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_FORTIFIED_SITE })).toBe(true);
      });

      it("should return true when at a City", () => {
        const citySite: Site = {
          type: SiteType.City,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS, citySite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_FORTIFIED_SITE })).toBe(true);
      });

      it("should return false when at a non-fortified site (Village)", () => {
        const villageSite: Site = {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS, villageSite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_FORTIFIED_SITE })).toBe(false);
      });

      it("should return false when on hex with no site", () => {
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_FORTIFIED_SITE })).toBe(false);
      });
    });

    describe("AT_MAGICAL_GLADE condition", () => {
      it("should return true when at a Magical Glade", () => {
        const gladeSite: Site = {
          type: SiteType.MagicalGlade,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_FOREST, gladeSite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_MAGICAL_GLADE })).toBe(true);
      });

      it("should return false when at a different site type", () => {
        const villageSite: Site = {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        };
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS, villageSite);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_MAGICAL_GLADE })).toBe(false);
      });

      it("should return false when on hex with no site", () => {
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hex = createTestHex(0, 0, TERRAIN_PLAINS);
        const state = createTestGameState({
          players: [player],
          map: {
            hexes: { [hexKey({ q: 0, r: 0 })]: hex },
          } as any,
        });

        expect(evaluateCondition(state, "player1", { type: CONDITION_AT_MAGICAL_GLADE })).toBe(false);
      });
    });
  });

  describe("activation", () => {
    it("should grant Influence 3 at a normal location (no site)", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_PLAINS);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_BEGUILE,
        })
      );
      expect(result.state.players[0].influencePoints).toBe(3);
    });

    it("should grant Influence 2 at a fortified site (Keep)", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_PLAINS, keepSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].influencePoints).toBe(2);
    });

    it("should grant Influence 2 at a fortified site (Mage Tower)", () => {
      const mageTowerSite: Site = {
        type: SiteType.MageTower,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_PLAINS, mageTowerSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].influencePoints).toBe(2);
    });

    it("should grant Influence 2 at a fortified site (City)", () => {
      const citySite: Site = {
        type: SiteType.City,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_PLAINS, citySite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].influencePoints).toBe(2);
    });

    it("should grant Influence 4 at a Magical Glade", () => {
      const gladeSite: Site = {
        type: SiteType.MagicalGlade,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_FOREST, gladeSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].influencePoints).toBe(4);
    });

    it("should grant Influence 3 at a non-fortified site (Village)", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        influencePoints: 0,
        position: { q: 0, r: 0 },
      });
      const hex = createTestHex(0, 0, TERRAIN_PLAINS, villageSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].influencePoints).toBe(3);
    });
  });

  describe("once per turn restriction", () => {
    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_BRAEVALAR_BEGUILE
      );
    });

    it("should reject if already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_BEGUILE],
        },
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_BEGUILE,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });
  });

  describe("valid actions", () => {
    it("should appear in valid actions when not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: { ...defaultCooldowns },
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions).toBeDefined();
      expect(skillOptions!.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_BRAEVALAR_BEGUILE,
        })
      );
    });

    it("should not appear in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_BEGUILE],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_BEGUILE],
        },
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.find(
        (s) => s.skillId === SKILL_BRAEVALAR_BEGUILE
      );
      expect(found).toBeUndefined();
    });
  });
});
