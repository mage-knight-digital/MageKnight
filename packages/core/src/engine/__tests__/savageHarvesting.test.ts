/**
 * Tests for Savage Harvesting (Krang's hero-specific basic action card)
 *
 * Replaces March for Krang with additional discard-for-crystal ability:
 * - Basic: Move 2 + optionally discard a non-wound card to gain a crystal
 * - Powered (Green): Move 4 + optionally discard a non-wound card to gain a crystal
 *
 * Crystal color rules:
 * - Action cards: crystal matches card's frame color automatically
 * - Non-action cards (artifacts, spells): player chooses crystal color (two-step)
 * - Wounds cannot be discarded
 * - Crystals capped at 3 per color
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { isEffectResolvable } from "../effects/index.js";
import { handleDiscardForCrystalEffect, getCardsEligibleForDiscardForCrystal } from "../effects/discardForCrystalEffects.js";
import { createResolveDiscardForCrystalCommand } from "../commands/resolveDiscardForCrystalCommand.js";
import { createResolveArtifactCrystalColorCommand } from "../commands/resolveArtifactCrystalColorCommand.js";
import { describeEffect } from "../effects/describeEffect.js";
import {
  validateHasPendingDiscardForCrystal,
  validateDiscardForCrystalSelection,
  validateHasPendingArtifactColorChoice,
  validateArtifactCrystalColorSelection,
} from "../validators/discardForCrystalValidators.js";
import { EFFECT_DISCARD_FOR_CRYSTAL } from "../../types/effectTypes.js";
import type { DiscardForCrystalEffect } from "../../types/cards.js";
import type { PendingDiscardForCrystal } from "../../types/player.js";
import {
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  CARD_BANNER_OF_GLORY,
  CARD_FIREBALL,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_DISCARDED,
} from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides: Partial<PendingDiscardForCrystal> = {}): PendingDiscardForCrystal {
  return {
    sourceCardId: CARD_KRANG_SAVAGE_HARVESTING,
    optional: true,
    discardedCardId: null,
    awaitingColorChoice: false,
    ...overrides,
  };
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

describe("Savage Harvesting", () => {
  describe("getCardsEligibleForDiscardForCrystal", () => {
    it("should return non-wound cards", () => {
      const hand = [CARD_MARCH, CARD_RAGE, CARD_WOUND];
      const eligible = getCardsEligibleForDiscardForCrystal(hand);
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should return empty array when only wounds in hand", () => {
      const hand = [CARD_WOUND, CARD_WOUND];
      const eligible = getCardsEligibleForDiscardForCrystal(hand);
      expect(eligible).toEqual([]);
    });

    it("should return empty array for empty hand", () => {
      const eligible = getCardsEligibleForDiscardForCrystal([]);
      expect(eligible).toEqual([]);
    });

    it("should include artifacts", () => {
      const hand = [CARD_BANNER_OF_GLORY];
      const eligible = getCardsEligibleForDiscardForCrystal(hand);
      expect(eligible).toEqual([CARD_BANNER_OF_GLORY]);
    });

    it("should include spells", () => {
      const hand = [CARD_FIREBALL];
      const eligible = getCardsEligibleForDiscardForCrystal(hand);
      expect(eligible).toEqual([CARD_FIREBALL]);
    });
  });

  // ============================================================================
  // RESOLVABILITY
  // ============================================================================

  describe("isEffectResolvable", () => {
    const effect: DiscardForCrystalEffect = {
      type: EFFECT_DISCARD_FOR_CRYSTAL,
      optional: true,
    };

    it("should be resolvable when player has non-wound cards", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", effect)).toBe(true);
    });

    it("should NOT be resolvable when player only has wounds", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });

    it("should NOT be resolvable when hand is empty", () => {
      const player = createTestPlayer({ hand: [] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", effect)).toBe(false);
    });

    it("should be resolvable with a mix of wounds and non-wounds", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND, CARD_MARCH, CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", effect)).toBe(true);
    });
  });

  // ============================================================================
  // EFFECT HANDLER
  // ============================================================================

  describe("handleDiscardForCrystalEffect", () => {
    it("should create pending state when player has eligible cards", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH, CARD_RAGE] });
      const state = createTestGameState({ players: [player] });
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: true,
      };

      const result = handleDiscardForCrystalEffect(
        state, 0, player, effect, CARD_KRANG_SAVAGE_HARVESTING
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingDiscardForCrystal).not.toBeNull();
      expect(result.state.players[0].pendingDiscardForCrystal?.optional).toBe(true);
      expect(result.state.players[0].pendingDiscardForCrystal?.sourceCardId).toBe(
        CARD_KRANG_SAVAGE_HARVESTING
      );
    });

    it("should skip when optional and no eligible cards", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: true,
      };

      const result = handleDiscardForCrystalEffect(
        state, 0, player, effect, CARD_KRANG_SAVAGE_HARVESTING
      );

      // Should not set pending state - just skipped
      expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
      expect(result.requiresChoice).toBeUndefined();
    });

    it("should throw when required and no eligible cards", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: false,
      };

      expect(() =>
        handleDiscardForCrystalEffect(
          state, 0, player, effect, CARD_KRANG_SAVAGE_HARVESTING
        )
      ).toThrow("No cards available to discard for crystal");
    });

    it("should throw when sourceCardId is null", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: true,
      };

      expect(() =>
        handleDiscardForCrystalEffect(state, 0, player, effect, null)
      ).toThrow("DiscardForCrystalEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // RESOLVE DISCARD FOR CRYSTAL COMMAND
  // ============================================================================

  describe("resolveDiscardForCrystalCommand", () => {
    describe("skipping (optional)", () => {
      it("should allow skipping when optional", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending({ optional: true }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: null,
        });
        const result = command.execute(state);

        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
        expect(result.state.players[0].crystals).toEqual(player.crystals);
        expect(result.events).toEqual([]);
      });

      it("should throw when skipping a required discard", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending({ optional: false }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: null,
        });

        expect(() => command.execute(state)).toThrow(
          "Cannot skip discard: discard is required (not optional)"
        );
      });
    });

    describe("action card discard (auto crystal color)", () => {
      it("should discard a green action card and gain green crystal", () => {
        // CARD_MARCH is a green basic action card
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_MARCH,
        });
        const result = command.execute(state);

        // Card removed from hand and added to discard
        expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
        expect(result.state.players[0].discard).toContain(CARD_MARCH);

        // Green crystal gained
        expect(result.state.players[0].crystals.green).toBe(1);

        // Pending state cleared
        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();

        // Discard event emitted
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: CARD_DISCARDED,
            cardId: CARD_MARCH,
          })
        );
      });

      it("should discard a red action card and gain red crystal", () => {
        // CARD_RAGE is a red basic action card
        const player = createTestPlayer({
          hand: [CARD_RAGE],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_RAGE,
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(1);
        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
      });
    });

    describe("non-action card discard (requires color choice)", () => {
      it("should discard an artifact and transition to awaitingColorChoice", () => {
        const player = createTestPlayer({
          hand: [CARD_BANNER_OF_GLORY],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_BANNER_OF_GLORY,
        });
        const result = command.execute(state);

        // Card removed from hand and added to discard
        expect(result.state.players[0].hand).not.toContain(CARD_BANNER_OF_GLORY);
        expect(result.state.players[0].discard).toContain(CARD_BANNER_OF_GLORY);

        // Pending state transitions to awaiting color choice
        const pending = result.state.players[0].pendingDiscardForCrystal;
        expect(pending).not.toBeNull();
        expect(pending?.awaitingColorChoice).toBe(true);
        expect(pending?.discardedCardId).toBe(CARD_BANNER_OF_GLORY);

        // No crystal gained yet
        expect(result.state.players[0].crystals).toEqual({
          red: 0, blue: 0, green: 0, white: 0,
        });
      });

      it("should discard a spell and transition to awaitingColorChoice", () => {
        const player = createTestPlayer({
          hand: [CARD_FIREBALL],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_FIREBALL,
        });
        const result = command.execute(state);

        // Card discarded
        expect(result.state.players[0].hand).not.toContain(CARD_FIREBALL);
        expect(result.state.players[0].discard).toContain(CARD_FIREBALL);

        // Awaiting color choice for spell
        const pending = result.state.players[0].pendingDiscardForCrystal;
        expect(pending?.awaitingColorChoice).toBe(true);
        expect(pending?.discardedCardId).toBe(CARD_FIREBALL);
      });
    });

    describe("crystal cap at 3", () => {
      it("should not exceed 3 crystals of the same color", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          crystals: { red: 0, blue: 0, green: 3, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_MARCH, // green action card
        });
        const result = command.execute(state);

        // Crystal stays at 3 (capped)
        expect(result.state.players[0].crystals.green).toBe(3);
        // But the card is still discarded
        expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
        expect(result.state.players[0].discard).toContain(CARD_MARCH);
        // Pending state cleared
        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
      });
    });

    describe("error handling", () => {
      it("should throw when no pending state exists", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: null,
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_MARCH,
        });

        expect(() => command.execute(state)).toThrow(
          "No pending discard-for-crystal to resolve"
        );
      });

      it("should throw when card is not eligible (wound)", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND],
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_WOUND,
        });

        expect(() => command.execute(state)).toThrow("not eligible for discard");
      });

      it("should throw when player not found", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "nonexistent",
          cardId: CARD_MARCH,
        });

        expect(() => command.execute(state)).toThrow("Player not found");
      });
    });

    describe("undo", () => {
      it("should restore hand, discard, crystals, and pending state after action card", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          discard: [],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_MARCH,
        });

        const executed = command.execute(state);
        // Verify execute changed state
        expect(executed.state.players[0].crystals.green).toBe(1);
        expect(executed.state.players[0].hand).not.toContain(CARD_MARCH);

        const undone = command.undo(executed.state);

        // Hand restored
        expect(undone.state.players[0].hand).toContain(CARD_MARCH);
        expect(undone.state.players[0].hand).toContain(CARD_RAGE);
        // Discard restored
        expect(undone.state.players[0].discard).toEqual([]);
        // Crystals restored
        expect(undone.state.players[0].crystals.green).toBe(0);
        // Pending state restored
        expect(undone.state.players[0].pendingDiscardForCrystal).not.toBeNull();
        expect(undone.state.players[0].pendingDiscardForCrystal?.optional).toBe(true);
      });

      it("should restore state after artifact discard (mid-flow undo)", () => {
        const player = createTestPlayer({
          hand: [CARD_BANNER_OF_GLORY],
          discard: [],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: CARD_BANNER_OF_GLORY,
        });

        const executed = command.execute(state);
        // Verify artifact was discarded and awaiting color choice
        expect(executed.state.players[0].pendingDiscardForCrystal?.awaitingColorChoice).toBe(true);

        const undone = command.undo(executed.state);

        // Hand and discard restored
        expect(undone.state.players[0].hand).toContain(CARD_BANNER_OF_GLORY);
        expect(undone.state.players[0].discard).toEqual([]);
        // Original pending state restored (not awaitingColorChoice)
        expect(undone.state.players[0].pendingDiscardForCrystal?.awaitingColorChoice).toBe(false);
      });

      it("should restore state after skip", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending({ optional: true }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveDiscardForCrystalCommand({
          playerId: "player1",
          cardId: null,
        });

        const executed = command.execute(state);
        expect(executed.state.players[0].pendingDiscardForCrystal).toBeNull();

        const undone = command.undo(executed.state);

        // Pending state restored
        expect(undone.state.players[0].pendingDiscardForCrystal).not.toBeNull();
        expect(undone.state.players[0].pendingDiscardForCrystal?.optional).toBe(true);
      });
    });
  });

  // ============================================================================
  // RESOLVE ARTIFACT CRYSTAL COLOR COMMAND
  // ============================================================================

  describe("resolveArtifactCrystalColorCommand", () => {
    describe("color selection", () => {
      it("should gain a red crystal when red is chosen", () => {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_BANNER_OF_GLORY,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_RED,
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.red).toBe(1);
        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
      });

      it("should gain a blue crystal when blue is chosen", () => {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_BANNER_OF_GLORY,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_BLUE,
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.blue).toBe(1);
      });

      it("should gain a green crystal when green is chosen", () => {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_FIREBALL,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_GREEN,
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.green).toBe(1);
      });

      it("should gain a white crystal when white is chosen", () => {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_FIREBALL,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_WHITE,
        });
        const result = command.execute(state);

        expect(result.state.players[0].crystals.white).toBe(1);
      });
    });

    describe("crystal cap at 3", () => {
      it("should not exceed 3 crystals of chosen color", () => {
        const player = createTestPlayer({
          crystals: { red: 3, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_BANNER_OF_GLORY,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_RED,
        });
        const result = command.execute(state);

        // Crystal stays at 3 (capped)
        expect(result.state.players[0].crystals.red).toBe(3);
        // Pending state still cleared
        expect(result.state.players[0].pendingDiscardForCrystal).toBeNull();
      });
    });

    describe("error handling", () => {
      it("should throw when no pending state exists", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: null,
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_RED,
        });

        expect(() => command.execute(state)).toThrow(
          "No pending discard-for-crystal to resolve"
        );
      });

      it("should throw when not awaiting color choice", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: false,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_RED,
        });

        expect(() => command.execute(state)).toThrow(
          "Not awaiting color choice"
        );
      });

      it("should throw when no card was discarded", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: null,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_RED,
        });

        expect(() => command.execute(state)).toThrow("No card was discarded");
      });
    });

    describe("undo", () => {
      it("should restore crystals and pending state", () => {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_BANNER_OF_GLORY,
          }),
        });
        const state = createTestGameState({ players: [player] });

        const command = createResolveArtifactCrystalColorCommand({
          playerId: "player1",
          color: MANA_BLUE,
        });

        const executed = command.execute(state);
        expect(executed.state.players[0].crystals.blue).toBe(1);
        expect(executed.state.players[0].pendingDiscardForCrystal).toBeNull();

        const undone = command.undo(executed.state);

        // Crystals restored
        expect(undone.state.players[0].crystals.blue).toBe(0);
        // Pending state restored
        expect(undone.state.players[0].pendingDiscardForCrystal).not.toBeNull();
        expect(undone.state.players[0].pendingDiscardForCrystal?.awaitingColorChoice).toBe(true);
        expect(undone.state.players[0].pendingDiscardForCrystal?.discardedCardId).toBe(
          CARD_BANNER_OF_GLORY
        );
      });
    });
  });

  // ============================================================================
  // DESCRIBE EFFECT
  // ============================================================================

  describe("describeEffect", () => {
    it("should describe optional discard-for-crystal", () => {
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: true,
      };
      expect(describeEffect(effect)).toBe(
        "Optionally discard a card to gain a crystal"
      );
    });

    it("should describe required discard-for-crystal", () => {
      const effect: DiscardForCrystalEffect = {
        type: EFFECT_DISCARD_FOR_CRYSTAL,
        optional: false,
      };
      expect(describeEffect(effect)).toBe(
        "Discard a card to gain a crystal"
      );
    });
  });

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  describe("validators", () => {

    describe("validateHasPendingDiscardForCrystal", () => {
      it("should pass when pending state exists", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: CARD_MARCH };

        const result = validateHasPendingDiscardForCrystal(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail when no pending state", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: null,
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: CARD_MARCH };

        const result = validateHasPendingDiscardForCrystal(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });

    describe("validateDiscardForCrystalSelection", () => {
      it("should pass for eligible card", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: CARD_MARCH };

        const result = validateDiscardForCrystalSelection(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail for wound card", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND],
          pendingDiscardForCrystal: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: CARD_WOUND };

        const result = validateDiscardForCrystalSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });

      it("should pass when skipping optional discard", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending({ optional: true }),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: null };

        const result = validateDiscardForCrystalSelection(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail when skipping required discard", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingDiscardForCrystal: makePending({ optional: false }),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_DISCARD_FOR_CRYSTAL" as const, cardId: null };

        const result = validateDiscardForCrystalSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });

    describe("validateHasPendingArtifactColorChoice", () => {
      it("should pass when awaiting color choice", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: true,
            discardedCardId: CARD_BANNER_OF_GLORY,
          }),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_ARTIFACT_CRYSTAL_COLOR" as const, color: MANA_RED };

        const result = validateHasPendingArtifactColorChoice(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail when not awaiting color choice", () => {
        const player = createTestPlayer({
          pendingDiscardForCrystal: makePending({
            awaitingColorChoice: false,
          }),
        });
        const state = createTestGameState({ players: [player] });
        const action = { type: "RESOLVE_ARTIFACT_CRYSTAL_COLOR" as const, color: MANA_RED };

        const result = validateHasPendingArtifactColorChoice(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });

    describe("validateArtifactCrystalColorSelection", () => {
      it("should pass for valid basic mana colors", () => {
        const colors = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];
        for (const color of colors) {
          const player = createTestPlayer({
            pendingDiscardForCrystal: makePending({
              awaitingColorChoice: true,
              discardedCardId: CARD_BANNER_OF_GLORY,
            }),
          });
          const state = createTestGameState({ players: [player] });
          const action = { type: "RESOLVE_ARTIFACT_CRYSTAL_COLOR" as const, color };

          const result = validateArtifactCrystalColorSelection(state, "player1", action);
          expect(result.valid).toBe(true);
        }
      });
    });
  });

  // ============================================================================
  // TWO-STEP FLOW (artifact: discard then choose color)
  // ============================================================================

  describe("full two-step flow for artifacts", () => {
    it("should complete artifact discard flow: discard -> choose color -> gain crystal", () => {
      // Step 1: Discard an artifact
      const player = createTestPlayer({
        hand: [CARD_BANNER_OF_GLORY, CARD_MARCH],
        discard: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingDiscardForCrystal: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const discardCommand = createResolveDiscardForCrystalCommand({
        playerId: "player1",
        cardId: CARD_BANNER_OF_GLORY,
      });
      const afterDiscard = discardCommand.execute(state);

      // Artifact discarded, awaiting color choice
      expect(afterDiscard.state.players[0].hand).not.toContain(CARD_BANNER_OF_GLORY);
      expect(afterDiscard.state.players[0].hand).toContain(CARD_MARCH);
      expect(afterDiscard.state.players[0].discard).toContain(CARD_BANNER_OF_GLORY);
      expect(afterDiscard.state.players[0].pendingDiscardForCrystal?.awaitingColorChoice).toBe(true);

      // Step 2: Choose crystal color
      const colorCommand = createResolveArtifactCrystalColorCommand({
        playerId: "player1",
        color: MANA_WHITE,
      });
      const afterColor = colorCommand.execute(afterDiscard.state);

      // White crystal gained, pending state cleared
      expect(afterColor.state.players[0].crystals.white).toBe(1);
      expect(afterColor.state.players[0].pendingDiscardForCrystal).toBeNull();

      // Other hand cards still present
      expect(afterColor.state.players[0].hand).toContain(CARD_MARCH);
    });

    it("should complete spell discard flow with color choice", () => {
      const player = createTestPlayer({
        hand: [CARD_FIREBALL],
        discard: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingDiscardForCrystal: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      // Step 1: Discard spell
      const discardCommand = createResolveDiscardForCrystalCommand({
        playerId: "player1",
        cardId: CARD_FIREBALL,
      });
      const afterDiscard = discardCommand.execute(state);
      expect(afterDiscard.state.players[0].pendingDiscardForCrystal?.awaitingColorChoice).toBe(true);

      // Step 2: Choose red crystal
      const colorCommand = createResolveArtifactCrystalColorCommand({
        playerId: "player1",
        color: MANA_RED,
      });
      const afterColor = colorCommand.execute(afterDiscard.state);

      expect(afterColor.state.players[0].crystals.red).toBe(1);
      expect(afterColor.state.players[0].pendingDiscardForCrystal).toBeNull();
    });
  });
});
