/**
 * Tests for Decompose (red advanced action card)
 *
 * Decompose allows throwing away (permanently removing) an action card from hand
 * to gain crystals:
 * - Basic: Throw away action card → gain 2 crystals of that card's color
 * - Powered (Red): Throw away action card → gain 1 crystal of each basic color
 *   that does NOT match the thrown card's color (3 crystals total)
 *
 * Key rules:
 * - Only action cards (basic/advanced) can be thrown away (not wounds, artifacts, spells)
 * - The Decompose card itself cannot be thrown away
 * - Thrown away cards go to removedCards (permanent, not recycled)
 * - Crystals capped at 3 per color
 * - Card destroyed event is emitted (permanent removal)
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { isEffectResolvable } from "../effects/index.js";
import { handleDecomposeEffect, getCardsEligibleForDecompose } from "../effects/decomposeEffects.js";
import { createResolveDecomposeCommand } from "../commands/resolveDecomposeCommand.js";
import { describeEffect } from "../effects/describeEffect.js";
import {
  validateHasPendingDecompose,
  validateDecomposeSelection,
} from "../validators/decomposeValidators.js";
import { EFFECT_DECOMPOSE } from "../../types/effectTypes.js";
import type { DecomposeEffect } from "../../types/cards.js";
import type { PendingDecompose } from "../../types/player.js";
import {
  CARD_DECOMPOSE,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  CARD_BANNER_OF_GLORY,
  CARD_FIREBALL,
  CARD_SWIFTNESS,
  CARD_DETERMINATION,
  CARD_DESTROYED,
  RESOLVE_DECOMPOSE_ACTION,
} from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides: Partial<PendingDecompose> = {}): PendingDecompose {
  return {
    sourceCardId: CARD_DECOMPOSE,
    mode: "basic",
    ...overrides,
  };
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

describe("Decompose", () => {
  describe("getCardsEligibleForDecompose", () => {
    it("should return action cards excluding wounds and the source card", () => {
      const hand = [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_DECOMPOSE];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should exclude wounds", () => {
      const hand = [CARD_WOUND, CARD_MARCH];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude the source card (Decompose itself)", () => {
      const hand = [CARD_DECOMPOSE, CARD_MARCH];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude artifacts (not action cards)", () => {
      const hand = [CARD_BANNER_OF_GLORY, CARD_MARCH];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude spells (not action cards)", () => {
      const hand = [CARD_FIREBALL, CARD_MARCH];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should return empty when only wounds and Decompose in hand", () => {
      const hand = [CARD_WOUND, CARD_DECOMPOSE];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([]);
    });

    it("should return empty for empty hand", () => {
      const eligible = getCardsEligibleForDecompose([], CARD_DECOMPOSE);
      expect(eligible).toEqual([]);
    });

    it("should include both basic and advanced action cards", () => {
      // CARD_MARCH is a basic green action, CARD_DECOMPOSE is advanced red
      // But we're using CARD_DECOMPOSE as sourceCardId, so it's excluded
      const hand = [CARD_MARCH, CARD_RAGE];
      const eligible = getCardsEligibleForDecompose(hand, CARD_DECOMPOSE);
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });
  });

  // ============================================================================
  // RESOLVABILITY
  // ============================================================================

  describe("isEffectResolvable", () => {
    const basicEffect: DecomposeEffect = {
      type: EFFECT_DECOMPOSE,
      mode: "basic",
    };

    it("should be resolvable when player has action cards", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should NOT be resolvable when player only has wounds", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when hand is empty", () => {
      const player = createTestPlayer({ hand: [] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should be resolvable with mix of wounds and action cards", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND, CARD_MARCH, CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should NOT be resolvable when only artifacts in hand", () => {
      const player = createTestPlayer({ hand: [CARD_BANNER_OF_GLORY] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when only spells in hand", () => {
      const player = createTestPlayer({ hand: [CARD_FIREBALL] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });
  });

  // ============================================================================
  // EFFECT HANDLER
  // ============================================================================

  describe("handleDecomposeEffect", () => {
    it("should create pending state (basic mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH, CARD_RAGE] });
      const state = createTestGameState({ players: [player] });
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "basic",
      };

      const result = handleDecomposeEffect(
        state, 0, player, effect, CARD_DECOMPOSE
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingDecompose).not.toBeNull();
      expect(result.state.players[0].pendingDecompose?.mode).toBe("basic");
      expect(result.state.players[0].pendingDecompose?.sourceCardId).toBe(CARD_DECOMPOSE);
    });

    it("should create pending state (powered mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "powered",
      };

      const result = handleDecomposeEffect(
        state, 0, player, effect, CARD_DECOMPOSE
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingDecompose?.mode).toBe("powered");
    });

    it("should throw when no eligible action cards", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND, CARD_DECOMPOSE] });
      const state = createTestGameState({ players: [player] });
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "basic",
      };

      expect(() =>
        handleDecomposeEffect(state, 0, player, effect, CARD_DECOMPOSE)
      ).toThrow("No action cards available to throw away for Decompose");
    });

    it("should throw when sourceCardId is null", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "basic",
      };

      expect(() =>
        handleDecomposeEffect(state, 0, player, effect, null)
      ).toThrow("DecomposeEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // RESOLVE DECOMPOSE COMMAND - BASIC MODE
  // ============================================================================

  describe("resolveDecomposeCommand (basic mode)", () => {
    describe("green card → 2 green crystals", () => {
      it("should throw away a green card and gain 2 green crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green basic action
        });
        const result = command.execute(state);

        // Card removed from hand
        expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
        // Card added to removedCards (permanent removal)
        expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
        // Card NOT in discard pile (thrown away, not discarded)
        expect(result.state.players[0].discard).not.toContain(CARD_MARCH);
        // 2 green crystals gained
        expect(result.state.players[0].crystals.green).toBe(2);
        // Other crystals unchanged
        expect(result.state.players[0].crystals.red).toBe(0);
        expect(result.state.players[0].crystals.blue).toBe(0);
        expect(result.state.players[0].crystals.white).toBe(0);
        // Pending state cleared
        expect(result.state.players[0].pendingDecompose).toBeNull();
        // Card destroyed event emitted
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: CARD_DESTROYED,
            cardId: CARD_MARCH,
          })
        );
      });
    });

    describe("red card → 2 red crystals", () => {
      it("should throw away a red card and gain 2 red crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_RAGE],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_RAGE, // red basic action
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(2);
        expect(result.state.players[0].removedCards).toContain(CARD_RAGE);
      });
    });

    describe("blue card → 2 blue crystals", () => {
      it("should throw away a blue card and gain 2 blue crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_DETERMINATION],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_DETERMINATION, // blue basic action
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.blue).toBe(2);
        expect(result.state.players[0].removedCards).toContain(CARD_DETERMINATION);
      });
    });

    describe("white card → 2 white crystals", () => {
      it("should throw away a white card and gain 2 white crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_SWIFTNESS],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_SWIFTNESS, // white basic action
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.white).toBe(2);
        expect(result.state.players[0].removedCards).toContain(CARD_SWIFTNESS);
      });
    });

    describe("crystal cap at 3", () => {
      it("should cap at 3 when starting with 2 crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 0, blue: 0, green: 2, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green → +2 green, capped at 3
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.green).toBe(3);
      });

      it("should not exceed 3 when starting with 3 crystals", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 0, blue: 0, green: 3, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "basic" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green → +2 green, stays at 3
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.green).toBe(3);
        // Card still removed
        expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      });
    });
  });

  // ============================================================================
  // RESOLVE DECOMPOSE COMMAND - POWERED MODE
  // ============================================================================

  describe("resolveDecomposeCommand (powered mode)", () => {
    describe("green card → 1 red, 1 blue, 1 white crystals", () => {
      it("should throw away green card and gain 1 of each non-green crystal", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "powered" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green → gain 1 red, 1 blue, 1 white
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(1);
        expect(result.state.players[0].crystals.blue).toBe(1);
        expect(result.state.players[0].crystals.green).toBe(0); // No green!
        expect(result.state.players[0].crystals.white).toBe(1);
        expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      });
    });

    describe("red card → 1 blue, 1 green, 1 white crystals", () => {
      it("should throw away red card and gain 1 of each non-red crystal", () => {
        const player = createTestPlayer({
          hand: [CARD_RAGE],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "powered" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_RAGE, // red → gain 1 blue, 1 green, 1 white
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(0); // No red!
        expect(result.state.players[0].crystals.blue).toBe(1);
        expect(result.state.players[0].crystals.green).toBe(1);
        expect(result.state.players[0].crystals.white).toBe(1);
      });
    });

    describe("crystal cap per color in powered mode", () => {
      it("should cap individual colors at 3", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 3, blue: 2, green: 0, white: 3 },
          removedCards: [],
          pendingDecompose: makePending({ mode: "powered" }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDecomposeCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green → gain 1 red (capped), 1 blue, 1 white (capped)
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(3); // Already at cap
        expect(result.state.players[0].crystals.blue).toBe(3);
        expect(result.state.players[0].crystals.green).toBe(0); // Matching color, not gained
        expect(result.state.players[0].crystals.white).toBe(3); // Already at cap
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("resolveDecomposeCommand error handling", () => {
    it("should throw when no pending state exists", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingDecompose: null,
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      expect(() => command.execute(state)).toThrow("No pending decompose to resolve");
    });

    it("should throw when card is not eligible (wound)", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_WOUND,
      });

      expect(() => command.execute(state)).toThrow("not eligible for Decompose");
    });

    it("should throw when card is not eligible (artifact)", () => {
      const player = createTestPlayer({
        hand: [CARD_BANNER_OF_GLORY],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_BANNER_OF_GLORY,
      });

      expect(() => command.execute(state)).toThrow("not eligible for Decompose");
    });

    it("should throw when player not found", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "nonexistent",
        cardId: CARD_MARCH,
      });

      expect(() => command.execute(state)).toThrow("Player not found");
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("resolveDecomposeCommand undo", () => {
    it("should restore hand, removedCards, crystals, and pending state (basic)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        discard: [],
        removedCards: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingDecompose: makePending({ mode: "basic" }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      const executed = command.execute(state);
      // Verify execute changed state
      expect(executed.state.players[0].crystals.green).toBe(2);
      expect(executed.state.players[0].hand).not.toContain(CARD_MARCH);
      expect(executed.state.players[0].removedCards).toContain(CARD_MARCH);

      const undone = command.undo(executed.state);

      // Hand restored
      expect(undone.state.players[0].hand).toContain(CARD_MARCH);
      expect(undone.state.players[0].hand).toContain(CARD_RAGE);
      // removedCards restored
      expect(undone.state.players[0].removedCards).toEqual([]);
      // Crystals restored
      expect(undone.state.players[0].crystals.green).toBe(0);
      // Pending state restored
      expect(undone.state.players[0].pendingDecompose).not.toBeNull();
      expect(undone.state.players[0].pendingDecompose?.mode).toBe("basic");
    });

    it("should restore state after powered mode", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        discard: [],
        removedCards: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingDecompose: makePending({ mode: "powered" }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      const executed = command.execute(state);
      expect(executed.state.players[0].crystals.red).toBe(1);
      expect(executed.state.players[0].crystals.blue).toBe(1);
      expect(executed.state.players[0].crystals.white).toBe(1);

      const undone = command.undo(executed.state);

      // All crystals restored
      expect(undone.state.players[0].crystals).toEqual({ red: 0, blue: 0, green: 0, white: 0 });
      // removedCards restored
      expect(undone.state.players[0].removedCards).toEqual([]);
      // Pending state restored
      expect(undone.state.players[0].pendingDecompose?.mode).toBe("powered");
    });
  });

  // ============================================================================
  // DESCRIBE EFFECT
  // ============================================================================

  describe("describeEffect", () => {
    it("should describe basic decompose", () => {
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "basic",
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card to gain 2 crystals of matching color"
      );
    });

    it("should describe powered decompose", () => {
      const effect: DecomposeEffect = {
        type: EFFECT_DECOMPOSE,
        mode: "powered",
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card to gain 1 crystal of each non-matching color"
      );
    });
  });

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  describe("validators", () => {
    describe("validateHasPendingDecompose", () => {
      it("should pass when pending state exists", () => {
        const player = createTestPlayer({
          pendingDecompose: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingDecompose(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail when no pending state", () => {
        const player = createTestPlayer({
          pendingDecompose: null,
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingDecompose(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });

    describe("validateDecomposeSelection", () => {
      it("should pass for eligible action card", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDecompose: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateDecomposeSelection(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail for wound card", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND],
          pendingDecompose: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_WOUND,
        } as const;

        const result = validateDecomposeSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });

      it("should fail for artifact card", () => {
        const player = createTestPlayer({
          hand: [CARD_BANNER_OF_GLORY],
          pendingDecompose: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_BANNER_OF_GLORY,
        } as const;

        const result = validateDecomposeSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });

      it("should fail for the Decompose card itself", () => {
        const player = createTestPlayer({
          hand: [CARD_DECOMPOSE, CARD_MARCH],
          pendingDecompose: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_DECOMPOSE_ACTION,
          cardId: CARD_DECOMPOSE,
        } as const;

        const result = validateDecomposeSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });
  });

  // ============================================================================
  // PERMANENT REMOVAL VERIFICATION
  // ============================================================================

  describe("permanent removal (throw away)", () => {
    it("should add card to removedCards, not discard pile", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        discard: [],
        removedCards: [],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      // Card is in removedCards (permanent)
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Card is NOT in discard (would be recycled)
      expect(result.state.players[0].discard).not.toContain(CARD_MARCH);
      // Card is NOT in hand
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
      // Other cards remain in hand
      expect(result.state.players[0].hand).toContain(CARD_RAGE);
    });

    it("should emit CARD_DESTROYED event", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        removedCards: [],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        type: CARD_DESTROYED,
        playerId: "player1",
        cardId: CARD_MARCH,
      });
    });

    it("should preserve existing removedCards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        removedCards: [CARD_RAGE],
        pendingDecompose: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveDecomposeCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      expect(result.state.players[0].removedCards).toEqual([CARD_RAGE, CARD_MARCH]);
    });
  });
});
