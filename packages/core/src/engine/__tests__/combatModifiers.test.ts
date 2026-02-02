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
  ENEMY_ORC_SKIRMISHERS,
  COMBAT_TYPE_MELEE,
  ELEMENT_PHYSICAL,
  CARD_WHIRLWIND,
  MANA_SOURCE_TOKEN,
  MANA_BLACK,
  MANA_WHITE,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SCOPE_ALL_ENEMIES,
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

  describe("Earthquake fortification-conditional armor reduction", () => {
    it("should use fortifiedAmount when enemy has ABILITY_FORTIFIED", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3, has ABILITY_FORTIFIED)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply Earthquake modifier: amount -3, fortifiedAmount -6, minimum 1
      // Diggers have ABILITY_FORTIFIED, so should use -6
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_earthquake" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3, // Not fortified
          fortifiedAmount: -6, // Fortified
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Add skip attack so we can get to attack phase
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip to attack phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // ranged/siege
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // block
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // assign
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Diggers base armor is 3, with -6 from Earthquake = -3, minimum 1
      // So effective armor should be 1
      // Attack with 1 damage should defeat
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should use base amount when enemy does NOT have ABILITY_FORTIFIED", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Orc Skirmishers (Attack 3, Armor 3, NO abilities)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SKIRMISHERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply Earthquake modifier: amount -3, fortifiedAmount -6, minimum 1
      // Orc Skirmishers have NO fortified ability, so should use -3
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_earthquake" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3, // Not fortified
          fortifiedAmount: -6, // Fortified
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Add skip attack so we can get to attack phase
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip to attack phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // ranged/siege
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // block
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state; // assign
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Orc Skirmishers base armor is 3, with -3 from Earthquake (not fortified) = 0, minimum 1
      // So effective armor should be 1
      // Attack with 1 damage should defeat
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should apply fortifiedAmount per enemy with mixed fortification in SCOPE_ALL_ENEMIES", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with both Diggers (armor 3, fortified) and Orc Skirmishers (armor 4, not fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_ORC_SKIRMISHERS],
      }).state;

      const diggersInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const orcInstanceId = state.combat?.enemies[1].instanceId ?? "";

      // Apply Earthquake "all enemies" modifier: amount -2, fortifiedAmount -4, minimum 1
      // Diggers (fortified, armor 3) should get -4 → -1 → min 1 = 1
      // Orc Skirmishers (not fortified, armor 4) should get -2 → 2
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_earthquake" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -2, // Not fortified
          fortifiedAmount: -4, // Fortified
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Add skip attack for both enemies
      for (const enemyId of [diggersInstanceId, orcInstanceId]) {
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, skillId: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId },
          effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
          createdAtRound: state.round,
          createdByPlayerId: "player1",
        });
      }

      // Skip to attack phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Diggers: base armor 3, -4 (fortified) = -1, minimum 1 → effective armor 1
      // Attack with 1 damage should defeat
      const resultDiggers = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [diggersInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(resultDiggers.state.combat?.enemies[0].isDefeated).toBe(true);

      // Continue with updated state
      state = resultDiggers.state;

      // Orc Skirmishers: base armor 4, -2 (not fortified) = 2
      // Attack with 2 damage should defeat
      const resultOrc = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [orcInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 2 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(resultOrc.state.combat?.enemies[1].isDefeated).toBe(true);
    });

    it("should treat doubly fortified (site + ability) the same as singly fortified", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers at a fortified site
      // Diggers have ABILITY_FORTIFIED, so they're doubly fortified at a fortified site
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
        isAtFortifiedSite: true, // At a fortified site (Keep/Tower/City)
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";

      // Apply Earthquake modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_earthquake" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3,
          fortifiedAmount: -6, // Should still be -6 even though doubly fortified
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Add skip attack
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip to attack phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Doubly fortified still uses fortifiedAmount (-6), same as singly fortified
      // Base armor 3, -6 = -3, minimum 1 → effective armor 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });
});
