/**
 * Scouts Unit Ability Tests
 *
 * Scouts have three abilities:
 * 1. Siege Attack 1 (free) - basic siege combat
 * 2. Scout (free) - Reveal face-down tokens within 3 spaces. +1 Fame if defeated this turn.
 * 3. Move 2 (free) - May reveal a new tile at distance 2 instead of 1.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  UNIT_SCOUTS,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  UNIT_ABILITY_SIEGE_ATTACK,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import { SCOUTS } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import type { HexState } from "../../types/map.js";
import type { EnemyTokenId, EnemyColor } from "../../types/enemy.js";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";
import { ENEMY_GUARDSMEN, getEnemy } from "@mage-knight/shared";
import { EFFECT_SCOUT_FAME_BONUS, RULE_EXTENDED_EXPLORE } from "../../types/modifierConstants.js";
import { isRuleActive } from "../modifiers/index.js";
import { resolveScoutFameBonus } from "../combat/scoutFameTracking.js";

/**
 * Create a combat state for Scouts tests
 */
function createScoutsCombatState(
  phase: "ranged_siege" | "attack",
  enemies: CombatEnemy[],
  isAtFortifiedSite = false
): CombatState {
  return {
    enemies,
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin: null,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
    pendingSwiftBlock: {},
    combatContext: COMBAT_CONTEXT_STANDARD,
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
    paidHeroesAssaultInfluence: false,
    vampiricArmorBonus: {},
  };
}

/**
 * Create a combat enemy from an enemy ID
 */
function createCombatEnemy(instanceId: string, enemyId: string): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isBlocked: false,
    isDefeated: false,
    isRequiredForConquest: true,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
  };
}

/**
 * Create a hex with unrevealed enemies
 */
function createHexWithEnemies(
  q: number,
  r: number,
  enemies: Array<{ tokenId: string; color: EnemyColor; isRevealed: boolean }>
): HexState {
  const hex = createTestHex(q, r, TERRAIN_PLAINS);
  return {
    ...hex,
    enemies: enemies.map((e) => ({
      tokenId: e.tokenId as EnemyTokenId,
      color: e.color,
      isRevealed: e.isRevealed,
    })),
  };
}

