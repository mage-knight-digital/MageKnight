/**
 * Utem Guardsmen unit tests
 *
 * Verifies Block 4 counts twice against Swift.
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
  UNIT_UTEM_GUARDSMEN,
  ENEMY_BLOCKED,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK, createCombatState } from "../../types/combat.js";

describe("Utem Guardsmen", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should double block against swift enemies", () => {
    const unit = createPlayerUnit(UNIT_UTEM_GUARDSMEN, "utem_1");
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
      unitInstanceId: "utem_1",
      abilityIndex: 1,
    }).state;

    state = engine.processAction(state, "player1", {
      type: ASSIGN_BLOCK_ACTION,
      enemyInstanceId: "enemy_0",
      element: ATTACK_ELEMENT_PHYSICAL,
      amount: 4,
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
        blockValue: 8,
      })
    );
  });

  it("should only block one attack even when swift block doubles", () => {
    const unit = createPlayerUnit(UNIT_UTEM_GUARDSMEN, "utem_1");
    const player = createTestPlayer({
      units: [unit],
      commandTokens: 1,
    });

    const baseCombat = createCombatState([ENEMY_WOLF_RIDERS]);
    const combat = {
      ...baseCombat,
      phase: COMBAT_PHASE_BLOCK,
      enemies: baseCombat.enemies.map((enemy) => ({
        ...enemy,
        definition: {
          ...enemy.definition,
          attack: 0,
          attackElement: ELEMENT_PHYSICAL,
          attacks: [
            { damage: 3, element: ELEMENT_PHYSICAL },
            { damage: 3, element: ELEMENT_PHYSICAL },
          ],
        },
      })),
    };

    let state = createTestGameState({ players: [player], combat });

    state = engine.processAction(state, "player1", {
      type: ACTIVATE_UNIT_ACTION,
      unitInstanceId: "utem_1",
      abilityIndex: 1,
    }).state;

    state = engine.processAction(state, "player1", {
      type: ASSIGN_BLOCK_ACTION,
      enemyInstanceId: "enemy_0",
      element: ATTACK_ELEMENT_PHYSICAL,
      amount: 4,
    }).state;

    const result = engine.processAction(state, "player1", {
      type: DECLARE_BLOCK_ACTION,
      targetEnemyInstanceId: "enemy_0",
      attackIndex: 0,
    });

    const enemy = result.state.combat?.enemies[0];
    expect(enemy?.attacksBlocked).toEqual([true, false]);
    expect(enemy?.isBlocked).toBe(false);
  });
});
