/**
 * Tests for Mana Draw powered effect
 *
 * Card text: "Take a mana die from the Source and set it to any color except gold.
 * Gain two mana tokens of that color. Do not reroll this die when you return it to the Source."
 *
 * Key behaviors:
 * - Entry effect presents die choice (if multiple) or auto-selects (if one)
 * - After die selection, player chooses color (red, blue, green, white)
 * - Die is set to chosen color and marked as taken
 * - Player gains 2 mana tokens of chosen color
 * - At end of turn, die returns WITHOUT rerolling (keeps chosen color)
 * - At round end, die is rerolled normally like all others
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect, isEffectResolvable } from "../effects/resolveEffect.js";
import type { ManaSource, SourceDie } from "../../types/mana.js";
import { createEndTurnCommand } from "../commands/endTurnCommand.js";
import {
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
} from "../../types/effectTypes.js";
import type {
  ManaDrawPoweredEffect,
  ManaDrawPickDieEffect,
  ManaDrawSetColorEffect,
} from "../../types/cards.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  CARD_MARCH,
} from "@mage-knight/shared";

/**
 * Helper to create a mana source with specific dice
 */
function createTestManaSource(dice: SourceDie[]): ManaSource {
  return { dice };
}

describe("Mana Draw Powered Effect", () => {
  describe("isEffectResolvable", () => {
    it("should be resolvable when there are available dice", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      expect(isEffectResolvable(state, "player1", effect)).toBe(true);
    });

    it("should NOT be resolvable when all dice are taken", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: "player2" },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player3" },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });

    it("should NOT be resolvable when source is empty", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });

    it("should be resolvable even if dice are depleted (gold/black)", () => {
      // Mana Draw can take any die, even depleted ones - it sets the color anyway
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      expect(isEffectResolvable(state, "player1", effect)).toBe(true);
    });
  });

  describe("Die Selection (Entry Effect)", () => {
    it("should auto-select when only one die is available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      const result = resolveEffect(state, "player1", effect);

      // Should go directly to color choice (no die selection needed)
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4); // 4 colors
      expect(result.description).toContain("Choose color");

      // All options should be ManaDrawSetColorEffect with the same dieId
      const options = result.dynamicChoiceOptions as ManaDrawSetColorEffect[];
      expect(options.every((o) => o.type === EFFECT_MANA_DRAW_SET_COLOR)).toBe(true);
      expect(options.every((o) => o.dieId === "die_0")).toBe(true);

      // Should have all 4 basic colors
      const colors = options.map((o) => o.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });

    it("should present die choice when multiple dice are available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(3); // 3 dice
      expect(result.description).toContain("Choose a die");

      // All options should be ManaDrawPickDieEffect
      const options = result.dynamicChoiceOptions as ManaDrawPickDieEffect[];
      expect(options.every((o) => o.type === EFFECT_MANA_DRAW_PICK_DIE)).toBe(true);

      const dieIds = options.map((o) => o.dieId);
      expect(dieIds).toContain("die_0");
      expect(dieIds).toContain("die_1");
      expect(dieIds).toContain("die_2");
    });

    it("should return no-op when no dice are available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: "player2" },
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toBe("No dice available in the Source");
    });

    it("should only include untaken dice in the options", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null }, // available
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player2" }, // taken
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null }, // available
        ]),
      });

      const effect: ManaDrawPoweredEffect = { type: EFFECT_MANA_DRAW_POWERED };
      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      const options = result.dynamicChoiceOptions as ManaDrawPickDieEffect[];
      const dieIds = options.map((o) => o.dieId);
      expect(dieIds).toContain("die_0");
      expect(dieIds).toContain("die_2");
      expect(dieIds).not.toContain("die_1");
    });
  });

  describe("Color Selection (Pick Die Effect)", () => {
    it("should present 4 color options after die is picked", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPickDieEffect = {
        type: EFFECT_MANA_DRAW_PICK_DIE,
        dieId: "die_0",
      };
      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);
      expect(result.description).toContain("Choose color");
      expect(result.description).toContain("gold"); // Shows original die color

      const options = result.dynamicChoiceOptions as ManaDrawSetColorEffect[];
      expect(options.every((o) => o.type === EFFECT_MANA_DRAW_SET_COLOR)).toBe(true);
      expect(options.every((o) => o.dieId === "die_0")).toBe(true);
    });

    it("should NOT include gold as a color option", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawPickDieEffect = {
        type: EFFECT_MANA_DRAW_PICK_DIE,
        dieId: "die_0",
      };
      const result = resolveEffect(state, "player1", effect);

      const options = result.dynamicChoiceOptions as ManaDrawSetColorEffect[];
      const colors = options.map((o) => o.color);
      expect(colors).not.toContain(MANA_GOLD);
      expect(colors).not.toContain(MANA_BLACK);
    });
  });

  describe("Final Resolution (Set Color Effect)", () => {
    it("should set die color and grant 2 mana tokens", () => {
      const player = createTestPlayer({
        id: "player1",
        pureMana: [],
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_BLUE,
      };
      const result = resolveEffect(state, "player1", effect);

      // Die should be updated
      const updatedDie = result.state.source.dice.find((d) => d.id === "die_0");
      expect(updatedDie?.color).toBe(MANA_BLUE);
      expect(updatedDie?.isDepleted).toBe(false); // Basic colors are never depleted
      expect(updatedDie?.takenByPlayerId).toBe("player1");

      // Player should have 2 mana tokens
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pureMana).toHaveLength(2);
      expect(updatedPlayer?.pureMana.every((t) => t.color === MANA_BLUE)).toBe(true);
    });

    it("should track manaDrawDieId on player", () => {
      const player = createTestPlayer({
        id: "player1",
        manaDrawDieId: null,
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_GREEN,
      };
      const result = resolveEffect(state, "player1", effect);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.manaDrawDieId).toBe("die_0");
    });

    it("should add to existing mana tokens (not replace)", () => {
      const player = createTestPlayer({
        id: "player1",
        pureMana: [
          { color: MANA_RED, source: "card" },
          { color: MANA_WHITE, source: "die" },
        ],
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_GREEN,
      };
      const result = resolveEffect(state, "player1", effect);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pureMana).toHaveLength(4); // 2 existing + 2 new
    });

    it("should return error description if die not found", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "nonexistent_die",
        color: MANA_BLUE,
      };
      const result = resolveEffect(state, "player1", effect);

      expect(result.description).toContain("Die not found");
    });
  });

  describe("End Turn Behavior (No Reroll)", () => {
    it("should return manaDrawDie without rerolling at end of turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH], // Need a card to avoid forced round end announcement
        deck: [CARD_MARCH],
        manaDrawDieId: "die_0",
        usedDieId: null,
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        source: createTestManaSource([
          // Die was set to blue via Mana Draw - it should stay blue after turn end
          { id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player1" },
        ]),
      });

      const command = createEndTurnCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Die should be returned (takenByPlayerId cleared) but keep its color
      const returnedDie = result.state.source.dice.find((d) => d.id === "die_0");
      expect(returnedDie?.takenByPlayerId).toBeNull();
      expect(returnedDie?.color).toBe(MANA_BLUE); // Color unchanged, NOT rerolled
    });

    it("should still reroll usedDieId normally at end of turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieId: null,
        usedDieId: "die_0", // Normal die used for powering
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: "player1" },
        ]),
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const command = createEndTurnCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Die should be returned and rerolled (color may change)
      const returnedDie = result.state.source.dice.find((d) => d.id === "die_0");
      expect(returnedDie?.takenByPlayerId).toBeNull();
      // Note: We can't assert the exact color since it's random, but the die exists
      expect(returnedDie).toBeDefined();
    });

    it("should handle both manaDrawDieId and usedDieId in same turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieId: "die_0", // From Mana Draw
        usedDieId: "die_1", // From normal powering
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player1" },
          { id: "die_1", color: MANA_GREEN, isDepleted: false, takenByPlayerId: "player1" },
        ]),
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const command = createEndTurnCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Mana Draw die should keep its color
      const manaDrawDie = result.state.source.dice.find((d) => d.id === "die_0");
      expect(manaDrawDie?.takenByPlayerId).toBeNull();
      expect(manaDrawDie?.color).toBe(MANA_BLUE);

      // Used die should be returned (and rerolled)
      const usedDie = result.state.source.dice.find((d) => d.id === "die_1");
      expect(usedDie?.takenByPlayerId).toBeNull();
    });

    it("should reset manaDrawDieId on player after turn ends", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieId: "die_0",
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: "player1" },
        ]),
      });

      const command = createEndTurnCommand({ playerId: "player1" });
      const result = command.execute(state);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.manaDrawDieId).toBeNull();
    });
  });

  describe("Description Generation", () => {
    it("should generate correct description for set color effect", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_WHITE,
      };
      const result = resolveEffect(state, "player1", effect);

      expect(result.description).toBe("Set die to white, gained 2 white mana");
    });
  });
});
