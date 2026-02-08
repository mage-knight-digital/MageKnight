/**
 * Tests for USE_MANA_DIE action
 *
 * Covers validator and command for taking a die from the mana source.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { validateUseManaDie } from "../validators/mana/standaloneManaValidators.js";
import { createUseManaDieCommand } from "../commands/useManaDieCommand.js";
import type { SourceDie } from "../../types/mana.js";
import { sourceDieId } from "../../types/mana.js";
import {
  USE_MANA_DIE_ACTION,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_GOLD,
  MANA_BLACK,
  MANA_TOKEN_SOURCE_DIE,
  MANA_DIE_TAKEN,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import {
  DIE_NOT_FOUND,
  DIE_DEPLETED,
  DIE_TAKEN,
  DIE_COLOR_MISMATCH,
  SOURCE_LIMIT_EXCEEDED,
  SOURCE_BLOCKED,
} from "../validators/validationCodes.js";
import { addModifier } from "../modifiers/lifecycle.js";
import {
  RULE_BLACK_AS_ANY_COLOR,
  RULE_SOURCE_BLOCKED,
  RULE_EXTRA_SOURCE_DIE,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
  EFFECT_RULE_OVERRIDE,
} from "../../types/modifierConstants.js";
import type { PlayerAction } from "@mage-knight/shared";

function createSourceDie(
  id: string,
  color: string,
  overrides: Partial<SourceDie> = {}
): SourceDie {
  return {
    id: sourceDieId(id),
    color: color as SourceDie["color"],
    isDepleted: false,
    takenByPlayerId: null,
    ...overrides,
  };
}

function makeAction(dieId: string, color: string): PlayerAction {
  return {
    type: USE_MANA_DIE_ACTION,
    dieId,
    color: color as PlayerAction extends { color: infer C } ? C : never,
  } as PlayerAction;
}

describe("validateUseManaDie", () => {
  describe("happy path", () => {
    it("should pass with a valid red die", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED)],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(true);
    });

    it("should pass for each basic color die", () => {
      for (const color of [MANA_RED, MANA_BLUE, MANA_GREEN]) {
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({
          players: [player],
          source: {
            dice: [createSourceDie("die_0", color)],
          },
        });

        const result = validateUseManaDie(state, "player1", makeAction("die_0", color));
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("gold die (wild during day)", () => {
    it("should allow gold die as basic color during day", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: {
          dice: [createSourceDie("die_0", MANA_GOLD)],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(true);
    });

    it("should allow gold die as gold during day", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: {
          dice: [createSourceDie("die_0", MANA_GOLD)],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_GOLD));
      expect(result.valid).toBe(true);
    });
  });

  describe("black die", () => {
    it("should allow black die as black at night", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: {
          dice: [createSourceDie("die_0", MANA_BLACK)],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_BLACK));
      expect(result.valid).toBe(true);
    });

    it("should allow black die as any color with RULE_BLACK_AS_ANY_COLOR modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: {
          dice: [createSourceDie("die_0", MANA_BLACK)],
        },
      });

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "mana_pull" as never, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_BLACK_AS_ANY_COLOR },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(true);
    });

    it("should reject black die as basic color without modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: {
          dice: [createSourceDie("die_0", MANA_BLACK)],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_COLOR_MISMATCH);
      }
    });
  });

  describe("die not found", () => {
    it("should fail when die ID does not exist in source", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_99", MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_NOT_FOUND);
      }
    });
  });

  describe("die already taken", () => {
    it("should fail when die is already taken by another player", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED, { takenByPlayerId: "player2" })],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_TAKEN);
      }
    });
  });

  describe("die depleted", () => {
    it("should fail when die is depleted", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_BLACK, { isDepleted: true })],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_BLACK));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_DEPLETED);
      }
    });
  });

  describe("source limit", () => {
    it("should fail when already used a die and no extra source die modifier", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: [sourceDieId("die_0")],
      });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [
            createSourceDie("die_0", MANA_RED, { takenByPlayerId: "player1" }),
            createSourceDie("die_1", MANA_BLUE),
          ],
        },
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_1", MANA_BLUE));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(SOURCE_LIMIT_EXCEEDED);
      }
    });

    it("should allow second die with RULE_EXTRA_SOURCE_DIE modifier", () => {
      const player = createTestPlayer({
        id: "player1",
        usedManaFromSource: true,
        usedDieIds: [sourceDieId("die_0")],
      });
      let state = createTestGameState({
        players: [player],
        source: {
          dice: [
            createSourceDie("die_0", MANA_RED, { takenByPlayerId: "player1" }),
            createSourceDie("die_1", MANA_BLUE),
          ],
        },
      });

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "mana_storm" as never, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_EXTRA_SOURCE_DIE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_1", MANA_BLUE));
      expect(result.valid).toBe(true);
    });
  });

  describe("source blocked", () => {
    it("should fail when source is blocked", () => {
      const player = createTestPlayer({ id: "player1" });
      let state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED)],
        },
      });

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "test" as never, playerId: "player1" },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_SOURCE_BLOCKED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const result = validateUseManaDie(state, "player1", makeAction("die_0", MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(SOURCE_BLOCKED);
      }
    });
  });

  describe("Mana Steal stored die", () => {
    it("should allow using the stored Mana Steal die", () => {
      const player = createTestPlayer({
        id: "player1",
        tacticState: {
          storedManaDie: { dieId: "stolen_die", color: MANA_RED },
          manaStealUsedThisTurn: false,
        },
      });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const result = validateUseManaDie(state, "player1", makeAction("stolen_die", MANA_RED));
      expect(result.valid).toBe(true);
    });

    it("should reject Mana Steal die if already used this turn", () => {
      const player = createTestPlayer({
        id: "player1",
        tacticState: {
          storedManaDie: { dieId: "stolen_die", color: MANA_RED },
          manaStealUsedThisTurn: true,
        },
      });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const result = validateUseManaDie(state, "player1", makeAction("stolen_die", MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_TAKEN);
      }
    });

    it("should reject Mana Steal die with wrong color", () => {
      const player = createTestPlayer({
        id: "player1",
        tacticState: {
          storedManaDie: { dieId: "stolen_die", color: MANA_RED },
          manaStealUsedThisTurn: false,
        },
      });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const result = validateUseManaDie(state, "player1", makeAction("stolen_die", MANA_BLUE));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(DIE_COLOR_MISMATCH);
      }
    });
  });

  describe("non-matching action type", () => {
    it("should pass for other action types", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const result = validateUseManaDie(state, "player1", {
        type: "END_TURN",
      } as PlayerAction);
      expect(result.valid).toBe(true);
    });
  });
});

describe("createUseManaDieCommand", () => {
  describe("execute", () => {
    it("should mark die as taken and add mana token", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED)],
        },
      });

      const command = createUseManaDieCommand({
        playerId: "player1",
        dieId: "die_0",
        color: MANA_RED,
      });

      expect(command.type).toBe("USE_MANA_DIE");
      expect(command.isReversible).toBe(true);

      const result = command.execute(state);
      const updatedPlayer = result.state.players[0]!;

      expect(updatedPlayer.usedManaFromSource).toBe(true);
      expect(updatedPlayer.usedDieIds).toContain("die_0");
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_DIE,
      });

      const updatedDie = result.state.source.dice.find((d) => d.id === "die_0");
      expect(updatedDie?.takenByPlayerId).toBe("player1");
    });

    it("should emit MANA_DIE_TAKEN event", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED)],
        },
      });

      const command = createUseManaDieCommand({
        playerId: "player1",
        dieId: "die_0",
        color: MANA_RED,
      });

      const result = command.execute(state);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        type: MANA_DIE_TAKEN,
        playerId: "player1",
        dieId: "die_0",
        color: MANA_RED,
      });
    });

    it("should handle Mana Steal stored die", () => {
      const player = createTestPlayer({
        id: "player1",
        tacticState: {
          storedManaDie: { dieId: "stolen_die", color: MANA_BLUE },
          manaStealUsedThisTurn: false,
        },
      });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const command = createUseManaDieCommand({
        playerId: "player1",
        dieId: "stolen_die",
        color: MANA_BLUE,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players[0]!;

      expect(updatedPlayer.tacticState.manaStealUsedThisTurn).toBe(true);
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]).toEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_DIE,
      });
      // Should NOT modify source dice
      expect(result.state.source.dice).toHaveLength(0);
    });
  });

  describe("undo", () => {
    it("should reverse all changes from execute", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: {
          dice: [createSourceDie("die_0", MANA_RED)],
        },
      });

      const command = createUseManaDieCommand({
        playerId: "player1",
        dieId: "die_0",
        color: MANA_RED,
      });

      const executeResult = command.execute(state);
      const undoResult = command.undo(executeResult.state);
      const restoredPlayer = undoResult.state.players[0]!;

      expect(restoredPlayer.usedManaFromSource).toBe(false);
      expect(restoredPlayer.usedDieIds).toHaveLength(0);
      expect(restoredPlayer.pureMana).toHaveLength(0);

      const restoredDie = undoResult.state.source.dice.find((d) => d.id === "die_0");
      expect(restoredDie?.takenByPlayerId).toBeNull();
    });

    it("should reverse Mana Steal stored die usage", () => {
      const player = createTestPlayer({
        id: "player1",
        tacticState: {
          storedManaDie: { dieId: "stolen_die", color: MANA_RED },
          manaStealUsedThisTurn: false,
        },
      });
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const command = createUseManaDieCommand({
        playerId: "player1",
        dieId: "stolen_die",
        color: MANA_RED,
      });

      const executeResult = command.execute(state);
      const undoResult = command.undo(executeResult.state);
      const restoredPlayer = undoResult.state.players[0]!;

      expect(restoredPlayer.tacticState.manaStealUsedThisTurn).toBe(false);
      expect(restoredPlayer.pureMana).toHaveLength(0);
    });
  });
});
