/**
 * Tests for Druidic Staff artifact.
 *
 * Basic: Discard a card → effect depends on card color
 * Powered (destroy): Choose 2 different options from the 4 color effects
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { getValidActions } from "../validActions/index.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_DISCARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  INVALID_ACTION,
  CARD_DRUIDIC_STAFF,
  CARD_RAGE,
  CARD_CRYSTALLIZE,
  CARD_PROMISE,
  CARD_MARCH,
  CARD_WOUND,
  MANA_SOURCE_TOKEN,
  MANA_RED,
  MANA_TOKEN_SOURCE_CARD,
  CARD_RUBY_RING,
} from "@mage-knight/shared";

describe("Druidic Staff", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================
  // Basic Effect: Discard a card for color-dependent effect
  // ============================================================

  describe("basic effect (discard for color)", () => {
    it("discarding a white card grants move points", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_PROMISE],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      expect(playResult.state.players[0].pendingDiscard).toBeTruthy();

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_PROMISE],
      });

      // White: Move up to 2 (grants 2 move points + terrain modifiers)
      expect(discardResult.state.players[0].movePoints).toBe(2);
    });

    it("discarding a blue card creates a crystal color choice", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_CRYSTALLIZE],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_CRYSTALLIZE],
      });

      // Blue: Choose crystal color (should have pending choice with 4 options)
      expect(discardResult.state.players[0].pendingChoice).toBeTruthy();
      expect(discardResult.state.players[0].pendingChoice?.options).toHaveLength(4);

      // Resolve choice (pick red crystals = index 0)
      const choiceResult = engine.processAction(discardResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(choiceResult.state.players[0].crystals.red).toBe(2);
    });

    it("discarding a blue card and choosing green crystals gives 2 green crystals", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_CRYSTALLIZE],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_CRYSTALLIZE],
      });

      // Choose green crystals (index 2)
      const choiceResult = engine.processAction(discardResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      expect(choiceResult.state.players[0].crystals.green).toBe(2);
    });

    it("discarding a red card readies a spent unit", () => {
      // Need to import unit types
      const { UNIT_STATE_SPENT, UNIT_STATE_READY, UNITS } = require("@mage-knight/shared");

      // Find a level 1-3 unit
      const unitEntries = Object.entries(UNITS) as [string, { level: number; name: string }][];
      const eligibleUnit = unitEntries.find(([, u]) => u.level <= 3);
      if (!eligibleUnit) {
        throw new Error("No level 1-3 unit found for test");
      }

      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_RAGE],
        units: [
          {
            unitId: eligibleUnit[0],
            instanceId: "unit-1",
            state: UNIT_STATE_SPENT,
            wounded: false,
            level: eligibleUnit[1].level,
          },
        ],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_RAGE],
      });

      // Red: Ready unit - with only one eligible unit, auto-resolves
      expect(discardResult.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("discarding a green card heals wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_MARCH, CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_MARCH],
      });

      // Green: Heal 3 (removes up to 3 wound cards)
      const woundsInHand = discardResult.state.players[0].hand.filter(
        (c: string) => c === CARD_WOUND
      ).length;
      expect(woundsInHand).toBe(0); // All 3 wounds healed
    });

    it("discarding an artifact gives no effect", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_RUBY_RING],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      expect(playResult.state.players[0].pendingDiscard).toBeTruthy();

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_RUBY_RING],
      });

      // Artifact has no action color → no effect
      // Card should be discarded but no move/crystal/heal/ready
      expect(discardResult.state.players[0].movePoints).toBe(0);
      expect(discardResult.state.players[0].crystals.red).toBe(0);
      expect(discardResult.state.players[0].pendingChoice).toBeNull();
      // Ruby Ring should be in discard pile
      expect(discardResult.state.players[0].discard).toContain(CARD_RUBY_RING);
    });

    it("eligible cards include both action cards and artifacts", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_RAGE, CARD_RUBY_RING, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const validActions = getValidActions(playResult.state, "player1");
      expect(validActions.mode).toBe("pending_discard_cost");
      // Action cards and artifacts are eligible
      expect(validActions.discardCost.availableCardIds).toContain(CARD_RAGE);
      expect(validActions.discardCost.availableCardIds).toContain(CARD_RUBY_RING);
      // Wounds are NOT eligible
      expect(validActions.discardCost.availableCardIds).not.toContain(CARD_WOUND);
    });

    it("cannot discard wound cards", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_WOUND, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: false,
      });

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [CARD_WOUND],
      });

      expect(discardResult.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================
  // Powered Effect: Choose two different options
  // ============================================================

  describe("powered effect (choose two options)", () => {
    it("creates a choice with 6 combination options", () => {
      const { UNIT_STATE_SPENT, UNITS } = require("@mage-knight/shared");
      const unitEntries = Object.entries(UNITS) as [string, { level: number; name: string }][];
      const eligibleUnit = unitEntries.find(([, u]) => u.level <= 3);
      if (!eligibleUnit) throw new Error("No level 1-3 unit found");

      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
        units: [
          {
            unitId: eligibleUnit[0],
            instanceId: "unit-1",
            state: UNIT_STATE_SPENT,
            wounded: false,
            level: eligibleUnit[1].level,
          },
        ],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should have pending choice with 6 options (C(4,2) = 6 pairs)
      // All 6 are resolvable because player has wounds (green) and spent units (red)
      expect(playResult.state.players[0].pendingChoice).toBeTruthy();
      expect(playResult.state.players[0].pendingChoice?.options).toHaveLength(6);
    });

    it("choosing blue + green gives crystals and healing", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_WOUND, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Blue + Green is option index 4 (0: W+B, 1: W+R, 2: W+G, 3: B+R, 4: B+G, 5: R+G)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 4,
      });

      // Blue part creates a crystal color sub-choice
      expect(choiceResult.state.players[0].pendingChoice).toBeTruthy();

      // Choose blue crystals (index 1)
      const crystalResult = engine.processAction(choiceResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have 2 blue crystals and wounds healed
      expect(crystalResult.state.players[0].crystals.blue).toBe(2);
      const woundsLeft = crystalResult.state.players[0].hand.filter(
        (c: string) => c === CARD_WOUND
      ).length;
      expect(woundsLeft).toBe(0); // Both wounds healed (heal 3, had 2)
    });

    it("choosing red + green readies a unit and heals", () => {
      const { UNIT_STATE_SPENT, UNIT_STATE_READY, UNITS } = require("@mage-knight/shared");

      const unitEntries = Object.entries(UNITS) as [string, { level: number; name: string }][];
      const eligibleUnit = unitEntries.find(([, u]) => u.level <= 3);
      if (!eligibleUnit) throw new Error("No level 1-3 unit found");

      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
        units: [
          {
            unitId: eligibleUnit[0],
            instanceId: "unit-1",
            state: UNIT_STATE_SPENT,
            wounded: false,
            level: eligibleUnit[1].level,
          },
        ],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Red + Green is option index 5
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 5,
      });

      // Unit should be readied
      expect(choiceResult.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Wound should be healed
      const woundsLeft = choiceResult.state.players[0].hand.filter(
        (c: string) => c === CARD_WOUND
      ).length;
      expect(woundsLeft).toBe(0);
    });

    it("choosing white + blue grants move and crystal choice", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // White + Blue is option index 0
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Move 2 should be granted
      expect(choiceResult.state.players[0].movePoints).toBe(2);
      // Crystal choice should be pending
      expect(choiceResult.state.players[0].pendingChoice).toBeTruthy();
      expect(choiceResult.state.players[0].pendingChoice?.options).toHaveLength(4);

      // Choose white crystals (index 3)
      const crystalResult = engine.processAction(choiceResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 3,
      });

      expect(crystalResult.state.players[0].crystals.white).toBe(2);
    });

    it("artifact is destroyed after powered use", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Artifact should be in removedCards (destroyed), not discard
      expect(playResult.state.players[0].removedCards).toContain(CARD_DRUIDIC_STAFF);
      expect(playResult.state.players[0].discard).not.toContain(CARD_DRUIDIC_STAFF);
    });

    it("does not require discarding a card for powered effect", () => {
      const player = createTestPlayer({
        hand: [CARD_DRUIDIC_STAFF],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DRUIDIC_STAFF,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should go straight to choice, not pendingDiscard
      expect(playResult.state.players[0].pendingDiscard).toBeNull();
      expect(playResult.state.players[0].pendingChoice).toBeTruthy();
    });
  });
});
