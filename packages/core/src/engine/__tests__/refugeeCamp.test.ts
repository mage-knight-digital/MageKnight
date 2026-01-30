/**
 * Refugee Camp tests
 *
 * Tests for Refugee Camp site interactions:
 * - Healing at 3 influence per point (same as Village)
 * - Tiered recruitment costs:
 *   - Village-recruitable units: +0
 *   - Keep/MageTower/Monastery units: +1
 *   - City-only units: +3
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestHex,
  createTestGameState,
} from "./testHelpers.js";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_RECRUITED,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_HERBALIST,
  UNIT_UTEM_SWORDSMEN,
  UNIT_RED_CAPE_MONKS,
  UNIT_ALTEM_GUARDIANS,
  UNIT_CATAPULTS,
  hexKey,
  GAME_PHASE_ROUND,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import { getHealingCost } from "../../data/siteProperties.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  getRefugeeCampCostModifier,
  getUnitOptions,
  isSiteAccessibleForRecruitment,
  siteTypeToRecruitSite,
} from "../validActions/units/recruitment.js";
import { UNITS, RECRUIT_SITE_CAMP } from "@mage-knight/shared";

/**
 * Create a Refugee Camp site
 */
function createRefugeeCampSite(): Site {
  return {
    type: SiteType.RefugeeCamp,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create a game state with the player at a Refugee Camp
 */
function createStateWithRefugeeCamp(
  playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
) {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    commandTokens: 3,
    influencePoints: 20, // Enough for most units
    ...playerOverrides,
  });

  const hexWithCamp = createTestHex(0, 0, undefined, createRefugeeCampSite());

  return createTestGameState({
    players: [player],
    phase: GAME_PHASE_ROUND,
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: hexWithCamp,
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });
}

