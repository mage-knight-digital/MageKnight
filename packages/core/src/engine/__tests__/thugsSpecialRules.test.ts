/**
 * Thugs Special Rules tests
 *
 * Tests for the Thugs unit's special recruitment and combat rules:
 * - AC #1: Block 3 ability
 * - AC #2: Attack 3 triggers immediate reputation -1
 * - AC #3: Influence 4 ability triggers immediate reputation -1
 * - AC #4: Reversed reputation modifier during recruitment
 * - AC #5: 2 Influence payment to assign combat damage to Thugs
 * - AC #6: Cannot recruit at "X" reputation (-7)
 * - AC #7: Cannot recruit Thugs + Heroes in same interaction
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
  createStateWithVillage,
} from "./testHelpers.js";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_THUGS,
  UNIT_HEROES,
  UNIT_PEASANTS,
  INVALID_ACTION,
  ACTIVATE_UNIT_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
  THUGS_DAMAGE_INFLUENCE_PAID,
  MIN_REPUTATION,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  GAME_PHASE_ROUND,
} from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { CombatState } from "../../types/combat.js";
import {
  getReputationCostModifier,
  violatesHeroesThugsExclusion,
} from "../rules/unitRecruitment.js";
import { getCombatOptions } from "../validActions/combat.js";
import { computeAvailableUnitTargets } from "../validActions/combatDamage.js";

/**
 * Create a Thugs unit for testing.
 */
function createThugsUnit(instanceId: string): PlayerUnit {
  return createPlayerUnit(UNIT_THUGS, instanceId);
}

/**
 * Create a combat state for Thugs damage testing.
 */
function createThugsCombatState(
  phase: CombatState["phase"],
  paidThugsDamageInfluence: Record<string, boolean> = {}
): CombatState {
  const base = createUnitCombatState(phase);
  return {
    ...base,
    paidThugsDamageInfluence,
  };
}

