/**
 * Axe Throw fame bonus tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import { resolveEffect } from "../../../effects/index.js";
import { AXE_THROW } from "../../../../data/basicActions/white/axe-throw.js";
import {
  ENTER_COMBAT_ACTION,
  ASSIGN_ATTACK_ACTION,
  END_COMBAT_PHASE_ACTION,
  ATTACK_TYPE_RANGED,
  ATTACK_ELEMENT_PHYSICAL,
  ENEMY_PROWLERS,
  getEnemy,
} from "@mage-knight/shared";

describe("Axe Throw fame bonus", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("grants fame when the tracked attack defeats an enemy", () => {
    let state = createTestGameState();

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_PROWLERS],
    }).state;

    const effectResult = resolveEffect(state, "player1", AXE_THROW.poweredEffect, AXE_THROW.id);
    state = effectResult.state;

    const enemyDef = getEnemy(ENEMY_PROWLERS);

    state = engine.processAction(state, "player1", {
      type: ASSIGN_ATTACK_ACTION,
      enemyInstanceId: "enemy_0",
      attackType: ATTACK_TYPE_RANGED,
      element: ATTACK_ELEMENT_PHYSICAL,
      amount: enemyDef.armor,
    }).state;

    const result = engine.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });

    const player = result.state.players.find((p) => p.id === "player1");
    expect(player?.fame).toBe(enemyDef.fame + 1);
  });

  it("does not grant fame if no enemy is defeated", () => {
    let state = createTestGameState();

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_PROWLERS],
    }).state;

    const effectResult = resolveEffect(state, "player1", AXE_THROW.poweredEffect, AXE_THROW.id);
    state = effectResult.state;

    state = engine.processAction(state, "player1", {
      type: ASSIGN_ATTACK_ACTION,
      enemyInstanceId: "enemy_0",
      attackType: ATTACK_TYPE_RANGED,
      element: ATTACK_ELEMENT_PHYSICAL,
      amount: 1,
    }).state;

    const result = engine.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });

    const player = result.state.players.find((p) => p.id === "player1");
    expect(player?.fame).toBe(0);
  });
});
