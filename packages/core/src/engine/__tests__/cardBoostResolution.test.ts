import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_CONCENTRATION,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  MANA_GREEN,
  MANA_SOURCE_TOKEN,
  COMBAT_TYPE_RANGED,
} from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_ATTACK,
} from "../../types/effectTypes.js";

describe("Card boost choice chaining", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should keep a pending boosted choice when Concentration auto-selects Swift Reflexes", () => {
    const player = createTestPlayer({
      hand: [CARD_CONCENTRATION, CARD_WOLFHAWK_SWIFT_REFLEXES],
      pureMana: [{ color: MANA_GREEN, source: "die" }],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const result = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CONCENTRATION,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_GREEN }],
    });

    const pendingChoice = result.state.players[0].pendingChoice;
    expect(pendingChoice).not.toBeNull();
    expect(pendingChoice?.options).toHaveLength(3);

    const moveOption = pendingChoice?.options[0];
    const attackOption = pendingChoice?.options[1];
    expect(moveOption).toMatchObject({ type: EFFECT_GAIN_MOVE, amount: 6 });
    expect(attackOption).toMatchObject({
      type: EFFECT_GAIN_ATTACK,
      amount: 5,
      combatType: COMBAT_TYPE_RANGED,
    });
  });

  it("should apply boosted Swift Reflexes attack after resolving the follow-up choice", () => {
    const player = createTestPlayer({
      hand: [CARD_CONCENTRATION, CARD_WOLFHAWK_SWIFT_REFLEXES],
      pureMana: [{ color: MANA_GREEN, source: "die" }],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const afterConcentration = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_CONCENTRATION,
      powered: true,
      manaSources: [{ type: MANA_SOURCE_TOKEN, color: MANA_GREEN }],
    });

    const afterChoice = engine.processAction(afterConcentration.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    });

    expect(afterChoice.state.players[0].pendingChoice).toBeNull();
    expect(afterChoice.state.players[0].combatAccumulator.attack.ranged).toBe(5);
    expect(afterChoice.state.players[0].playArea).toEqual(
      expect.arrayContaining([CARD_CONCENTRATION, CARD_WOLFHAWK_SWIFT_REFLEXES])
    );
  });
});
