/**
 * Tests for Rush of Adrenaline advanced action card
 *
 * Basic: For each of the first 3 wounds taken to hand this turn, draw a card (retroactive).
 * Powered (green/red): Throw away first wound + draw 1; for each of next 3, draw a card (retroactive).
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { RUSH_OF_ADRENALINE } from "../../data/advancedActions/dual/rush-of-adrenaline.js";
import {
  CARD_RUSH_OF_ADRENALINE,
  CARD_WOUND,
  CARD_MARCH,
  CARD_RAGE,
  CARD_STAMINA,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
  EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
} from "../../types/modifierConstants.js";
import { EFFECT_RUSH_OF_ADRENALINE } from "../../types/effectTypes.js";
import { EFFECT_TAKE_WOUND } from "../../types/effectTypes.js";
import type { RushOfAdrenalineEffect } from "../../types/cards.js";
import { processRushOfAdrenalineOnWound } from "../effects/rushOfAdrenalineHelpers.js";

describe("Rush of Adrenaline", () => {
  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(RUSH_OF_ADRENALINE).toBeDefined();
      expect(RUSH_OF_ADRENALINE.name).toBe("Rush of Adrenaline");
      expect(RUSH_OF_ADRENALINE.id).toBe(CARD_RUSH_OF_ADRENALINE);
      expect(RUSH_OF_ADRENALINE.sidewaysValue).toBe(1);
    });

    it("should have basic effect with Rush of Adrenaline type", () => {
      const basic = RUSH_OF_ADRENALINE.basicEffect as RushOfAdrenalineEffect;
      expect(basic.type).toBe(EFFECT_RUSH_OF_ADRENALINE);
      expect(basic.mode).toBe("basic");
    });

    it("should have powered effect with Rush of Adrenaline type", () => {
      const powered = RUSH_OF_ADRENALINE.poweredEffect as RushOfAdrenalineEffect;
      expect(powered.type).toBe(EFFECT_RUSH_OF_ADRENALINE);
      expect(powered.mode).toBe("powered");
    });
  });

  // ============================================================================
  // BASIC EFFECT: Draw 1 per wound to hand (first 3)
  // ============================================================================

  describe("basic effect", () => {
    it("should create modifier when played with no wounds yet", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      // Should create modifier with 3 remaining draws
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      const effect = mods[0]!.effect as {
        mode: string;
        remainingDraws: number;
      };
      expect(effect.mode).toBe("basic");
      expect(effect.remainingDraws).toBe(3);

      // No cards drawn (no wounds yet)
      expect(result.state.players[0]!.hand).toHaveLength(1);
    });

    it("should retroactively draw cards for wounds already taken", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // 2 wounds taken, 2 retroactive draws from deck [RAGE, MARCH, RAGE]
      // Hand: WOUND, WOUND, MARCH + RAGE, MARCH = 5 cards
      expect(updatedPlayer.hand).toHaveLength(5);
      expect(updatedPlayer.deck).toHaveLength(1);
    });

    it("should cap retroactive draws at 3", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE, CARD_MARCH],
        woundsReceivedThisTurn: { hand: 4, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // 4 wounds taken but only 3 draws allowed
      expect(updatedPlayer.deck).toHaveLength(1); // 4 - 3 = 1

      // No modifier needed (all 3 draws consumed)
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(0);
    });

    it("should create modifier with remaining draws after partial retroactive", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 1, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // 1 retroactive draw
      expect(updatedPlayer.hand).toHaveLength(3); // WOUND, MARCH + RAGE

      // Modifier with 2 remaining draws
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(2);
    });

    it("should handle empty deck gracefully for retroactive draws", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [],
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // No cards to draw despite 2 wounds
      expect(updatedPlayer.hand).toHaveLength(3);

      // Still creates modifier with 1 remaining draw (3 - 2 = 1)
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(1);
    });
  });

  // ============================================================================
  // POWERED EFFECT: Throw first wound + draw, then draw per wound (next 3)
  // ============================================================================

  describe("powered effect", () => {
    it("should create modifier when played with no wounds yet", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.poweredEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      const effect = mods[0]!.effect as {
        mode: string;
        remainingDraws: number;
        thrownFirstWound: boolean;
      };
      expect(effect.mode).toBe("powered");
      expect(effect.remainingDraws).toBe(3);
      expect(effect.thrownFirstWound).toBe(false);
    });

    it("should retroactively throw first wound and draw card", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 1, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.poweredEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // Wound thrown away, 1 card drawn
      // Hand: MARCH + RAGE (wound removed, card drawn)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      expect(updatedPlayer.hand).toHaveLength(2);
      expect(updatedPlayer.deck).toHaveLength(2);

      // Wound returned to pile
      if (result.state.woundPileCount !== null) {
        expect(result.state.woundPileCount).toBeGreaterThan(
          state.woundPileCount!
        );
      }
    });

    it("should retroactively throw first wound and draw for subsequent wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE, CARD_STAMINA],
        woundsReceivedThisTurn: { hand: 3, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.poweredEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // 1st wound: thrown away + draw 1
      // 2nd+3rd wounds: draw 2 (2 of 3 remaining draws consumed)
      // Hand starts: WOUND, WOUND, WOUND, MARCH (4)
      // After throw: WOUND, WOUND, MARCH (3)
      // After throw draw: WOUND, WOUND, MARCH, RAGE (4)
      // After retro draws (2): WOUND, WOUND, MARCH, RAGE, MARCH, RAGE (6)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(2);
      expect(updatedPlayer.deck).toHaveLength(1); // 4 - 3 = 1

      // Modifier with 1 remaining draw
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(1);
    });

    it("should handle max wounds scenario correctly", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE, CARD_STAMINA, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 4, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.poweredEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // 1st wound: thrown + draw 1
      // 2nd-4th wounds: draw 3 (all 3 remaining draws consumed, wound 4 gets nothing)
      // Deck started with 5 cards, drew 4 (1 + 3)
      expect(updatedPlayer.deck).toHaveLength(1);

      // No modifier remaining (all draws consumed + first wound thrown)
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(0);
    });
  });

  // ============================================================================
  // TRIGGER: applyTakeWound integration
  // ============================================================================

  describe("trigger via applyTakeWound", () => {
    it("should draw cards when wounds are taken with basic modifier active", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Rush of Adrenaline modifier (basic, 3 remaining draws)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Take a wound via effect
      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 1,
      });

      const updatedPlayer = result.state.players[0]!;
      // Hand: MARCH + WOUND (from take wound) + RAGE (from Rush draw)
      expect(updatedPlayer.hand).toContain(CARD_WOUND);
      expect(updatedPlayer.hand).toHaveLength(3);
      expect(updatedPlayer.deck).toHaveLength(2);

      // Modifier decremented to 2
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(2);
    });

    it("should throw away wound in powered mode when first wound arrives", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Rush of Adrenaline modifier (powered, first wound not yet thrown)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "powered" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Take a wound
      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 1,
      });

      const updatedPlayer = result.state.players[0]!;
      // Wound was added then thrown away, 1 card drawn
      // Hand: MARCH + RAGE (wound thrown, card drawn)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      expect(updatedPlayer.hand).toHaveLength(2);

      // Modifier updated: thrownFirstWound = true
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      const modEffect = mods[0]!.effect as {
        thrownFirstWound: boolean;
        remainingDraws: number;
      };
      expect(modEffect.thrownFirstWound).toBe(true);
      expect(modEffect.remainingDraws).toBe(3); // Throw doesn't consume draws
    });

    it("should draw for subsequent wounds after first is thrown (powered)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // Modifier with first wound already thrown
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "powered" as const,
          remainingDraws: 3,
          thrownFirstWound: true,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Take a wound - should draw 1 card (not throw)
      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 1,
      });

      const updatedPlayer = result.state.players[0]!;
      // Hand: MARCH + WOUND + RAGE (wound stays, card drawn)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(1);
      expect(updatedPlayer.hand).toHaveLength(3);

      // Modifier: remainingDraws decremented
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(2);
    });

    it("should remove modifier when all draws consumed", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // Modifier with 1 remaining draw (basic)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 1,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 1,
      });

      // Modifier should be removed
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(0);
    });

    it("should handle multiple wounds at once", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE, CARD_STAMINA],
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // Basic modifier with 3 remaining draws
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Take 2 wounds at once
      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 2,
      });

      const updatedPlayer = result.state.players[0]!;
      // Hand: MARCH + 2 WOUNDS + 2 drawn cards
      expect(updatedPlayer.hand).toHaveLength(5);
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(2);
      expect(updatedPlayer.deck).toHaveLength(2); // 4 - 2 = 2

      // 1 remaining draw
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(1);
    });
  });

  // ============================================================================
  // HELPER: processRushOfAdrenalineOnWound direct tests
  // ============================================================================

  describe("processRushOfAdrenalineOnWound", () => {
    it("should do nothing if no modifier is active", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        1
      );

      expect(result.descriptions).toHaveLength(0);
      expect(result.state).toBe(state); // Unchanged
    });

    it("should do nothing if woundsJustTaken is 0", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE],
      });
      let state = createTestGameState({ players: [player] });

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        0
      );

      expect(result.descriptions).toHaveLength(0);
    });

    it("should handle empty deck without crashing", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [],
      });
      let state = createTestGameState({ players: [player] });

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        1
      );

      // No cards drawn but modifier is updated
      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.deck).toHaveLength(0);

      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(2);
    });

    it("should handle powered throw-away with empty deck", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [],
      });
      let state = createTestGameState({ players: [player] });

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "powered" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        1
      );

      const updatedPlayer = result.state.players[0]!;
      // Wound thrown away but no card to draw
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      expect(updatedPlayer.hand).toHaveLength(1); // Just MARCH
    });

    it("should handle powered throw + draw for multiple wounds at once", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE, CARD_STAMINA],
      });
      let state = createTestGameState({ players: [player] });

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "powered" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        3
      );

      const updatedPlayer = result.state.players[0]!;
      // 1st wound: thrown + draw 1
      // 2nd+3rd wounds: draw 2
      // Hand: 3 wounds → throw 1 = 2 wounds, MARCH stays + 3 drawn cards = 5 non-wound + 2 wounds
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(2);
      expect(updatedPlayer.deck).toHaveLength(1); // 4 - 3 = 1
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("edge cases", () => {
    it("should not trigger for wounds to discard pile", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        discard: [CARD_WOUND],
        deck: [CARD_RAGE],
        woundsReceivedThisTurn: { hand: 0, discard: 1 },
      });
      let state = createTestGameState({ players: [player] });

      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // processRushOfAdrenalineOnWound is only called when wounds go to hand.
      // Verify that the modifier is unchanged when called with 0 wounds.
      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        0
      );

      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(3);
    });

    it("should work when more wounds taken than draws remaining", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE, CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Only 1 draw remaining
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 1,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = processRushOfAdrenalineOnWound(
        state,
        0,
        state.players[0]!,
        3
      );

      const updatedPlayer = result.state.players[0]!;
      // Only 1 card drawn despite 3 wounds
      expect(updatedPlayer.deck).toHaveLength(1); // 2 - 1 = 1

      // Modifier removed
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(0);
    });

    it("should not count wounds to discard in retroactive calculation", () => {
      // woundsReceivedThisTurn.discard should NOT count for Rush of Adrenaline
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        discard: [CARD_WOUND, CARD_WOUND],
        deck: [CARD_RAGE, CARD_MARCH, CARD_RAGE],
        woundsReceivedThisTurn: { hand: 1, discard: 2 },
      });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(
        state,
        "player1",
        RUSH_OF_ADRENALINE.basicEffect,
        CARD_RUSH_OF_ADRENALINE
      );

      const updatedPlayer = result.state.players[0]!;
      // Only 1 wound to hand → 1 retroactive draw
      expect(updatedPlayer.hand).toHaveLength(3); // WOUND + MARCH + 1 drawn

      // 2 remaining draws
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(1);
      expect(
        (mods[0]!.effect as { remainingDraws: number }).remainingDraws
      ).toBe(2);
    });

    it("should only draw up to available deck size", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_RAGE], // Only 1 card in deck
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      let state = createTestGameState({ players: [player] });

      // 3 remaining draws
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: CARD_RUSH_OF_ADRENALINE,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
          mode: "basic" as const,
          remainingDraws: 3,
          thrownFirstWound: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Take 3 wounds but only 1 card in deck
      const result = resolveEffect(state, "player1", {
        type: EFFECT_TAKE_WOUND,
        amount: 3,
      });

      const updatedPlayer = result.state.players[0]!;
      // 3 wounds added + 1 card drawn (deck exhausted)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(3);
      expect(updatedPlayer.deck).toHaveLength(0);

      // Modifier removed since all draws consumed
      const mods = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_RUSH_OF_ADRENALINE_ACTIVE
      );
      expect(mods).toHaveLength(0);
    });
  });
});
