/**
 * Shield Bash Card Tests
 *
 * Shield Bash (Blue Advanced Action):
 * Basic: Block 3. Counts twice against an attack with Swiftness.
 * Powered (Blue): Block 5. Counts twice against an attack with Swiftness.
 *   Blocked enemy gets Armor -1 for each point of block higher than needed
 *   (to a minimum of 1).
 *
 * Key mechanics:
 * - Block counts twice vs Swiftness (via swiftBlockElements in accumulator)
 * - Powered: excess undoubled block reduces enemy Armor
 * - Ice Resistant enemies immune to armor reduction (blue card)
 * - Cannot reduce Summoner armor via summoned monster
 * - Armor reduction calculated per individual blocked attack
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer } from "./testHelpers.js";
import { createTestGameState } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  ASSIGN_BLOCK_ACTION,
  DECLARE_BLOCK_ACTION,
  CARD_SHIELD_BASH,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  ENEMY_WOLF_RIDERS,
  ENEMY_GUARDSMEN,
  ENEMY_DIGGERS,
  ENEMY_ICE_GOLEMS,
  getEnemy,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import { getEffectiveEnemyArmor } from "../modifiers/combat.js";

describe("Shield Bash", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic effect", () => {
    it("should grant Block 3", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Guardsmen
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Shield Bash basic
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: false,
      });

      // Should grant Block 3
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].combatAccumulator.blockElements.physical).toBe(3);
      expect(result.state.players[0].pendingChoice).toBeNull();
    });

    it("should track block in swiftBlockElements for Swiftness doubling", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: false,
      }).state;

      // Should be tracked in swiftBlockElements
      expect(state.players[0].combatAccumulator.swiftBlockElements.physical).toBe(3);
    });

    it("should block Swift enemy with doubled block value", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
      });
      let state = createTestGameState({ players: [player] });

      // Wolf Riders: Attack 3, Swift, Armor 4
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash basic (Block 3, counts twice = effective 6 vs Swift)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: false,
      }).state;

      // Assign all block to wolf riders
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;

      // Declare block — Wolf Riders need 6 (3×2), Shield Bash provides 3×2 = 6
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      });

      // Block should succeed
      const enemy = result.state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(true);
    });

    it("should not grant armor reduction on basic effect", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
      });
      let state = createTestGameState({ players: [player] });

      // Diggers: Attack 2, Armor 3, no resistances
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_DIGGERS).armor;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash basic (Block 3)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: false,
      }).state;

      // Assign block and declare
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;

      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Armor should NOT be reduced (basic effect)
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(baseArmor);
    });
  });

  describe("powered effect", () => {
    it("should grant Block 5 and track in swiftBlockElements", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Should grant Block 5 with swift tracking
      expect(state.players[0].combatAccumulator.block).toBe(5);
      expect(state.players[0].combatAccumulator.blockElements.physical).toBe(5);
      expect(state.players[0].combatAccumulator.swiftBlockElements.physical).toBe(5);
    });

    it("should apply armor reduction for excess block on successful block", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Diggers: Attack 2, Armor 3
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_DIGGERS).armor;
      expect(baseArmor).toBe(3);

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign 2 block (enough to block Diggers attack 2)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;

      // Declare block — excess = 0 (assigned exactly 2, needed 2)
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // No excess block, no armor reduction
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(3);
    });

    it("should reduce armor by excess undoubled block points", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Diggers: Attack 2, Armor 3
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_DIGGERS).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign 5 block (3 excess over attack 2)
      for (let i = 0; i < 5; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      // Declare block — excess = 5 - 2 = 3
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Armor should be reduced by 3: 3 - 3 = 0, clamped to minimum 1
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(1);
    });

    it("should calculate excess using undoubled block vs Swift enemy (Vlaada O3)", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Wolf Riders: Attack 3, Swift, Armor 4
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_WOLF_RIDERS).armor;
      expect(baseArmor).toBe(4);

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5, counts twice vs Swift = effective 10)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign all 5 block to Wolf Riders
      for (let i = 0; i < 5; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      // Declare block
      // Wolf Riders need 6 doubled block (3×2), Shield Bash provides 5×2 = 10
      // Block succeeds: 10 >= 6
      // Undoubled excess: 5 (undoubled block) - 3 (undoubled attack) = 2
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Enemy should be blocked
      const enemy = state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(true);

      // Armor reduction: 2 (excess undoubled)
      // Effective armor: 4 - 2 = 2
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(2);
    });

    it("should enforce minimum armor of 1", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Diggers: Attack 2, Armor 3
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_DIGGERS).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign all 5 block (excess = 5 - 2 = 3, armor 3 - 3 = 0 → clamped to 1)
      for (let i = 0; i < 5; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Armor should be clamped to 1 (not 0)
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(1);
    });

    it("should NOT apply armor reduction to Ice Resistant enemies (S7)", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Ice Golems: Attack 2 (Ice), Armor 4, Ice + Physical Resistance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEMS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_ICE_GOLEMS).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign block to Ice Golems
      // Ice Golems attack is 2 (Ice element), physical block is inefficient
      // Need 4 physical block (2 inefficient halved = 1 per 2)
      // Actually, physical block vs ice attack is INefficient.
      // 5 physical vs Ice: floor(5/2) = 2, which equals attack 2. Enough to block.
      for (let i = 0; i < 5; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Block should succeed (5 physical vs Ice attack 2: floor(5/2) = 2 >= 2)
      const enemy = state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(true);

      // Armor should NOT be reduced (Ice Resistant = immune to Shield Bash armor reduction)
      const resistanceCount = getEnemy(ENEMY_ICE_GOLEMS).resistances.length;
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        resistanceCount,
        "player1"
      );
      expect(effectiveArmor).toBe(baseArmor);
    });

    it("should block Swift enemy with Shield Bash powered and calculate correct Vlaada example", () => {
      // Vlaada's Example: Shield Bash Block 5 × 2 = 10 vs Wolf Riders Attack 3 Swift
      // Need 6 doubled block (3 × 2), use 6 of 10 doubled
      // Excess: 4 doubled = 2 undoubled
      // Armor reduction: 2
      // This is tested by the O3 test above, but let's verify 3 block assigned also works

      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Wolf Riders: Attack 3, Swift, Armor 4
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_WOLF_RIDERS).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign only 3 block (just enough: 3×2 = 6 = 3×2 required)
      for (let i = 0; i < 3; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Block succeeds (3×2 = 6 >= 6)
      const enemy = state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(true);

      // Excess: 3 (undoubled) - 3 (undoubled attack) = 0, no armor reduction
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(4); // No reduction
    });
  });

  describe("edge cases", () => {
    it("should not apply armor reduction when block fails", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Guardsmen: Attack 3, Armor 7
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_GUARDSMEN).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign only 2 block (not enough for Guardsmen attack 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_BLOCK_ACTION,
        enemyInstanceId,
        element: "physical",
        amount: 1,
      }).state;

      // Declare block — should fail (2 < 3)
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Block should fail
      const enemy = state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(false);

      // No armor reduction on failed block
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(baseArmor);
    });

    it("should work with Guardsmen (non-Swift) - no doubling needed", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Guardsmen: Attack 3, Armor 7
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_GUARDSMEN).armor;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Shield Bash powered (Block 5)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SHIELD_BASH,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Assign 5 block
      for (let i = 0; i < 5; i++) {
        state = engine.processAction(state, "player1", {
          type: ASSIGN_BLOCK_ACTION,
          enemyInstanceId,
          element: "physical",
          amount: 1,
        }).state;
      }

      // Declare block (5 >= 3, succeeds)
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: enemyInstanceId,
      }).state;

      // Block succeeds
      const enemy = state.combat?.enemies.find(
        (e) => e.instanceId === enemyInstanceId
      );
      expect(enemy?.isBlocked).toBe(true);

      // Excess = 5 - 3 = 2, armor 7 - 2 = 5
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(5);
    });
  });
});
