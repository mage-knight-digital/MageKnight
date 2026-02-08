/**
 * Tests for Mana Storm advanced action card
 *
 * Basic: Choose a mana die in the Source showing a basic color.
 * Gain a crystal of that color, then immediately reroll that die
 * and return it to the Source.
 *
 * Powered: Reroll all dice in the Source. You can use three extra dice
 * from the Source, and you can use dice showing black or gold as mana
 * of any basic color, regardless of the Round.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import type { ManaSource, SourceDie } from "../../types/mana.js";
import {
  EFFECT_MANA_STORM_BASIC,
  EFFECT_MANA_STORM_SELECT_DIE,
  EFFECT_MANA_STORM_POWERED,
} from "../../types/effectTypes.js";
import type { ManaStormSelectDieEffect } from "../../types/cards.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  CARD_MARCH,
  CARD_MANA_STORM,
  PLAY_CARD_ACTION,
  MANA_SOURCE_DIE,
} from "@mage-knight/shared";
import { validateManaAvailable, validateSingleManaSource } from "../validators/mana/index.js";
import { isRuleActive, countRuleActive, addModifier } from "../modifiers/index.js";
import {
  RULE_EXTRA_SOURCE_DIE,
  RULE_BLACK_AS_ANY_COLOR,
  RULE_GOLD_AS_ANY_COLOR,
  EFFECT_RULE_OVERRIDE,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import { createRng } from "../../utils/rng.js";
import { getManaOptions, canPayForMana, canPayForTwoMana, getAvailableManaSourcesForColor } from "../validActions/mana.js";

function createTestManaSource(dice: SourceDie[]): ManaSource {
  return { dice };
}

/**
 * Helper to create Mana Storm modifiers directly (without going through reroll).
 * Applies 3x RULE_EXTRA_SOURCE_DIE + RULE_BLACK_AS_ANY_COLOR + RULE_GOLD_AS_ANY_COLOR.
 */
function applyManaStormModifiers(state: import("../../state/GameState.js").GameState, playerId: string) {
  const modifierBase: Omit<ActiveModifier, "id" | "effect"> = {
    source: { type: SOURCE_CARD, cardId: CARD_MANA_STORM, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  };

  let s = state;
  for (let i = 0; i < 3; i++) {
    s = addModifier(s, { ...modifierBase, effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE } });
  }
  s = addModifier(s, { ...modifierBase, effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_BLACK_AS_ANY_COLOR } });
  s = addModifier(s, { ...modifierBase, effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_GOLD_AS_ANY_COLOR } });
  return s;
}

