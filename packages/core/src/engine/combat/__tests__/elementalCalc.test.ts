/**
 * Elemental Calculation Tests
 *
 * Tests for block efficiency, attack resistances, and elemental interactions.
 */

import { describe, it, expect } from "vitest";
import {
  isBlockEfficient,
  calculateTotalBlock,
  isAttackResisted,
  calculateEffectiveAttack,
  combineResistances,
  getFinalAttackValue,
  getFinalBlockValue,
  NO_RESISTANCES,
  type Resistances,
} from "../elementalCalc.js";
import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
} from "@mage-knight/shared";
import { createTestGameState, createTestPlayer } from "../../__tests__/testHelpers.js";
import type { ActiveModifier } from "../../../types/modifiers.js";
import {
  COMBAT_VALUE_ATTACK,
  COMBAT_VALUE_BLOCK,
  COMBAT_VALUE_RANGED,
  COMBAT_VALUE_SIEGE,
  DURATION_COMBAT,
  EFFECT_COMBAT_VALUE,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../modifierConstants.js";

describe("Block Efficiency", () => {
  describe("isBlockEfficient", () => {
    describe("against Physical attacks", () => {
      it("should be efficient with Physical block", () => {
        expect(isBlockEfficient(ELEMENT_PHYSICAL, ELEMENT_PHYSICAL)).toBe(true);
      });

      it("should be efficient with Fire block", () => {
        expect(isBlockEfficient(ELEMENT_FIRE, ELEMENT_PHYSICAL)).toBe(true);
      });

      it("should be efficient with Ice block", () => {
        expect(isBlockEfficient(ELEMENT_ICE, ELEMENT_PHYSICAL)).toBe(true);
      });

      it("should be efficient with Cold Fire block", () => {
        expect(isBlockEfficient(ELEMENT_COLD_FIRE, ELEMENT_PHYSICAL)).toBe(true);
      });
    });

    describe("against Fire attacks", () => {
      it("should be inefficient with Physical block", () => {
        expect(isBlockEfficient(ELEMENT_PHYSICAL, ELEMENT_FIRE)).toBe(false);
      });

      it("should be inefficient with Fire block (same element)", () => {
        expect(isBlockEfficient(ELEMENT_FIRE, ELEMENT_FIRE)).toBe(false);
      });

      it("should be efficient with Ice block", () => {
        expect(isBlockEfficient(ELEMENT_ICE, ELEMENT_FIRE)).toBe(true);
      });

      it("should be efficient with Cold Fire block", () => {
        expect(isBlockEfficient(ELEMENT_COLD_FIRE, ELEMENT_FIRE)).toBe(true);
      });
    });

    describe("against Ice attacks", () => {
      it("should be inefficient with Physical block", () => {
        expect(isBlockEfficient(ELEMENT_PHYSICAL, ELEMENT_ICE)).toBe(false);
      });

      it("should be efficient with Fire block", () => {
        expect(isBlockEfficient(ELEMENT_FIRE, ELEMENT_ICE)).toBe(true);
      });

      it("should be inefficient with Ice block (same element)", () => {
        expect(isBlockEfficient(ELEMENT_ICE, ELEMENT_ICE)).toBe(false);
      });

      it("should be efficient with Cold Fire block", () => {
        expect(isBlockEfficient(ELEMENT_COLD_FIRE, ELEMENT_ICE)).toBe(true);
      });
    });

    describe("against Cold Fire attacks", () => {
      it("should be inefficient with Physical block", () => {
        expect(isBlockEfficient(ELEMENT_PHYSICAL, ELEMENT_COLD_FIRE)).toBe(false);
      });

      it("should be inefficient with Fire block", () => {
        expect(isBlockEfficient(ELEMENT_FIRE, ELEMENT_COLD_FIRE)).toBe(false);
      });

      it("should be inefficient with Ice block", () => {
        expect(isBlockEfficient(ELEMENT_ICE, ELEMENT_COLD_FIRE)).toBe(false);
      });

      it("should be efficient with Cold Fire block (only Cold Fire)", () => {
        expect(isBlockEfficient(ELEMENT_COLD_FIRE, ELEMENT_COLD_FIRE)).toBe(true);
      });
    });
  });

  describe("calculateTotalBlock", () => {
    it("should count all blocks at full value against Physical", () => {
      const blocks = [
        { element: ELEMENT_PHYSICAL, value: 3 },
        { element: ELEMENT_FIRE, value: 2 },
        { element: ELEMENT_ICE, value: 1 },
      ];
      expect(calculateTotalBlock(blocks, ELEMENT_PHYSICAL)).toBe(6);
    });

    it("should halve inefficient blocks (Physical vs Fire attack)", () => {
      // Physical 6 vs Fire Attack -> 6 / 2 = 3
      const blocks = [{ element: ELEMENT_PHYSICAL, value: 6 }];
      expect(calculateTotalBlock(blocks, ELEMENT_FIRE)).toBe(3);
    });

    it("should combine efficient and inefficient blocks correctly", () => {
      // Ice 3 (efficient) + Physical 6 (inefficient, halved to 3) = 6
      const blocks = [
        { element: ELEMENT_ICE, value: 3 },
        { element: ELEMENT_PHYSICAL, value: 6 },
      ];
      expect(calculateTotalBlock(blocks, ELEMENT_FIRE)).toBe(6);
    });

    it("should round down inefficient blocks", () => {
      // Physical 5 vs Fire Attack -> 5 / 2 = 2.5 -> 2
      const blocks = [{ element: ELEMENT_PHYSICAL, value: 5 }];
      expect(calculateTotalBlock(blocks, ELEMENT_FIRE)).toBe(2);
    });

    it("should handle Cold Fire attacks (only Cold Fire blocks efficient)", () => {
      // Cold Fire 2 (efficient) + Physical 4 (inefficient, halved to 2) + Ice 2 (inefficient, halved to 1) = 5
      const blocks = [
        { element: ELEMENT_COLD_FIRE, value: 2 },
        { element: ELEMENT_PHYSICAL, value: 4 },
        { element: ELEMENT_ICE, value: 2 },
      ];
      expect(calculateTotalBlock(blocks, ELEMENT_COLD_FIRE)).toBe(5);
    });

    it("should handle empty block array", () => {
      expect(calculateTotalBlock([], ELEMENT_PHYSICAL)).toBe(0);
    });

    it("should work with real combat scenario: Physical block vs Fire attack fails", () => {
      // Player has Physical block 6, enemy has Fire Attack 5
      // Effective block: 6 / 2 = 3, which is < 5, so block fails
      const blocks = [{ element: ELEMENT_PHYSICAL, value: 6 }];
      const effectiveBlock = calculateTotalBlock(blocks, ELEMENT_FIRE);
      expect(effectiveBlock).toBe(3);
      expect(effectiveBlock < 5).toBe(true); // Block fails
    });
  });
});

describe("Attack Resistances", () => {
  describe("isAttackResisted", () => {
    it("should resist Physical with Physical resistance", () => {
      const resistances: Resistances = [RESIST_PHYSICAL];
      expect(isAttackResisted(ELEMENT_PHYSICAL, resistances)).toBe(true);
    });

    it("should not resist Physical without Physical resistance", () => {
      expect(isAttackResisted(ELEMENT_PHYSICAL, NO_RESISTANCES)).toBe(false);
    });

    it("should resist Fire with Fire resistance", () => {
      const resistances: Resistances = [RESIST_FIRE];
      expect(isAttackResisted(ELEMENT_FIRE, resistances)).toBe(true);
    });

    it("should resist Ice with Ice resistance", () => {
      const resistances: Resistances = [RESIST_ICE];
      expect(isAttackResisted(ELEMENT_ICE, resistances)).toBe(true);
    });

    it("should resist Cold Fire only with BOTH Fire AND Ice resistance", () => {
      // Only Fire resistance - not enough
      expect(isAttackResisted(ELEMENT_COLD_FIRE, [RESIST_FIRE])).toBe(false);

      // Only Ice resistance - not enough
      expect(isAttackResisted(ELEMENT_COLD_FIRE, [RESIST_ICE])).toBe(false);

      // Both Fire and Ice resistance - resisted
      expect(isAttackResisted(ELEMENT_COLD_FIRE, [RESIST_FIRE, RESIST_ICE])).toBe(true);
    });
  });

  describe("calculateEffectiveAttack", () => {
    it("should deal full damage with no resistances", () => {
      const attacks = [{ element: ELEMENT_FIRE, value: 5 }];
      expect(calculateEffectiveAttack(attacks, NO_RESISTANCES)).toBe(5);
    });

    it("should halve resisted attacks", () => {
      const attacks = [{ element: ELEMENT_FIRE, value: 6 }];
      const resistances: Resistances = [RESIST_FIRE];
      expect(calculateEffectiveAttack(attacks, resistances)).toBe(3);
    });

    it("should round down halved attacks", () => {
      const attacks = [{ element: ELEMENT_FIRE, value: 5 }];
      const resistances: Resistances = [RESIST_FIRE];
      expect(calculateEffectiveAttack(attacks, resistances)).toBe(2);
    });

    it("should combine resisted and unresisted attacks", () => {
      // Physical 4 (resisted, halved to 2) + Fire 6 (not resisted) = 8
      const attacks = [
        { element: ELEMENT_PHYSICAL, value: 4 },
        { element: ELEMENT_FIRE, value: 6 },
      ];
      const resistances: Resistances = [RESIST_PHYSICAL];
      expect(calculateEffectiveAttack(attacks, resistances)).toBe(8);
    });

    it("should handle multiple resistance types", () => {
      // Physical 4 (resisted) + Fire 4 (resisted) = 4/2 + 4/2 = 2 + 2 = 4
      const attacks = [
        { element: ELEMENT_PHYSICAL, value: 4 },
        { element: ELEMENT_FIRE, value: 4 },
      ];
      const resistances: Resistances = [RESIST_PHYSICAL, RESIST_FIRE];
      expect(calculateEffectiveAttack(attacks, resistances)).toBe(4);
    });

    it("should handle Cold Fire against dual resistance", () => {
      // Cold Fire 10 vs Fire+Ice resistance = 10/2 = 5
      const attacks = [{ element: ELEMENT_COLD_FIRE, value: 10 }];
      const resistances: Resistances = [RESIST_FIRE, RESIST_ICE];
      expect(calculateEffectiveAttack(attacks, resistances)).toBe(5);
    });

    it("should not halve Cold Fire with only one resistance", () => {
      const attacks = [{ element: ELEMENT_COLD_FIRE, value: 10 }];

      // Fire resistance only
      expect(calculateEffectiveAttack(attacks, [RESIST_FIRE])).toBe(10);

      // Ice resistance only
      expect(calculateEffectiveAttack(attacks, [RESIST_ICE])).toBe(10);
    });
  });

  describe("combineResistances", () => {
    it("should return no resistances for empty array", () => {
      expect(combineResistances([])).toEqual(NO_RESISTANCES);
    });

    it("should return resistances from single enemy", () => {
      const enemies = [{ resistances: [RESIST_PHYSICAL] as Resistances }];
      expect(combineResistances(enemies)).toEqual([RESIST_PHYSICAL]);
    });

    it("should combine resistances from multiple enemies with OR logic", () => {
      const enemies = [
        { resistances: [RESIST_PHYSICAL] as Resistances },
        { resistances: [RESIST_FIRE] as Resistances },
        { resistances: [RESIST_ICE] as Resistances },
      ];
      expect(combineResistances(enemies)).toEqual([RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE]);
    });

    it("should handle overlapping resistances", () => {
      const enemies = [
        { resistances: [RESIST_PHYSICAL, RESIST_FIRE] as Resistances },
        { resistances: [RESIST_PHYSICAL, RESIST_ICE] as Resistances },
      ];
      expect(combineResistances(enemies)).toEqual([RESIST_PHYSICAL, RESIST_FIRE, RESIST_ICE]);
    });
  });
});

describe("Combat Value Modifiers", () => {
  /**
   * Helper to create a combat value modifier
   */
  function createCombatModifier(
    valueType: typeof COMBAT_VALUE_ATTACK | typeof COMBAT_VALUE_BLOCK | typeof COMBAT_VALUE_RANGED | typeof COMBAT_VALUE_SIEGE,
    amount: number,
    playerId = "player1"
  ): ActiveModifier {
    return {
      id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      source: { type: SOURCE_SKILL, skillId: "test_skill", playerId },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_COMBAT_VALUE,
        valueType,
        amount,
      },
      createdAtRound: 1,
      createdByPlayerId: playerId,
    };
  }

  describe("getFinalAttackValue", () => {
    it("should apply attack bonus from modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 3),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Base attack 2 + modifier bonus 3 = 5
      expect(result).toBe(5);
    });

    it("should stack multiple attack modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 2),
          createCombatModifier(COMBAT_VALUE_ATTACK, 1),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 1 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Base attack 1 + 2 + 1 = 4
      expect(result).toBe(4);
    });

    it("should apply ranged bonus only to ranged attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_RANGED, 2),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 3 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_RANGED);

      // Base attack 3 + ranged bonus 2 = 5
      expect(result).toBe(5);
    });

    it("should NOT apply ranged bonus to melee attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_RANGED, 2),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 3 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Base attack 3 only, ranged bonus does NOT apply to melee
      expect(result).toBe(3);
    });

    it("should apply ranged bonus to siege attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_RANGED, 2),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 3 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_SIEGE);

      // Base attack 3 + ranged bonus 2 = 5 (ranged applies to siege)
      expect(result).toBe(5);
    });

    it("should apply siege bonus only to siege attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_SIEGE, 4),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_SIEGE);

      // Base attack 2 + siege bonus 4 = 6
      expect(result).toBe(6);
    });

    it("should NOT apply siege bonus to melee attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_SIEGE, 4),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Base attack 2 only, siege bonus does NOT apply to melee
      expect(result).toBe(2);
    });

    it("should NOT apply siege bonus to ranged attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_SIEGE, 4),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_RANGED);

      // Base attack 2 only, siege bonus does NOT apply to ranged
      expect(result).toBe(2);
    });

    it("should combine attack, ranged, and siege bonuses for siege attacks", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 1),
          createCombatModifier(COMBAT_VALUE_RANGED, 2),
          createCombatModifier(COMBAT_VALUE_SIEGE, 3),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_SIEGE);

      // Base attack 2 + attack 1 + ranged 2 + siege 3 = 8
      expect(result).toBe(8);
    });

    it("should only apply attack bonus for melee attacks with all modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 1),
          createCombatModifier(COMBAT_VALUE_RANGED, 2),
          createCombatModifier(COMBAT_VALUE_SIEGE, 3),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Base attack 2 + attack 1 = 3 (ranged and siege don't apply)
      expect(result).toBe(3);
    });

    it("should apply modifiers after resistance halving", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 3),
        ],
      });

      // 6 Fire attack against Fire resistance = 3, plus 3 bonus = 6
      const attacks = [{ element: ELEMENT_FIRE, value: 6 }];
      const resistances: Resistances = [RESIST_FIRE];
      const result = getFinalAttackValue(attacks, resistances, state, "player1", COMBAT_TYPE_MELEE);

      expect(result).toBe(6);
    });

    it("should return base attack when no modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 5 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      expect(result).toBe(5);
    });

    it("should not apply other player modifiers with SCOPE_SELF", () => {
      const player1 = createTestPlayer({ id: "player1" });
      const player2 = createTestPlayer({ id: "player2" });
      const state = createTestGameState({
        players: [player1, player2],
        activeModifiers: [
          // Player 2's modifier should not affect player 1
          createCombatModifier(COMBAT_VALUE_ATTACK, 10, "player2"),
        ],
      });

      const attacks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalAttackValue(attacks, NO_RESISTANCES, state, "player1", COMBAT_TYPE_MELEE);

      // Only base attack, no bonus from player2's modifier
      expect(result).toBe(2);
    });
  });

  describe("getFinalBlockValue", () => {
    it("should apply block bonus from modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_BLOCK, 2),
        ],
      });

      const blocks = [{ element: ELEMENT_PHYSICAL, value: 3 }];
      const result = getFinalBlockValue(blocks, ELEMENT_PHYSICAL, state, "player1");

      // Base block 3 + modifier bonus 2 = 5
      expect(result).toBe(5);
    });

    it("should stack multiple block modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_BLOCK, 2),
          createCombatModifier(COMBAT_VALUE_BLOCK, 3),
        ],
      });

      const blocks = [{ element: ELEMENT_PHYSICAL, value: 1 }];
      const result = getFinalBlockValue(blocks, ELEMENT_PHYSICAL, state, "player1");

      // Base block 1 + 2 + 3 = 6
      expect(result).toBe(6);
    });

    it("should apply modifiers after efficiency halving", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_BLOCK, 3),
        ],
      });

      // Physical 6 block against Fire attack = 3 (halved), plus 3 bonus = 6
      const blocks = [{ element: ELEMENT_PHYSICAL, value: 6 }];
      const result = getFinalBlockValue(blocks, ELEMENT_FIRE, state, "player1");

      expect(result).toBe(6);
    });

    it("should return base block when no modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [],
      });

      const blocks = [{ element: ELEMENT_PHYSICAL, value: 4 }];
      const result = getFinalBlockValue(blocks, ELEMENT_PHYSICAL, state, "player1");

      expect(result).toBe(4);
    });

    it("should not apply attack modifiers to block", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_ATTACK, 10),
        ],
      });

      const blocks = [{ element: ELEMENT_PHYSICAL, value: 3 }];
      const result = getFinalBlockValue(blocks, ELEMENT_PHYSICAL, state, "player1");

      // Only base block, attack modifier doesn't apply
      expect(result).toBe(3);
    });

    it("should not apply other player modifiers with SCOPE_SELF", () => {
      const player1 = createTestPlayer({ id: "player1" });
      const player2 = createTestPlayer({ id: "player2" });
      const state = createTestGameState({
        players: [player1, player2],
        activeModifiers: [
          createCombatModifier(COMBAT_VALUE_BLOCK, 10, "player2"),
        ],
      });

      const blocks = [{ element: ELEMENT_PHYSICAL, value: 2 }];
      const result = getFinalBlockValue(blocks, ELEMENT_PHYSICAL, state, "player1");

      // Only base block, no bonus from player2's modifier
      expect(result).toBe(2);
    });
  });
});
