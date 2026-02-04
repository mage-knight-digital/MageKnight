/**
 * Tests for Krang's Battle Rage basic action card
 */

import { describe, it, expect } from "vitest";
import { resolveEffect } from "../effects/index.js";
import { createTestGameState } from "./testHelpers.js";
import { createCombatState } from "../../types/combat.js";
import { KRANG_BATTLE_RAGE } from "../../data/basicActions/red/krang-battle-rage.js";
import { ENEMY_PROWLERS } from "@mage-knight/shared";

function createStateWithWounds(woundsThisCombat: number) {
  const combat = { ...createCombatState([ENEMY_PROWLERS]), woundsThisCombat };
  return createTestGameState({ combat });
}

describe("Battle Rage (Krang)", () => {
  it("basic effect should be Attack 2 with no wounds", () => {
    const state = createStateWithWounds(0);
    const result = resolveEffect(state, "player1", KRANG_BATTLE_RAGE.basicEffect, KRANG_BATTLE_RAGE.id);

    expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(2);
  });

  it("basic effect should cap bonus at +1", () => {
    const state = createStateWithWounds(3);
    const result = resolveEffect(state, "player1", KRANG_BATTLE_RAGE.basicEffect, KRANG_BATTLE_RAGE.id);

    expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(3);
  });

  it("powered effect should scale by wounds this combat", () => {
    const state = createStateWithWounds(2);
    const result = resolveEffect(state, "player1", KRANG_BATTLE_RAGE.poweredEffect, KRANG_BATTLE_RAGE.id);

    expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(6);
  });

  it("powered effect should cap bonus at +4", () => {
    const state = createStateWithWounds(6);
    const result = resolveEffect(state, "player1", KRANG_BATTLE_RAGE.poweredEffect, KRANG_BATTLE_RAGE.id);

    expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(8);
  });
});
