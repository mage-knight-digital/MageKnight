/**
 * Charm / Possess (White Spell #20) Tests
 *
 * Basic (Charm):
 * - Influence 4
 * - If during Interaction: choice between crystal (any color) or recruit discount (3)
 *
 * Powered (Possess):
 * - Select non-Arcane-Immune enemy → it does not attack
 * - Gain Attack equal to enemy's attack value (including elements)
 * - Special abilities excluded (only raw damage + element)
 * - Gained attack only targets OTHER enemies (solo → no attack gained)
 * - Arcane Immune enemies cannot be targeted
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  CARD_CHARM,
  MANA_BLACK,
  MANA_WHITE,
  MANA_SOURCE_TOKEN,
  TIME_OF_DAY_NIGHT,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMY_FIRE_DRAGON,
} from "@mage-knight/shared";
import { doesEnemyAttackThisCombat } from "../modifiers/index.js";
import { CHARM } from "../../data/spells/white/charm.js";

// Helper: create powered spell play action with manaSources for BLACK + WHITE
const playCharmPowered = {
  type: PLAY_CARD_ACTION as typeof PLAY_CARD_ACTION,
  cardId: CARD_CHARM,
  powered: true as const,
  manaSources: [
    { type: MANA_SOURCE_TOKEN as typeof MANA_SOURCE_TOKEN, color: MANA_BLACK },
    { type: MANA_SOURCE_TOKEN as typeof MANA_SOURCE_TOKEN, color: MANA_WHITE },
  ],
};

describe("Charm / Possess (White Spell #20)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Card definition", () => {
    it("should be a spell card with correct metadata", () => {
      expect(CHARM.id).toBe(CARD_CHARM);
      expect(CHARM.name).toBe("Charm");
      expect(CHARM.poweredName).toBe("Possess");
      expect(CHARM.cardType).toBe("spell");
      expect(CHARM.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
      expect(CHARM.sidewaysValue).toBe(1);
    });

    it("should have influence as basic category and combat as powered category", () => {
      expect(CHARM.categories).toEqual(["influence"]);
      expect(CHARM.poweredEffectCategories).toEqual(["combat"]);
    });
  });

  describe("Basic effect (Charm): Influence 4", () => {
    it("should grant Influence 4 when played outside interaction", () => {
      // Spells require mana of their color to cast even basic effect
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        influencePoints: 0,
        pureMana: [{ color: MANA_WHITE, source: MANA_SOURCE_TOKEN }],
      });
      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_CHARM,
        powered: false,
      });

      // Should gain 4 influence (conditional doesn't trigger outside interaction)
      expect(result.state.players[0]!.influencePoints).toBe(4);
      // No pending choice since we're not in interaction
      expect(result.state.players[0]!.pendingChoice).toBeNull();
    });
  });

  describe("Powered effect (Possess): Enemy selection", () => {
    it("should present eligible enemies as choices in combat", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      // Night time: black mana is available at night
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with two enemies (Diggers have no Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_DIGGERS],
      }).state;

      // Play Charm powered
      const result = engine.processAction(state, "player1", playCharmPowered);

      // Should have pending choice with 2 enemy options
      expect(result.state.players[0]!.pendingChoice).not.toBeNull();
      expect(result.state.players[0]!.pendingChoice?.options).toHaveLength(2);
    });

    it("should exclude Arcane Immune enemies from selection", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with Sorcerers (Arcane Immune) and Diggers (not)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS, ENEMY_DIGGERS],
      }).state;

      // Play Charm powered — only 1 eligible target (Diggers), auto-resolved
      const result = engine.processAction(state, "player1", playCharmPowered);

      // Auto-resolved: Diggers was the only valid target (Sorcerers excluded)
      // Diggers should have skip attack applied
      const diggersId = result.state.combat!.enemies[1]!.instanceId;
      expect(doesEnemyAttackThisCombat(result.state, diggersId)).toBe(false);

      // Sorcerers (Arcane Immune) should still attack normally
      const sorcerersId = result.state.combat!.enemies[0]!.instanceId;
      expect(doesEnemyAttackThisCombat(result.state, sorcerersId)).toBe(true);
    });

    it("should have no valid targets if all enemies are Arcane Immune", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with only Sorcerers (Arcane Immune)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      // Play Charm powered
      const result = engine.processAction(state, "player1", playCharmPowered);

      // No pending choice since no valid targets
      expect(result.state.players[0]!.pendingChoice).toBeNull();
    });
  });

  describe("Powered effect (Possess): Skip attack + gain attack", () => {
    it("should apply skip attack modifier to possessed enemy", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with two Diggers (Attack 3, Physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_DIGGERS],
      }).state;

      // Play Charm powered
      state = engine.processAction(state, "player1", playCharmPowered).state;

      // Select first enemy (index 0)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // The possessed enemy should not attack this combat
      const possessedEnemyId = state.combat!.enemies[0]!.instanceId;
      expect(doesEnemyAttackThisCombat(state, possessedEnemyId)).toBe(false);

      // The other enemy should still attack
      const otherEnemyId = state.combat!.enemies[1]!.instanceId;
      expect(doesEnemyAttackThisCombat(state, otherEnemyId)).toBe(true);
    });

    it("should grant Attack equal to possessed enemy's attack value", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with two Diggers (Attack 3, Physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_DIGGERS],
      }).state;

      // Play Charm powered
      state = engine.processAction(state, "player1", playCharmPowered).state;

      // Select first enemy (Diggers: Attack 3 Physical)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have gained 3 physical melee attack
      expect(state.players[0]!.combatAccumulator.attack.normal).toBe(3);
    });

    it("should grant elemental Attack matching enemy's element", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with Fire Dragon (Attack 9, Fire) + Diggers
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_DRAGON, ENEMY_DIGGERS],
      }).state;

      // Play Charm powered
      state = engine.processAction(state, "player1", playCharmPowered).state;

      // Select Fire Dragon (index 0): Attack 9 Fire
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have gained 9 fire melee attack
      expect(
        state.players[0]!.combatAccumulator.attack.normalElements.fire,
      ).toBe(9);
    });
  });

  describe("Powered effect (Possess): Solo enemy — no attack gained", () => {
    it("should skip attack only (no attack gained) when possessing the only enemy", () => {
      const player = createTestPlayer({
        hand: [CARD_CHARM],
        pureMana: [
          { color: MANA_BLACK, source: MANA_SOURCE_TOKEN },
          { color: MANA_WHITE, source: MANA_SOURCE_TOKEN },
        ],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Enter combat with single Diggers (Attack 3, Physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Play Charm powered
      state = engine.processAction(state, "player1", playCharmPowered).state;

      // Select the only enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skip attack should still apply
      const enemyId = state.combat!.enemies[0]!.instanceId;
      expect(doesEnemyAttackThisCombat(state, enemyId)).toBe(false);

      // But no attack should be gained (no other targets)
      expect(state.players[0]!.combatAccumulator.attack.normal).toBe(0);
    });
  });
});