describe("Refugee Camp", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Healing", () => {
    it("should have healing cost of 3 (same as Village)", () => {
      expect(getHealingCost(SiteType.RefugeeCamp)).toBe(3);
    });

    it("should have same healing cost as Village", () => {
      expect(getHealingCost(SiteType.RefugeeCamp)).toBe(
        getHealingCost(SiteType.Village)
      );
    });
  });

  describe("Site Accessibility", () => {
    it("should map RefugeeCamp to camp recruit site", () => {
      expect(siteTypeToRecruitSite(SiteType.RefugeeCamp)).toBe(
        RECRUIT_SITE_CAMP
      );
    });

    it("should always be accessible for recruitment (like Village)", () => {
      // Not conquered, no owner
      expect(
        isSiteAccessibleForRecruitment(
          SiteType.RefugeeCamp,
          false,
          null,
          "player1",
          false
        )
      ).toBe(true);

      // Even if burned flag is set (shouldn't happen for camp but test defensively)
      expect(
        isSiteAccessibleForRecruitment(
          SiteType.RefugeeCamp,
          false,
          null,
          "player1",
          true
        )
      ).toBe(true);
    });
  });

  describe("Tiered Recruitment Costs", () => {
    describe("getRefugeeCampCostModifier", () => {
      it("should return +0 for Village-recruitable units", () => {
        // Peasants can be recruited at Village
        const peasants = UNITS[UNIT_PEASANTS];
        expect(getRefugeeCampCostModifier(peasants)).toBe(0);

        // Herbalist can be recruited at Village + Monastery
        const herbalist = UNITS[UNIT_HERBALIST];
        expect(getRefugeeCampCostModifier(herbalist)).toBe(0);
      });

      it("should return +1 for Keep/MageTower/Monastery-only units", () => {
        // Utem Swordsmen: Keep only
        const swordsmen = UNITS[UNIT_UTEM_SWORDSMEN];
        expect(getRefugeeCampCostModifier(swordsmen)).toBe(1);

        // Red Cape Monks: Monastery only
        const monks = UNITS[UNIT_RED_CAPE_MONKS];
        expect(getRefugeeCampCostModifier(monks)).toBe(1);
      });

      it("should return +3 for City-only units", () => {
        // Altem Guardians: City only
        const guardians = UNITS[UNIT_ALTEM_GUARDIANS];
        expect(getRefugeeCampCostModifier(guardians)).toBe(3);
      });

      it("should use cheapest tier for multi-site units", () => {
        // Catapults: Keep + City - should use Keep tier (+1), not City tier (+3)
        const catapults = UNITS[UNIT_CATAPULTS];
        expect(getRefugeeCampCostModifier(catapults)).toBe(1);
      });
    });

    describe("getUnitOptions at Refugee Camp", () => {
      it("should return all units from offer with tiered costs", () => {
        const state = createStateWithRefugeeCamp({
          reputation: 0, // No reputation modifier
        });
        // Add units to the offer
        state.offers = {
          ...state.offers,
          units: [
            UNIT_PEASANTS, // Village: base 4 + 0 = 4
            UNIT_UTEM_SWORDSMEN, // Keep: base 6 + 1 = 7
            UNIT_ALTEM_GUARDIANS, // City: base 11 + 3 = 14
          ],
        };

        const options = getUnitOptions(state, state.players[0]);
        expect(options).toBeDefined();
        if (!options) throw new Error("Expected options to be defined");
        expect(options.recruitable).toHaveLength(3);

        // Check costs are correct with tiered modifiers
        const peasantOption = options.recruitable.find(
          (u) => u.unitId === UNIT_PEASANTS
        );
        expect(peasantOption?.cost).toBe(4); // base 4 + 0 tier modifier

        const swordsmenOption = options.recruitable.find(
          (u) => u.unitId === UNIT_UTEM_SWORDSMEN
        );
        expect(swordsmenOption?.cost).toBe(7); // base 6 + 1 tier modifier

        const guardiansOption = options.recruitable.find(
          (u) => u.unitId === UNIT_ALTEM_GUARDIANS
        );
        expect(guardiansOption?.cost).toBe(14); // base 11 + 3 tier modifier
      });

      it("should combine tiered costs with reputation modifier", () => {
        const state = createStateWithRefugeeCamp({
          reputation: -4, // +2 cost modifier
        });
        state.offers = {
          ...state.offers,
          units: [UNIT_PEASANTS], // Village: base 4 + 0 tier + 2 rep = 6
        };

        const options = getUnitOptions(state, state.players[0]);
        expect(options).toBeDefined();
        if (!options) throw new Error("Expected options to be defined");

        const peasantOption = options.recruitable.find(
          (u) => u.unitId === UNIT_PEASANTS
        );
        expect(peasantOption?.cost).toBe(6); // 4 base + 0 tier + 2 reputation
      });

      it("should mark units as affordable based on adjusted cost", () => {
        const state = createStateWithRefugeeCamp({
          influencePoints: 10,
          reputation: 0,
        });
        state.offers = {
          ...state.offers,
          units: [
            UNIT_PEASANTS, // 4 + 0 = 4 (affordable)
            UNIT_ALTEM_GUARDIANS, // 11 + 3 = 14 (not affordable)
          ],
        };

        const options = getUnitOptions(state, state.players[0]);
        expect(options).toBeDefined();
        if (!options) throw new Error("Expected options to be defined");

        const peasantOption = options.recruitable.find(
          (u) => u.unitId === UNIT_PEASANTS
        );
        expect(peasantOption?.canAfford).toBe(true);

        const guardiansOption = options.recruitable.find(
          (u) => u.unitId === UNIT_ALTEM_GUARDIANS
        );
        expect(guardiansOption?.canAfford).toBe(false);
      });
    });
  });

  describe("Recruitment Actions", () => {
    it("should recruit Village-recruitable unit at base cost", () => {
      const state = createStateWithRefugeeCamp({
        units: [],
        influencePoints: 10,
      });
      state.offers = { ...state.offers, units: [UNIT_PEASANTS] };

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4, // Base cost, no tier modifier
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);

      const recruitEvent = result.events.find((e) => e.type === UNIT_RECRUITED);
      expect(recruitEvent).toBeDefined();
    });

    it("should recruit Keep-only unit with +1 cost modifier", () => {
      const state = createStateWithRefugeeCamp({
        units: [],
        influencePoints: 10,
      });
      state.offers = { ...state.offers, units: [UNIT_UTEM_SWORDSMEN] };

      // Utem Swordsmen base cost is 6, +1 tier = 7
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_UTEM_SWORDSMEN,
        influenceSpent: 7,
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_UTEM_SWORDSMEN);
    });

    it("should recruit City-only unit with +3 cost modifier", () => {
      const state = createStateWithRefugeeCamp({
        units: [],
        influencePoints: 20,
      });
      state.offers = { ...state.offers, units: [UNIT_ALTEM_GUARDIANS] };

      // Altem Guardians base cost is 11, +3 tier = 14
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_ALTEM_GUARDIANS,
        influenceSpent: 14,
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(
        UNIT_ALTEM_GUARDIANS
      );
    });

    it("should allow recruiting any unit from offer regardless of recruit sites", () => {
      // This is the key feature: Refugee Camp can recruit ALL units
      const state = createStateWithRefugeeCamp({
        units: [],
        influencePoints: 20,
      });

      // Red Cape Monks are Monastery-only, but should be recruitable at Refugee Camp
      state.offers = { ...state.offers, units: [UNIT_RED_CAPE_MONKS] };

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_RED_CAPE_MONKS,
        influenceSpent: 8, // Base 7 + 1 tier
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_RED_CAPE_MONKS);
    });

    it("should reject recruitment with insufficient influence for tiered cost", () => {
      const state = createStateWithRefugeeCamp({
        units: [],
        influencePoints: 20,
      });
      state.offers = { ...state.offers, units: [UNIT_UTEM_SWORDSMEN] };

      // Try to recruit at base cost (6) instead of tiered cost (7)
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_UTEM_SWORDSMEN,
        influenceSpent: 6, // Should need 7 at Refugee Camp
      });

      expect(result.state.players[0].units).toHaveLength(0);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });
});
