/**
 * Tests for mana powering system
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { ManaSource, SourceDie } from "../../types/mana.js";
import {
  PLAY_CARD_ACTION,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  MANA_GREEN,
  MANA_RED,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  CARD_MARCH,
  CARD_RAGE,
  INVALID_ACTION,
  CARD_PLAYED,
} from "@mage-knight/shared";
import type { PlayCardAction } from "@mage-knight/shared";

describe("Mana powering", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Helper to create a mana source with specific dice
   */
  function createTestManaSource(dice: SourceDie[]): ManaSource {
    return { dice };
  }

  describe("Using mana die from source", () => {
    it("should allow powering card with matching die", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
        usedManaFromSource: false,
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      // March powered = Move 4
      expect(result.state.players[0]?.movePoints).toBe(4);
      expect(result.state.players[0]?.usedManaFromSource).toBe(true);

      // Check event indicates powered
      const cardPlayedEvent = result.events.find((e) => e.type === CARD_PLAYED);
      expect(cardPlayedEvent).toBeDefined();
      if (cardPlayedEvent?.type === CARD_PLAYED) {
        expect(cardPlayedEvent.powered).toBe(true);
      }
    });

    it("should reject using second die same turn", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        usedManaFromSource: true, // Already used one
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You can only use one mana die from the Source per turn",
        })
      );
    });

    it("should track usedDieId when using a die", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
        usedManaFromSource: false,
        usedDieId: null,
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.state.players[0]?.usedDieId).toBe("die_0");
      expect(result.state.source.dice[0]?.takenByPlayerId).toBe("player1");
    });

    it("should reject die taken by another player", () => {
      const player = createTestPlayer({
        id: "player2",
        hand: [CARD_MARCH],
        usedManaFromSource: false,
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player2"],
        source: createTestManaSource([
          // Die is already taken by player1
          { id: "die_0", color: MANA_GREEN, isDepleted: false, takenByPlayerId: "player1" },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player2", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "That mana die is already taken by another player",
        })
      );
    });

    it("should reject using depleted die", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      // Use a green die that's manually marked as depleted
      // (normally only gold/black deplete based on time, but this tests the validation)
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GREEN, isDepleted: true, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "That mana die is depleted",
        })
      );
    });

    it("should reject die color mismatch", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        source: createTestManaSource([
          { id: "die_0", color: MANA_RED, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GREEN, // Claiming green but die shows red
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Die shows red, not green",
        })
      );
    });
  });

  describe("Using crystals", () => {
    it("should allow powering card with matching crystal", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
        crystals: { red: 0, blue: 0, green: 2, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_CRYSTAL,
          color: MANA_GREEN,
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.state.players[0]?.movePoints).toBe(4); // Powered March = Move 4
      expect(result.state.players[0]?.crystals.green).toBe(1); // Used one crystal
    });

    it("should reject when no crystal of that color", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_CRYSTAL,
          color: MANA_GREEN,
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You have no green crystals",
        })
      );
    });
  });

  describe("Using mana tokens", () => {
    it("should allow powering card with matching token", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
        pureMana: [{ color: MANA_GREEN, source: "die" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_TOKEN,
          color: MANA_GREEN,
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.state.players[0]?.movePoints).toBe(4);
      expect(result.state.players[0]?.pureMana.length).toBe(0); // Token consumed
    });

    it("should reject when no token of that color", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_RED, source: "die" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_TOKEN,
          color: MANA_GREEN,
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You have no green mana token",
        })
      );
    });
  });

  describe("Gold mana", () => {
    it("should allow gold to power any card during day", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH], // Green card
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GOLD,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.state.players[0]?.movePoints).toBe(4);
    });

    it("should reject gold mana at night", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: createTestManaSource([
          // Gold shouldn't be available at night but test validates this
          { id: "die_0", color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_GOLD,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Gold mana cannot be used at night",
        })
      );
    });
  });

  describe("Black mana", () => {
    it("should reject black mana during day", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_BLACK,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Black mana cannot be used during the day",
        })
      );
    });

    it("should reject black mana for action cards (even at night)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        source: createTestManaSource([
          { id: "die_0", color: MANA_BLACK, isDepleted: false, takenByPlayerId: null },
        ]),
      });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_DIE,
          color: MANA_BLACK,
          dieId: "die_0",
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Black mana cannot power action cards",
        })
      );
    });
  });

  describe("Color matching", () => {
    it("should reject mismatched mana color", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH], // Green card
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_CRYSTAL,
          color: MANA_RED, // Wrong color
        },
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "red mana cannot power this card. Accepted: green",
        })
      );
    });

    it("should allow exact color match", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE], // Red card
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_CRYSTAL,
          color: MANA_RED,
        },
      };

      const result = engine.processAction(state, "player1", action);

      // Rage powered = Attack 4 (no choice required for powered)
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(4);
    });
  });

  describe("Basic (non-powered) play", () => {
    it("should still work for basic play without mana", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      };

      const result = engine.processAction(state, "player1", action);

      // March basic = Move 2
      expect(result.state.players[0]?.movePoints).toBe(2);
    });

    it("should reject powered play without mana source", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const action: PlayCardAction = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        // No manaSource provided
      };

      const result = engine.processAction(state, "player1", action);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Powered play requires a mana source",
        })
      );
    });
  });
});