describe("Scouts Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(SCOUTS.name).toBe("Scouts");
      expect(SCOUTS.level).toBe(1);
      expect(SCOUTS.influence).toBe(4);
      expect(SCOUTS.armor).toBe(2);
    });

    it("should have three abilities", () => {
      expect(SCOUTS.abilities.length).toBe(3);
    });

    it("should have Siege Attack 1 as first ability", () => {
      const ability = SCOUTS.abilities[0];
      expect(ability?.type).toBe(UNIT_ABILITY_SIEGE_ATTACK);
      if (ability?.type === UNIT_ABILITY_SIEGE_ATTACK) {
        expect(ability.value).toBe(1);
        expect(ability.element).toBe(ELEMENT_PHYSICAL);
      }
    });

    it("should have Scout peek as second ability (free, non-combat)", () => {
      const ability = SCOUTS.abilities[1];
      expect(ability?.type).toBe("effect");
      if (ability?.type === "effect") {
        expect(ability.effectId).toBe("scouts_scout_peek");
        expect(ability.requiresCombat).toBe(false);
        expect(ability.manaCost).toBeUndefined();
      }
    });

    it("should have Extended Move as third ability (free, non-combat)", () => {
      const ability = SCOUTS.abilities[2];
      expect(ability?.type).toBe("effect");
      if (ability?.type === "effect") {
        expect(ability.effectId).toBe("scouts_extended_move");
        expect(ability.requiresCombat).toBe(false);
        expect(ability.manaCost).toBeUndefined();
      }
    });

    it("should be recruitable at all site types", () => {
      expect(SCOUTS.recruitSites).toContain("village");
      expect(SCOUTS.recruitSites).toContain("keep");
      expect(SCOUTS.recruitSites).toContain("mage_tower");
      expect(SCOUTS.recruitSites).toContain("monastery");
      expect(SCOUTS.recruitSites).toContain("city");
    });
  });

  describe("Siege Attack 1", () => {
    it("should grant 1 siege attack in ranged/siege phase", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createScoutsCombatState(
          COMBAT_PHASE_RANGED_SIEGE,
          [createCombatEnemy("enemy_1", ENEMY_GUARDSMEN)],
          true // fortified site needed for siege
        ),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 0, // Siege Attack 1
      });

      // Should add 1 to siege attack accumulator
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(1);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_SIEGE_ATTACK);
        expect(activateEvent.abilityValue).toBe(1);
      }
    });

    it("should grant 1 siege attack in attack phase", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createScoutsCombatState(
          COMBAT_PHASE_ATTACK,
          [createCombatEnemy("enemy_1", ENEMY_GUARDSMEN)]
        ),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 0, // Siege Attack 1
      });

      // Siege attack in attack phase contributes to normal attack
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(1);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Scout Peek Ability", () => {
    it("should reveal unrevealed enemies within 3 hexes", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Create map with unrevealed enemies within 3 hexes
      // Token IDs use "enemyId_counter" format (e.g., "guardsmen_1")
      const hexes: Record<string, HexState> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS), // Player here
        [hexKey({ q: 1, r: 0 })]: createHexWithEnemies(1, 0, [
          { tokenId: "guardsmen_1", color: "green", isRevealed: false },
        ]),
        [hexKey({ q: 2, r: 0 })]: createHexWithEnemies(2, 0, [
          { tokenId: "golems_1", color: "red", isRevealed: false },
        ]),
      };

      const state = createTestGameState({
        players: [player],
        combat: null,
        map: { hexes } as never,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 1, // Scout peek
      });

      // Unit should be spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Enemies should be revealed
      const hex1 = result.state.map.hexes[hexKey({ q: 1, r: 0 })];
      expect(hex1?.enemies[0]?.isRevealed).toBe(true);

      const hex2 = result.state.map.hexes[hexKey({ q: 2, r: 0 })];
      expect(hex2?.enemies[0]?.isRevealed).toBe(true);
    });

    it("should not reveal enemies beyond 3 hexes", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Create map with an enemy at distance 4 (beyond range)
      const hexes: Record<string, HexState> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
        [hexKey({ q: 3, r: 0 })]: createTestHex(3, 0, TERRAIN_PLAINS),
        [hexKey({ q: 4, r: 0 })]: createHexWithEnemies(4, 0, [
          { tokenId: "guardsmen_99", color: "green", isRevealed: false },
        ]),
      };

      const state = createTestGameState({
        players: [player],
        combat: null,
        map: { hexes } as never,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 1, // Scout peek
      });

      // Enemy at distance 4 should NOT be revealed
      const farHex = result.state.map.hexes[hexKey({ q: 4, r: 0 })];
      expect(farHex?.enemies[0]?.isRevealed).toBe(false);
    });

    it("should skip already revealed enemies", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const hexes: Record<string, HexState> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createHexWithEnemies(1, 0, [
          { tokenId: "guardsmen_1", color: "green", isRevealed: true }, // Already revealed
        ]),
      };

      const state = createTestGameState({
        players: [player],
        combat: null,
        map: { hexes } as never,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 1, // Scout peek
      });

      // Unit should still be spent even if nothing to reveal
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should create ScoutFameBonus modifier for revealed enemies", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const hexes: Record<string, HexState> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createHexWithEnemies(1, 0, [
          { tokenId: "guardsmen_1", color: "green", isRevealed: false },
        ]),
      };

      const state = createTestGameState({
        players: [player],
        combat: null,
        map: { hexes } as never,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 1, // Scout peek
      });

      // Should have a ScoutFameBonus modifier tracking the enemyId (not tokenId)
      const scoutModifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_SCOUT_FAME_BONUS
      );
      expect(scoutModifier).toBeDefined();
      if (scoutModifier?.effect.type === EFFECT_SCOUT_FAME_BONUS) {
        // getEnemyIdFromToken("guardsmen_1") -> "guardsmen"
        expect(scoutModifier.effect.revealedEnemyIds).toContain("guardsmen");
        expect(scoutModifier.effect.fame).toBe(1);
      }
    });

    it("should work outside combat (non-combat ability)", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 1, // Scout peek
      });

      // Should succeed outside combat
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Scout Fame Bonus Tracking", () => {
    it("should grant +1 fame when a scouted enemy is defeated", () => {
      // Simulate having a ScoutFameBonus modifier with revealed enemies.
      // The modifier tracks enemyId (definition ID like "guardsmen"),
      // and combat end passes defeated CombatEnemy.enemyId values.
      const baseState = createTestGameState();

      const stateWithModifier: typeof baseState = {
        ...baseState,
        activeModifiers: [
          {
            id: "mod_1",
            source: { type: "unit" as const, unitIndex: 0, playerId: "player1" },
            duration: "turn" as const,
            scope: { type: "self" as const },
            effect: {
              type: EFFECT_SCOUT_FAME_BONUS,
              revealedEnemyIds: [ENEMY_GUARDSMEN],
              fame: 1,
            },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      };

      const result = resolveScoutFameBonus(
        stateWithModifier,
        "player1",
        [ENEMY_GUARDSMEN] // Defeated enemy's definition ID
      );

      expect(result.fameToGain).toBe(1);
      // Modifier should be consumed (removed)
      const remainingMod = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_SCOUT_FAME_BONUS
      );
      expect(remainingMod).toBeUndefined();
    });

    it("should not grant fame when no scouted enemies are defeated", () => {
      const baseState = createTestGameState();

      const stateWithModifier: typeof baseState = {
        ...baseState,
        activeModifiers: [
          {
            id: "mod_1",
            source: { type: "unit" as const, unitIndex: 0, playerId: "player1" },
            duration: "turn" as const,
            scope: { type: "self" as const },
            effect: {
              type: EFFECT_SCOUT_FAME_BONUS,
              revealedEnemyIds: [ENEMY_GUARDSMEN],
              fame: 1,
            },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      };

      // Defeat a different enemy type (not in the revealed list)
      const result = resolveScoutFameBonus(
        stateWithModifier,
        "player1",
        ["golems"] // Different enemy type
      );

      expect(result.fameToGain).toBe(0);
      // Modifier should still be present
      const remainingMod = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_SCOUT_FAME_BONUS
      );
      expect(remainingMod).toBeDefined();
    });

    it("should grant fame per scouted enemy defeated", () => {
      const baseState = createTestGameState();

      const stateWithModifier: typeof baseState = {
        ...baseState,
        activeModifiers: [
          {
            id: "mod_1",
            source: { type: "unit" as const, unitIndex: 0, playerId: "player1" },
            duration: "turn" as const,
            scope: { type: "self" as const },
            effect: {
              type: EFFECT_SCOUT_FAME_BONUS,
              revealedEnemyIds: [ENEMY_GUARDSMEN, "golems", "diggers"],
              fame: 1,
            },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      };

      // Defeat 2 of the 3 scouted enemy types
      const result = resolveScoutFameBonus(
        stateWithModifier,
        "player1",
        [ENEMY_GUARDSMEN, "diggers"]
      );

      expect(result.fameToGain).toBe(2);
    });

    it("should return zero fame when no enemies defeated at all", () => {
      const baseState = createTestGameState();

      const result = resolveScoutFameBonus(
        baseState,
        "player1",
        [] // No enemies defeated
      );

      expect(result.fameToGain).toBe(0);
    });
  });

  describe("Extended Move Ability", () => {
    it("should grant Move 2 points", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 2, // Extended Move
      });

      expect(result.state.players[0].movePoints).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should apply RULE_EXTENDED_EXPLORE modifier", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 2, // Extended Move
      });

      // Should have the extended explore rule active
      expect(
        isRuleActive(result.state, "player1", RULE_EXTENDED_EXPLORE)
      ).toBe(true);
    });

    it("should work outside combat (non-combat ability)", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 2, // Extended Move
      });

      // Should succeed outside combat
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].movePoints).toBe(2);
    });

    it("should add to existing move points", () => {
      const unit = createPlayerUnit(UNIT_SCOUTS, "scouts_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 3, // Already have 3 move points
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "scouts_1",
        abilityIndex: 2, // Extended Move
      });

      // Should have 3 + 2 = 5 move points
      expect(result.state.players[0].movePoints).toBe(5);
    });
  });
});
