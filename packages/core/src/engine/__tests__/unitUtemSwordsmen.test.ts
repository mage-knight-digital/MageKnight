/**
 * Utem Swordsmen Unit Ability Tests
 *
 * Utem Swordsmen have two abilities:
 * 1. Attack 3 OR Block 3 - choice ability (free, physical)
 * 2. Attack 6 OR Block 6 - choice ability (free, physical) — this unit becomes wounded
 *
 * The self-wound on ability 2 is NOT combat damage:
 * - Does NOT trigger Paralyze (instant-kill)
 * - Does NOT trigger Vampiric (armor increase)
 * - Does NOT trigger Poison (extra wounds)
 * - Adds exactly 1 wound (sets unit.wounded = true)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  UNIT_UTEM_SWORDSMEN,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  ENEMY_GUARDSMEN,
  ENEMY_MEDUSA,
  ENEMY_SWAMP_DRAGON,
  ENEMY_MONKS,
  getEnemy,
  UTEM_SWORDSMEN,
  UNIT_ABILITY_EFFECT,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";

/**
 * Create a combat state with customizable enemies for Swordsmen tests
 */
function createSwordsmenCombatState(
  phase: "attack" | "block",
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

describe("Utem Swordsmen Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(UTEM_SWORDSMEN.name).toBe("Utem Swordsmen");
      expect(UTEM_SWORDSMEN.level).toBe(2);
      expect(UTEM_SWORDSMEN.influence).toBe(6);
      expect(UTEM_SWORDSMEN.armor).toBe(4);
    });

    it("should have two abilities", () => {
      expect(UTEM_SWORDSMEN.abilities.length).toBe(2);
    });

    it("should have Attack 3 OR Block 3 as first ability (effect-based choice)", () => {
      const ability = UTEM_SWORDSMEN.abilities[0];
      expect(ability?.type).toBe(UNIT_ABILITY_EFFECT);
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Attack");
      expect(ability?.displayName).toContain("Block");
      expect(ability?.displayName).toContain("3");
    });

    it("should have Attack 6 OR Block 6 with wound as second ability", () => {
      const ability = UTEM_SWORDSMEN.abilities[1];
      expect(ability?.type).toBe(UNIT_ABILITY_EFFECT);
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("6");
    });
  });

  describe("Attack OR Block 3 (Ability 0)", () => {
    it("should present choice between Attack 3 and Block 3", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should grant Attack 3 when attack option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
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

      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normal,
      ).toBe(3);
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
      // First ability should NOT wound the unit
      expect(choiceResult.state.players[0].units[0].wounded).toBe(false);
    });

    it("should grant Block 3 when block option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 0,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1,
        },
      );

      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(3);
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
      // First ability should NOT wound the unit
      expect(choiceResult.state.players[0].units[0].wounded).toBe(false);
    });
  });

  describe("Attack OR Block 6 with self-wound (Ability 1)", () => {
    it("should present choice between Attack 6 and Block 6", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should grant Attack 6 and wound the unit when attack option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
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

      // Attack 6 should be added
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normal,
      ).toBe(6);

      // Unit should be both spent and wounded
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
    });

    it("should grant Block 6 and wound the unit when block option chosen", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1,
        },
      );

      // Block 6 should be added
      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(6);

      // Unit should be both spent and wounded
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
    });
  });

  describe("Self-wound edge cases", () => {
    it("should not trigger Paralyze instant-kill from self-wound", () => {
      // Medusa has Paralyze — normally wounds from its attack kill units instantly
      // But self-wound is NOT combat damage, so Paralyze should not trigger
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_MEDUSA)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0, // Attack 6
        },
      );

      // Unit should be wounded but NOT destroyed (Paralyze didn't trigger)
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
      // Unit should still exist in the player's unit array
      expect(choiceResult.state.players[0].units.length).toBe(1);
    });

    it("should not trigger Vampiric armor increase from self-wound", () => {
      // Swamp Dragon has Vampiric — normally gains armor when dealing wounds
      // But self-wound is NOT combat damage from the enemy
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_SWAMP_DRAGON)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0, // Attack 6
        },
      );

      // Vampiric armor bonus should remain 0 (self-wound didn't trigger it)
      expect(
        choiceResult.state.combat?.vampiricArmorBonus["enemy_0"],
      ).toBeUndefined();
    });

    it("should not trigger Poison extra wounds from self-wound", () => {
      // Monks have Poison — normally adds extra wound when dealing damage
      // But self-wound is a single direct wound, Poison doesn't apply
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_MONKS)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0, // Attack 6
        },
      );

      // Unit should be wounded but NOT destroyed (Poison didn't double the wound)
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
      expect(choiceResult.state.players[0].units.length).toBe(1);
    });

    it("should add exactly 1 wound regardless of enemy abilities", () => {
      // The self-wound adds exactly 1 wound (sets wounded=true), not more
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        },
      );

      // Exactly 1 wound: wounded = true, not destroyed
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
      expect(choiceResult.state.players[0].units.length).toBe(1);
    });

    it("should not wound hero (no wound cards in hand from self-wound)", () => {
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [], // Empty hand
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        },
      );

      // Hero's hand should still be empty (no wound cards added)
      expect(choiceResult.state.players[0].hand.length).toBe(0);
    });

    it("self-wound happens during activation, not during damage assignment phase", () => {
      // The wound happens immediately when the ability is used
      // This is verified by the unit being wounded right after choice resolution
      // (not deferred to the damage assignment phase)
      const unit = createPlayerUnit(UNIT_UTEM_SWORDSMEN, "swordsmen_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSwordsmenCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Before activation: unit is not wounded
      expect(state.players[0].units[0].wounded).toBe(false);

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "swordsmen_1",
        abilityIndex: 1,
      });

      // After activation but before choice: unit is not yet wounded
      // (compound resolves after choice)
      expect(activateResult.state.players[0].units[0].wounded).toBe(false);

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        },
      );

      // After choice: unit is wounded (happened during activation, not damage phase)
      expect(choiceResult.state.players[0].units[0].wounded).toBe(true);
    });
  });
});
