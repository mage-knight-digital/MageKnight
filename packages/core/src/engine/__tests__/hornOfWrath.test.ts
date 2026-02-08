/**
 * Tests for Horn of Wrath artifact
 *
 * Basic: Siege Attack 5. Roll mana die - wound if black or red.
 * Powered (destroy): Siege Attack 5 + choose 0-5 bonus.
 *   Roll 1 die per bonus chosen. Wound per black/red result.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import {
  EFFECT_ROLL_DIE_FOR_WOUND,
  EFFECT_CHOOSE_BONUS_WITH_RISK,
  EFFECT_RESOLVE_BONUS_CHOICE,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import type {
  RollDieForWoundEffect,
  ChooseBonusWithRiskEffect,
  ResolveBonusChoiceEffect,
} from "../../types/cards.js";
import {
  CARD_WOUND,
  CARD_HORN_OF_WRATH,
  MANA_RED,
  MANA_BLACK,
} from "@mage-knight/shared";
import { createRng } from "../../utils/rng.js";
import { HORN_OF_WRATH_CARDS } from "../../data/artifacts/hornOfWrath.js";

describe("Horn of Wrath", () => {
  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      const card = HORN_OF_WRATH_CARDS[CARD_HORN_OF_WRATH];
      expect(card).toBeDefined();
      expect(card!.name).toBe("Horn of Wrath");
      expect(card!.destroyOnPowered).toBe(true);
      expect(card!.sidewaysValue).toBe(1);
    });
  });

  // ============================================================================
  // BASIC EFFECT: Roll Die for Wound
  // ============================================================================

  describe("Roll Die for Wound", () => {
    it("should roll specified number of dice and apply wounds for matching colors", () => {
      // Use a seed that produces a known result — we'll test the mechanics
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: RollDieForWoundEffect = {
        type: EFFECT_ROLL_DIE_FOR_WOUND,
        diceCount: 1,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      // Result should describe the roll
      expect(result.description).toContain("Rolled:");

      // RNG should have advanced
      expect(result.state.rng.counter).toBeGreaterThan(state.rng.counter);
    });

    it("should not add wounds when rolling a safe color", () => {
      // We need a seed that produces a non-black, non-red result
      // Let's try multiple seeds and find one that gives a safe color
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });

      // Try seeds until we find one that rolls a safe color (blue, green, white, gold)
      let safeState: ReturnType<typeof resolveEffect> | null = null;
      for (let seed = 0; seed < 100; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollDieForWoundEffect = {
          type: EFFECT_ROLL_DIE_FOR_WOUND,
          diceCount: 1,
          woundColors: [MANA_BLACK, MANA_RED],
        };

        const result = resolveEffect(state, "player1", effect);

        // Check if no wound was added
        const woundsInHand = result.state.players[0]!.hand.filter(
          (c) => c === CARD_WOUND
        ).length;

        if (woundsInHand === 0) {
          safeState = result;
          break;
        }
      }

      expect(safeState).not.toBeNull();
      expect(safeState!.description).toContain("No wounds");
    });

    it("should add wound when rolling black or red", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });

      // Try seeds until we find one that rolls black or red
      let woundState: ReturnType<typeof resolveEffect> | null = null;
      for (let seed = 0; seed < 100; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollDieForWoundEffect = {
          type: EFFECT_ROLL_DIE_FOR_WOUND,
          diceCount: 1,
          woundColors: [MANA_BLACK, MANA_RED],
        };

        const result = resolveEffect(state, "player1", effect);

        const woundsInHand = result.state.players[0]!.hand.filter(
          (c) => c === CARD_WOUND
        ).length;

        if (woundsInHand > 0) {
          woundState = result;
          break;
        }
      }

      expect(woundState).not.toBeNull();
      expect(woundState!.description).toContain("Gained 1 wound");
    });

    it("should handle multiple dice correctly", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: RollDieForWoundEffect = {
        type: EFFECT_ROLL_DIE_FOR_WOUND,
        diceCount: 5,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      // Should have advanced RNG by at least 5 steps
      expect(result.state.rng.counter).toBeGreaterThanOrEqual(
        state.rng.counter + 5
      );

      // Description should show all roll results
      expect(result.description).toContain("Rolled:");
    });
  });

  // ============================================================================
  // POWERED EFFECT: Choose Bonus with Risk
  // ============================================================================

  describe("Choose Bonus with Risk", () => {
    it("should present choices from 0 to maxBonus", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
      });

      const effect: ChooseBonusWithRiskEffect = {
        type: EFFECT_CHOOSE_BONUS_WITH_RISK,
        maxBonus: 5,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(6); // 0, 1, 2, 3, 4, 5
    });

    it("should generate ResolveBonusChoice options with correct bonus values", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
      });

      const effect: ChooseBonusWithRiskEffect = {
        type: EFFECT_CHOOSE_BONUS_WITH_RISK,
        maxBonus: 5,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      const options = result.dynamicChoiceOptions as readonly ResolveBonusChoiceEffect[];
      expect(options![0]!.bonus).toBe(0);
      expect(options![1]!.bonus).toBe(1);
      expect(options![5]!.bonus).toBe(5);
      expect(options![0]!.type).toBe(EFFECT_RESOLVE_BONUS_CHOICE);
    });
  });

  // ============================================================================
  // RESOLVE BONUS CHOICE
  // ============================================================================

  describe("Resolve Bonus Choice", () => {
    it("should add siege attack when bonus > 0", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: ResolveBonusChoiceEffect = {
        type: EFFECT_RESOLVE_BONUS_CHOICE,
        bonus: 3,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      // Should have gained +3 siege attack
      const siegeAttack = result.state.players[0]!.combatAccumulator.attack.siege;
      expect(siegeAttack).toBe(3);
    });

    it("should not roll dice when bonus is 0", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: ResolveBonusChoiceEffect = {
        type: EFFECT_RESOLVE_BONUS_CHOICE,
        bonus: 0,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      // No siege attack added
      expect(result.state.players[0]!.combatAccumulator.attack.siege).toBe(0);
      // No wounds added
      const woundsInHand = result.state.players[0]!.hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsInHand).toBe(0);
      // RNG should not have advanced (no dice rolled)
      expect(result.state.rng.counter).toBe(state.rng.counter);
      expect(result.description).toContain("No bonus chosen");
    });

    it("should roll dice and potentially add wounds for bonus > 0", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
      });

      const effect: ResolveBonusChoiceEffect = {
        type: EFFECT_RESOLVE_BONUS_CHOICE,
        bonus: 5,
        attackType: COMBAT_TYPE_SIEGE,
        woundColors: [MANA_BLACK, MANA_RED],
      };

      const result = resolveEffect(state, "player1", effect);

      // Should have gained +5 siege attack regardless of roll results
      expect(result.state.players[0]!.combatAccumulator.attack.siege).toBe(5);

      // RNG should have advanced by at least 5 (for 5 dice rolls)
      expect(result.state.rng.counter).toBeGreaterThanOrEqual(
        state.rng.counter + 5
      );

      // Description should include roll results
      expect(result.description).toContain("Rolled:");
    });

    it("should add wounds for each black/red result in multi-die roll", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });

      // Find a seed that produces at least 1 wound with 5 dice
      // (very likely with 5 dice — 33% chance each = ~1.67 expected)
      let foundWoundSeed = false;
      for (let seed = 0; seed < 50; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: ResolveBonusChoiceEffect = {
          type: EFFECT_RESOLVE_BONUS_CHOICE,
          bonus: 5,
          attackType: COMBAT_TYPE_SIEGE,
          woundColors: [MANA_BLACK, MANA_RED],
        };

        const result = resolveEffect(state, "player1", effect);

        const woundsInHand = result.state.players[0]!.hand.filter(
          (c) => c === CARD_WOUND
        ).length;

        if (woundsInHand > 0) {
          foundWoundSeed = true;
          // Verify wounds were tracked for Banner of Protection
          expect(
            result.state.players[0]!.woundsReceivedThisTurn.hand
          ).toBe(woundsInHand);
          break;
        }
      }

      expect(foundWoundSeed).toBe(true);
    });

    it("should track wounds received for Banner of Protection", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });

      // Find a seed that produces wounds
      for (let seed = 0; seed < 50; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollDieForWoundEffect = {
          type: EFFECT_ROLL_DIE_FOR_WOUND,
          diceCount: 1,
          woundColors: [MANA_BLACK, MANA_RED],
        };

        const result = resolveEffect(state, "player1", effect);
        const woundsInHand = result.state.players[0]!.hand.filter(
          (c) => c === CARD_WOUND
        ).length;

        if (woundsInHand > 0) {
          expect(
            result.state.players[0]!.woundsReceivedThisTurn.hand
          ).toBe(1);
          return;
        }
      }

      // If we get here, no seed produced a wound (extremely unlikely)
      throw new Error("Could not find a seed that produces a wound");
    });
  });

  // ============================================================================
  // PROBABILITY VERIFICATION
  // ============================================================================

  describe("probability distribution", () => {
    it("should produce wound roughly 33% of the time (2 of 6 colors)", () => {
      const player = createTestPlayer({
        hand: [CARD_HORN_OF_WRATH],
      });

      let woundCount = 0;
      const totalRolls = 600;

      for (let seed = 0; seed < totalRolls; seed++) {
        const state = createTestGameState({
          players: [player],
          rng: createRng(seed),
        });

        const effect: RollDieForWoundEffect = {
          type: EFFECT_ROLL_DIE_FOR_WOUND,
          diceCount: 1,
          woundColors: [MANA_BLACK, MANA_RED],
        };

        const result = resolveEffect(state, "player1", effect);
        const woundsInHand = result.state.players[0]!.hand.filter(
          (c) => c === CARD_WOUND
        ).length;

        if (woundsInHand > 0) {
          woundCount++;
        }
      }

      // Expected: ~200 wounds out of 600 rolls (33.3%)
      // Allow wide margin: 20-47% (120-280 wounds)
      const percentage = (woundCount / totalRolls) * 100;
      expect(percentage).toBeGreaterThan(20);
      expect(percentage).toBeLessThan(47);
    });
  });
});
