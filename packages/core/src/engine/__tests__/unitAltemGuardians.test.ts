/**
 * Altem Guardians unit tests
 *
 * Verifies Block 8, counts twice against Swift, and Grant All Resistances (green mana).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { createPlayerUnit } from "../../types/unit.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ACTIVATE_UNIT_ACTION,
  ASSIGN_BLOCK_ACTION,
  DECLARE_BLOCK_ACTION,
  ATTACK_ELEMENT_PHYSICAL,
  ENEMY_WOLF_RIDERS,
  UNIT_ALTEM_GUARDIANS,
  UNIT_PEASANTS,
  ENEMY_BLOCKED,
  MANA_SOURCE_TOKEN,
  MANA_GREEN,
} from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK, createCombatState } from "../../types/combat.js";
import { getEffectiveUnitResistances } from "../modifiers/index.js";
import { RESIST_FIRE, RESIST_ICE, RESIST_PHYSICAL } from "@mage-knight/shared";

describe("Altem Guardians", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Block 8 with Swift doubling", () => {
    it("should have Block 8 count as 16 against Swift enemies", () => {
      const unit = createPlayerUnit(UNIT_ALTEM_GUARDIANS, "guardians_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardians_1",
        abilityIndex: 1, // Block 8
      }).state;

      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId: "enemy_0",
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 8,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 16, // 8 block counts twice vs Swift = 16
        })
      );
    });
  });

  describe("Grant All Resistances (green mana)", () => {
    it("should grant Physical, Fire, and Ice resistance to all controlled units for the turn", () => {
      const guardians = createPlayerUnit(UNIT_ALTEM_GUARDIANS, "guardians_1");
      const peasants = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [guardians, peasants],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const baseCombat = createCombatState([ENEMY_WOLF_RIDERS]);
      const combat = {
        ...baseCombat,
        phase: COMBAT_PHASE_BLOCK,
      };

      let state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardians_1",
        abilityIndex: 2, // Grant All Resistances
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].pureMana.length).toBe(0);

      const updatedPeasants = result.state.players[0].units.find(
        (u) => u.instanceId === "peasants_1"
      );
      expect(updatedPeasants).toBeDefined();
      const resistances = getEffectiveUnitResistances(
        result.state,
        "player1",
        updatedPeasants!
      );
      expect(resistances).toContain(RESIST_PHYSICAL);
      expect(resistances).toContain(RESIST_FIRE);
      expect(resistances).toContain(RESIST_ICE);
    });
  });
});
