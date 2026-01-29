/**
 * Tests for combat ValidActions computation
 *
 * These test the getCombatOptions function which computes:
 * - availableAttack pool
 * - enemy states with effective damage
 * - assignableAttacks options
 * - unassignableAttacks options
 */

import { describe, it, expect } from "vitest";
import { getCombatOptions } from "../combat.js";
import { createTestGameState } from "../../__tests__/testHelpers.js";
import { createEngine } from "../../MageKnightEngine.js";
import {
  ENTER_COMBAT_ACTION,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  ENEMY_DIGGERS,
  ENEMY_IRONCLADS,
  ENEMY_SORCERERS,
  ATTACK_TYPE_MELEE,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  UNIT_FIRE_GOLEMS,
  ELEMENT_PHYSICAL,
  ABILITY_ASSASSINATION,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../../types/unit.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../../types/combat.js";
import type { GameState } from "../../../state/GameState.js";
import type { AccumulatedAttack } from "../../../types/player.js";
import {
  EFFECT_ABILITY_NULLIFIER,
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";
import { addModifier } from "../../modifiers.js";

/**
 * Helper to set up accumulated attack values in the player's combatAccumulator.
 */
function withAccumulatedAttack(
  state: GameState,
  playerId: string,
  attack: Partial<AccumulatedAttack>
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];

  const defaultAttack: AccumulatedAttack = {
    normal: 0,
    ranged: 0,
    siege: 0,
    normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: { ...defaultAttack, ...attack },
    },
  };

  return { ...state, players: updatedPlayers };
}

/**
 * Helper to enter combat and optionally skip to a specific phase.
 */
function setupCombatState(
  enemyIds: string[],
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_ATTACK = COMBAT_PHASE_RANGED_SIEGE,
  isAtFortifiedSite: boolean = false
): GameState {
  const engine = createEngine();
  let state = createTestGameState();

  state = engine.processAction(state, "player1", {
    type: ENTER_COMBAT_ACTION,
    enemyIds: enemyIds,
    isAtFortifiedSite,
  }).state;

  // If we need a different phase, manually set it
  if (phase !== COMBAT_PHASE_RANGED_SIEGE && state.combat) {
    state = {
      ...state,
      combat: {
        ...state.combat,
        phase,
      },
    };
  }

  return state;
}

