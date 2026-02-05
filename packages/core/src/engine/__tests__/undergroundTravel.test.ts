/**
 * Underground Travel / Underground Attack Spell Tests
 *
 * Tests for:
 * - Basic: Move 3, all terrain costs 1, no swamp/lake, no rampaging provocation
 * - Powered: Same + ignore site fortification
 * - Terrain prohibition (swamp/lake blocked)
 * - Rampaging enemy bypass (entry + provocation)
 * - Safe space validation
 * - Fortification bypass (powered)
 * - Movement entry evaluation with modifiers
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import type { CombatEnemy } from "../../types/combat.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import {
  getEffectiveTerrainCost,
  isTerrainSafe,
} from "../modifiers/terrain.js";
import { addModifier, isRuleActive } from "../modifiers/index.js";
import { evaluateMoveEntry } from "../rules/movement.js";
import { getFortificationLevel } from "../rules/combatTargeting.js";
import {
  hexKey,
  TERRAIN_PLAINS,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_DESERT,
  TERRAIN_WASTELAND,
  TIME_OF_DAY_NIGHT,
  CARD_UNDERGROUND_TRAVEL,
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
} from "@mage-knight/shared";
import type { CardId, EnemyId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_IGNORE_FORTIFICATION,
  SCOPE_SELF,
  SOURCE_CARD,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import { SiteType } from "../../types/map.js";
import { ENEMIES } from "@mage-knight/shared";

/**
 * Helper: apply Underground Travel basic modifiers
 * (all terrain cost 1 + prohibit swamp/lake + ignore rampaging)
 */
