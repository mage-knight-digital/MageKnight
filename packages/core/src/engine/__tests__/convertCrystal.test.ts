/**
 * Tests for CONVERT_CRYSTAL action
 *
 * Covers validator and command for converting a crystal to a mana token.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { validateConvertCrystal } from "../validators/mana/standaloneManaValidators.js";
import { createConvertCrystalCommand } from "../commands/convertCrystalCommand.js";
import {
  CONVERT_CRYSTAL_ACTION,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CRYSTAL,
  CRYSTAL_USED,
} from "@mage-knight/shared";
import { NO_CRYSTAL } from "../validators/validationCodes.js";
import type { PlayerAction } from "@mage-knight/shared";

function makeAction(color: string): PlayerAction {
  return {
    type: CONVERT_CRYSTAL_ACTION,
    color,
  } as PlayerAction;
}

describe("validateConvertCrystal", () => {
  describe("happy path", () => {
    it("should pass when player has red crystal", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateConvertCrystal(state, "player1", makeAction(MANA_RED));
      expect(result.valid).toBe(true);
    });

    it("should pass for each basic color", () => {
      for (const color of [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE]) {
        const player = createTestPlayer({
          id: "player1",
          crystals: { red: 1, blue: 1, green: 1, white: 1 },
        });
        const state = createTestGameState({ players: [player] });

        const result = validateConvertCrystal(state, "player1", makeAction(color));
        expect(result.valid).toBe(true);
      }
    });

    it("should pass when player has max crystals", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateConvertCrystal(state, "player1", makeAction(MANA_RED));
      expect(result.valid).toBe(true);
    });
  });

  describe("no crystal available", () => {
    it("should fail when player has no crystal of requested color", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateConvertCrystal(state, "player1", makeAction(MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(NO_CRYSTAL);
      }
    });

    it("should fail when player has crystals of other colors but not requested", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 0, blue: 3, green: 2, white: 1 },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateConvertCrystal(state, "player1", makeAction(MANA_RED));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(NO_CRYSTAL);
      }
    });
  });

  describe("non-matching action type", () => {
    it("should pass for other action types", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const result = validateConvertCrystal(state, "player1", {
        type: "END_TURN",
      } as PlayerAction);
      expect(result.valid).toBe(true);
    });
  });
});

describe("createConvertCrystalCommand", () => {
  describe("execute", () => {
    it("should decrement crystal and add mana token", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      expect(command.type).toBe("CONVERT_CRYSTAL");
      expect(command.isReversible).toBe(true);

      const result = command.execute(state);
      const updatedPlayer = result.state.players[0]!;

      expect(updatedPlayer.crystals.red).toBe(1);
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      });
    });

    it("should emit CRYSTAL_USED event", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      const result = command.execute(state);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        type: CRYSTAL_USED,
        playerId: "player1",
        color: MANA_RED,
      });
    });

    it("should work for each basic color", () => {
      for (const color of [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE]) {
        const player = createTestPlayer({
          id: "player1",
          crystals: { red: 1, blue: 1, green: 1, white: 1 },
        });
        const state = createTestGameState({ players: [player] });

        const command = createConvertCrystalCommand({
          playerId: "player1",
          color,
        });

        const result = command.execute(state);
        const updatedPlayer = result.state.players[0]!;

        expect(updatedPlayer.crystals[color]).toBe(0);
        expect(updatedPlayer.pureMana).toHaveLength(1);
        expect(updatedPlayer.pureMana[0]!.color).toBe(color);
      }
    });

    it("should allow multiple conversions per turn", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const cmd1 = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });
      const result1 = cmd1.execute(state);

      const cmd2 = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });
      const result2 = cmd2.execute(result1.state);
      const updatedPlayer = result2.state.players[0]!;

      expect(updatedPlayer.crystals.red).toBe(1);
      expect(updatedPlayer.pureMana).toHaveLength(2);
    });

    it("should preserve existing mana tokens", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CRYSTAL }],
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players[0]!;

      expect(updatedPlayer.pureMana).toHaveLength(2);
      expect(updatedPlayer.pureMana[0]).toEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      });
      expect(updatedPlayer.pureMana[1]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      });
    });
  });

  describe("undo", () => {
    it("should restore crystal and remove token", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      const executeResult = command.execute(state);
      const undoResult = command.undo(executeResult.state);
      const restoredPlayer = undoResult.state.players[0]!;

      expect(restoredPlayer.crystals.red).toBe(2);
      expect(restoredPlayer.pureMana).toHaveLength(0);
    });

    it("should only remove one token when undoing with multiple tokens present", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 2, blue: 1, green: 0, white: 0 },
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CRYSTAL }],
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      const executeResult = command.execute(state);
      // Now pureMana has [blue_crystal, red_crystal]

      const undoResult = command.undo(executeResult.state);
      const restoredPlayer = undoResult.state.players[0]!;

      expect(restoredPlayer.crystals.red).toBe(2);
      expect(restoredPlayer.pureMana).toHaveLength(1);
      expect(restoredPlayer.pureMana[0]).toEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      });
    });

    it("should produce no events on undo", () => {
      const player = createTestPlayer({
        id: "player1",
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createConvertCrystalCommand({
        playerId: "player1",
        color: MANA_RED,
      });

      const executeResult = command.execute(state);
      const undoResult = command.undo(executeResult.state);

      expect(undoResult.events).toHaveLength(0);
    });
  });
});
