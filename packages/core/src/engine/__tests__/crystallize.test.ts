/**
 * Tests for Crystallize card effect
 *
 * Basic: Pay one mana token of a basic color, gain a crystal of that color
 * Powered: Gain a crystal of any basic color (choice)
 *
 * Key behaviors:
 * 1. Basic effect requires player to have mana tokens to convert
 * 2. Basic effect should present choice of which color token to convert (if multiple colors)
 * 3. If player has multiple tokens of SAME color, only one choice (fungible)
 * 4. Powered effect always works (just pick a color to gain crystal)
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import {
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_GAIN_CRYSTAL,
} from "../../types/effectTypes.js";
import type { ConvertManaToCrystalEffect, GainCrystalEffect } from "../../types/cards.js";
import {
  CARD_CRYSTALLIZE,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  CARD_PLAYED,
  CHOICE_REQUIRED,
} from "@mage-knight/shared";

describe("Crystallize Basic Effect", () => {
  describe("isEffectResolvable", () => {
    it("should be resolvable when player has basic color mana tokens", () => {
      const player = createTestPlayer({
        pureMana: [{ color: MANA_BLUE, source: "die" }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: ConvertManaToCrystalEffect = {
        type: EFFECT_CONVERT_MANA_TO_CRYSTAL,
      };

      expect(isEffectResolvable(state, "player1", effect)).toBe(true);
    });

    it("should NOT be resolvable when player has no mana tokens", () => {
      const player = createTestPlayer({
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const effect: ConvertManaToCrystalEffect = {
        type: EFFECT_CONVERT_MANA_TO_CRYSTAL,
      };

      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });

    it("should NOT be resolvable when player only has black mana (cannot become crystal)", () => {
      const player = createTestPlayer({
        pureMana: [{ color: MANA_BLACK, source: "die" }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: ConvertManaToCrystalEffect = {
        type: EFFECT_CONVERT_MANA_TO_CRYSTAL,
      };

      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });
  });

  describe("resolveEffect", () => {
    it("should present choice options for each unique mana color (not each token)", () => {
      // Player has 2 blue tokens and 1 red token
      // Should see 2 choices (blue, red), NOT 3 choices (blue, blue, red)
      const player = createTestPlayer({
        pureMana: [
          { color: MANA_BLUE, source: "die" },
          { color: MANA_BLUE, source: "card" },
          { color: MANA_RED, source: "die" },
        ],
      });
      const state = createTestGameState({ players: [player] });

      const effect: ConvertManaToCrystalEffect = {
        type: EFFECT_CONVERT_MANA_TO_CRYSTAL,
      };

      const result = resolveEffect(state, "player1", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      // Should have exactly 2 options: convert blue OR convert red
      expect(result.dynamicChoiceOptions).toHaveLength(2);
    });

    it("should auto-resolve when player has only one color of mana tokens", () => {
      // Player has only blue tokens - no meaningful choice
      const player = createTestPlayer({
        pureMana: [
          { color: MANA_BLUE, source: "die" },
          { color: MANA_BLUE, source: "card" },
        ],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const effect: ConvertManaToCrystalEffect = {
        type: EFFECT_CONVERT_MANA_TO_CRYSTAL,
      };

      const result = resolveEffect(state, "player1", effect);

      // Should auto-resolve since there's only one meaningful choice
      // Player should gain a blue crystal and lose one blue mana token
      expect(result.requiresChoice).toBeFalsy();

      const updatedPlayer = result.state.players.find(p => p.id === "player1");
      expect(updatedPlayer?.crystals.blue).toBe(1);
      expect(updatedPlayer?.pureMana).toHaveLength(1); // Started with 2, used 1
    });

    it("should convert mana token to crystal of same color when resolved", () => {
      const player = createTestPlayer({
        pureMana: [{ color: MANA_GREEN, source: "die" }],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Directly resolve a "gain green crystal" effect (simulating choice resolution)
      const gainCrystalEffect: GainCrystalEffect = {
        type: EFFECT_GAIN_CRYSTAL,
        color: MANA_GREEN,
      };

      const result = resolveEffect(state, "player1", gainCrystalEffect);

      const updatedPlayer = result.state.players.find(p => p.id === "player1");
      expect(updatedPlayer?.crystals.green).toBe(1);
    });
  });

  describe("playCardCommand integration", () => {
    it("should play Crystallize basic and set up pending choice when multiple colors available", () => {
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [
          { color: MANA_BLUE, source: "die" },
          { color: MANA_RED, source: "die" },
        ],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createPlayCardCommand({
        playerId: "player1",
        cardId: CARD_CRYSTALLIZE,
        handIndex: 0,
        powered: false,
        previousPlayedCardFromHand: false,
      });

      const result = command.execute(state);

      // Should emit CARD_PLAYED and CHOICE_REQUIRED events
      expect(result.events.some(e => e.type === CARD_PLAYED)).toBe(true);
      expect(result.events.some(e => e.type === CHOICE_REQUIRED)).toBe(true);

      // Player should have pending choice
      const updatedPlayer = result.state.players.find(p => p.id === "player1");
      expect(updatedPlayer?.pendingChoice).not.toBeNull();
      expect(updatedPlayer?.pendingChoice?.options).toHaveLength(2);
    });

    it("should auto-resolve Crystallize basic when only one color available", () => {
      const player = createTestPlayer({
        hand: [CARD_CRYSTALLIZE],
        pureMana: [{ color: MANA_WHITE, source: "die" }],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createPlayCardCommand({
        playerId: "player1",
        cardId: CARD_CRYSTALLIZE,
        handIndex: 0,
        powered: false,
        previousPlayedCardFromHand: false,
      });

      const result = command.execute(state);

      // Should auto-resolve - no CHOICE_REQUIRED
      expect(result.events.some(e => e.type === CHOICE_REQUIRED)).toBe(false);

      // Player should have gained white crystal and lost white mana
      const updatedPlayer = result.state.players.find(p => p.id === "player1");
      expect(updatedPlayer?.crystals.white).toBe(1);
      expect(updatedPlayer?.pureMana).toHaveLength(0);
      expect(updatedPlayer?.pendingChoice).toBeNull();
    });
  });
});

describe("Crystallize Undo", () => {
  it("should restore mana token and remove crystal when undoing Crystallize basic", () => {
    // Setup: player has one white mana token, no crystals
    const player = createTestPlayer({
      hand: [CARD_CRYSTALLIZE],
      pureMana: [{ color: MANA_WHITE, source: "die" }],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    // Execute: play Crystallize basic (auto-resolves since only one color)
    const command = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_CRYSTALLIZE,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = command.execute(state);

    // Verify the effect applied: gained crystal, lost mana token
    const playerAfterExecute = result.state.players.find(p => p.id === "player1");
    expect(playerAfterExecute?.crystals.white).toBe(1);
    expect(playerAfterExecute?.pureMana).toHaveLength(0);
    expect(playerAfterExecute?.hand).not.toContain(CARD_CRYSTALLIZE);

    // Undo: should restore everything to original state
    const undoResult = command.undo(result.state);

    const playerAfterUndo = undoResult.state.players.find(p => p.id === "player1");

    // Crystal should be removed
    expect(playerAfterUndo?.crystals.white).toBe(0);

    // Mana token should be restored
    expect(playerAfterUndo?.pureMana).toHaveLength(1);
    expect(playerAfterUndo?.pureMana[0]?.color).toBe(MANA_WHITE);

    // Card should be back in hand
    expect(playerAfterUndo?.hand).toContain(CARD_CRYSTALLIZE);
  });
});

describe("Crystallize Powered Effect", () => {
  it("should always be resolvable (gaining a crystal is always possible)", () => {
    const player = createTestPlayer({
      pureMana: [], // No mana tokens needed for powered effect
    });
    const state = createTestGameState({ players: [player] });

    // Powered effect is a choice of gain_crystal effects
    const gainCrystalEffect: GainCrystalEffect = {
      type: EFFECT_GAIN_CRYSTAL,
      color: MANA_RED,
    };

    expect(isEffectResolvable(state, "player1", gainCrystalEffect)).toBe(true);
  });

  it("should present 4 color choices for powered effect", () => {
    // The powered effect is already a CHOICE effect with 4 GAIN_CRYSTAL options
    // This should work via the existing choice mechanism
    const player = createTestPlayer({
      hand: [CARD_CRYSTALLIZE],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({
      players: [player],
      source: {
        dice: [{ id: "die_0", color: MANA_BLUE, isDepleted: false, takenByPlayerId: null }],
      },
    });

    const command = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_CRYSTALLIZE,
      handIndex: 0,
      powered: true,
      manaSource: { type: "die", color: MANA_BLUE, dieId: "die_0" },
      previousPlayedCardFromHand: false,
    });

    const result = command.execute(state);

    // Should have CHOICE_REQUIRED with 4 options (red, blue, green, white crystals)
    const choiceEvent = result.events.find(e => e.type === CHOICE_REQUIRED);
    expect(choiceEvent).toBeDefined();
    if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
      expect(choiceEvent.options).toHaveLength(4);
    }
  });
});
