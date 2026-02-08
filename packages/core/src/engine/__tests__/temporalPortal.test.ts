/**
 * Tests for Temporal Portal (Blue Advanced Action)
 *
 * Basic: Play as your action. Move 1 (all terrain costs 1, no rampaging
 *        provocation). Hand limit +1 on next draw.
 * Powered: Choice: (Move 2 + HL+1) OR (Move 1 + HL+2).
 *
 * Key behaviors:
 * - Consumes the player's action (CATEGORY_ACTION)
 * - Cannot be played if player already took an action
 * - All terrain costs 1 (including lakes/mountains)
 * - Does not provoke rampaging enemies
 * - Hand limit bonus persists until consumed at end-of-turn draw
 * - Powered effect presents a choice between two compound options
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  CARD_TEMPORAL_PORTAL,
  CARD_MARCH,
  PLAY_CARD_ACTION,
} from "@mage-knight/shared";
import type { CardId, PlayerAction } from "@mage-knight/shared";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import { getValidActions } from "../validActions/index.js";
import {
  validateActionCardNotAlreadyActed,
  validateCardPlayableInContext,
} from "../validators/playCardValidators.js";
import { cardConsumesAction } from "../rules/cardPlay.js";
import { getCard } from "../validActions/cards/index.js";
import { describeEffect } from "../effects/describeEffect.js";
import { reverseEffect } from "../effects/reverse.js";
import { EFFECT_HAND_LIMIT_BONUS } from "../../types/effectTypes.js";
import type { HandLimitBonusEffect } from "../../types/cards.js";
import { CATEGORY_ACTION } from "../../types/cards.js";
import type { GameState } from "../../state/GameState.js";

// ============================================================================
// 1. Card Definition Tests
// ============================================================================

describe("Temporal Portal card definition", () => {
  it("exists and has correct metadata", () => {
    const card = getCard(CARD_TEMPORAL_PORTAL);
    expect(card).toBeDefined();
    expect(card!.name).toBe("Temporal Portal");
    expect(card!.poweredBy).toEqual(["blue"]);
  });

  it("has CATEGORY_ACTION in categories", () => {
    const card = getCard(CARD_TEMPORAL_PORTAL);
    expect(card!.categories).toContain(CATEGORY_ACTION);
  });

  it("cardConsumesAction returns true", () => {
    const card = getCard(CARD_TEMPORAL_PORTAL);
    expect(cardConsumesAction(card!)).toBe(true);
  });
});

// ============================================================================
// 2. "Play as Action" Validator Tests
// ============================================================================

describe("Temporal Portal action consumption validation", () => {
  it("allows playing when player has not taken action", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL],
      hasTakenActionThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });
    const action: PlayerAction = {
      type: PLAY_CARD_ACTION,
      cardId: CARD_TEMPORAL_PORTAL,
      powered: false,
    };

    const result = validateActionCardNotAlreadyActed(state, "player1", action);
    expect(result.valid).toBe(true);
  });

  it("rejects playing when player has already taken action", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL],
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });
    const action: PlayerAction = {
      type: PLAY_CARD_ACTION,
      cardId: CARD_TEMPORAL_PORTAL,
      powered: false,
    };

    const result = validateActionCardNotAlreadyActed(state, "player1", action);
    expect(result.valid).toBe(false);
  });

  it("allows non-action cards when player has already taken action", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });
    const action: PlayerAction = {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: false,
    };

    const result = validateActionCardNotAlreadyActed(state, "player1", action);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 3. ValidActions Tests
// ============================================================================

describe("Temporal Portal validActions", () => {
  it("shows Temporal Portal as playable when action not taken", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, "player1");

    expect(validActions.mode).toBe("normal_turn");
    if (validActions.mode === "normal_turn") {
      const portalCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_TEMPORAL_PORTAL
      );
      expect(portalCard).toBeDefined();
      expect(portalCard!.canPlayBasic).toBe(true);
    }
  });

  it("hides Temporal Portal when action already taken", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, "player1");

    expect(validActions.mode).toBe("normal_turn");
    if (validActions.mode === "normal_turn") {
      const portalCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_TEMPORAL_PORTAL
      );
      expect(portalCard).toBeUndefined();
    }
  });

  it("still shows non-action cards when action already taken", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, "player1");

    expect(validActions.mode).toBe("normal_turn");
    if (validActions.mode === "normal_turn") {
      const marchCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_MARCH
      );
      expect(marchCard).toBeDefined();
    }
  });
});

// ============================================================================
// 4. PlayCardCommand Basic Effect Tests
// ============================================================================

describe("Temporal Portal basic effect", () => {
  function createPortalState(): GameState {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      meditationHandLimitBonus: 0,
    });
    return createTestGameState({ players: [player] });
  }

  it("grants move points", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.movePoints).toBe(1);
  });

  it("sets hasTakenActionThisTurn to true", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.hasTakenActionThisTurn).toBe(true);
  });

  it("sets meditationHandLimitBonus to 1", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.meditationHandLimitBonus).toBe(1);
  });

  it("applies terrain cost modifier (active modifier added to state)", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    // Modifiers should be added to game state
    expect(result.state.activeModifiers.length).toBeGreaterThan(0);
  });

  it("applies rampaging ignore modifier", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    // Check that an EFFECT_RULE_OVERRIDE modifier exists for rampaging
    const rampagingMod = result.state.activeModifiers.find(
      (m) =>
        m.effect.type === "rule_override" &&
        "rule" in m.effect &&
        m.effect.rule === "ignore_rampaging_provoke"
    );
    expect(rampagingMod).toBeDefined();
  });

  it("moves card from hand to play area", () => {
    const state = createPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.hand).not.toContain(CARD_TEMPORAL_PORTAL);
    expect(player.playArea).toContain(CARD_TEMPORAL_PORTAL);
  });
});

// ============================================================================
// 5. PlayCardCommand Powered Effect Tests (Choice)
// ============================================================================

describe("Temporal Portal powered effect", () => {
  function createPoweredPortalState(): GameState {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      meditationHandLimitBonus: 0,
      crystals: { red: 0, blue: 1, green: 0, white: 0 },
    });
    return createTestGameState({ players: [player] });
  }

  it("creates a pending choice with 2 options", () => {
    const state = createPoweredPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: true,
      manaSources: [
        { type: "crystal", color: "black" },
        { type: "crystal", color: "blue" },
      ],
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.pendingChoice).not.toBeNull();
    expect(player.pendingChoice!.options).toHaveLength(2);
  });

  it("sets hasTakenActionThisTurn before choice resolution", () => {
    const state = createPoweredPortalState();
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: true,
      manaSources: [
        { type: "crystal", color: "black" },
        { type: "crystal", color: "blue" },
      ],
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;
    expect(player.hasTakenActionThisTurn).toBe(true);
  });
});

// ============================================================================
// 6. Undo Tests
// ============================================================================

describe("Temporal Portal undo", () => {
  it("restores hasTakenActionThisTurn on undo", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      meditationHandLimitBonus: 0,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const executeResult = cmd.execute(state);
    expect(executeResult.state.players[0]!.hasTakenActionThisTurn).toBe(true);

    const undoResult = cmd.undo(executeResult.state);
    expect(undoResult.state.players[0]!.hasTakenActionThisTurn).toBe(false);
  });

  it("restores meditationHandLimitBonus on undo", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      meditationHandLimitBonus: 0,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const executeResult = cmd.execute(state);
    expect(executeResult.state.players[0]!.meditationHandLimitBonus).toBe(1);

    const undoResult = cmd.undo(executeResult.state);
    expect(undoResult.state.players[0]!.meditationHandLimitBonus).toBe(0);
  });

  it("restores move points on undo", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      movePoints: 0,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const executeResult = cmd.execute(state);
    expect(executeResult.state.players[0]!.movePoints).toBe(1);

    const undoResult = cmd.undo(executeResult.state);
    expect(undoResult.state.players[0]!.movePoints).toBe(0);
  });

  it("restores card to hand on undo", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const executeResult = cmd.execute(state);
    expect(executeResult.state.players[0]!.hand).not.toContain(CARD_TEMPORAL_PORTAL);

    const undoResult = cmd.undo(executeResult.state);
    expect(undoResult.state.players[0]!.hand).toContain(CARD_TEMPORAL_PORTAL);
  });
});

// ============================================================================
// 7. Effect Description Tests
// ============================================================================

describe("EFFECT_HAND_LIMIT_BONUS description", () => {
  it("describes hand limit +1", () => {
    const effect: HandLimitBonusEffect = {
      type: EFFECT_HAND_LIMIT_BONUS,
      bonus: 1,
    };
    expect(describeEffect(effect)).toBe("Hand limit +1 on next draw");
  });

  it("describes hand limit +2", () => {
    const effect: HandLimitBonusEffect = {
      type: EFFECT_HAND_LIMIT_BONUS,
      bonus: 2,
    };
    expect(describeEffect(effect)).toBe("Hand limit +2 on next draw");
  });
});

// ============================================================================
// 8. Effect Reverse Tests
// ============================================================================

describe("EFFECT_HAND_LIMIT_BONUS reversal", () => {
  it("reverses hand limit bonus", () => {
    const player = createTestPlayer({
      meditationHandLimitBonus: 2,
    });
    const effect: HandLimitBonusEffect = {
      type: EFFECT_HAND_LIMIT_BONUS,
      bonus: 2,
    };
    const reversed = reverseEffect(player, effect);
    expect(reversed.meditationHandLimitBonus).toBe(0);
  });

  it("does not go below 0", () => {
    const player = createTestPlayer({
      meditationHandLimitBonus: 0,
    });
    const effect: HandLimitBonusEffect = {
      type: EFFECT_HAND_LIMIT_BONUS,
      bonus: 1,
    };
    const reversed = reverseEffect(player, effect);
    expect(reversed.meditationHandLimitBonus).toBe(0);
  });

  it("partially reverses when bonus exceeds current value", () => {
    const player = createTestPlayer({
      meditationHandLimitBonus: 1,
    });
    const effect: HandLimitBonusEffect = {
      type: EFFECT_HAND_LIMIT_BONUS,
      bonus: 3,
    };
    const reversed = reverseEffect(player, effect);
    expect(reversed.meditationHandLimitBonus).toBe(0);
  });
});

// ============================================================================
// 9. Hand Limit Integration
// ============================================================================

describe("Temporal Portal hand limit integration", () => {
  it("getEndTurnDrawLimit includes bonus from Temporal Portal", async () => {
    const { getEndTurnDrawLimit } = await import("../helpers/handLimitHelpers.js");

    const player = createTestPlayer({
      meditationHandLimitBonus: 1,
      handLimit: 5,
    });
    const state = createTestGameState({ players: [player] });

    const limit = getEndTurnDrawLimit(state, "player1", 0);
    expect(limit).toBe(6);
  });

  it("stacks with existing meditation bonus", async () => {
    const { getEndTurnDrawLimit } = await import("../helpers/handLimitHelpers.js");

    const player = createTestPlayer({
      meditationHandLimitBonus: 3, // e.g., Meditation (+2) + Temporal Portal (+1)
      handLimit: 5,
    });
    const state = createTestGameState({ players: [player] });

    const limit = getEndTurnDrawLimit(state, "player1", 0);
    expect(limit).toBe(8);
  });
});

// ============================================================================
// 10. Edge Cases
// ============================================================================

describe("Temporal Portal edge cases", () => {
  it("cannot be played twice in same turn (action already consumed)", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_TEMPORAL_PORTAL as CardId],
      hasTakenActionThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    // Play the first one
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });
    const result = cmd.execute(state);
    expect(result.state.players[0]!.hasTakenActionThisTurn).toBe(true);

    // Validator rejects second play
    const action: PlayerAction = {
      type: PLAY_CARD_ACTION,
      cardId: CARD_TEMPORAL_PORTAL,
      powered: false,
    };
    const validationResult = validateActionCardNotAlreadyActed(
      result.state,
      "player1",
      action
    );
    expect(validationResult.valid).toBe(false);
  });

  it("validateCardPlayableInContext allows basic effect outside combat", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL],
    });
    const state = createTestGameState({ players: [player] });
    const action: PlayerAction = {
      type: PLAY_CARD_ACTION,
      cardId: CARD_TEMPORAL_PORTAL,
      powered: false,
    };

    const result = validateCardPlayableInContext(state, "player1", action);
    expect(result.valid).toBe(true);
  });

  it("accumulates hand limit bonus with existing value", () => {
    const player = createTestPlayer({
      hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
      hasTakenActionThisTurn: false,
      meditationHandLimitBonus: 2, // existing bonus from Meditation
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_TEMPORAL_PORTAL,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const updatedPlayer = result.state.players[0]!;
    // Should add +1 to existing 2 = 3
    expect(updatedPlayer.meditationHandLimitBonus).toBe(3);
  });
});
