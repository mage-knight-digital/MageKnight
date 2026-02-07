/**
 * Tests for Regeneration advanced action card (#157)
 *
 * Basic: Heal 1. Ready a Level I or II Unit you control.
 * Powered (Green): Heal 2. Ready a Level I, II or III Unit you control.
 *
 * Key rules:
 * - Healing removes wound cards from hand (1 per healing point)
 * - Readying happens immediately during card resolution (not bankable)
 * - Readying targets Spent units only, filtered by level
 */

import { describe, it, expect } from "vitest";
import { resolveEffect } from "../effects/index.js";
import { REGENERATION } from "../../data/advancedActions/green/regeneration.js";
import { createPlayerUnit } from "../../types/unit.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { PlayerUnit } from "../../types/unit.js";
import {
  CARD_WOUND,
  CARD_MARCH,
  UNIT_PEASANTS,
  UNIT_UTEM_GUARDSMEN,
  UNIT_HEROES,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
} from "@mage-knight/shared";

function createStateWithUnits(units: PlayerUnit[], wounds = 0) {
  const hand = [CARD_MARCH, ...Array.from({ length: wounds }, () => CARD_WOUND)];
  const player = createTestPlayer({ units, hand });
  return createTestGameState({ players: [player] });
}

function spentUnit(unitId: typeof UNIT_PEASANTS | typeof UNIT_UTEM_GUARDSMEN | typeof UNIT_HEROES, instanceId: string, wounded = false): PlayerUnit {
  return {
    ...createPlayerUnit(unitId, instanceId),
    state: UNIT_STATE_SPENT,
    wounded,
  };
}

describe("Regeneration card", () => {
  describe("basic effect: Heal 1 + Ready Level I/II", () => {
    const effect = REGENERATION.basicEffect;

    it("should heal 1 wound from hand", () => {
      const state = createStateWithUnits([], 2);
      const result = resolveEffect(state, state.players[0].id, effect);

      // Started with 2 wounds, healed 1 → 1 wound remaining
      const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsRemaining).toBe(1);
    });

    it("should heal AND ready a spent unit", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
      ], 1);

      const result = resolveEffect(state, state.players[0].id, effect);

      // Wound healed
      const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsRemaining).toBe(0);
      // Unit readied (auto-resolved with only one eligible)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should ready a Level I unit", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should ready a Level II unit", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_UTEM_GUARDSMEN, "g1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should NOT ready a Level III unit (basic limits to Level I/II)", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_HEROES, "h1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      // Level III unit should remain spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should skip readying when no eligible units exist", () => {
      const state = createStateWithUnits([]);

      const result = resolveEffect(state, state.players[0].id, effect);

      // No error, effect still resolves (heal has no wounds to heal, ready skips)
      expect(result.state).toBeDefined();
    });

    it("should require choice when multiple spent units are eligible", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
        spentUnit(UNIT_UTEM_GUARDSMEN, "g1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      // Should require choice for which unit to ready
      expect(result.requiresChoice).toBe(true);
    });

    it("should filter out Level III units from basic effect choice", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
        spentUnit(UNIT_HEROES, "h1"), // Level III, should be excluded
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      // Only Level I unit eligible → auto-resolves
      expect(result.requiresChoice).toBeFalsy();
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY); // Peasants readied
      expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_SPENT); // Heroes still spent
    });
  });

  describe("powered effect: Heal 2 + Ready Level I/II/III", () => {
    const effect = REGENERATION.poweredEffect;

    it("should heal 2 wounds from hand", () => {
      const state = createStateWithUnits([], 3);
      const result = resolveEffect(state, state.players[0].id, effect);

      // Started with 3 wounds, healed 2 → 1 wound remaining
      const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsRemaining).toBe(1);
    });

    it("should ready a Level III unit (powered extends range)", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_HEROES, "h1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should still ready Level I and II units", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should include Level III in choices with other eligible units", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1"),
        spentUnit(UNIT_HEROES, "h1"),
      ]);

      const result = resolveEffect(state, state.players[0].id, effect);

      // Both units eligible → requires choice
      expect(result.requiresChoice).toBe(true);
    });
  });

  describe("readying does not change wound status", () => {
    it("should ready a wounded unit without healing the wound", () => {
      const state = createStateWithUnits([
        spentUnit(UNIT_PEASANTS, "p1", true),
      ]);

      const result = resolveEffect(state, state.players[0].id, REGENERATION.basicEffect);

      const unit = result.state.players[0].units[0];
      expect(unit.state).toBe(UNIT_STATE_READY);
      expect(unit.wounded).toBe(true); // Wound unchanged by readying
    });
  });
});
