/**
 * Arcane Immunity Tests
 *
 * Tests for the Arcane Immunity enemy ability (Issue #242):
 * - Defeat effects (instant kill) are blocked by Arcane Immunity
 * - Skip attack effects are blocked by Arcane Immunity
 * - Shadow enemy has Arcane Immunity assigned
 * - Arcane Immunity does NOT propagate to grouped enemies
 * - Attack/Block effects work normally (not blocked)
 *
 * Note: Modifier blocking (armor reduction, resistance removal, ability nullification)
 * is already tested in exposeSpell.test.ts.
 *
 * Arcane Immunity: Enemy is not affected by non-Attack/non-Block effects from any source.
 * Magic does not touch them.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  DECLARE_BLOCK_ACTION,
  ENEMY_SORCERERS,
  ENEMY_DIGGERS,
  ENEMY_SHADOW,
  ELEMENT_PHYSICAL,
  CARD_WHIRLWIND,
  MANA_SOURCE_TOKEN,
  MANA_BLACK,
  MANA_WHITE,
  ABILITY_ARCANE_IMMUNITY,
  getEnemy,
} from "@mage-knight/shared";
import {
  addModifier,
  doesEnemyAttackThisCombat,
} from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SCOPE_ALL_ENEMIES,
  SOURCE_SKILL,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";

describe("Arcane Immunity", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Enemy definitions", () => {
    it("should have Arcane Immunity on Sorcerers", () => {
      const sorcerers = getEnemy(ENEMY_SORCERERS);
      expect(sorcerers.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
    });

    it("should have Arcane Immunity on Shadow", () => {
      const shadow = getEnemy(ENEMY_SHADOW);
      expect(shadow.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
    });

    it("should NOT have Arcane Immunity on Diggers", () => {
      const diggers = getEnemy(ENEMY_DIGGERS);
      expect(diggers.abilities).not.toContain(ABILITY_ARCANE_IMMUNITY);
    });
  });

  describe("Defeat effects (blocked by Arcane Immunity)", () => {
    it("should block Tornado (powered Whirlwind) defeat effect on Sorcerers", () => {
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        pureMana: [
          { color: MANA_BLACK, source: "die" as const },
          { color: MANA_WHITE, source: "die" as const },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Add mana tokens to player
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1"
            ? {
                ...p,
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

      // Play Whirlwind powered (Tornado) - should be blocked by Arcane Immunity
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WHIRLWIND,
        powered: true,
        manaSources: [
          { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
          { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
        ],
      });

      // Enemy should NOT be defeated (Arcane Immunity blocks defeat)
      expect(result.state.combat?.enemies[0]?.isDefeated).toBe(false);

      // Player should NOT have gained fame
      expect(result.state.players[0]?.fame).toBe(0);
    });

    it("should allow Tornado defeat effect on non-immune enemy (Diggers)", () => {
      const player = createTestPlayer({
        hand: [CARD_WHIRLWIND],
        pureMana: [
          { color: MANA_BLACK, source: "die" as const },
          { color: MANA_WHITE, source: "die" as const },
        ],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (no Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Add mana tokens to player
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1"
            ? {
                ...p,
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

      // Play Whirlwind powered (Tornado) - should work on non-immune enemy
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

      // Player should have gained fame (Diggers = 2 fame)
      expect(result.state.players[0]?.fame).toBe(2);
    });
  });

  describe("Skip attack modifier (blocked by Arcane Immunity)", () => {
    it("should block skip attack modifier on Arcane Immune enemy", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Add skip attack modifier (simulating Whirlwind basic effect)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Check that the enemy still attacks (modifier is blocked)
      // The doesEnemyAttackThisCombat function should return true for Arcane Immune enemies
      // because the skip attack modifier is blocked
      expect(doesEnemyAttackThisCombat(state, enemyInstanceId)).toBe(true);
    });

    it("should allow skip attack modifier on non-immune enemy", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (no Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Add skip attack modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Check that the enemy does NOT attack (modifier works)
      expect(doesEnemyAttackThisCombat(state, enemyInstanceId)).toBe(false);
    });
  });

  describe("Non-propagation to grouped enemies", () => {
    it("should NOT propagate Arcane Immunity to other enemies in combat", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with both Sorcerers (immune) and Diggers (not immune)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS, ENEMY_DIGGERS],
      }).state;

      expect(state.combat?.enemies).toHaveLength(2);

      const sorcerersInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const diggersInstanceId = state.combat?.enemies[1].instanceId ?? "";

      // Add skip attack modifier to ALL enemies
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Check each enemy individually
      // Sorcerers (immune) - should still attack (modifier blocked)
      expect(doesEnemyAttackThisCombat(state, sorcerersInstanceId)).toBe(true);

      // Diggers (not immune) - should NOT attack (modifier works)
      expect(doesEnemyAttackThisCombat(state, diggersInstanceId)).toBe(false);
    });
  });

  describe("Block effects (NOT blocked by Arcane Immunity)", () => {
    it("should allow blocking attacks from Arcane Immune enemy", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity, attack 6)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Add block points (Sorcerers attack 6, but no Swift so we need 6 block)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 6 },
      ]);

      // Declare block
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should successfully block (Arcane Immunity doesn't block Block points)
      expect(result.state.combat?.enemies[0]?.isBlocked).toBe(true);
    });
  });
});
