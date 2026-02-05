/**
 * Utem Crossbowmen Unit Ability Tests
 *
 * Utem Crossbowmen have two abilities:
 * 1. Attack 3 OR Block 3 - choice ability (free, physical)
 * 2. Ranged Attack 2 (free, physical)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  UNIT_UTEM_CROSSBOWMEN,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  ENEMY_GUARDSMEN,
  getEnemy,
  UTEM_CROSSBOWMEN,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";

/**
 * Create a combat state with customizable enemies for Crossbowmen tests
 */
function createCrossbowmenCombatState(
  phase: "ranged_siege" | "attack",
  enemies: CombatEnemy[],
): CombatState {
  return {
    enemies,
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite: false,
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

describe("Utem Crossbowmen Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(UTEM_CROSSBOWMEN.name).toBe("Utem Crossbowmen");
      expect(UTEM_CROSSBOWMEN.level).toBe(2);
      expect(UTEM_CROSSBOWMEN.influence).toBe(6);
      expect(UTEM_CROSSBOWMEN.armor).toBe(4);
    });

    it("should have two abilities", () => {
      expect(UTEM_CROSSBOWMEN.abilities.length).toBe(2);
    });

    it("should have Attack 3 OR Block 3 as first ability (effect-based choice)", () => {
      const ability = UTEM_CROSSBOWMEN.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Attack");
      expect(ability?.displayName).toContain("Block");
    });

    it("should have Ranged Attack 2 as second ability", () => {
      const ability = UTEM_CROSSBOWMEN.abilities[1];
      expect(ability?.type).toBe("ranged_attack");
      expect(ability?.value).toBe(2);
    });
  });

  describe("Attack OR Block 3 (Ability 0)", () => {
    it("should present choice between Attack 3 and Block 3", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 0,
      });

      // Should create a pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should grant Attack 3 when attack option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 0,
      });

      // Step 2: Choose attack option (index 0)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        },
      );

      // Verify Attack 3 was added (physical = normal attack)
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normal,
      ).toBe(3);

      // Verify unit is spent
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
    });

    it("should grant Block 3 when block option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 0,
      });

      // Step 2: Choose block option (index 1)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1,
        },
      );

      // Verify Block 3 was added (physical = normal block)
      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(3);

      // Verify unit is spent
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
    });

    it("should not require mana for choice ability", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 0,
      });

      // Should succeed and create a choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });
  });

  describe("Ranged Attack 2 (Ability 1)", () => {
    it("should add Ranged Attack 2 in ranged & siege phase", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(
          COMBAT_PHASE_RANGED_SIEGE,
          enemies,
        ),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should add Ranged Attack 2 in attack phase", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCrossbowmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });
});
