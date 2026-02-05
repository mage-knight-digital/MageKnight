/**
 * Swift Reflexes Card Tests
 *
 * Swift Reflexes is Wolfhawk's hero-specific card (replaces Swiftness).
 * Basic: Move 2, Ranged Attack 1, OR Reduce one enemy attack by 1
 * Powered (Blue): Move 4, Ranged Attack 3, OR Reduce one enemy attack by 2
 *
 * The attack reduction option is only available during the Block phase.
 * Enemies with attack reduced to 0 are treated as "successfully blocked"
 * (they are filtered from block options as non-threatening).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  ENEMY_DIGGERS,
  ENEMY_ORC_SKIRMISHERS,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { getEffectiveEnemyAttack } from "../modifiers/combat.js";
import { getValidActions } from "../validActions/index.js";

describe("Swift Reflexes", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic card structure", () => {
    it("should have three options in basic effect", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        movePoints: 0,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat to test the card
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Swift Reflexes basic
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      });

      // Should create pending choice with 3 options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(3);
    });

    it("should have three options in powered effect", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Swift Reflexes powered
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      });

      // Should create pending choice with 3 options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(3);
    });
  });

  describe("attack reduction - basic effect", () => {
    it("should reduce enemy attack by 1 when basic attack reduction is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Verify initial effective attack
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        3
      );

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Swift Reflexes basic
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      }).state;

      // Choose attack reduction option (index 2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;

      // With only one enemy, the system might auto-select or prompt for choice
      // If there's a pending choice, resolve it
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack was reduced by 1
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        2
      );
    });
  });

  describe("attack reduction - powered effect", () => {
    it("should reduce enemy attack by 2 when powered attack reduction is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Swift Reflexes powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Choose attack reduction option (index 2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;

      // Select the target enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Verify attack was reduced by 2
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        1
      );
    });
  });

  describe("phase restriction", () => {
    it("should show attack reduction option during Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Swift Reflexes basic
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      });

      // All three options should be available in Block phase
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(3);
    });

    it("should only show Move and Ranged Attack options in Ranged/Siege phase", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat - starts in Ranged/Siege phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Play Swift Reflexes basic in Ranged/Siege phase
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      });

      // Only 2 options should be available (Move, Ranged Attack) - attack reduction is not resolvable
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should only show Move and Ranged Attack options in Attack phase", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip through to attack phase (since enemy attacks, we need to deal with block and damage)
      // Manually set phase for test simplicity
      state = {
        ...state,
        combat: state.combat ? { ...state.combat, phase: COMBAT_PHASE_ATTACK } : null,
      };
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Swift Reflexes basic in Attack phase
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      });

      // Only 2 options should be available (Move, Attack) - attack reduction is not resolvable
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });
  });

  describe("zero attack handling", () => {
    it("should reduce enemy attack to 0 when multiple reductions applied", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES, CARD_WOLFHAWK_SWIFT_REFLEXES],
        pureMana: [
          { color: MANA_BLUE, source: "die" },
          { color: MANA_BLUE, source: "die" },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with enemy that has 2 attack (Orc Skirmishers have attack 3, but let's use a lower attack for this test)
      // Diggers have Attack 3, so we need 2 powered reductions (2+2 = 4 reduction) or 3+ basic
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // First powered reduction: -2
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        1
      );

      // Second powered reduction: -2 (brings attack to -1, but min is 0)
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Attack should be clamped to 0 (minimum)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        0
      );
    });

    it("should filter enemies with 0 effective attack from block options", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES, CARD_WOLFHAWK_SWIFT_REFLEXES],
        pureMana: [
          { color: MANA_BLUE, source: "die" },
          { color: MANA_BLUE, source: "die" },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Apply two powered reductions to bring attack to 0
      // First reduction
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Second reduction
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Get valid actions - enemy with 0 attack should not appear in block options
      const validActions = getValidActions(state, "player1");

      // In block phase with 0-attack enemy, the enemy should be filtered from block targets
      // We can check that enemyBlockStates doesn't include this enemy
      expect(
        validActions.mode === "combat"
          ? (validActions.combat.enemyBlockStates?.length ?? 0)
          : 0
      ).toBe(0);
    });
  });

  describe("modifier persistence", () => {
    it("should persist attack reduction through combat phases", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Apply reduction
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Verify reduction in Block phase
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        2
      );

      // Move to next phase (skip block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Reduction should persist
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        2
      );

      // Move to attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Reduction should still persist
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        2
      );
    });
  });

  describe("multi-enemy combat", () => {
    it("should only reduce attack of the selected enemy", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_ORC_SKIRMISHERS],
      }).state;

      const enemy1InstanceId = state.combat?.enemies[0].instanceId ?? "";
      const enemy2InstanceId = state.combat?.enemies[1].instanceId ?? "";
      const enemy1BaseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      const enemy2BaseAttack = state.combat?.enemies[1].definition.attack ?? 0;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Swift Reflexes and target first enemy
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      }).state;
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      }).state;

      // Should have 2 enemy selection options
      expect(state.players[0].pendingChoice?.options).toHaveLength(2);

      // Select first enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // First enemy should have reduced attack
      expect(
        getEffectiveEnemyAttack(state, enemy1InstanceId, enemy1BaseAttack)
      ).toBe(enemy1BaseAttack - 1);

      // Second enemy should have unchanged attack
      expect(
        getEffectiveEnemyAttack(state, enemy2InstanceId, enemy2BaseAttack)
      ).toBe(enemy2BaseAttack);
    });
  });

  describe("Move and Ranged Attack options", () => {
    it("should grant Move 2 when basic Move option is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        movePoints: 0,
      });
      let state = createTestGameState({ players: [player] });

      // Play Swift Reflexes basic outside combat
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      }).state;

      // Choose Move (index 0)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      expect(state.players[0].movePoints).toBe(2);
    });

    it("should grant Move 4 when powered Move option is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        movePoints: 0,
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Play Swift Reflexes powered outside combat
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Choose Move (index 0)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      expect(state.players[0].movePoints).toBe(4);
    });

    it("should grant Ranged Attack 1 when basic Ranged Attack option is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Play Swift Reflexes in ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: false,
      }).state;

      // Choose Ranged Attack (index 1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      expect(state.players[0].combatAccumulator.attack.ranged).toBe(1);
    });

    it("should grant Ranged Attack 3 when powered Ranged Attack option is chosen", () => {
      const player = createTestPlayer({
        hand: [CARD_WOLFHAWK_SWIFT_REFLEXES],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Play Swift Reflexes powered in ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WOLFHAWK_SWIFT_REFLEXES,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Choose Ranged Attack (index 1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      expect(state.players[0].combatAccumulator.attack.ranged).toBe(3);
    });
  });
});
