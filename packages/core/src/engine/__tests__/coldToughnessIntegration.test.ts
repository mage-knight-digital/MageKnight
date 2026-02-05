/**
 * Cold Toughness Integration Tests
 *
 * Tests the full combat flow with Cold Toughness modifier active,
 * verifying that the per-enemy block bonus is correctly applied
 * during block resolution.
 *
 * Block efficiency rules (from elementalCalc.ts):
 * - Physical attack: ALL block types are efficient
 * - Fire attack: Ice and Cold Fire are efficient; Physical and Fire are halved
 * - Ice attack: Fire and Cold Fire are efficient; Physical and Ice are halved
 * - Cold Fire attack: Only Cold Fire is efficient; everything else is halved
 *
 * Cold Toughness bonus is ICE element block, so:
 * - Efficient vs Physical and Fire attacks (full value)
 * - Inefficient vs Ice and Cold Fire attacks (halved, rounded down)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  ELEMENT_PHYSICAL,
  ELEMENT_COLD_FIRE,
  ENEMY_HIGH_DRAGON,
  ENEMY_DELPHANA_MASTERS,
  ENEMY_DIGGERS,
  ENEMY_SHADOW,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_SELF,
  SOURCE_CARD,
  EFFECT_COLD_TOUGHNESS_BLOCK,
} from "../../types/modifierConstants.js";
import type { CardId } from "@mage-knight/shared";

/**
 * Helper to add Cold Toughness modifier to game state.
 */
function withColdToughnessModifier(
  state: ReturnType<typeof createTestGameState>,
  playerId: string = "player1"
) {
  return addModifier(state, {
    source: { type: SOURCE_CARD, cardId: "cold_toughness" as CardId, playerId },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_SELF },
    effect: { type: EFFECT_COLD_TOUGHNESS_BLOCK },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  });
}

describe("Cold Toughness Integration", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==========================================================================
  // Diggers: Physical attack 3, Fortified (+1 bonus)
  // All block is efficient vs Physical, so ice bonus counts at full value.
  // ==========================================================================

  describe("Diggers (Physical attack, bonus = 1)", () => {
    it("should add +1 ice bonus that is efficient vs physical attack", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // Diggers: Physical attack 3, Fortified. Bonus: 1 ice.
      // 2 physical base (efficient vs Physical) + 1 ice bonus (also efficient vs Physical) = 3.
      // Need 3. Should succeed.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 3, // 2 physical + 1 ice bonus, all efficient vs Physical
        })
      );
    });

    it("should fail without Cold Toughness modifier (2 < 3)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // No Cold Toughness modifier
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 2,
        })
      );
    });
  });

  // ==========================================================================
  // FAQ Example: High Dragon
  // Cold Fire attack 6, Brutal (+1), Fire Res (+1), Ice Res (+1), Cold Fire (+2) = 5 bonus
  // Ice block is INEFFICIENT vs Cold Fire (halved, floored)
  // ==========================================================================

  describe("High Dragon (FAQ example, Cold Fire attack)", () => {
    it("should add +5 ice bonus (halved vs Cold Fire) allowing block with Cold Fire base", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HIGH_DRAGON],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // High Dragon: Cold Fire attack 6. Bonus: 5 ice.
      // 4 cold_fire base (efficient vs Cold Fire) + 5 ice bonus (inefficient → floor(5/2) = 2).
      // Total effective = 4 + 2 = 6. Need 6. Should succeed.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 6, // 4 cold_fire (efficient) + floor(5 ice / 2) = 4 + 2 = 6
        })
      );
    });

    it("should fail without Cold Toughness (4 cold_fire < 6 required)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HIGH_DRAGON],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // No modifier
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 4,
        })
      );
    });
  });

  // ==========================================================================
  // FAQ Example: Delphana Masters
  // Cold Fire attack 5, Assassination (+1), Paralyze (+1), Fire Res (+1), Ice Res (+1),
  // Cold Fire (+2) = 6 bonus
  // ==========================================================================

  describe("Delphana Masters (FAQ example, Cold Fire attack)", () => {
    it("should add +6 ice bonus allowing block with small Cold Fire base", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DELPHANA_MASTERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // Delphana Masters: Cold Fire attack 5. Bonus: 6 ice.
      // 2 cold_fire base (efficient) + 6 ice bonus (inefficient → floor(6/2) = 3).
      // Total effective = 2 + 3 = 5. Need 5. Should succeed.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 5, // 2 cold_fire (efficient) + floor(6 ice / 2) = 2 + 3 = 5
        })
      );
    });
  });

  // ==========================================================================
  // Arcane Immunity: Shadow
  // Shadow: Elusive + Arcane Immunity, Cold Fire attack 4, no resistances
  // Arcane Immunity negates the bonus entirely.
  // ==========================================================================

  describe("Arcane Immunity negation", () => {
    it("should NOT add bonus for enemy with Arcane Immunity", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // Shadow: Cold Fire attack 4, Arcane Immunity → bonus is 0.
      // Without bonus: Shadow would have Elusive + Arcane Immunity + Cold Fire = 4 bonus.
      // But Arcane Immunity negates it entirely.
      // 3 cold_fire base (efficient vs Cold Fire) = 3 effective. Need 4. Should fail.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 3, // No bonus despite modifier being active
        })
      );
    });

    it("should block Arcane Immune enemy with sufficient base block only", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // Shadow: Cold Fire attack 4. Need 4 cold_fire block (efficient).
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 4, // No bonus, just base block
        })
      );
    });
  });

  // ==========================================================================
  // Elemental efficiency: bonus is ICE block
  // ==========================================================================

  describe("Elemental efficiency of Cold Toughness bonus", () => {
    it("ice bonus is efficient vs physical attack (all block efficient vs physical)", () => {
      let state = createTestGameState();

      // Diggers: Physical attack 3, Fortified. Bonus: 1.
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // 2 physical + 1 ice bonus. All efficient vs Physical = 3 effective. Need 3.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("ice bonus is inefficient vs cold fire attack (halved)", () => {
      let state = createTestGameState();

      // High Dragon: Cold Fire attack 6. Bonus: 5 ice.
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HIGH_DRAGON],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // 3 cold_fire base (efficient, = 3) + 5 ice bonus (inefficient, floor(5/2) = 2) = 5.
      // Need 6. Should fail (1 short because ice bonus is halved).
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 5, // 3 efficient + floor(5/2) = 5
        })
      );
    });
  });

  // ==========================================================================
  // Multiple enemies: bonus varies per enemy
  // ==========================================================================

  describe("Multiple enemies with different bonuses", () => {
    it("should calculate different bonus for each enemy", () => {
      let state = createTestGameState();

      // Enter combat with Diggers (bonus 1) and High Dragon (bonus 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_HIGH_DRAGON],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = withColdToughnessModifier(state);

      // Block Diggers (enemy_0): Physical attack 3. Bonus 1 ice (efficient vs Physical).
      // 2 physical + 1 ice bonus = 3 effective. Need 3.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ], "enemy_0");
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      expect(state.combat?.enemies[0].isBlocked).toBe(true);

      // Block High Dragon (enemy_1): Cold Fire attack 6. Bonus 5 ice (inefficient vs Cold Fire).
      // 4 cold_fire (efficient) + 5 ice bonus (floor(5/2) = 2) = 6 effective. Need 6.
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ], "enemy_1");
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_1",
      });

      expect(result.state.combat?.enemies[1].isBlocked).toBe(true);
    });
  });
});
