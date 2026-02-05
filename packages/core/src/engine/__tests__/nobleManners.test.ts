/**
 * Integration tests for Noble Manners card conditional bonuses
 *
 * Verifies that Noble Manners grants Fame/Reputation bonuses
 * when played during interaction at inhabited sites.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { NOROWAS_NOBLE_MANNERS } from "../../data/basicActions/white/norowas-noble-manners.js";
import { SiteType } from "../../types/index.js";
import type { Site } from "../../types/map.js";
import { hexKey, TERRAIN_FOREST } from "@mage-knight/shared";

describe("Noble Manners Card", () => {
  describe("Basic Effect", () => {
    it("should grant Influence 2 + Fame 1 when at inhabited village", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, villageSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(1);
    });

    it("should grant only Influence 2 when not at inhabited site", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const hex = createTestHex(0, 0, TERRAIN_FOREST, null);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus
    });

    it("should grant only Influence 2 when at non-inhabited site", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const glade: Site = {
        type: SiteType.MagicalGlade,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, glade);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus
    });

    it("should grant only Influence 2 when at unconquered keep", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const keep: Site = {
        type: SiteType.Keep,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, keep);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus (keep not accessible)
    });

    it("should grant Influence 2 + Fame 1 when at monastery", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const monastery: Site = {
        type: SiteType.Monastery,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, monastery);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(1);
    });

    it("should grant only Influence 2 at burned monastery", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
      });
      const burnedMonastery: Site = {
        type: SiteType.Monastery,
        owner: null,
        isConquered: false,
        isBurned: true,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, burnedMonastery);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.basicEffect,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(2);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus (burned)
    });
  });

  describe("Powered Effect", () => {
    it("should grant Influence 4 + Fame 1 + Rep 1 when at inhabited village", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
        reputation: 0,
      });
      const villageSite: Site = {
        type: SiteType.Village,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, villageSite);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(1);
      expect(result.state.players[0]?.reputation).toBe(1);
    });

    it("should grant only Influence 4 when not at inhabited site", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
        reputation: 0,
      });
      const hex = createTestHex(0, 0, TERRAIN_FOREST, null);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus
      expect(result.state.players[0]?.reputation).toBe(0); // No rep bonus
    });

    it("should grant only Influence 4 at burned monastery", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
        reputation: 0,
      });
      const burnedMonastery: Site = {
        type: SiteType.Monastery,
        owner: null,
        isConquered: false,
        isBurned: true,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, burnedMonastery);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus
      expect(result.state.players[0]?.reputation).toBe(0); // No rep bonus
    });

    it("should grant only Influence 4 at unconquered keep", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
        reputation: 0,
      });
      const keep: Site = {
        type: SiteType.Keep,
        owner: null,
        isConquered: false,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, keep);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(0); // No fame bonus
      expect(result.state.players[0]?.reputation).toBe(0); // No rep bonus
    });

    it("should grant Influence 4 + Fame 1 + Rep 1 at owned keep", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        id: "player1",
        fame: 0,
        reputation: 0,
      });
      const ownedKeep: Site = {
        type: SiteType.Keep,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, ownedKeep);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(1);
      expect(result.state.players[0]?.reputation).toBe(1);
    });

    it("should grant only Influence 4 at conquered mage tower", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        fame: 0,
        reputation: 0,
      });
      const mageTower: Site = {
        type: SiteType.MageTower,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      };
      const hex = createTestHex(0, 0, TERRAIN_FOREST, mageTower);
      const state = createTestGameState({
        players: [player],
        map: {
          hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        } as any,
      });

      const result = resolveEffect(
        state,
        "player1",
        NOROWAS_NOBLE_MANNERS.poweredEffect!,
        NOROWAS_NOBLE_MANNERS.id
      );

      expect(result.state.players[0]?.influencePoints).toBe(4);
      expect(result.state.players[0]?.fame).toBe(1);
      expect(result.state.players[0]?.reputation).toBe(1);
    });
  });
});
