/**
 * Tests for Mana Draw / Mana Pull powered effects
 *
 * Mana Draw: "Take a mana die from the Source and set it to any color except gold.
 * Gain two mana tokens of that color. Do not reroll this die when you return it to the Source."
 *
 * Mana Pull (Arythea): "Take two mana dice from the source and set them to any color except gold.
 * Gain a mana token of each of these colors. Do not reroll these dice when you return them to the Source."
 *
 * Both use the same parameterized effect system:
 * - Mana Draw: diceCount=1, tokensPerDie=2
 * - Mana Pull: diceCount=2, tokensPerDie=1
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect, isEffectResolvable } from "../effects/resolveEffect.js";
import type { ManaSource, SourceDie } from "../../types/mana.js";
import { sourceDieId } from "../../types/mana.js";
import { createEndTurnCommand } from "../commands/endTurnCommand.js";
import { createResolveChoiceCommand } from "../commands/resolveChoiceCommand.js";
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
  // Standard Mana Draw params
  const manaDrawEffect: ManaDrawPoweredEffect = {
    type: EFFECT_MANA_DRAW_POWERED,
    diceCount: 1,
    tokensPerDie: 2,
  };

  describe("isEffectResolvable", () => {
    it("should be resolvable when there are available dice", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      expect(isEffectResolvable(state, "player1", manaDrawEffect)).toBe(true);
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

      expect(isEffectResolvable(state, "player1", manaDrawEffect)).toBe(false);
    });

    it("should NOT be resolvable when source is empty", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([]),
      });

      expect(isEffectResolvable(state, "player1", manaDrawEffect)).toBe(false);
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

      expect(isEffectResolvable(state, "player1", manaDrawEffect)).toBe(true);
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

      const result = resolveEffect(state, "player1", manaDrawEffect);

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

    it("should show die choice when multiple dice available for diceCount=1", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", manaDrawEffect);

      // Should let player choose which die to take
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(3); // 3 dice to choose from
      expect(result.description).toContain("Choose a die");
      const options = result.dynamicChoiceOptions as ManaDrawPickDieEffect[];
      expect(options.every((o) => o.type === EFFECT_MANA_DRAW_PICK_DIE)).toBe(true);
    });

    it("should return no-op when no dice are available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: "player2" },
        ]),
      });

      const result = resolveEffect(state, "player1", manaDrawEffect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toBe("No dice available in the Source");
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
        dieColor: MANA_GOLD,
        remainingDiceToSelect: 0,
        tokensPerDie: 2,
        alreadySelectedDieIds: [],
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
        dieColor: MANA_RED,
        remainingDiceToSelect: 0,
        tokensPerDie: 2,
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      const options = result.dynamicChoiceOptions as ManaDrawSetColorEffect[];
      const colors = options.map((o) => o.color);
      expect(colors).not.toContain(MANA_GOLD);
      expect(colors).not.toContain(MANA_BLACK);
    });
  });

  describe("Final Resolution (Set Color Effect)", () => {
    it("should set die color and grant 2 mana tokens for Mana Draw", () => {
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
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
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

    it("should track manaDrawDieIds on player", () => {
      const player = createTestPlayer({
        id: "player1",
        manaDrawDieIds: [],
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
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.manaDrawDieIds).toContain("die_0");
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
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
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
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
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
        manaDrawDieIds: [sourceDieId("die_0")],
        usedDieIds: [],
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

    it("should still reroll usedDieIds normally at end of turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieIds: [],
        usedDieIds: [sourceDieId("die_0")], // Normal die used for powering
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

    it("should handle both manaDrawDieIds and usedDieIds in same turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieIds: [sourceDieId("die_0")], // From Mana Draw
        usedDieIds: [sourceDieId("die_1")], // From normal powering
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

    it("should reset manaDrawDieIds on player after turn ends", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieIds: ["die_0"],
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
      expect(updatedPlayer?.manaDrawDieIds).toEqual([]);
    });
  });

  describe("Description Generation", () => {
    it("should generate correct description for set color effect with 2 tokens", () => {
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
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      expect(result.description).toBe("Set die to white, gained 2 white mana");
    });

    it("should generate correct description for set color effect with 1 token", () => {
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
        color: MANA_RED,
        tokensPerDie: 1,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      expect(result.description).toBe("Set die to red, gained 1 red mana");
    });
  });
});

describe("Mana Pull Powered Effect (Arythea)", () => {
  // Mana Pull params: 2 dice, 1 token each
  const manaPullEffect: ManaDrawPoweredEffect = {
    type: EFFECT_MANA_DRAW_POWERED,
    diceCount: 2,
    tokensPerDie: 1,
  };

  describe("Die Selection", () => {
    it("should present die choice when diceCount=2 and multiple dice available", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", manaPullEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(3); // 3 dice to choose from
      expect(result.description).toContain("Choose a die");

      const options = result.dynamicChoiceOptions as ManaDrawPickDieEffect[];
      expect(options.every((o) => o.type === EFFECT_MANA_DRAW_PICK_DIE)).toBe(true);
      // Each option should indicate 1 more die to select after this
      expect(options.every((o) => o.remainingDiceToSelect === 1)).toBe(true);
      expect(options.every((o) => o.tokensPerDie === 1)).toBe(true);
    });

    it("should auto-select and go to color choice when only 2 dice available for diceCount=2", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const result = resolveEffect(state, "player1", manaPullEffect);

      // Should auto-select first die and present color choice
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4); // 4 colors
      expect(result.description).toContain("Choose color");
    });
  });

  describe("Multi-Die Resolution Chain", () => {
    it("should chain to second die selection after first die is set", () => {
      const player = createTestPlayer({
        id: "player1",
        manaDrawDieIds: [],
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
          { id: "die_2", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Simulate first die selection and color choice
      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_WHITE,
        tokensPerDie: 1,
        remainingDiceToSelect: 1, // 1 more die to select
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      // Should chain to next die selection
      expect(result.requiresChoice).toBe(true);
      expect(result.description).toContain("gained 1 white mana");

      // Options should be for choosing the second die (excluding already selected)
      const options = result.dynamicChoiceOptions as ManaDrawPickDieEffect[];
      expect(options).toHaveLength(2); // die_1 and die_2, not die_0
      const dieIds = options.map((o) => o.dieId);
      expect(dieIds).not.toContain("die_0");
      expect(dieIds).toContain("die_1");
      expect(dieIds).toContain("die_2");
    });

    it("should complete after second die is set with no more chaining", () => {
      const player = createTestPlayer({
        id: "player1",
        manaDrawDieIds: ["die_0"], // First die already tracked
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_WHITE, isDepleted: false, takenByPlayerId: "player1" }, // Already taken
          { id: "die_1", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      // Second die selection
      const effect: ManaDrawSetColorEffect = {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_1",
        color: MANA_RED,
        tokensPerDie: 1,
        remainingDiceToSelect: 0, // No more dice
        alreadySelectedDieIds: ["die_0"],
      };
      const result = resolveEffect(state, "player1", effect);

      // Should complete without more choices
      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toBe("Set die to red, gained 1 red mana");

      // Player should have both dice tracked
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.manaDrawDieIds).toContain("die_0");
      expect(updatedPlayer?.manaDrawDieIds).toContain("die_1");
    });

    it("should grant only 1 token per die for Mana Pull", () => {
      const player = createTestPlayer({
        id: "player1",
        pureMana: [],
        manaDrawDieIds: [],
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
        tokensPerDie: 1, // Mana Pull grants 1 token per die
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      };
      const result = resolveEffect(state, "player1", effect);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pureMana).toHaveLength(1); // Only 1 token
      expect(updatedPlayer?.pureMana[0]?.color).toBe(MANA_BLUE);
    });
  });

  describe("End Turn with Multiple Dice", () => {
    it("should return all manaDrawDieIds without rerolling", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
        manaDrawDieIds: [sourceDieId("die_0"), sourceDieId("die_1")], // Both from Mana Pull
        usedDieIds: [],
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player1" },
          { id: "die_1", color: MANA_RED, isDepleted: false, takenByPlayerId: "player1" },
        ]),
      });

      const command = createEndTurnCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Both dice should keep their colors
      const die0 = result.state.source.dice.find((d) => d.id === "die_0");
      const die1 = result.state.source.dice.find((d) => d.id === "die_1");

      expect(die0?.takenByPlayerId).toBeNull();
      expect(die0?.color).toBe(MANA_BLUE); // Not rerolled

      expect(die1?.takenByPlayerId).toBeNull();
      expect(die1?.color).toBe(MANA_RED); // Not rerolled
    });
  });
});

describe("Mana Draw Undo", () => {
  /**
   * This test reproduces the infinite mana bug:
   * 1. Player triggers Mana Draw, gets pending choice for color
   * 2. Player picks red, gains 2 red mana
   * 3. Player undoes the choice
   * 4. BUG: Player still has 2 red mana (should have 0)
   * 5. Player picks red again, now has 4 red mana (infinite mana exploit!)
   */
  it("should remove mana tokens when undoing color selection", () => {
    // Set up state with pending choice for color selection
    const setColorOptions: ManaDrawSetColorEffect[] = [
      {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_RED,
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      },
      {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_BLUE,
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      },
      {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_GREEN,
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      },
      {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_WHITE,
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      },
    ];

    const player = createTestPlayer({
      id: "player1",
      pureMana: [], // Start with no mana
      manaDrawDieIds: [],
      pendingChoice: {
        cardId: CARD_MARCH, // Doesn't matter which card for this test
        options: setColorOptions,
      },
    });

    const state = createTestGameState({
      players: [player],
      source: createTestManaSource([
        { id: "die_0", color: MANA_GOLD, isDepleted: true, takenByPlayerId: null },
      ]),
    });

    // Verify pendingChoice is set (TypeScript narrowing)
    const pendingChoice = player.pendingChoice;
    if (!pendingChoice) {
      throw new Error("Test setup error: pendingChoice should be set");
    }

    // Step 1: Resolve choice - pick red (index 0)
    const resolveCommand = createResolveChoiceCommand({
      playerId: "player1",
      choiceIndex: 0, // Pick red
      previousPendingChoice: pendingChoice,
    });

    const afterResolve = resolveCommand.execute(state);

    // Verify: Player should have 2 red mana tokens
    const playerAfterResolve = afterResolve.state.players.find((p) => p.id === "player1");
    expect(playerAfterResolve?.pureMana).toHaveLength(2);
    expect(playerAfterResolve?.pureMana.every((t) => t.color === MANA_RED)).toBe(true);

    // Verify: Die should be taken and set to red
    const dieAfterResolve = afterResolve.state.source.dice.find((d) => d.id === "die_0");
    expect(dieAfterResolve?.color).toBe(MANA_RED);
    expect(dieAfterResolve?.takenByPlayerId).toBe("player1");

    // Verify: manaDrawDieIds should include the die
    expect(playerAfterResolve?.manaDrawDieIds).toContain("die_0");

    // Step 2: Undo the choice
    const afterUndo = resolveCommand.undo(afterResolve.state);

    // Verify: Player should have 0 mana tokens (the 2 red should be removed)
    const playerAfterUndo = afterUndo.state.players.find((p) => p.id === "player1");
    expect(playerAfterUndo?.pureMana).toHaveLength(0); // THIS IS THE BUG - currently fails

    // Verify: Die should be restored to original state
    const dieAfterUndo = afterUndo.state.source.dice.find((d) => d.id === "die_0");
    expect(dieAfterUndo?.color).toBe(MANA_GOLD); // Should be back to gold
    expect(dieAfterUndo?.takenByPlayerId).toBeNull(); // Should not be taken

    // Verify: manaDrawDieIds should NOT include the die
    expect(playerAfterUndo?.manaDrawDieIds).not.toContain("die_0");

    // Verify: Pending choice should be restored
    expect(playerAfterUndo?.pendingChoice).not.toBeNull();
    expect(playerAfterUndo?.pendingChoice?.options).toHaveLength(4);
  });

  it("should restore die to original color when undoing (not just any color)", () => {
    // Die starts as blue, player sets it to red, undo should restore blue
    const setColorOptions: ManaDrawSetColorEffect[] = [
      {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: "die_0",
        color: MANA_RED,
        tokensPerDie: 2,
        remainingDiceToSelect: 0,
        alreadySelectedDieIds: [],
      },
    ];

    const player = createTestPlayer({
      id: "player1",
      pureMana: [],
      manaDrawDieIds: [],
      pendingChoice: {
        cardId: CARD_MARCH,
        options: setColorOptions,
      },
    });

    const state = createTestGameState({
      players: [player],
      source: createTestManaSource([
        { id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
      ]),
    });

    // Verify pendingChoice is set (TypeScript narrowing)
    const pendingChoice = player.pendingChoice;
    if (!pendingChoice) {
      throw new Error("Test setup error: pendingChoice should be set");
    }

    const resolveCommand = createResolveChoiceCommand({
      playerId: "player1",
      choiceIndex: 0,
      previousPendingChoice: pendingChoice,
    });

    const afterResolve = resolveCommand.execute(state);
    const afterUndo = resolveCommand.undo(afterResolve.state);

    // Die should be back to BLUE (its original color), not gold or some default
    const dieAfterUndo = afterUndo.state.source.dice.find((d) => d.id === "die_0");
    expect(dieAfterUndo?.color).toBe(MANA_BLUE);
  });
});
