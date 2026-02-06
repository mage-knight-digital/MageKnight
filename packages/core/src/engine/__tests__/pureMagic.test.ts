/**
 * Tests for Pure Magic advanced action card
 *
 * Pure Magic:
 * - Basic: Pay a mana. Green → Move 4. White → Influence 4. Blue → Block 4. Red → Attack 4.
 * - Powered (Blue): Pay a mana. Green → Move 7. White → Influence 7. Blue → Block 7. Red → Attack 7.
 *
 * Key mechanics:
 * - Effect is determined by color of mana paid (not a free choice)
 * - Blue/Red mana → Block/Attack → only payable during combat
 * - Green/White mana → Move/Influence → always available
 * - Gold mana is wild and substitutes for any basic color (day only)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  CARD_PURE_MAGIC,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK, COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Pure Magic Advanced Action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a state with Pure Magic in hand and the given mana tokens
   */
  function createStateWithPureMagic(
    playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
  ) {
    const player = createTestPlayer({
      hand: [CARD_PURE_MAGIC],
      ...playerOverrides,
    });
    return createTestGameState({ players: [player] });
  }

  /**
   * Create a combat state with Pure Magic in hand
   */
  function createCombatStateWithPureMagic(
    phase: typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_ATTACK,
    playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
  ) {
    const player = createTestPlayer({
      hand: [CARD_PURE_MAGIC],
      ...playerOverrides,
    });
    return createTestGameState({
      players: [player],
      combat: createUnitCombatState(phase),
    });
  }

  describe("Basic effect - non-combat", () => {
    it("should present green and white mana options when both tokens available", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_GREEN, source: "card" },
          { color: MANA_WHITE, source: "card" },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      // Should have a pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();

      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Should have 2 options: green → Move 4, white → Influence 4
        // (blue/red not available outside combat)
        expect(choiceEvent.options).toHaveLength(2);
      }
    });

    it("should grant Move 4 when paying green mana", () => {
      const state = createStateWithPureMagic({
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      // Should auto-resolve since only one option
      // Or present choice - let's check
      if (playResult.state.players[0].pendingChoice) {
        // Single option - resolve it
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        // Green mana should be consumed
        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        // Should have gained Move 4
        expect(choiceResult.state.players[0].movePoints).toBe(4);
        expect(choiceResult.state.players[0].pendingChoice).toBeNull();
      } else {
        // Auto-resolved
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].movePoints).toBe(4);
      }
    });

    it("should grant Influence 4 when paying white mana", () => {
      const state = createStateWithPureMagic({
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].influencePoints).toBe(4);
        expect(choiceResult.state.players[0].pendingChoice).toBeNull();
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].influencePoints).toBe(4);
      }
    });

    it("should NOT offer blue/red mana options outside combat", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_RED, source: "card" },
          { color: MANA_BLUE, source: "card" },
          { color: MANA_GREEN, source: "card" },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      // Only green is valid outside combat, so it auto-resolves (single option)
      // Green mana consumed, Move 4 granted
      expect(result.state.players[0].pendingChoice).toBeNull();
      expect(result.state.players[0].movePoints).toBe(4);
      // Only green token consumed, blue and red remain
      expect(result.state.players[0].pureMana).toHaveLength(2);
    });

    it("should handle no available mana tokens", () => {
      const state = createStateWithPureMagic({
        pureMana: [],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      // Card should resolve with no effect (no mana to pay)
      expect(result.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("Basic effect - in combat", () => {
    it("should offer all four color options in combat when all tokens available", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_ATTACK, {
        pureMana: [
          { color: MANA_RED, source: "card" },
          { color: MANA_BLUE, source: "card" },
          { color: MANA_GREEN, source: "card" },
          { color: MANA_WHITE, source: "card" },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();

      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        expect(choiceEvent.options).toHaveLength(4);
      }
    });

    it("should grant Block 4 when paying blue mana in combat", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_BLOCK, {
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].combatAccumulator.block).toBe(4);
        expect(choiceResult.state.players[0].pendingChoice).toBeNull();
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].combatAccumulator.block).toBe(4);
      }
    });

    it("should grant Attack 4 when paying red mana in combat", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_ATTACK, {
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(4);
        expect(choiceResult.state.players[0].pendingChoice).toBeNull();
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].combatAccumulator.attack.normal).toBe(4);
      }
    });
  });

  describe("Powered effect", () => {
    it("should grant Move 7 when paying green mana (powered)", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_BLUE, source: "card" }, // for powering
          { color: MANA_GREEN, source: "card" }, // for effect
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        // Blue token spent for powering, green token spent for effect
        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].movePoints).toBe(7);
        expect(choiceResult.state.players[0].pendingChoice).toBeNull();
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].movePoints).toBe(7);
      }
    });

    it("should grant Influence 7 when paying white mana (powered)", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_BLUE, source: "card" }, // for powering
          { color: MANA_WHITE, source: "card" }, // for effect
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].influencePoints).toBe(7);
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].influencePoints).toBe(7);
      }
    });

    it("should grant Attack 7 when paying red mana in combat (powered)", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_ATTACK, {
        pureMana: [
          { color: MANA_BLUE, source: "card" }, // for powering
          { color: MANA_RED, source: "card" }, // for effect
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(7);
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].combatAccumulator.attack.normal).toBe(7);
      }
    });

    it("should grant Block 7 when paying blue mana in combat (powered)", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_BLOCK, {
        pureMana: [
          { color: MANA_BLUE, source: "card" }, // for powering
          { color: MANA_BLUE, source: "card" }, // for effect
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Blue mana used for powering, remaining blue for block
      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        // Both blue tokens spent
        expect(choiceResult.state.players[0].pureMana).toHaveLength(0);
        expect(choiceResult.state.players[0].combatAccumulator.block).toBe(7);
      } else {
        expect(playResult.state.players[0].pureMana).toHaveLength(0);
        expect(playResult.state.players[0].combatAccumulator.block).toBe(7);
      }
    });
  });

  describe("Gold mana (wild)", () => {
    it("should allow gold mana as substitute for green (Move) outside combat", () => {
      const state = createStateWithPureMagic({
        pureMana: [{ color: MANA_GOLD, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      // Should present gold → Move and gold → Influence options
      expect(playResult.state.players[0].pendingChoice).not.toBeNull();

      const choiceEvent = playResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Gold can be Move or Influence outside combat (not Block/Attack)
        expect(choiceEvent.options).toHaveLength(2);
      }
    });

    it("should allow gold mana for all four options in combat", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_ATTACK, {
        pureMana: [{ color: MANA_GOLD, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      expect(playResult.state.players[0].pendingChoice).not.toBeNull();

      const choiceEvent = playResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Gold can substitute for all four colors in combat
        expect(choiceEvent.options).toHaveLength(4);
      }
    });

    it("should not duplicate options when player has both basic and gold mana", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_GREEN, source: "card" },
          { color: MANA_GOLD, source: "card" },
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      expect(playResult.state.players[0].pendingChoice).not.toBeNull();

      const choiceEvent = playResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Green → Move (from green token) + Gold → Influence (gold fills white gap)
        // Should NOT duplicate Move option
        expect(choiceEvent.options).toHaveLength(2);
      }
    });
  });

  describe("Mana consumption", () => {
    it("should consume exactly 1 mana token when paying for effect", () => {
      const state = createStateWithPureMagic({
        pureMana: [
          { color: MANA_GREEN, source: "card" },
          { color: MANA_GREEN, source: "card" },
        ],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        // Only 1 green token should be consumed, 1 remains
        expect(choiceResult.state.players[0].pureMana).toHaveLength(1);
        expect(choiceResult.state.players[0].pureMana[0]?.color).toBe(MANA_GREEN);
      }
    });
  });

  describe("Effects are NOT elemental", () => {
    it("should produce non-elemental attack (no fire/ice resistance)", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_ATTACK, {
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        // Attack should be physical (normal), not elemental
        const acc = choiceResult.state.players[0].combatAccumulator;
        expect(acc.attack.normal).toBe(4);
        expect(acc.attack.normalElements.physical).toBe(4);
        expect(acc.attack.normalElements.fire).toBe(0);
        expect(acc.attack.normalElements.ice).toBe(0);
      }
    });

    it("should produce non-elemental block", () => {
      const state = createCombatStateWithPureMagic(COMBAT_PHASE_BLOCK, {
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PURE_MAGIC,
        powered: false,
      });

      if (playResult.state.players[0].pendingChoice) {
        const choiceResult = engine.processAction(playResult.state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });

        const acc = choiceResult.state.players[0].combatAccumulator;
        expect(acc.block).toBe(4);
        expect(acc.blockElements.physical).toBe(4);
        expect(acc.blockElements.fire).toBe(0);
        expect(acc.blockElements.ice).toBe(0);
      }
    });
  });
});