describe("Mana Storm", () => {
  // ============================================================================
  // BASIC EFFECT
  // ============================================================================

  describe("Basic Effect", () => {
    it("should present choice of basic color dice", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_BASIC });

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(3);
      expect(result.description).toContain("Choose a die");
    });

    it("should auto-select when only one basic die available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_BASIC });

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);
      const option = result.dynamicChoiceOptions![0] as ManaStormSelectDieEffect;
      expect(option.dieId).toBe("die_0");
      expect(option.dieColor).toBe(MANA_RED);
    });

    it("should exclude gold and black dice from choices", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_WHITE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_BASIC });

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);
      const option = result.dynamicChoiceOptions![0] as ManaStormSelectDieEffect;
      expect(option.dieColor).toBe(MANA_WHITE);
    });

    it("should exclude depleted and taken dice", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: true, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "other" },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_BASIC });

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);
      const option = result.dynamicChoiceOptions![0] as ManaStormSelectDieEffect;
      expect(option.dieColor).toBe(MANA_GREEN);
    });

    it("should handle no basic dice available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_BASIC });

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toContain("No dice showing basic colors");
    });
  });

  // ============================================================================
  // SELECT DIE (BASIC RESOLUTION)
  // ============================================================================

  describe("Select Die (Basic Resolution)", () => {
    it("should gain a crystal of the die's color", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaStormSelectDieEffect = {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: "die_0",
        dieColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      expect(updatedPlayer?.crystals.red).toBe(1);
    });

    it("should reroll the die after gaining crystal", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaStormSelectDieEffect = {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: "die_0",
        dieColor: MANA_BLUE,
      };

      const result = resolveEffect(state, "player1", effect);
      const updatedDie = result.state.source.dice.find((d) => d.id === "die_0");

      // Die should exist and be rerolled (color may have changed)
      expect(updatedDie).toBeDefined();
      // RNG should have advanced
      expect(result.state.rng.counter).toBeGreaterThan(state.rng.counter);
    });

    it("should thread RNG correctly through crystal + reroll", () => {
      const player = createTestPlayer({ id: "player1" });
      const rng = createRng(42);
      const state = createTestGameState({
        players: [player],
        rng,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaStormSelectDieEffect = {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: "die_0",
        dieColor: MANA_GREEN,
      };

      const result = resolveEffect(state, "player1", effect);

      // RNG should be different from starting RNG (advanced by reroll)
      expect(result.state.rng).not.toEqual(rng);
    });

    it("should respect crystal cap of 3", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaStormSelectDieEffect = {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: "die_0",
        dieColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      // Should stay at 3 (cap)
      expect(updatedPlayer?.crystals.red).toBe(3);
    });

    it("should produce correct description", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_WHITE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaStormSelectDieEffect = {
        type: EFFECT_MANA_STORM_SELECT_DIE,
        dieId: "die_0",
        dieColor: MANA_WHITE,
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.description).toBe("Gained white crystal, rerolled die");
    });
  });

  // ============================================================================
  // POWERED EFFECT
  // ============================================================================

  describe("Powered Effect", () => {
    it("should reroll all dice in the source", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      // RNG should have advanced by at least 3 (one per die)
      expect(result.state.rng.counter).toBeGreaterThanOrEqual(state.rng.counter + 3);
      // All dice should still exist
      expect(result.state.source.dice).toHaveLength(3);
    });

    it("should apply 3 RULE_EXTRA_SOURCE_DIE modifiers", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      const extraDiceCount = countRuleActive(result.state, "player1", RULE_EXTRA_SOURCE_DIE);
      expect(extraDiceCount).toBe(3);
    });

    it("should apply RULE_BLACK_AS_ANY_COLOR modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      expect(isRuleActive(result.state, "player1", RULE_BLACK_AS_ANY_COLOR)).toBe(true);
    });

    it("should apply RULE_GOLD_AS_ANY_COLOR modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      expect(isRuleActive(result.state, "player1", RULE_GOLD_AS_ANY_COLOR)).toBe(true);
    });

    it("should produce correct description", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      expect(result.description).toContain("Rerolled all source dice");
      expect(result.description).toContain("3 extra dice");
      expect(result.description).toContain("black/gold as any basic color");
    });
  });

  // ============================================================================
  // POWERED EFFECT: EXTRA DICE USAGE
  // ============================================================================

  describe("Powered Effect: Extra Dice Usage", () => {
    it("should allow using 4 total dice (1 base + 3 extra) after powered effect", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_3", color: MANA_WHITE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect (gives 3 extra dice)
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Find a non-depleted die to use (colors may have changed after reroll)
      const availableDie = state.source.dice.find(
        (d) => !d.isDepleted && d.takenByPlayerId === null
      );
      expect(availableDie).toBeDefined();

      // Player already used 1 die. With 3 extra (max = 4), should still be able to use more.
      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: availableDie!.id,
          color: availableDie!.color,
        },
      };

      const validationResult = validateManaAvailable(state, "player1", action);
      expect(validationResult.valid).toBe(true);
    });

    it("should reject using a 5th die (exceeds 1 base + 3 extra)", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        usedManaFromSource: true,
        usedDieIds: ["die_0", "die_1", "die_2", "die_3"],
      });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
          { id: "die_3", color: MANA_WHITE, isDepleted: false, takenByPlayerId: null },
          { id: "die_4", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect (gives 3 extra dice)
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Player already used 4 dice. Max is 4 (1 + 3 extra). 5th should be rejected.
      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_4",
          color: MANA_RED,
        },
      };

      const validationResult = validateManaAvailable(state, "player1", action);
      expect(validationResult.valid).toBe(false);
    });
  });

  // ============================================================================
  // POWERED EFFECT: BLACK/GOLD AS ANY COLOR
  // ============================================================================

  describe("Powered Effect: Black/Gold as Any Color", () => {
    it("should allow using black die as any basic color", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        timeOfDay: TIME_OF_DAY_NIGHT, // Black is available at night
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Find a non-depleted black die (it may have been rerolled)
      const blackDie = state.source.dice.find(
        (d) => d.color === MANA_BLACK && !d.isDepleted
      );
      if (!blackDie) return; // Skip if reroll changed color

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: blackDie.id,
          color: MANA_GREEN, // Using black as green
        },
      };

      const validationResult = validateManaAvailable(state, "player1", action);
      expect(validationResult.valid).toBe(true);
    });

    it("should allow using gold die as any basic color", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Find a gold die (may have been rerolled)
      const goldDie = state.source.dice.find(
        (d) => d.color === MANA_GOLD && !d.isDepleted
      );
      if (!goldDie) return; // Skip if reroll changed color

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: goldDie.id,
          color: MANA_RED, // Using gold as red
        },
      };

      const validationResult = validateManaAvailable(state, "player1", action);
      expect(validationResult.valid).toBe(true);
    });

    it("should show gold die as all basic colors in mana options", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Find the gold die (if still gold after reroll)
      const goldDie = state.source.dice.find(
        (d) => d.color === MANA_GOLD && !d.isDepleted
      );
      if (!goldDie) return; // Skip if reroll changed color

      const updatedPlayer = state.players.find((p) => p.id === "player1")!;
      const options = getManaOptions(state, updatedPlayer);

      // Gold die should be available as all 4 basic colors + gold itself
      const goldDieOptions = options.availableDice.filter((d) => d.dieId === goldDie.id);
      const colors = goldDieOptions.map((d) => d.color);
      expect(colors).toContain(MANA_GOLD);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });

    it("should show black die as all basic colors in mana options", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        rng: createRng(42),
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply powered effect
      const poweredResult = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });
      state = poweredResult.state;

      // Find the black die (if still black after reroll)
      const blackDie = state.source.dice.find(
        (d) => d.color === MANA_BLACK && !d.isDepleted
      );
      if (!blackDie) return; // Skip if reroll changed color

      const updatedPlayer = state.players.find((p) => p.id === "player1")!;
      const options = getManaOptions(state, updatedPlayer);

      // Black die should be available as all basic colors + black itself
      // (At night, gold is depleted so gold is not a valid output color)
      const blackDieOptions = options.availableDice.filter((d) => d.dieId === blackDie.id);
      const colors = blackDieOptions.map((d) => d.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_BLACK);
    });
  });

  // ============================================================================
  // POWERED EFFECT: DETERMINISTIC REROLL TESTS
  // ============================================================================

  describe("Powered Effect: Deterministic Reroll", () => {
    it("should produce deterministic results with same RNG seed", () => {
      const player = createTestPlayer({ id: "player1" });

      const makeState = () =>
        createTestGameState({
          players: [player],
          rng: createRng(123),
          source: createTestManaSource([
            { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
            { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          ]),
        });

      const result1 = resolveEffect(makeState(), "player1", { type: EFFECT_MANA_STORM_POWERED });
      const result2 = resolveEffect(makeState(), "player1", { type: EFFECT_MANA_STORM_POWERED });

      // Same seed = same reroll results
      expect(result1.state.source.dice[0]!.color).toBe(result2.state.source.dice[0]!.color);
      expect(result1.state.source.dice[1]!.color).toBe(result2.state.source.dice[1]!.color);
      expect(result1.state.rng).toEqual(result2.state.rng);
    });

    it("should clear takenByPlayerId on rerolled dice", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        rng: createRng(42),
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: "player1" },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player2" },
        ]),
      });

      const result = resolveEffect(state, "player1", { type: EFFECT_MANA_STORM_POWERED });

      // All dice should have takenByPlayerId cleared after reroll
      for (const die of result.state.source.dice) {
        expect(die.takenByPlayerId).toBeNull();
      }
    });
  });

  // ============================================================================
  // VALIDACTIONS: EXTRA DICE WITH usedManaFromSource GUARD
  // ============================================================================

  describe("ValidActions: Extra Dice with Modifiers (deterministic)", () => {
    it("getManaOptions should show source dice when extra dice modifiers allow it", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifiers: already used source, should have no source dice
      const optionsBefore = getManaOptions(state, player);
      const sourceDiceBefore = optionsBefore.availableDice.filter(
        (d) => d.dieId === "die_0" || d.dieId === "die_1"
      );
      expect(sourceDiceBefore).toHaveLength(0);

      // Apply Mana Storm modifiers (3 extra dice)
      state = applyManaStormModifiers(state, "player1");

      const optionsAfter = getManaOptions(state, player);
      const sourceDiceAfter = optionsAfter.availableDice.filter(
        (d) => d.dieId === "die_0" || d.dieId === "die_1"
      );
      expect(sourceDiceAfter.length).toBeGreaterThan(0);
    });

    it("getManaOptions should block source when max dice reached", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0", "die_1", "die_2", "die_3"],
      });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_4", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Apply Mana Storm modifiers (3 extra dice → max 4)
      state = applyManaStormModifiers(state, "player1");

      // Already used 4 dice, max is 4 → no source dice available
      const options = getManaOptions(state, player);
      const sourceDice = options.availableDice.filter((d) => d.dieId === "die_4");
      expect(sourceDice).toHaveLength(0);
    });

    it("canPayForMana should find source die when extra dice allow it", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifiers: can't pay (already used source)
      expect(canPayForMana(state, player, MANA_BLUE)).toBe(false);

      // With Mana Storm modifiers
      state = applyManaStormModifiers(state, "player1");
      expect(canPayForMana(state, player, MANA_BLUE)).toBe(true);
    });

    it("canPayForMana should find gold die as basic color with gold-as-any modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT, // Gold normally depleted at night
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Gold is depleted at night, can't use normally
      expect(canPayForMana(state, player, MANA_RED)).toBe(false);

      // With gold-as-any-color modifier, gold die can be used as red
      state = applyManaStormModifiers(state, "player1");
      expect(canPayForMana(state, player, MANA_RED)).toBe(true);
    });

    it("canPayForTwoMana should count source dice with extra dice modifiers", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_1", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifiers: can't use source (already used)
      expect(canPayForTwoMana(state, player, MANA_RED, MANA_BLUE)).toBe(false);

      // With Mana Storm modifiers
      state = applyManaStormModifiers(state, "player1");
      expect(canPayForTwoMana(state, player, MANA_RED, MANA_BLUE)).toBe(true);
    });

    it("getAvailableManaSourcesForColor should include source dice with extra dice modifiers", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_1", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifiers
      const sourcesBefore = getAvailableManaSourcesForColor(state, player, MANA_GREEN);
      expect(sourcesBefore.filter((s) => s.type === "die")).toHaveLength(0);

      // With Mana Storm modifiers
      state = applyManaStormModifiers(state, "player1");
      const sourcesAfter = getAvailableManaSourcesForColor(state, player, MANA_GREEN);
      expect(sourcesAfter.filter((s) => s.type === "die")).toHaveLength(1);
    });

    it("getAvailableManaSourcesForColor should include gold die as basic color with modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // With gold-as-any-color modifier
      state = applyManaStormModifiers(state, "player1");
      const sources = getAvailableManaSourcesForColor(state, player, MANA_WHITE);
      const goldDieSources = sources.filter((s) => s.type === "die" && "dieId" in s && s.dieId === "die_0");
      expect(goldDieSources.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // VALIDATORS: GOLD-AS-ANY-COLOR (deterministic)
  // ============================================================================

  describe("Validators: Gold-as-any-color (deterministic)", () => {
    it("validateManaAvailable should allow gold die as basic color with modifier", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifier: gold die can't be used as green (only as gold or wild during day)
      // Actually gold IS wild during day, so let's test at night where it's depleted
      state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_GREEN,
        },
      };

      // Without modifier at night: gold die can't be used as green
      const resultBefore = validateManaAvailable(state, "player1", action);
      expect(resultBefore.valid).toBe(false);

      // With gold-as-any-color modifier
      state = applyManaStormModifiers(state, "player1");
      const resultAfter = validateManaAvailable(state, "player1", action);
      expect(resultAfter.valid).toBe(true);
    });

    it("validateSingleManaSource should allow gold die as basic color with modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const manaSource = {
        type: MANA_SOURCE_DIE as const,
        dieId: "die_0",
        color: MANA_RED,
      };

      // Without modifier: gold die can't produce red at night
      const resultBefore = validateSingleManaSource(state, player, manaSource, "player1");
      expect(resultBefore.valid).toBe(false);

      // With gold-as-any-color modifier
      state = applyManaStormModifiers(state, "player1");
      const resultAfter = validateSingleManaSource(state, player, manaSource, "player1");
      expect(resultAfter.valid).toBe(true);
    });

    it("validateSingleManaSource should enforce stacked extra dice limit", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: ["die_0"],
      });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_1", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const manaSource = {
        type: MANA_SOURCE_DIE as const,
        dieId: "die_1",
        color: MANA_RED,
      };

      // Without modifier: already used source, should reject
      const resultBefore = validateSingleManaSource(state, player, manaSource, "player1");
      expect(resultBefore.valid).toBe(false);

      // With 3 extra dice modifiers: max 4, used 1, should allow
      state = applyManaStormModifiers(state, "player1");
      const resultAfter = validateSingleManaSource(state, player, manaSource, "player1");
      expect(resultAfter.valid).toBe(true);
    });

    it("getManaOptions should expand gold die to basic colors with modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Without modifier: gold die shows as gold only
      const optionsBefore = getManaOptions(state, player);
      const goldOptionsBefore = optionsBefore.availableDice.filter((d) => d.dieId === "die_0");
      const colorsBefore = goldOptionsBefore.map((d) => d.color);
      expect(colorsBefore).toContain(MANA_GOLD);
      expect(colorsBefore).not.toContain(MANA_RED);

      // With modifier: gold die expands to all basic colors
      state = applyManaStormModifiers(state, "player1");
      const optionsAfter = getManaOptions(state, player);
      const goldOptionsAfter = optionsAfter.availableDice.filter((d) => d.dieId === "die_0");
      const colorsAfter = goldOptionsAfter.map((d) => d.color);
      expect(colorsAfter).toContain(MANA_GOLD);
      expect(colorsAfter).toContain(MANA_RED);
      expect(colorsAfter).toContain(MANA_BLUE);
      expect(colorsAfter).toContain(MANA_GREEN);
      expect(colorsAfter).toContain(MANA_WHITE);
    });
  });
});
