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
  DECLARE_ATTACK_TARGETS_ACTION,
  FINALIZE_ATTACK_ACTION,
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

    // Declare targets in ranged/siege phase
    state = engine.processAction(state, "player1", {
      type: DECLARE_ATTACK_TARGETS_ACTION,
      targetEnemyInstanceIds: ["enemy_0"],
    }).state;

    // Resolve Axe Throw powered effect (adds ranged attack + tracker)
    const effectResult = resolveEffect(state, "player1", AXE_THROW.poweredEffect, AXE_THROW.id);
    state = effectResult.state;

    // Finalize attack (Axe Throw powered gives Ranged Attack 3, Prowlers armor 3)
    const result = engine.processAction(state, "player1", {
      type: FINALIZE_ATTACK_ACTION,
    });

    const player = result.state.players.find((p) => p.id === "player1");
    const enemyDef = getEnemy(ENEMY_PROWLERS);
    expect(player?.fame).toBe(enemyDef.fame + 1);
  });

  it("does not grant fame if no enemy is defeated", () => {
    let state = createTestGameState();

    state = engine.processAction(state, "player1", {
      type: ENTER_COMBAT_ACTION,
      enemyIds: [ENEMY_PROWLERS],
    }).state;

    // Declare targets
    state = engine.processAction(state, "player1", {
      type: DECLARE_ATTACK_TARGETS_ACTION,
      targetEnemyInstanceIds: ["enemy_0"],
    }).state;

    // Resolve Axe Throw basic effect (Ranged Attack 2, not enough for Prowlers armor 3)
    const effectResult = resolveEffect(state, "player1", AXE_THROW.basicEffect, AXE_THROW.id);
    state = effectResult.state;

    // Finalize attack (insufficient — only 2 ranged vs armor 3)
    const result = engine.processAction(state, "player1", {
      type: FINALIZE_ATTACK_ACTION,
    });

    const player = result.state.players.find((p) => p.id === "player1");
    expect(player?.fame).toBe(0);
  });
});