describe("getCombatOptions", () => {
  describe("availableAttack pool", () => {
    it("should compute available attack when nothing assigned", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Give player 5 melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      const options = getCombatOptions(state);

      expect(options?.availableAttack?.melee).toBe(5);
      expect(options?.availableAttack?.ranged).toBe(0);
      expect(options?.availableAttack?.siege).toBe(0);
    });

    it("should subtract assigned from accumulated", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Give player 5 melee attack, with 2 already assigned
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Manually set assigned attack
      const playerIndex = state.players.findIndex((p) => p.id === "player1");
      const player = state.players[playerIndex];
      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          assignedAttack: {
            normal: 2,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
        },
      };
      state = { ...state, players: updatedPlayers };

      const options = getCombatOptions(state);

      // Available = 5 - 2 = 3
      expect(options?.availableAttack?.melee).toBe(3);
    });

    it("should include elemental attack values", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      state = withAccumulatedAttack(state, "player1", {
        normal: 3,
        normalElements: { physical: 0, fire: 4, ice: 2, coldFire: 1 },
      });

      const options = getCombatOptions(state);

      expect(options?.availableAttack?.melee).toBe(3);
      expect(options?.availableAttack?.fireMelee).toBe(4);
      expect(options?.availableAttack?.iceMelee).toBe(2);
      expect(options?.availableAttack?.coldFireMelee).toBe(1);
    });

    it("should include ranged and siege in ranged/siege phase", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_RANGED_SIEGE);

      state = withAccumulatedAttack(state, "player1", {
        ranged: 3,
        siege: 5,
        rangedElements: { physical: 0, fire: 2, ice: 0, coldFire: 0 },
      });

      const options = getCombatOptions(state);

      expect(options?.availableAttack?.ranged).toBe(3);
      expect(options?.availableAttack?.siege).toBe(5);
      expect(options?.availableAttack?.fireRanged).toBe(2);
    });
  });

  describe("enemy states", () => {
    it("should include basic enemy info", () => {
      const state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      const options = getCombatOptions(state);

      expect(options?.enemies).toHaveLength(1);
      expect(options?.enemies?.[0].enemyInstanceId).toBe("enemy_0");
      expect(options?.enemies?.[0].enemyName).toBe("Prowlers");
      expect(options?.enemies?.[0].armor).toBe(3);
      expect(options?.enemies?.[0].isDefeated).toBe(false);
    });

    it("should include resistance info", () => {
      // Fire Mages have fire resistance
      const state = setupCombatState([ENEMY_FIRE_MAGES], COMBAT_PHASE_ATTACK);

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].resistances.fire).toBe(true);
      expect(options?.enemies?.[0].resistances.physical).toBe(false);
      expect(options?.enemies?.[0].resistances.ice).toBe(false);
    });

    it("should compute pending damage from state", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Add pending damage to combat state
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 2, fire: 1, ice: 0, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].pendingDamage).toEqual({
        physical: 2,
        fire: 1,
        ice: 0,
        coldFire: 0,
      });
    });

    it("should calculate effective damage with no resistances", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Prowlers have no resistances
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 2, fire: 1, ice: 1, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);

      // All damage should be at full value (no resistances)
      expect(options?.enemies?.[0].effectiveDamage).toEqual({
        physical: 2,
        fire: 1,
        ice: 1,
        coldFire: 0,
      });
      expect(options?.enemies?.[0].totalEffectiveDamage).toBe(4);
    });

    it("should halve resisted damage", () => {
      let state = setupCombatState([ENEMY_FIRE_MAGES], COMBAT_PHASE_ATTACK);

      // Fire Mages have fire resistance
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 2, fire: 4, ice: 0, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);

      // Physical is full, fire is halved (4 -> 2)
      expect(options?.enemies?.[0].effectiveDamage.physical).toBe(2);
      expect(options?.enemies?.[0].effectiveDamage.fire).toBe(2);
      expect(options?.enemies?.[0].totalEffectiveDamage).toBe(4);
    });

    it("should compute canDefeat when effective damage >= armor", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Prowlers have armor 3
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 3, fire: 0, ice: 0, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].canDefeat).toBe(true);
    });

    it("should not set canDefeat when effective damage < armor", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Prowlers have armor 3
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 2, fire: 0, ice: 0, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].canDefeat).toBe(false);
    });

    it("should set requiresSiege for fortified site in ranged/siege phase", () => {
      const state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_RANGED_SIEGE, true);

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].isFortified).toBe(true);
      expect(options?.enemies?.[0].requiresSiege).toBe(true);
    });

    it("should not set requiresSiege in attack phase even at fortified site", () => {
      const state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK, true);

      const options = getCombatOptions(state);

      expect(options?.enemies?.[0].isFortified).toBe(true);
      expect(options?.enemies?.[0].requiresSiege).toBe(false);
    });
  });

  describe("assignableAttacks", () => {
    it("should generate options for each available attack type and enemy", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      state = withAccumulatedAttack(state, "player1", {
        normal: 3,
        normalElements: { physical: 0, fire: 2, ice: 1, coldFire: 0 },
      });

      const options = getCombatOptions(state);

      // Should have options for physical, fire, ice melee
      const assignable = options?.assignableAttacks ?? [];

      expect(assignable).toContainEqual(
        expect.objectContaining({
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 1,
        })
      );

      expect(assignable).toContainEqual(
        expect.objectContaining({
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_FIRE,
        })
      );

      expect(assignable).toContainEqual(
        expect.objectContaining({
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_ICE,
        })
      );
    });

    it("should not include options when no attack available", () => {
      const state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);
      // No attack accumulated

      const options = getCombatOptions(state);

      expect(options?.assignableAttacks).toEqual([]);
    });

    it("should only include ranged/siege types in ranged/siege phase", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_RANGED_SIEGE);

      state = withAccumulatedAttack(state, "player1", {
        normal: 3, // Should not be usable
        ranged: 2,
        siege: 1,
      });

      const options = getCombatOptions(state);
      const assignable = options?.assignableAttacks ?? [];

      // Should have ranged and siege options
      expect(assignable).toContainEqual(
        expect.objectContaining({
          attackType: ATTACK_TYPE_RANGED,
          element: ATTACK_ELEMENT_PHYSICAL,
        })
      );

      expect(assignable).toContainEqual(
        expect.objectContaining({
          attackType: ATTACK_TYPE_SIEGE,
          element: ATTACK_ELEMENT_PHYSICAL,
        })
      );

      // Should NOT have melee options
      const meleeOptions = assignable.filter(
        (opt) => opt.attackType === ATTACK_TYPE_MELEE
      );
      expect(meleeOptions).toHaveLength(0);
    });

    it("should exclude ranged against fortified enemies", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_RANGED_SIEGE, true);

      state = withAccumulatedAttack(state, "player1", {
        ranged: 3,
        siege: 2,
      });

      const options = getCombatOptions(state);
      const assignable = options?.assignableAttacks ?? [];

      // Should have siege options
      expect(assignable).toContainEqual(
        expect.objectContaining({
          attackType: ATTACK_TYPE_SIEGE,
        })
      );

      // Should NOT have ranged options (fortified enemies need siege)
      const rangedOptions = assignable.filter(
        (opt) => opt.attackType === ATTACK_TYPE_RANGED
      );
      expect(rangedOptions).toHaveLength(0);
    });

    it("should not include options for defeated enemies", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Mark enemy as defeated
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            enemies: state.combat.enemies.map((e) => ({
              ...e,
              isDefeated: true,
            })),
          },
        };
      }

      const options = getCombatOptions(state);

      expect(options?.assignableAttacks).toEqual([]);
    });
  });

  describe("unassignableAttacks", () => {
    it("should generate options based on pending damage", () => {
      let state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      // Add pending damage
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            pendingDamage: {
              enemy_0: { physical: 2, fire: 1, ice: 0, coldFire: 0 },
            },
          },
        };
      }

      const options = getCombatOptions(state);
      const unassignable = options?.unassignableAttacks ?? [];

      // Should have options to unassign physical and fire
      expect(unassignable).toContainEqual(
        expect.objectContaining({
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 1,
        })
      );

      expect(unassignable).toContainEqual(
        expect.objectContaining({
          element: ATTACK_ELEMENT_FIRE,
        })
      );

      // Should not have option for ice (no pending ice damage)
      const iceOptions = unassignable.filter(
        (opt) => opt.element === ATTACK_ELEMENT_ICE
      );
      expect(iceOptions).toHaveLength(0);
    });

    it("should be empty when no pending damage", () => {
      const state = setupCombatState([ENEMY_PROWLERS], COMBAT_PHASE_ATTACK);

      const options = getCombatOptions(state);

      expect(options?.unassignableAttacks).toEqual([]);
    });
  });

  describe("non-combat phases", () => {
    it("should return null when not in combat", () => {
      const state = createTestGameState();

      const options = getCombatOptions(state);

      expect(options).toBeNull();
    });

    it("should not include attack fields in block phase", () => {
      const engine = createEngine();
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Manually set to block phase
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            phase: COMBAT_PHASE_BLOCK,
          },
        };
      }

      const options = getCombatOptions(state);

      // Should have block-specific fields instead
      expect(options?.availableAttack).toBeUndefined();
      expect(options?.assignableAttacks).toBeUndefined();
    });
  });

  describe("damageAssignments (ASSIGN_DAMAGE phase)", () => {
    /**
     * Helper to set up combat in ASSIGN_DAMAGE phase with specific enemies
     */
    function setupAssignDamagePhase(
      enemyIds: string[],
      options: { unitsAllowed?: boolean } = {}
    ): GameState {
      const engine = createEngine();
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds,
      }).state;

      // Set to assign damage phase
      if (state.combat) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            phase: COMBAT_PHASE_ASSIGN_DAMAGE,
            unitsAllowed: options.unitsAllowed ?? true,
          },
        };
      }

      return state;
    }

    /**
     * Helper to add units to a player
     */
    function withPlayerUnits(
      state: GameState,
      playerId: string,
      units: ReturnType<typeof createPlayerUnit>[]
    ): GameState {
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        units,
      };

      return { ...state, players: updatedPlayers };
    }

    describe("enemy attack info", () => {
      it("should include enemy attack element", () => {
        const state = setupAssignDamagePhase([ENEMY_DIGGERS]);

        const options = getCombatOptions(state);

        // Diggers have physical attack
        expect(options?.damageAssignments?.[0].attackElement).toBe(ELEMENT_PHYSICAL);
      });

      it("should include enemy Brutal status", () => {
        // Ironclads enemy has Brutal ability
        const state = setupAssignDamagePhase([ENEMY_IRONCLADS]);

        const options = getCombatOptions(state);

        expect(options?.damageAssignments?.[0].isBrutal).toBe(true);
      });

      it("should compute totalDamage with Brutal (2x)", () => {
        // Ironclads have attack 4 and Brutal
        const state = setupAssignDamagePhase([ENEMY_IRONCLADS]);

        const options = getCombatOptions(state);

        // Ironclads have 4 attack, Brutal doubles it to 8
        expect(options?.damageAssignments?.[0].rawAttackValue).toBe(4);
        expect(options?.damageAssignments?.[0].totalDamage).toBe(8);
      });

      it("should compute totalDamage without Brutal (1x)", () => {
        const state = setupAssignDamagePhase([ENEMY_DIGGERS]);

        const options = getCombatOptions(state);

        // Diggers have attack 3, no Brutal
        expect(options?.damageAssignments?.[0].rawAttackValue).toBe(3);
        expect(options?.damageAssignments?.[0].totalDamage).toBe(3);
      });
    });

    describe("unit targets", () => {
      it("should include available units with basic info", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits).toHaveLength(1);
        expect(availableUnits[0].unitInstanceId).toBe("peasant_1");
        expect(availableUnits[0].unitName).toBe("Peasants");
        expect(availableUnits[0].armor).toBe(3);
      });

      it("should compute resistance status based on attack element", () => {
        // Diggers have physical attack
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        // Guardian Golems have physical resistance
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits[0].isResistantToAttack).toBe(true);
      });

      it("should compute resistance correctly for fire attack", () => {
        // Fire Mages have fire attack
        let state = setupAssignDamagePhase([ENEMY_FIRE_MAGES]);
        // Fire Golems have fire resistance
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1"),
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        const fireGolem = availableUnits.find((u) => u.unitInstanceId === "fire_golem_1");
        const peasant = availableUnits.find((u) => u.unitInstanceId === "peasant_1");

        expect(fireGolem?.isResistantToAttack).toBe(true);
        expect(peasant?.isResistantToAttack).toBe(false);
      });

      it("should mark wounded units as not assignable", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        const woundedUnit = {
          ...createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
          wounded: true,
        };
        state = withPlayerUnits(state, "player1", [woundedUnit]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits[0].isWounded).toBe(true);
        expect(availableUnits[0].canBeAssigned).toBe(false);
      });

      it("should mark units that used resistance this combat as not assignable", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        const usedResistanceUnit = {
          ...createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1"),
          usedResistanceThisCombat: true,
        };
        state = withPlayerUnits(state, "player1", [usedResistanceUnit]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits[0].alreadyAssignedThisCombat).toBe(true);
        expect(availableUnits[0].canBeAssigned).toBe(false);
      });

      it("should mark unwounded units that haven't used resistance as assignable", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits[0].isWounded).toBe(false);
        expect(availableUnits[0].alreadyAssignedThisCombat).toBe(false);
        expect(availableUnits[0].canBeAssigned).toBe(true);
      });

      it("should return empty availableUnits when units not allowed in combat", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS], { unitsAllowed: false });
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits).toHaveLength(0);
      });

      it("should include multiple units with correct info", () => {
        let state = setupAssignDamagePhase([ENEMY_DIGGERS]);
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
          createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1"),
        ]);

        const options = getCombatOptions(state);

        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits).toHaveLength(2);

        const peasant = availableUnits.find((u) => u.unitInstanceId === "peasant_1");
        const golem = availableUnits.find((u) => u.unitInstanceId === "golem_1");

        expect(peasant?.unitName).toBe("Peasants");
        expect(peasant?.armor).toBe(3);
        expect(peasant?.isResistantToAttack).toBe(false); // No physical resistance

        expect(golem?.unitName).toBe("Guardian Golems");
        expect(golem?.armor).toBe(3);
        expect(golem?.isResistantToAttack).toBe(true); // Has physical resistance
      });

      it("should return empty availableUnits for enemy with Assassination ability", () => {
        // Sorcerers have Assassination ability
        let state = setupAssignDamagePhase([ENEMY_SORCERERS]);
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        const options = getCombatOptions(state);

        // Unit targets should be empty due to Assassination
        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits).toHaveLength(0);
      });

      it("should return unit targets if Assassination is nullified", () => {
        // Sorcerers have Assassination ability
        let state = setupAssignDamagePhase([ENEMY_SORCERERS]);
        state = withPlayerUnits(state, "player1", [
          createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        ]);

        // Add modifier to nullify Assassination ability using the proper modifier system
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, id: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
          effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_ASSASSINATION },
          createdByPlayerId: "player1",
          createdAtRound: state.round,
        });

        const options = getCombatOptions(state);

        // Unit targets should be available since Assassination is nullified
        const availableUnits = options?.damageAssignments?.[0].availableUnits ?? [];
        expect(availableUnits).toHaveLength(1);
        expect(availableUnits[0].unitInstanceId).toBe("peasant_1");
      });
    });

    describe("backwards compatibility", () => {
      it("should maintain unassignedDamage field for backwards compatibility", () => {
        const state = setupAssignDamagePhase([ENEMY_DIGGERS]);

        const options = getCombatOptions(state);

        // unassignedDamage should equal totalDamage
        expect(options?.damageAssignments?.[0].unassignedDamage).toBe(
          options?.damageAssignments?.[0].totalDamage
        );
      });
    });
  });
});
