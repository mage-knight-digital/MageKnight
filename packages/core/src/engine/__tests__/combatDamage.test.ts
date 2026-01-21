/**
 * Combat Damage Tests
 *
 * Tests for damage assignment, mandatory damage, and knockout tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  DAMAGE_ASSIGNED,
  ENEMY_ORC,
  ENEMY_PROWLERS,
  ENEMY_CURSED_HAGS,
  COMBAT_TYPE_RANGED,
  CARD_WOUND,
  CARD_MARCH,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Combat Damage", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Damage assignment", () => {
    it("should assign wounds to hero from unblocked enemy", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH], // Need a card to avoid mandatory announcement
        handLimit: 5,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Orc (attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // 3 damage / 2 armor = 2 wounds (rounded up)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 3,
          woundsTaken: 2,
        })
      );
      // Wounds added to hand
      expect(result.state.players[0].hand).toContain(CARD_WOUND);
      expect(
        result.state.players[0].hand.filter((c) => c === CARD_WOUND)
      ).toHaveLength(2);
    });

    it("should not assign damage from blocked enemy", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block the enemy
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to assign damage from blocked enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Enemy is blocked, no damage to assign",
        })
      );
    });
  });

  describe("Mandatory damage assignment", () => {
    it("should require damage assignment before leaving Assign Damage phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to skip Assign Damage without assigning
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("Must assign damage"),
        })
      );
    });

    it("should allow leaving Assign Damage phase after assigning damage", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH], // Need a card to avoid mandatory announcement
        handLimit: 5,
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from unblocked enemy
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // Now we can advance to Attack phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });

    it("should allow skipping Assign Damage phase when enemy is blocked", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - should be able to skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });

    it("should allow skipping Assign Damage phase when enemy is defeated", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified) to allow ranged attack
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Defeat enemy in Ranged/Siege phase
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      expect(state.combat?.enemies[0].isDefeated).toBe(true);

      // Ranged/Siege → Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Block → Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign Damage → Attack (should succeed because enemy is defeated, no damage to assign)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });

  describe("Knockout tracking with poison", () => {
    it("should only count hand wounds for knockout, not discard wounds from poison", () => {
      // Player with hand limit 5 and armor 2
      // Cursed Hags attack 3 with poison -> 2 wounds to hand (3/2 rounded up)
      // Poison adds 2 more wounds to discard
      // Total wounds = 2 to hand, 2 to discard
      // woundsThisCombat should be 2, NOT 4
      // Player should NOT be knocked out (2 < 5)
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Cursed Hags (attack 3, poison)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_CURSED_HAGS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from poison enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Should have 2 wounds to hand (attack 3 / armor 2 = 2)
      const player1 = result.state.players[0];
      const handWounds = player1.hand.filter((c) => c === CARD_WOUND).length;
      expect(handWounds).toBe(2);

      // Should have 2 wounds to discard (poison doubles wounds)
      const discardWounds = player1.discard.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(discardWounds).toBe(2);

      // Combat should track only 2 wounds (hand wounds only)
      expect(result.state.combat?.woundsThisCombat).toBe(2);

      // Player should NOT be knocked out (2 < 5)
      expect(player1.knockedOut).toBe(false);
    });

    it("should knock out player when hand wounds reach hand limit, ignoring poison discard wounds", () => {
      // Player with hand limit 3 and armor 1
      // Cursed Hags attack 3 with poison -> 3 wounds to hand (3/1 = 3)
      // Poison adds 3 more wounds to discard
      // woundsThisCombat should be 3 (not 6)
      // Player SHOULD be knocked out (3 >= 3)
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 3,
        armor: 1,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Cursed Hags (attack 3, poison)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_CURSED_HAGS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from poison enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Combat should track 3 wounds (hand wounds only)
      expect(result.state.combat?.woundsThisCombat).toBe(3);

      // Player SHOULD be knocked out (3 >= 3 hand limit)
      const player1 = result.state.players[0];
      expect(player1.knockedOut).toBe(true);
    });
  });
});