function applyUndergroundTravelBasicModifiers(baseState: GameState): GameState {
  const sourceInfo = {
    type: SOURCE_CARD as const,
    cardId: CARD_UNDERGROUND_TRAVEL as CardId,
    playerId: "player1",
  };

  let state = addModifier(baseState, {
    source: sourceInfo,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_ALL,
      amount: 0,
      minimum: 0,
      replaceCost: 1,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: sourceInfo,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_PROHIBITION,
      prohibitedTerrains: [TERRAIN_SWAMP, TERRAIN_LAKE],
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: sourceInfo,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_IGNORE_RAMPAGING_PROVOKE,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

/**
 * Helper: apply Underground Attack powered modifiers
 * (basic modifiers + ignore fortification)
 */
function applyUndergroundAttackPoweredModifiers(baseState: GameState): GameState {
  let state = applyUndergroundTravelBasicModifiers(baseState);

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_UNDERGROUND_TRAVEL as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_IGNORE_FORTIFICATION,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

/**
 * Helper: create a test CombatEnemy from an enemy ID
 */
function createTestCombatEnemy(
  enemyId: EnemyId,
  instanceId: string,
  isRequiredForConquest = true
): CombatEnemy {
  const definition = ENEMIES[enemyId];
  if (!definition) {
    throw new Error(`Unknown enemy ID: ${enemyId}`);
  }
  return {
    enemyId,
    instanceId,
    definition,
    isDefeated: false,
    isRequiredForConquest,
    pendingDamage: null,
    totalReceivedBlock: 0,
  };
}

describe("Underground Travel Spell", () => {
  describe("Basic Effect: Terrain Cost Modification", () => {
    it("should set all terrain costs to 1", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(1);
    });

    it("should set terrain costs to 1 at night", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(1);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player2")).toBe(3);
    });
  });

  describe("Basic Effect: Terrain Prohibition", () => {
    it("should prohibit swamp entry", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_SWAMP),
          },
        },
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      const swampHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", swampHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED");
    });

    it("should prohibit lake entry", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED");
    });

    it("should allow forest, hills, desert, wasteland, and plains", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_FOREST),
            [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_HILLS),
            [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_DESERT),
          },
        },
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      const forestHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      expect(evaluateMoveEntry(state, "player1", forestHex, { q: 1, r: 0 }).reason).toBeNull();
      expect(evaluateMoveEntry(state, "player1", forestHex, { q: 1, r: 0 }).cost).toBe(1);

      const hillsHex = state.map.hexes[hexKey({ q: 0, r: 1 })];
      expect(evaluateMoveEntry(state, "player1", hillsHex, { q: 0, r: 1 }).reason).toBeNull();
      expect(evaluateMoveEntry(state, "player1", hillsHex, { q: 0, r: 1 }).cost).toBe(1);
    });

    it("should allow city terrain (city terrain is not swamp)", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS, {
              type: SiteType.City,
              owner: null,
              isConquered: false,
              isBurned: false,
            }),
          },
        },
        scenarioConfig: {
          ...createTestGameState().scenarioConfig,
          citiesCanBeEntered: true,
        },
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      const cityHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", cityHex, { q: 1, r: 0 });
      expect(result.reason).not.toBe("MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED");
    });
  });

  describe("Basic Effect: Rampaging Enemy Bypass", () => {
    it("should allow entering hex with rampaging enemies", () => {
      const enemy = createHexEnemy("diggers_1" as EnemyTokenId);
      const rampagingHex = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        enemies: [enemy],
        rampagingEnemies: [enemy],
      };

      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      const hex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", hex, { q: 1, r: 0 });
      // With ignore rampaging rule, entry should NOT be blocked
      expect(result.reason).toBeNull();
      expect(result.cost).toBe(1);
    });

    it("should block rampaging entry without Underground Travel active", () => {
      const enemy = createHexEnemy("diggers_1" as EnemyTokenId);
      const rampagingHex = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        enemies: [enemy],
        rampagingEnemies: [enemy],
      };

      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      });

      const hex = baseState.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(baseState, "player1", hex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_RAMPAGING");
    });

    it("should set the RULE_IGNORE_RAMPAGING_PROVOKE rule active", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(isRuleActive(state, "player1", RULE_IGNORE_RAMPAGING_PROVOKE)).toBe(true);
    });

    it("should not set rampaging rule for other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(isRuleActive(state, "player1", RULE_IGNORE_RAMPAGING_PROVOKE)).toBe(true);
      expect(isRuleActive(state, "player2", RULE_IGNORE_RAMPAGING_PROVOKE)).toBe(false);
    });
  });

  describe("Basic Effect: Safe Space", () => {
    it("should keep swamps as safe spaces terrain-wise", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      // Swamps are naturally safe spaces, even though Underground Travel prohibits entry
      expect(isTerrainSafe(state, "player1", TERRAIN_SWAMP)).toBe(true);
    });

    it("should keep lakes as unsafe spaces", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should keep plains, forest, hills, desert as safe", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_PLAINS)).toBe(true);
      expect(isTerrainSafe(state, "player1", TERRAIN_FOREST)).toBe(true);
      expect(isTerrainSafe(state, "player1", TERRAIN_HILLS)).toBe(true);
      expect(isTerrainSafe(state, "player1", TERRAIN_DESERT)).toBe(true);
    });
  });

  describe("Powered Effect: Fortification Bypass", () => {
    it("should set the RULE_IGNORE_FORTIFICATION rule active", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundAttackPoweredModifiers(baseState);

      expect(isRuleActive(state, "player1", RULE_IGNORE_FORTIFICATION)).toBe(true);
    });

    it("should not set fortification rule for basic effect", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundTravelBasicModifiers(baseState);

      expect(isRuleActive(state, "player1", RULE_IGNORE_FORTIFICATION)).toBe(false);
    });

    it("should bypass site fortification for enemies at fortified sites", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundAttackPoweredModifiers(baseState);

      // Use Prowlers (no ABILITY_FORTIFIED) to test site-only fortification
      const enemy = createTestCombatEnemy(ENEMY_PROWLERS, "prowlers_inst_1");
      const level = getFortificationLevel(enemy, true, state, "player1");
      expect(level).toBe(0); // Site fortification ignored
    });

    it("should NOT bypass enemy ability fortification (only site)", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundAttackPoweredModifiers(baseState);

      // Diggers have ABILITY_FORTIFIED natively
      const enemy = createTestCombatEnemy(ENEMY_DIGGERS, "diggers_inst_1");
      const level = getFortificationLevel(enemy, true, state, "player1");
      // Enemy ability fortification still counts (level 1), site fortification ignored
      expect(level).toBe(1);
    });

    it("should have full site fortification without powered effect", () => {
      const baseState = createTestGameState();
      // No modifiers applied - use Prowlers (no ABILITY_FORTIFIED)

      const enemy = createTestCombatEnemy(ENEMY_PROWLERS, "prowlers_inst_1");
      const level = getFortificationLevel(enemy, true, baseState, "player1");
      expect(level).toBe(1); // Site fortification applies normally
    });

    it("should not affect other players fortification checks", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyUndergroundAttackPoweredModifiers(baseState);

      // Use Prowlers (no ABILITY_FORTIFIED)
      const enemy = createTestCombatEnemy(ENEMY_PROWLERS, "prowlers_inst_1");

      // Player 1 ignores fortification
      expect(getFortificationLevel(enemy, true, state, "player1")).toBe(0);
      // Player 2 does not
      expect(getFortificationLevel(enemy, true, state, "player2")).toBe(1);
    });
  });

  describe("Powered Effect: Movement Modifiers", () => {
    it("should have all the same modifiers as basic effect", () => {
      const baseState = createTestGameState();
      const state = applyUndergroundAttackPoweredModifiers(baseState);

      // Terrain costs 1
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(1);

      // Rampaging bypass
      expect(isRuleActive(state, "player1", RULE_IGNORE_RAMPAGING_PROVOKE)).toBe(true);

      // Swamp/lake prohibition
      const swampState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_SWAMP),
          },
        },
      });
      const poweredSwampState = applyUndergroundAttackPoweredModifiers(swampState);
      const swampHex = poweredSwampState.map.hexes[hexKey({ q: 1, r: 0 })];
      expect(evaluateMoveEntry(poweredSwampState, "player1", swampHex, { q: 1, r: 0 }).reason).toBe(
        "MOVE_ENTRY_BLOCK_TERRAIN_PROHIBITED"
      );
    });
  });

  describe("Card Definition", () => {
    it("should be registered as a green spell", () => {
      // Import the spell registry to verify registration
      const { SPELL_CARDS } = require("../../data/spells/index.js");
      const card = SPELL_CARDS[CARD_UNDERGROUND_TRAVEL];

      expect(card).toBeDefined();
      expect(card.name).toBe("Underground Travel");
      expect(card.poweredName).toBe("Underground Attack");
      expect(card.cardType).toBe("spell");
      expect(card.sidewaysValue).toBe(1);
    });

    it("should have correct categories", () => {
      const { SPELL_CARDS } = require("../../data/spells/index.js");
      const card = SPELL_CARDS[CARD_UNDERGROUND_TRAVEL];

      expect(card.categories).toEqual(["movement"]);
      expect(card.poweredEffectCategories).toEqual(["movement", "combat"]);
    });

    it("should be powered by BLACK + GREEN mana", () => {
      const { SPELL_CARDS } = require("../../data/spells/index.js");
      const card = SPELL_CARDS[CARD_UNDERGROUND_TRAVEL];

      expect(card.poweredBy).toContain("black");
      expect(card.poweredBy).toContain("green");
    });
  });
});
