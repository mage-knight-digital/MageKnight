/**
 * Tests for RULE_BLACK_AS_ANY_COLOR modifier (Mana Pull basic effect)
 *
 * Mana Pull (Arythea): "You can use one additional mana die from the Source this turn.
 * If that die is black, use it to produce mana of any color."
 */

import { describe, it, expect } from "vitest";
import { validateManaAvailable } from "../validators/mana/index.js";
import { addModifier } from "../modifiers/index.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { ManaSource, SourceDie } from "../../state/GameState.js";
import {
  PLAY_CARD_ACTION,
  MANA_SOURCE_DIE,
  MANA_RED,
  MANA_BLUE,
  MANA_BLACK,
  MANA_GOLD,
  CARD_RAGE,
} from "@mage-knight/shared";
import {
  RULE_BLACK_AS_ANY_COLOR,
  RULE_EXTRA_SOURCE_DIE,
  EFFECT_RULE_OVERRIDE,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import { BASIC_ACTION_CARDS } from "../../data/basicActions/index.js";

function createTestManaSource(dice: SourceDie[]): ManaSource {
  return { dice };
}

describe("RULE_BLACK_AS_ANY_COLOR (Mana Pull basic effect)", () => {
  function createBlackAsAnyColorModifier(playerId: string): Omit<ActiveModifier, "id"> {
    return {
      source: { type: SOURCE_CARD, cardId: "mana_pull", playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_BLACK_AS_ANY_COLOR },
      createdAtRound: 1,
      createdByPlayerId: playerId,
    };
  }

  function createExtraSourceDieModifier(playerId: string): Omit<ActiveModifier, "id"> {
    return {
      source: { type: SOURCE_CARD, cardId: "mana_pull", playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE },
      createdAtRound: 1,
      createdByPlayerId: playerId,
    };
  }

  describe("with RULE_BLACK_AS_ANY_COLOR active", () => {
    it("should allow using black die as red mana", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Add the black-as-any-color modifier
      state = addModifier(state, createBlackAsAnyColorModifier("player1"));

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_RED, // Declaring black die as red
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("should allow using black die as blue mana", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      state = addModifier(state, createBlackAsAnyColorModifier("player1"));

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_BLUE,
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("should allow using black die as gold mana (any color means ANY)", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      state = addModifier(state, createBlackAsAnyColorModifier("player1"));

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_GOLD, // Can use black as gold with Mana Pull!
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("should still require declaring a color (can't use black as black with this rule - same behavior)", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      state = addModifier(state, createBlackAsAnyColorModifier("player1"));

      // Using black die as black mana still works (exact match)
      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_BLACK,
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });
  });

  describe("without RULE_BLACK_AS_ANY_COLOR", () => {
    it("should NOT allow using black die declared as red mana", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // No modifier added

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_RED, // Can't declare black as red without the rule
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(false);
      expect(!result.valid && result.error.code).toBe("DIE_COLOR_MISMATCH");
    });

    it("should only allow using black die as black mana", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_BLACK,
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });
  });

  describe("Mana Pull basic effect applies both modifiers", () => {
    it("should have both RULE_EXTRA_SOURCE_DIE and RULE_BLACK_AS_ANY_COLOR with Mana Pull basic", () => {
      // This tests that resolving Mana Pull's basic effect applies both modifiers
      // We verify this indirectly by checking the card definition uses the compound effect
      const manaPull = BASIC_ACTION_CARDS["arythea_mana_pull"];

      expect(manaPull.basicEffect.type).toBe("compound");
      expect(manaPull.basicEffect.effects).toHaveLength(2);

      // First effect is the extra source die
      expect(manaPull.basicEffect.effects[0].type).toBe("apply_modifier");
      expect(manaPull.basicEffect.effects[0].modifier.rule).toBe(RULE_EXTRA_SOURCE_DIE);

      // Second effect is black as any color
      expect(manaPull.basicEffect.effects[1].type).toBe("apply_modifier");
      expect(manaPull.basicEffect.effects[1].modifier.rule).toBe(RULE_BLACK_AS_ANY_COLOR);
    });

    it("should allow using second die when both modifiers are active", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true, // Already used one die
      });
      let state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Add both modifiers (as Mana Pull basic would)
      state = addModifier(state, createExtraSourceDieModifier("player1"));
      state = addModifier(state, createBlackAsAnyColorModifier("player1"));

      // Use the black die as red mana (even though player already used source)
      const action = {
        type: PLAY_CARD_ACTION as const,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE as const,
          dieId: "die_0",
          color: MANA_RED,
        },
      };

      const result = validateManaAvailable(state, "player1", action);
      expect(result.valid).toBe(true);
    });
  });
});
