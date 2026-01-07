/**
 * Unit System tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex, createVillageSite } from "./testHelpers.js";
import { hexKey } from "@mage-knight/shared";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_RECRUITED,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  UNIT_THUGS,
  UNIT_FORESTERS,
  UNIT_CATAPULTS,
  UNIT_FIRE_MAGES,
  UNIT_RED_CAPE_MONKS,
  UNIT_SHOCKTROOPS,
  GAME_PHASE_ROUND,
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  UNIT_WOUNDED,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_HEAL,
  UNIT_HERBALIST,
  CARD_WOUND,
} from "@mage-knight/shared";
import { createPlayerUnit, readyAllUnits } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";

describe("Unit System", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  /**
   * Create a game state where the player is at a village (for recruitment tests)
   */
  function createStateWithVillage(playerOverrides: Parameters<typeof createTestPlayer>[0] = {}) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      ...playerOverrides,
    });

    const hexWithVillage = createTestHex(0, 0, undefined, createVillageSite());

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hexWithVillage,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
    });
  }

  describe("Recruiting", () => {
    it("should recruit unit when command slots available", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4, // Peasants cost 4
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(false);

      // Check event was emitted
      const recruitEvent = result.events.find(
        (e) => e.type === UNIT_RECRUITED
      );
      expect(recruitEvent).toBeDefined();
      if (recruitEvent && recruitEvent.type === UNIT_RECRUITED) {
        expect(recruitEvent.unitId).toBe(UNIT_PEASANTS);
        expect(recruitEvent.influenceSpent).toBe(4);
      }
    });

    it("should reject recruit when no command slots available", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_unit");
      const state = createStateWithVillage({
        units: [existingUnit],
        commandTokens: 1, // Only 1 slot, already full
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // Should still have only 1 unit
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("command slot");
      }
    });

    it("should reject recruit with insufficient influence", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 2, // Less than cost of 4
      });

      // Should not have any units
      expect(result.state.players[0].units).toHaveLength(0);

      // Check for invalid action event
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("influence");
      }
    });

    it("should recruit with exactly the right influence", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 2,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4, // Exactly the cost
      });

      expect(result.state.players[0].units).toHaveLength(1);
    });

    it("should allow recruiting multiple units up to command limit", () => {
      let state = createStateWithVillage({
        units: [],
        commandTokens: 3,
      });

      // Recruit first unit
      let result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(1);

      // Recruit second unit
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(2);

      // Recruit third unit
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(3);

      // Fourth should fail
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      expect(result.state.players[0].units).toHaveLength(3);
      expect(result.events.some((e) => e.type === INVALID_ACTION)).toBe(true);
    });
  });

  describe("Unit state helpers", () => {
    it("createPlayerUnit should create unit with ready state", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "test_unit_1");

      expect(unit.unitId).toBe(UNIT_PEASANTS);
      expect(unit.instanceId).toBe("test_unit_1");
      expect(unit.state).toBe(UNIT_STATE_READY);
      expect(unit.wounded).toBe(false);
      expect(unit.usedResistanceThisCombat).toBe(false);
    });

    it("readyAllUnits should reset unit states", () => {
      const units = [
        {
          instanceId: "unit_1",
          unitId: UNIT_PEASANTS,
          state: UNIT_STATE_SPENT as const,
          wounded: true,
          usedResistanceThisCombat: true,
        },
        {
          instanceId: "unit_2",
          unitId: UNIT_GUARDIAN_GOLEMS,
          state: UNIT_STATE_SPENT as const,
          wounded: false,
          usedResistanceThisCombat: true,
        },
      ];

      const readied = readyAllUnits(units);

      expect(readied[0].state).toBe(UNIT_STATE_READY);
      expect(readied[0].wounded).toBe(true); // Wounds persist
      expect(readied[0].usedResistanceThisCombat).toBe(false);

      expect(readied[1].state).toBe(UNIT_STATE_READY);
      expect(readied[1].wounded).toBe(false);
      expect(readied[1].usedResistanceThisCombat).toBe(false);
    });
  });

  describe("Damage absorption", () => {
    it("should wound non-resistant unit and absorb armor", () => {
      // Peasants have armor 3, no resistances
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Create combat state with a physical attacking enemy
      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      // Assign all damage to the unit
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "peasant_1", amount: 3 },
        ],
      });

      // Unit should be wounded (3 damage <= 3 armor, but not resistant)
      expect(result.state.players[0].units[0].wounded).toBe(true);

      // Check wound event
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeDefined();
    });

    it("should not wound resistant unit if damage <= armor", () => {
      // Guardian Golems have armor 3 and physical resistance
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3, // Equal to armor
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 3 },
        ],
      });

      // Unit should NOT be wounded (resistant, damage <= armor)
      expect(result.state.players[0].units[0].wounded).toBe(false);
      // But should have used resistance
      expect(result.state.players[0].units[0].usedResistanceThisCombat).toBe(
        true
      );
    });

    it("should wound resistant unit if damage > armor", () => {
      // Guardian Golems have armor 3 and physical resistance
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 5, // More than armor (3)
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 5 },
        ],
      });

      // Unit should be wounded (resistant, but damage > armor)
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });

    it("should reject assigning damage to wounded unit", () => {
      // Already wounded peasant - cannot be targeted
      const unit = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        wounded: true,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "peasant_1", amount: 3 },
        ],
      });

      // Unit should still be there (action rejected)
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("wounded");
      }
    });

    it("should reject assigning damage to unit that used resistance", () => {
      // Unit that absorbed damage via resistance this combat
      const unit = {
        ...createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1"),
        usedResistanceThisCombat: true,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 3 },
        ],
      });

      // Unit should still be there (action rejected)
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("absorbed damage");
      }
    });
  });

  describe("Unit Combat Abilities", () => {
    /**
     * Create a combat state in the specified phase
     */
    function createCombatState(phase: typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_ASSIGN_DAMAGE, isAtFortifiedSite = false) {
      return {
        enemies: [
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_DIGGERS,
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase,
        woundsThisCombat: 0,
        attacksThisPhase: 0,
        fameGained: 0,
        isAtFortifiedSite,
        unitsAllowed: true,
        nightManaRules: false,
      };
    }

    describe("Activation", () => {
      it("should activate unit and add attack to accumulator", () => {
        // Thugs have Attack 3 (ability index 0)
        const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0, // Attack 3
        });

        // Verify accumulator.attack.normal increased by 3
        expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);

        // Verify unit is now spent
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

        // Check event was emitted
        const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
        expect(activateEvent).toBeDefined();
        if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
          expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
          expect(activateEvent.abilityValue).toBe(3);
        }
      });

      it("should activate unit and add block to accumulator", () => {
        // Peasants have Block 2 (ability index 1)
        const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_BLOCK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 1, // Block 2
        });

        // Verify accumulator.block increased by 2
        expect(result.state.players[0].combatAccumulator.block).toBe(2);

        // Verify unit is now spent
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      });

      it("should allow ranged attack in ranged & siege phase", () => {
        // Foresters have Ranged Attack 2 (ability index 1)
        const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "foresters_1",
          abilityIndex: 1, // Ranged Attack 2
        });

        // Verify success - ranged attack added
        expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      });

      it("should allow ranged attack in attack phase", () => {
        // Foresters have Ranged Attack 2 (ability index 1)
        const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "foresters_1",
          abilityIndex: 1, // Ranged Attack 2
        });

        // Verify success - ranged works in attack phase too
        expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      });

      it("should activate heal ability and remove wounds from hand", () => {
        // Herbalist has Heal 2 (ability index 0)
        const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
          hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND], // 3 wounds
        });

        // Heal ability should work outside of combat
        const state = createTestGameState({
          players: [player],
          phase: GAME_PHASE_ROUND,
          combat: null,
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "herbalist_1",
          abilityIndex: 0, // Heal 2
        });

        // Verify wounds were removed from hand (Heal 2 = remove 2 wounds)
        const woundsRemaining = result.state.players[0].hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        expect(woundsRemaining).toBe(1); // 3 - 2 = 1 wound remaining

        // Verify unit is now spent
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

        // Verify wound pile increased
        expect(result.state.woundPileCount).toBe(state.woundPileCount + 2);

        // Check event was emitted
        const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
        expect(activateEvent).toBeDefined();
        if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
          expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_HEAL);
          expect(activateEvent.abilityValue).toBe(2);
        }
      });
    });

    describe("Phase restrictions", () => {
      it("should reject block ability in attack phase", () => {
        // Peasants have Block 2 (ability index 1)
        const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 1, // Block 2
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Block phase");
        }
      });

      it("should reject attack ability in block phase", () => {
        // Thugs have Attack 3 (ability index 0)
        const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_BLOCK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0, // Attack 3
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Attack phase");
        }
      });
    });

    describe("Siege requirements", () => {
      it("should reject ranged attack at fortified site in ranged phase", () => {
        // Foresters have Ranged Attack 2 (ability index 1)
        const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, true), // Fortified!
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "foresters_1",
          abilityIndex: 1, // Ranged Attack 2
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Siege");
        }
      });

      it("should allow siege attack at fortified site in ranged phase", () => {
        // Catapults have Siege Attack 4 (ability index 0)
        const unit = createPlayerUnit(UNIT_CATAPULTS, "catapult_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, true), // Fortified!
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "catapult_1",
          abilityIndex: 0, // Siege Attack 4
        });

        // Verify success
        expect(result.state.players[0].combatAccumulator.attack.siege).toBe(4);
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      });
    });

    describe("Spent units", () => {
      it("should allow spent unit to absorb damage", () => {
        // Peasants - first activate for Block, then assign damage to same unit
        const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        // Start in block phase
        let state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_BLOCK),
        });

        // Activate unit for Block (becomes spent)
        let result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 1, // Block 2
        });
        state = result.state;

        expect(state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

        // Now move to assign damage phase
        const combat = state.combat;
        if (!combat) throw new Error("Expected combat state");
        state = {
          ...state,
          combat: {
            ...combat,
            phase: COMBAT_PHASE_ASSIGN_DAMAGE,
          },
        };

        // Assign damage to same unit
        result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_1",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "peasants_1", amount: 3 },
          ],
        });

        // Spent unit should still be able to absorb damage
        expect(result.state.players[0].units[0].wounded).toBe(true);
      });

      it("should not allow spent unit to activate again", () => {
        // Unit already spent
        const unit = {
          ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
          state: UNIT_STATE_SPENT as const,
        };
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 0, // Attack 2
        });

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("not ready");
        }
      });
    });

    describe("Multiple units", () => {
      it("should allow multiple units to contribute in same phase", () => {
        // Two units with Attack abilities
        const thugs = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const peasants = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
        const player = createTestPlayer({
          units: [thugs, peasants],
          commandTokens: 2,
        });

        let state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        // Activate first unit (Thugs Attack 3)
        let result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0, // Attack 3
        });
        state = result.state;
        expect(state.players[0].combatAccumulator.attack.normal).toBe(3);

        // Activate second unit (Peasants Attack 2)
        result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 0, // Attack 2
        });

        // Verify both contribute to accumulator
        expect(result.state.players[0].combatAccumulator.attack.normal).toBe(5);
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_SPENT);
      });
    });

    describe("Combat requirement", () => {
      it("should reject combat abilities when not in combat", () => {
        // Thugs have Attack 3
        const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        // No combat state
        const state = createTestGameState({
          players: [player],
          combat: null,
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0, // Attack 3
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("combat");
        }
      });
    });

    describe("Invalid ability index", () => {
      it("should reject invalid ability index", () => {
        // Thugs only have 1 ability (index 0)
        const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 5, // Invalid index
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
      });
    });

    describe("Wounded units", () => {
      it("should not allow wounded unit to activate", () => {
        const unit = {
          ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
          wounded: true,
        };
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "peasants_1",
          abilityIndex: 0, // Attack 2
        });

        // Check for invalid action event
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Wounded");
        }
      });
    });

    describe("Passive abilities", () => {
      it("should return clear error for passive abilities like swift", () => {
        // Shocktroops have Swift at index 1 (passive)
        const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "shocktroops_1",
          abilityIndex: 1, // Swift (passive)
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event with helpful message
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("passive");
          expect(invalidEvent.reason).toContain("automatically");
        }
      });

      it("should return clear error for passive abilities like brutal", () => {
        // Shocktroops have Brutal at index 2 (passive)
        const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "shocktroops_1",
          abilityIndex: 2, // Brutal (passive)
        });

        // Unit should still be ready (action rejected)
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

        // Check for invalid action event with helpful message
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("passive");
          expect(invalidEvent.reason).toContain("automatically");
        }
      });
    });

    describe("Elemental attack tracking", () => {
      it("should track fire attack separately from physical", () => {
        // Red Cape Monks have Fire Attack 4 at index 0
        const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "monks_1",
          abilityIndex: 0, // Fire Attack 4
        });

        // Verify fire element tracked separately
        expect(result.state.players[0].combatAccumulator.attack.normalElements.fire).toBe(4);
        expect(result.state.players[0].combatAccumulator.attack.normalElements.physical).toBe(0);
        // Total normal attack should still include fire
        expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);

        // Verify unit is now spent
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

        // Check event includes element info
        const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
        expect(activateEvent).toBeDefined();
        if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
          expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
          expect(activateEvent.abilityValue).toBe(4);
          expect(activateEvent.element).toBe(ELEMENT_FIRE);
        }
      });

      it("should track fire block separately from physical", () => {
        // Red Cape Monks have Fire Block 3 at index 1
        const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_BLOCK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "monks_1",
          abilityIndex: 1, // Fire Block 3
        });

        // Verify fire element tracked separately
        expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(3);
        expect(result.state.players[0].combatAccumulator.blockElements.physical).toBe(0);
        // Total block should include fire
        expect(result.state.players[0].combatAccumulator.block).toBe(3);

        // Verify unit is now spent
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

        // Check event includes element info
        const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
        expect(activateEvent).toBeDefined();
        if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
          expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
          expect(activateEvent.abilityValue).toBe(3);
          expect(activateEvent.element).toBe(ELEMENT_FIRE);
        }
      });

      it("should track fire ranged attack in ranged phase", () => {
        // Fire Mages have Fire Ranged Attack 4 at index 1
        const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "fire_mages_1",
          abilityIndex: 1, // Fire Ranged Attack 4
        });

        // Verify fire ranged tracked separately
        expect(result.state.players[0].combatAccumulator.attack.rangedElements.fire).toBe(4);
        expect(result.state.players[0].combatAccumulator.attack.rangedElements.physical).toBe(0);
        // Total ranged attack should include fire
        expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(4);
      });

      it("should track physical attack as physical element", () => {
        // Thugs have Physical Attack 3 at index 0
        const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [unit],
          commandTokens: 1,
        });

        const state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        const result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0, // Physical Attack 3
        });

        // Verify physical element tracked
        expect(result.state.players[0].combatAccumulator.attack.normalElements.physical).toBe(3);
        expect(result.state.players[0].combatAccumulator.attack.normalElements.fire).toBe(0);
        expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);

        // Check event includes physical element
        const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
        expect(activateEvent).toBeDefined();
        if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
          expect(activateEvent.element).toBe(ELEMENT_PHYSICAL);
        }
      });

      it("should accumulate multiple elemental attacks", () => {
        // Red Cape Monks: Fire Attack 4, Thugs: Physical Attack 3
        const monks = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
        const thugs = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [monks, thugs],
          commandTokens: 2,
        });

        let state = createTestGameState({
          players: [player],
          combat: createCombatState(COMBAT_PHASE_ATTACK),
        });

        // Activate monks (Fire Attack 4)
        let result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "monks_1",
          abilityIndex: 0,
        });
        state = result.state;

        // Activate thugs (Physical Attack 3)
        result = engine.processAction(state, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: "thugs_1",
          abilityIndex: 0,
        });

        // Verify both tracked separately
        expect(result.state.players[0].combatAccumulator.attack.normalElements.fire).toBe(4);
        expect(result.state.players[0].combatAccumulator.attack.normalElements.physical).toBe(3);
        // Total should be combined
        expect(result.state.players[0].combatAccumulator.attack.normal).toBe(7);
      });
    });
  });
});