describe("Thugs Special Rules", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  // =========================================================================
  // AC #4: Reversed reputation modifier during recruitment
  // =========================================================================

  describe("AC #4: Reversed reputation modifier during recruitment", () => {
    describe("getReputationCostModifier", () => {
      it("should reverse positive reputation modifier for Thugs (makes more expensive)", () => {
        // At reputation +3, base modifier is -2 (saves 2 influence for normal units)
        // For Thugs, it should be +2 (costs 2 MORE influence)
        const normalModifier = getReputationCostModifier(3);
        const thugsModifier = getReputationCostModifier(3, UNIT_THUGS);

        expect(normalModifier).toBe(-2);
        expect(thugsModifier).toBe(2);
      });

      it("should reverse negative reputation modifier for Thugs (makes cheaper)", () => {
        // At reputation -3, base modifier is +2 (costs 2 more for normal units)
        // For Thugs, it should be -2 (saves 2 influence)
        const normalModifier = getReputationCostModifier(-3);
        const thugsModifier = getReputationCostModifier(-3, UNIT_THUGS);

        expect(normalModifier).toBe(2);
        expect(thugsModifier).toBe(-2);
      });

      it("should reverse extreme modifiers for Thugs", () => {
        // At reputation -6, base modifier is +3 → Thugs = -3
        expect(getReputationCostModifier(-6, UNIT_THUGS)).toBe(-3);

        // At reputation +6, base modifier is -3 → Thugs = +3
        expect(getReputationCostModifier(6, UNIT_THUGS)).toBe(3);
      });

      it("should return 0 modifier for Thugs at reputation 0", () => {
        expect(getReputationCostModifier(0, UNIT_THUGS)).toBe(0);
      });

      it("should reverse -7 (X) modifier for Thugs", () => {
        // At reputation -7, base modifier is +5 → Thugs = -5
        expect(getReputationCostModifier(-7, UNIT_THUGS)).toBe(-5);
      });

      it("should reverse +7 modifier for Thugs", () => {
        // At reputation +7, base modifier is -5 → Thugs = +5
        expect(getReputationCostModifier(7, UNIT_THUGS)).toBe(5);
      });

      it("should not reverse modifiers for non-Thugs units", () => {
        // Peasants should use normal modifier
        expect(getReputationCostModifier(3, UNIT_PEASANTS)).toBe(-2);
        expect(getReputationCostModifier(-3, UNIT_PEASANTS)).toBe(2);
      });
    });
  });

  // =========================================================================
  // AC #5: 2 Influence payment to assign combat damage to Thugs
  // =========================================================================

  describe("AC #5: 2 Influence payment to assign combat damage to Thugs", () => {
    describe("PAY_THUGS_DAMAGE_INFLUENCE_ACTION", () => {
      it("should pay 2 influence and update combat state for specific Thugs unit", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_1",
        });

        // Verify payment was recorded for this specific unit
        expect(result.state.combat?.paidThugsDamageInfluence["thugs_1"]).toBe(true);
        expect(result.state.players[0].influencePoints).toBe(3); // 5 - 2

        // Check for payment event
        const paymentEvent = result.events.find(
          (e) => e.type === THUGS_DAMAGE_INFLUENCE_PAID
        );
        expect(paymentEvent).toBeDefined();
      });

      it("should reject payment when not in combat", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [thugsUnit],
          commandTokens: 2,
        });

        const state = createTestGameState({
          players: [player],
          combat: null,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_1",
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
      });

      it("should reject payment when already paid for that unit", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(
          COMBAT_PHASE_ASSIGN_DAMAGE,
          { thugs_1: true } // Already paid
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_1",
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("already");
        }
      });

      it("should reject payment when insufficient influence", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 1, // Not enough (need 2)
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_1",
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("influence");
        }
      });

      it("should reject payment for a non-Thugs unit", () => {
        const peasantUnit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [peasantUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "peasant_1",
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
      });

      it("should allow payment for multiple Thugs units independently", () => {
        const thugsUnit1 = createThugsUnit("thugs_1");
        const thugsUnit2 = createThugsUnit("thugs_2");
        const player = createTestPlayer({
          influencePoints: 10,
          units: [thugsUnit1, thugsUnit2],
          commandTokens: 3,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        let state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        // Pay for first Thugs unit
        const result1 = engine.processAction(state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_1",
        });

        expect(result1.state.combat?.paidThugsDamageInfluence["thugs_1"]).toBe(true);
        expect(result1.state.combat?.paidThugsDamageInfluence["thugs_2"]).toBeUndefined();
        expect(result1.state.players[0].influencePoints).toBe(8); // 10 - 2

        // Pay for second Thugs unit
        const result2 = engine.processAction(result1.state, "player1", {
          type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
          unitInstanceId: "thugs_2",
        });

        expect(result2.state.combat?.paidThugsDamageInfluence["thugs_1"]).toBe(true);
        expect(result2.state.combat?.paidThugsDamageInfluence["thugs_2"]).toBe(true);
        expect(result2.state.players[0].influencePoints).toBe(6); // 8 - 2
      });
    });

    describe("damage assignment to Thugs requires payment", () => {
      it("should reject damage assignment to Thugs without payment", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_1",
          assignments: [
            {
              target: DAMAGE_TARGET_UNIT,
              unitInstanceId: "thugs_1",
            },
          ],
        });

        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Influence");
        }
      });

      it("should allow damage assignment to Thugs after payment", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(
          COMBAT_PHASE_ASSIGN_DAMAGE,
          { thugs_1: true } // Payment already made
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_1",
          assignments: [
            {
              target: DAMAGE_TARGET_UNIT,
              unitInstanceId: "thugs_1",
            },
          ],
        });

        // Should NOT be rejected
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeUndefined();
      });

      it("should allow damage assignment to non-Thugs units without payment", () => {
        const peasantUnit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
        const player = createTestPlayer({
          units: [peasantUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_1",
          assignments: [
            {
              target: DAMAGE_TARGET_UNIT,
              unitInstanceId: "peasant_1",
            },
          ],
        });

        // Should NOT be rejected
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeUndefined();
      });

      it("should allow assigning all damage to hero without Thugs payment", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        // Assign all damage to hero (no Thugs unit referenced)
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_1",
        });

        // Should be valid (all damage to hero)
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeUndefined();
      });
    });

    describe("computeAvailableUnitTargets with Thugs", () => {
      it("should mark Thugs units as requiring influence payment", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const targets = computeAvailableUnitTargets(
          player,
          "physical" as never, // Element type
          true, // units allowed
          {} // no payments made
        );

        expect(targets).toHaveLength(1);
        expect(targets[0].requiresInfluencePayment).toBe(true);
        expect(targets[0].influencePaymentMade).toBe(false);
        expect(targets[0].canBeAssigned).toBe(false); // Can't assign without payment
      });

      it("should allow Thugs unit assignment after payment", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const targets = computeAvailableUnitTargets(
          player,
          "physical" as never,
          true,
          { thugs_1: true } // Payment made
        );

        expect(targets).toHaveLength(1);
        expect(targets[0].requiresInfluencePayment).toBe(true);
        expect(targets[0].influencePaymentMade).toBe(true);
        expect(targets[0].canBeAssigned).toBe(true);
      });

      it("should not mark non-Thugs units as requiring payment", () => {
        const peasantUnit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
        const player = createTestPlayer({
          units: [peasantUnit],
          commandTokens: 2,
        });

        const targets = computeAvailableUnitTargets(
          player,
          "physical" as never,
          true,
          {}
        );

        expect(targets).toHaveLength(1);
        expect(targets[0].requiresInfluencePayment).toBeUndefined();
        expect(targets[0].canBeAssigned).toBe(true);
      });
    });

    describe("CombatOptions thugsDamagePaymentOptions", () => {
      it("should include Thugs payment options when Thugs units are present", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const options = getCombatOptions(state);
        expect(options).not.toBeNull();
        expect(options!.thugsDamagePaymentOptions).toBeDefined();
        expect(options!.thugsDamagePaymentOptions).toHaveLength(1);
        expect(options!.thugsDamagePaymentOptions![0].unitInstanceId).toBe("thugs_1");
        expect(options!.thugsDamagePaymentOptions![0].canAfford).toBe(true);
        expect(options!.thugsDamagePaymentOptions![0].alreadyPaid).toBe(false);
        expect(options!.thugsDamagePaymentOptions![0].cost).toBe(2);
      });

      it("should mark payment as already made when paid", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(
          COMBAT_PHASE_ASSIGN_DAMAGE,
          { thugs_1: true }
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const options = getCombatOptions(state);
        expect(options!.thugsDamagePaymentOptions![0].alreadyPaid).toBe(true);
        expect(options!.thugsDamagePaymentOptions![0].canAfford).toBe(false); // Already paid, can't pay again
      });

      it("should show cannot afford when insufficient influence", () => {
        const thugsUnit = createThugsUnit("thugs_1");
        const player = createTestPlayer({
          influencePoints: 1, // Not enough
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const options = getCombatOptions(state);
        expect(options!.thugsDamagePaymentOptions![0].canAfford).toBe(false);
      });

      it("should not include Thugs payment options when no Thugs units", () => {
        const peasantUnit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
        const player = createTestPlayer({
          influencePoints: 5,
          units: [peasantUnit],
          commandTokens: 2,
        });

        const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const options = getCombatOptions(state);
        expect(options!.thugsDamagePaymentOptions).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // AC #6: Cannot recruit at "X" reputation (-7)
  // =========================================================================

  describe("AC #6: Cannot recruit at X reputation", () => {
    it("should reject recruitment at minimum reputation (-7)", () => {
      const state = createStateWithVillage({
        reputation: MIN_REPUTATION, // -7
        influencePoints: 20, // Plenty of influence
        commandTokens: 3,
      });

      // Put Thugs in the offer
      const stateWithOffer = {
        ...state,
        offers: {
          ...state.offers,
          units: [UNIT_THUGS],
        },
      };

      const result = engine.processAction(stateWithOffer, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_THUGS,
        influenceSpent: 20,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("reputation");
      }
    });

    it("should allow recruitment at reputation -6 (one above X)", () => {
      const state = createStateWithVillage({
        reputation: -6,
        influencePoints: 20,
        commandTokens: 3,
      });

      const stateWithOffer = {
        ...state,
        offers: {
          ...state.offers,
          units: [UNIT_PEASANTS],
        },
      };

      const result = engine.processAction(stateWithOffer, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 20,
      });

      // Should NOT be rejected for reputation
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION && e.reason?.includes("reputation")
      );
      expect(invalidEvent).toBeUndefined();
    });
  });

  // =========================================================================
  // AC #7: Cannot recruit Thugs + Heroes in same interaction
  // =========================================================================

  describe("AC #7: Cannot recruit Thugs + Heroes in same interaction", () => {
    describe("violatesHeroesThugsExclusion", () => {
      it("should block Thugs when Heroes already recruited this interaction", () => {
        expect(violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_HEROES])).toBe(true);
      });

      it("should block Heroes when Thugs already recruited this interaction", () => {
        expect(violatesHeroesThugsExclusion(UNIT_HEROES, [UNIT_THUGS])).toBe(true);
      });

      it("should allow Thugs when no Heroes recruited", () => {
        expect(violatesHeroesThugsExclusion(UNIT_THUGS, [])).toBe(false);
        expect(violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_PEASANTS])).toBe(false);
      });

      it("should allow Heroes when no Thugs recruited", () => {
        expect(violatesHeroesThugsExclusion(UNIT_HEROES, [])).toBe(false);
        expect(violatesHeroesThugsExclusion(UNIT_HEROES, [UNIT_PEASANTS])).toBe(false);
      });

      it("should allow other units regardless of Thugs/Heroes recruited", () => {
        expect(violatesHeroesThugsExclusion(UNIT_PEASANTS, [UNIT_THUGS])).toBe(false);
        expect(violatesHeroesThugsExclusion(UNIT_PEASANTS, [UNIT_HEROES])).toBe(false);
      });
    });

    it("should reject recruiting Thugs when Heroes already recruited this interaction", () => {
      const state = createStateWithVillage({
        influencePoints: 20,
        commandTokens: 3,
        unitsRecruitedThisInteraction: [UNIT_HEROES], // Heroes already recruited
      });

      const stateWithOffer = {
        ...state,
        offers: {
          ...state.offers,
          units: [UNIT_THUGS],
        },
      };

      const result = engine.processAction(stateWithOffer, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_THUGS,
        influenceSpent: 20,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Undo: Effect-based abilities must properly reverse state changes
  // =========================================================================

  describe("Undo: Effect-based ability reversal", () => {
    it("should undo Thugs Attack and restore reputation", () => {
      const unit = createThugsUnit("thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        reputation: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      // Activate Thugs Attack (Attack 3 + Rep -1)
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 1, // Attack 3 + Rep -1
      });

      // Verify effects applied
      expect(afterActivate.state.players[0].reputation).toBe(-1);
      expect(
        afterActivate.state.players[0].combatAccumulator.attack.normal
      ).toBe(3);
      expect(afterActivate.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );

      // Undo the activation
      const afterUndo = engine.processAction(
        afterActivate.state,
        "player1",
        { type: "UNDO" }
      );

      // Reputation should be restored
      expect(afterUndo.state.players[0].reputation).toBe(0);
      // Attack should be removed from accumulator
      expect(
        afterUndo.state.players[0].combatAccumulator.attack.normal
      ).toBe(0);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(
        UNIT_STATE_READY
      );
    });

    it("should undo Thugs Influence and restore reputation", () => {
      const unit = createThugsUnit("thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        reputation: 3,
        influencePoints: 5,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Activate Thugs Influence (Influence 4 + Rep -1)
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 2, // Influence 4 + Rep -1
      });

      // Verify effects applied
      expect(afterActivate.state.players[0].reputation).toBe(2);
      expect(afterActivate.state.players[0].influencePoints).toBe(9);
      expect(afterActivate.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );

      // Undo the activation
      const afterUndo = engine.processAction(
        afterActivate.state,
        "player1",
        { type: "UNDO" }
      );

      // Reputation should be restored
      expect(afterUndo.state.players[0].reputation).toBe(3);
      // Influence should be restored
      expect(afterUndo.state.players[0].influencePoints).toBe(5);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(
        UNIT_STATE_READY
      );
    });

    it("should undo Pay Thugs Damage Influence and restore influence", () => {
      const thugsUnit = createThugsUnit("thugs_1");
      const player = createTestPlayer({
        influencePoints: 5,
        units: [thugsUnit],
        commandTokens: 2,
      });

      const combatState = createThugsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE);

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      // Pay influence
      const afterPay = engine.processAction(state, "player1", {
        type: PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
        unitInstanceId: "thugs_1",
      });

      expect(afterPay.state.players[0].influencePoints).toBe(3);
      expect(
        afterPay.state.combat!.paidThugsDamageInfluence["thugs_1"]
      ).toBe(true);

      // Undo the payment
      const afterUndo = engine.processAction(
        afterPay.state,
        "player1",
        { type: "UNDO" }
      );

      // Influence should be restored
      expect(afterUndo.state.players[0].influencePoints).toBe(5);
      // Payment should be removed
      expect(
        afterUndo.state.combat!.paidThugsDamageInfluence["thugs_1"]
      ).toBeUndefined();
    });
  });
});
