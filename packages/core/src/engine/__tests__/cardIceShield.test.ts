/**
 * Ice Shield Card Tests
 *
 * Ice Shield (Blue Advanced Action):
 * Basic: Ice Block 3
 * Powered (Blue): Ice Block 3. Reduce one enemy's Armor by 3.
 *   - Armor cannot be reduced below 1
 *   - Ice-resistant enemies are excluded from targeting
 *   - Arcane Immune enemies can be selected but modifier is blocked
 *
 * Note: When only one eligible enemy exists, the engine auto-resolves
 * the enemy selection (no pending choice created).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_ICE_SHIELD,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  ENEMY_GUARDSMEN,
  ENEMY_DIGGERS,
  ENEMY_ICE_GOLEMS,
  ENEMY_SORCERERS,
  getEnemy,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import { getEffectiveEnemyArmor } from "../modifiers/combat.js";

describe("Ice Shield", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic effect", () => {
    it("should grant Ice Block 3 with no choice presented", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
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
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Play Ice Shield basic
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: false,
      });

      // Should grant Ice Block 3 with no pending choice
      expect(result.state.players[0].combatAccumulator.blockElements.ice).toBe(3);
      expect(result.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("powered effect", () => {
    it("should grant Ice Block 3 and apply armor reduction (auto-resolved single enemy)", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Guardsmen (Armor 7, no resistances)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_GUARDSMEN).armor;
      expect(baseArmor).toBe(7);

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered — single enemy auto-resolves
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Block should be applied
      expect(state.players[0].combatAccumulator.blockElements.ice).toBe(3);

      // No pending choice (auto-resolved)
      expect(state.players[0].pendingChoice).toBeNull();

      // Armor should be reduced by 3: 7 - 3 = 4
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(4);
    });

    it("should apply armor -3 modifier to selected enemy when multiple exist", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two non-ice-resistant enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN, ENEMY_DIGGERS],
      }).state;

      const guardsmen = state.combat?.enemies[0];
      const guardsmenInstanceId = guardsmen?.instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_GUARDSMEN).armor;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered — two enemies means choice is presented
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Block should be applied immediately as first part of compound
      expect(state.players[0].combatAccumulator.blockElements.ice).toBe(3);

      // Should have pending choice with 2 enemy options
      expect(state.players[0].pendingChoice).not.toBeNull();
      expect(state.players[0].pendingChoice?.options).toHaveLength(2);

      // Select the first enemy (Guardsmen)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Verify armor was reduced by 3: 7 - 3 = 4
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        guardsmenInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(4);
    });

    it("should enforce armor floor of 1", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Armor 3, no resistances)
      // Armor 3 - 3 = 0, but should be clamped to 1
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_DIGGERS).armor;
      expect(baseArmor).toBe(3);

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered — single enemy auto-resolves
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
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

    it("should exclude ice-resistant enemies from targeting", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Guardsmen (no ice resistance) and Ice Golems (ice resistant)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN, ENEMY_ICE_GOLEMS],
      }).state;

      const guardsmenInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const iceGolemsInstanceId = state.combat?.enemies[1].instanceId ?? "";
      const guardsmenBaseArmor = getEnemy(ENEMY_GUARDSMEN).armor;
      const iceGolemsBaseArmor = getEnemy(ENEMY_ICE_GOLEMS).armor;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered — only Guardsmen eligible, auto-resolves
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // No pending choice (only 1 eligible enemy, auto-resolved)
      expect(state.players[0].pendingChoice).toBeNull();

      // Guardsmen armor should be reduced
      const guardsmenArmor = getEffectiveEnemyArmor(
        state,
        guardsmenInstanceId,
        guardsmenBaseArmor,
        0,
        "player1"
      );
      expect(guardsmenArmor).toBe(4); // 7 - 3

      // Ice Golems armor should be unchanged
      const iceGolemsArmor = getEffectiveEnemyArmor(
        state,
        iceGolemsInstanceId,
        iceGolemsBaseArmor,
        2, // Ice Golems have 2 resistances (ice + physical)
        "player1"
      );
      expect(iceGolemsArmor).toBe(iceGolemsBaseArmor); // unchanged
    });

    it("should gracefully skip armor reduction when all enemies are ice-resistant", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with only ice-resistant enemy
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEMS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      });

      // Block should still be applied
      expect(result.state.players[0].combatAccumulator.blockElements.ice).toBe(3);

      // No enemy choice should be pending (all targets excluded)
      expect(result.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow targeting arcane immune enemies but modifier is blocked", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (Armor 6, Arcane Immunity, no ice resistance)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseArmor = getEnemy(ENEMY_SORCERERS).armor;
      expect(baseArmor).toBe(6);

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered — single enemy auto-resolves
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Armor should NOT be reduced due to Arcane Immunity
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        enemyInstanceId,
        baseArmor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(6);
    });

    it("should present all non-ice-resistant enemies as choices when multiple exist", () => {
      const player = createTestPlayer({
        hand: [CARD_ICE_SHIELD],
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two non-ice-resistant enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN, ENEMY_DIGGERS],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Play Ice Shield powered
      state = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_ICE_SHIELD,
        powered: true,
        manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_BLUE }],
      }).state;

      // Should have both enemies as choices
      const options = state.players[0].pendingChoice?.options ?? [];
      expect(options).toHaveLength(2);
    });
  });
});
