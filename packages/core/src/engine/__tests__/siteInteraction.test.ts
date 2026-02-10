/**
 * Site Interaction tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  INTERACT_ACTION,
  BUY_HEALING_ACTION,
  HEALING_PURCHASED,
  INVALID_ACTION,
  CARD_WOUND,
  CARD_MARCH,
  GAME_PHASE_ROUND,
  RECRUIT_UNIT_ACTION,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  hexKey,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";

describe("Site Interaction", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a test state with a site at the player's position
   */
  function createStateWithSite(
    site: Site,
    playerOverrides: Parameters<typeof createTestPlayer>[0] = {}
  ) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      ...playerOverrides,
    });

    const hex = {
      ...createTestHex(0, 0),
      site,
    };

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hex,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
    });
  }

  describe("Village healing", () => {
    it("should process BUY_HEALING at village", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        hand: [CARD_WOUND, CARD_MARCH],
        influencePoints: 3,
      });

      const result = engine.processAction(state, "player1", {
        type: BUY_HEALING_ACTION,
        amount: 1,
      });

      expect(result.state.players[0].hand).toEqual([CARD_MARCH]);

      const healEvent = result.events.find((e) => e.type === HEALING_PURCHASED);
      expect(healEvent).toBeDefined();
      if (healEvent && healEvent.type === HEALING_PURCHASED) {
        expect(healEvent.healingPoints).toBe(1);
        expect(healEvent.influenceCost).toBe(3);
      }
    });

    it("should reject BUY_HEALING without enough influence", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        hand: [CARD_WOUND, CARD_MARCH],
        influencePoints: 2,
      });

      const result = engine.processAction(state, "player1", {
        type: BUY_HEALING_ACTION,
        amount: 1,
      });

      expect(result.state.players[0].hand).toContain(CARD_WOUND);

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Need 3 influence");
      }
    });

    it("should heal wounds at village (3 influence = 1 healing)", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        influencePoints: 6, // Enough for 2 healing
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 2,
      });

      // Should have removed 2 wounds
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      );
      expect(woundsRemaining).toHaveLength(0);

      // Should still have the march card
      expect(result.state.players[0].hand).toContain(CARD_MARCH);

      // Check event
      const healEvent = result.events.find((e) => e.type === HEALING_PURCHASED);
      expect(healEvent).toBeDefined();
      if (healEvent && healEvent.type === HEALING_PURCHASED) {
        expect(healEvent.healingPoints).toBe(2);
        expect(healEvent.influenceCost).toBe(6);
        expect(healEvent.woundsHealed).toBe(2);
      }
    });

    it("should only charge for wounds actually healed, not requested", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        hand: [CARD_WOUND, CARD_MARCH], // Only 1 wound
        influencePoints: 9, // Enough for 3 healing but only 1 wound exists
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 3, // Request 3, but only 1 wound exists
      });

      // Should have removed only 1 wound
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      );
      expect(woundsRemaining).toHaveLength(0);

      // Check event shows only 1 wound healed and correct cost (3 not 9)
      const healEvent = result.events.find((e) => e.type === HEALING_PURCHASED);
      expect(healEvent).toBeDefined();
      if (healEvent && healEvent.type === HEALING_PURCHASED) {
        expect(healEvent.healingPoints).toBe(1); // Actual, not requested
        expect(healEvent.influenceCost).toBe(3); // 1 wound * 3 cost, not 9
        expect(healEvent.woundsHealed).toBe(1);
      }
    });

    it("should heal at monastery with cheaper cost (2 influence = 1 healing)", () => {
      const monasterySite: Site = {
        type: SiteType.Monastery,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(monasterySite, {
        hand: [CARD_WOUND, CARD_WOUND],
        influencePoints: 4, // Enough for 2 healing at monastery
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 2,
      });

      // Should have removed 2 wounds
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      );
      expect(woundsRemaining).toHaveLength(0);

      // Check event shows correct cost
      const healEvent = result.events.find((e) => e.type === HEALING_PURCHASED);
      expect(healEvent).toBeDefined();
      if (healEvent && healEvent.type === HEALING_PURCHASED) {
        expect(healEvent.influenceCost).toBe(4); // 2 healing * 2 cost
      }
    });

    it("should reject interaction at non-inhabited site", () => {
      const dungeonSite: Site = {
        type: SiteType.Dungeon,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(dungeonSite, {
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 1,
      });

      // Wounds should still be there
      expect(result.state.players[0].hand).toContain(CARD_WOUND);

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("does not allow interaction");
      }
    });

    it("should reject interaction at unconquered fortified site", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: null,
        isConquered: false, // Not conquered
        isBurned: false,
      };

      const state = createStateWithSite(keepSite, {
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 1,
      });

      // Wounds should still be there
      expect(result.state.players[0].hand).toContain(CARD_WOUND);

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("conquer");
      }
    });

    it("should reject interaction at keep owned by another player", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: "player2", // Different player owns it
        isConquered: true,
        isBurned: false,
      };

      const state = createStateWithSite(keepSite, {
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
      });

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("keeps you own");
      }
    });

    it("should allow interaction at keep you own", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: "player1", // Player owns it
        isConquered: true,
        isBurned: false,
      };

      const state = createStateWithSite(keepSite, {
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      // Note: Keep doesn't offer healing in current implementation
      // This test verifies the site is accessible when owned
      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
      });

      // Should not be rejected for ownership reasons
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).not.toContain("keeps you own");
        expect(invalidEvent.reason).not.toContain("conquer");
      }
    });

    it("should reject interaction at burned monastery", () => {
      const monasterySite: Site = {
        type: SiteType.Monastery,
        owner: null,
        isConquered: false,
        isBurned: true, // Burned
      };

      const state = createStateWithSite(monasterySite, {
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 1,
      });

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("burned");
      }
    });

    it("should reject interaction when not at any site", () => {
      // Player on empty hex (no site)
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        hand: [CARD_WOUND],
        influencePoints: 10,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
      });

      const result = engine.processAction(state, "player1", {
        type: INTERACT_ACTION,
        healing: 1,
      });

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not at a site");
      }
    });
  });

  describe("Recruitment location validation", () => {
    it("should allow recruitment at village", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS, // Peasants can be recruited at village
        influenceSpent: 4,
      });

      expect(result.state.players[0].units).toHaveLength(1);
    });

    it("should reject recruitment when not at site", () => {
      // Player on empty hex
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        units: [],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // Should still have no units
      expect(result.state.players[0].units).toHaveLength(0);

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("must be at a site");
      }
    });

    it("should reject unit type that doesn't match site", () => {
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };

      const state = createStateWithSite(villageSite, {
        units: [],
        commandTokens: 1,
      });

      // Guardian Golems can only be recruited at Mage Tower or Keep, not Village
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_GUARDIAN_GOLEMS,
        influenceSpent: 7,
      });

      // Should still have no units
      expect(result.state.players[0].units).toHaveLength(0);

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("cannot be recruited");
      }
    });

    it("should reject recruitment at unconquered fortified site", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: null,
        isConquered: false, // Not conquered
        isBurned: false,
      };

      const state = createStateWithSite(keepSite, {
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_GUARDIAN_GOLEMS,
        influenceSpent: 7,
      });

      // Should still have no units
      expect(result.state.players[0].units).toHaveLength(0);

      // Check for invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("conquer");
      }
    });

    it("should allow recruitment at conquered keep", () => {
      const keepSite: Site = {
        type: SiteType.Keep,
        owner: "player1",
        isConquered: true, // Conquered
        isBurned: false,
      };

      const state = createStateWithSite(keepSite, {
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_GUARDIAN_GOLEMS, // Guardian Golems can be recruited at Keep
        influenceSpent: 7,
      });

      expect(result.state.players[0].units).toHaveLength(1);
    });
  });
});
