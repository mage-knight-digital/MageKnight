/**
 * Combat Modifiers Tests
 *
 * Tests for combat modifiers including armor modifications and fame tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  PLAY_CARD_ACTION,
  ENEMY_DIGGERS,
  COMBAT_TYPE_MELEE,
  ELEMENT_PHYSICAL,
  CARD_WHIRLWIND,
  MANA_SOURCE_TOKEN,
  MANA_BLACK,
  MANA_WHITE,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Combat Modifiers", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Armor modifiers in attack resolution", () => {
    it("should use reduced armor when attacking enemy with armor modifier", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply armor -2 modifier (simulating Tremor "all enemies -2 armor" effect)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -2,
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Also add skip attack so we can get to attack phase without dealing with damage
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Skip block phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Skip assign damage phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 1 damage - normally not enough (armor 3), but with -2 modifier = armor 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Should succeed (effective armor = 3 - 2 = 1)
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should respect minimum armor of 1 when modifier would reduce below 1", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";

      // Apply armor -4 modifier (would reduce armor 3 to -1, but minimum is 1)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -4,
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Also add skip attack so we can get to attack phase without dealing with damage
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip block phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip assign damage phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 1 damage - should work because minimum armor is 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("Fame tracking from spell defeats", () => {
    it("should track fame gained in combat.fameGained when spell defeats enemy", () => {
      // Set up combat with Diggers (2 fame)
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // We need to be in Ranged/Siege phase and have target selection
      // Whirlwind (powered) defeats target enemy
      // Give player black and white mana tokens
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1"
            ? {
                ...p,
                hand: [CARD_WHIRLWIND, ...p.hand],
                pureMana: [
                  { color: MANA_BLACK, source: "die" as const },
                  { color: MANA_WHITE, source: "die" as const },
                ],
              }
            : p
        ),
      };

      // Set the target for the spell
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              pendingTargetEnemy: "enemy_0",
            }
          : null,
      };

      // Play Whirlwind powered (requires black + white mana)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WHIRLWIND,
        powered: true,
        manaSources: [
          { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
          { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
        ],
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0]?.isDefeated).toBe(true);

      // Player should have gained fame
      expect(result.state.players[0]?.fame).toBe(2); // Diggers = 2 fame

      // combat.fameGained should also track this (this is the bug fix)
      expect(result.state.combat?.fameGained).toBe(2);
    });
  });
});
