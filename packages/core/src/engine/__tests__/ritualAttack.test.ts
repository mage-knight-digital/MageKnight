/**
 * Tests for Ritual Attack discard-as-cost behavior.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_DISCARD_ACTION,
  INVALID_ACTION,
  CARD_RITUAL_ATTACK,
  CARD_RAGE,
  CARD_CRYSTALLIZE,
  CARD_PROMISE,
  CARD_MARCH,
  CARD_FIREBALL,
  MANA_SOURCE_TOKEN,
  MANA_RED,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";

describe("Ritual Attack", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  const basicCases = [
    {
      label: "red",
      discard: CARD_RAGE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.normal).toBe(5);
      },
    },
    {
      label: "blue",
      discard: CARD_CRYSTALLIZE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.normalElements.ice).toBe(3);
      },
    },
    {
      label: "white",
      discard: CARD_PROMISE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.ranged).toBe(3);
      },
    },
    {
      label: "green",
      discard: CARD_MARCH,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.siege).toBe(2);
      },
    },
  ];

  for (const testCase of basicCases) {
    it(`basic effect uses ${testCase.label} discard`, () => {
      const player = createTestPlayer({
        hand: [CARD_RITUAL_ATTACK, testCase.discard],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RITUAL_ATTACK,
        powered: false,
      });

      expect(playResult.state.players[0].pendingDiscard).toBeTruthy();

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [testCase.discard],
      });

      const attack = discardResult.state.players[0].combatAccumulator.attack;
      testCase.assert(attack);
    });
  }

  const poweredCases = [
    {
      label: "red",
      discard: CARD_RAGE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.normalElements.fire).toBe(6);
      },
    },
    {
      label: "blue",
      discard: CARD_CRYSTALLIZE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.normalElements.coldFire).toBe(4);
      },
    },
    {
      label: "white",
      discard: CARD_PROMISE,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.rangedElements.fire).toBe(4);
      },
    },
    {
      label: "green",
      discard: CARD_MARCH,
      assert: (attack: ReturnType<typeof createTestPlayer>["combatAccumulator"]["attack"]) => {
        expect(attack.siegeElements.fire).toBe(3);
      },
    },
  ];

  for (const testCase of poweredCases) {
    it(`powered effect uses ${testCase.label} discard`, () => {
      const player = createTestPlayer({
        hand: [CARD_RITUAL_ATTACK, testCase.discard],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RITUAL_ATTACK,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      expect(playResult.state.players[0].pendingDiscard).toBeTruthy();

      const discardResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_DISCARD_ACTION,
        cardIds: [testCase.discard],
      });

      const attack = discardResult.state.players[0].combatAccumulator.attack;
      testCase.assert(attack);
    });
  }

  it("filters discard options to action cards", () => {
    const player = createTestPlayer({
      hand: [CARD_RITUAL_ATTACK, CARD_RAGE, CARD_FIREBALL],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });

    const playResult = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_RITUAL_ATTACK,
      powered: false,
    });

    const validActions = getValidActions(playResult.state, "player1");
    expect(validActions.discardCost?.availableCardIds).toContain(CARD_RAGE);
    expect(validActions.discardCost?.availableCardIds).not.toContain(CARD_FIREBALL);
  });

  it("rejects discarding a non-action card", () => {
    const player = createTestPlayer({
      hand: [CARD_RITUAL_ATTACK, CARD_RAGE, CARD_FIREBALL],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });

    const playResult = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_RITUAL_ATTACK,
      powered: false,
    });

    const discardResult = engine.processAction(playResult.state, "player1", {
      type: RESOLVE_DISCARD_ACTION,
      cardIds: [CARD_FIREBALL],
    });

    expect(discardResult.events).toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );
  });
});
