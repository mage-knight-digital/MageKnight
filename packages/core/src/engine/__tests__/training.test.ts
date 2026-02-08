/**
 * Tests for Training (green advanced action card)
 *
 * Training allows throwing away (permanently removing) an action card from hand
 * to gain an AA of the same color from the offer:
 * - Basic: Throw away action card -> gain AA of same color from offer to discard pile
 * - Powered: Throw away action card -> gain AA of same color from offer to hand
 *
 * Key rules:
 * - Only action cards (basic/advanced) can be thrown away (not wounds, artifacts, spells)
 * - The Training card itself cannot be thrown away
 * - Thrown away cards go to removedCards (permanent, not recycled)
 * - Basic: gained card goes to DISCARD PILE
 * - Powered: gained card goes to HAND
 * - Two-phase resolution: select card to throw, then select from AA offer
 * - Dual-color AAs match if EITHER color matches
 * - Offer is replenished from deck after taking a card
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { isEffectResolvable } from "../effects/index.js";
import { handleTrainingEffect, getCardsEligibleForTraining } from "../effects/trainingEffects.js";
import { createResolveTrainingCommand } from "../commands/resolveTrainingCommand.js";
import { createResolveTrainingCommandFromAction } from "../commands/factories/cards.js";
import { describeEffect } from "../effects/describeEffect.js";
import {
  validateHasPendingTraining,
  validateTrainingSelection,
} from "../validators/trainingValidators.js";
import { getTrainingOptions } from "../validActions/pending.js";
import { getValidActions } from "../validActions/index.js";
import { EFFECT_TRAINING } from "../../types/effectTypes.js";
import type { TrainingEffect } from "../../types/cards.js";
import type { PendingTraining } from "../../types/player.js";
import {
  CARD_TRAINING,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  CARD_BANNER_OF_GLORY,
  CARD_FIREBALL,
  CARD_DESTROYED,
  CARD_GAINED,
  CARD_STAMINA,
  RESOLVE_TRAINING_ACTION,
  PLAY_CARD_ACTION,
} from "@mage-knight/shared";
import { CARD_PATH_FINDING } from "@mage-knight/shared";
import { CARD_DECOMPOSE } from "@mage-knight/shared";
import { CARD_REFRESHING_WALK } from "@mage-knight/shared";
import { CARD_BLOOD_RAGE } from "@mage-knight/shared";
import { CARD_IN_NEED } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides: Partial<PendingTraining> = {}): PendingTraining {
  return {
    sourceCardId: CARD_TRAINING,
    mode: "basic",
    phase: "select_card",
    thrownCardColor: null,
    availableOfferCards: [],
    ...overrides,
  };
}

function makePhase2Pending(
  mode: "basic" | "powered",
  thrownCardColor: "red" | "blue" | "green" | "white",
  availableOfferCards: readonly CardId[]
): PendingTraining {
  return {
    sourceCardId: CARD_TRAINING,
    mode,
    phase: "select_from_offer",
    thrownCardColor,
    availableOfferCards,
  };
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

describe("Training", () => {
  describe("getCardsEligibleForTraining", () => {
    it("should return action cards excluding wounds and the source card", () => {
      const hand = [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_TRAINING];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should exclude wounds", () => {
      const hand = [CARD_WOUND, CARD_MARCH];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude the source card (Training itself)", () => {
      const hand = [CARD_TRAINING, CARD_MARCH];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude artifacts (not action cards)", () => {
      const hand = [CARD_BANNER_OF_GLORY, CARD_MARCH];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude spells (not action cards)", () => {
      const hand = [CARD_FIREBALL, CARD_MARCH];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should return empty when only wounds and Training in hand", () => {
      const hand = [CARD_WOUND, CARD_TRAINING];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([]);
    });

    it("should include both basic and advanced action cards", () => {
      const hand = [CARD_MARCH, CARD_DECOMPOSE];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([CARD_MARCH, CARD_DECOMPOSE]);
    });
  });

  // ============================================================================
  // RESOLVABILITY
  // ============================================================================

  describe("isEffectResolvable", () => {
    const basicEffect: TrainingEffect = {
      type: EFFECT_TRAINING,
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

    it("should NOT be resolvable when only artifacts in hand", () => {
      const player = createTestPlayer({ hand: [CARD_BANNER_OF_GLORY] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });
  });

  // ============================================================================
  // EFFECT HANDLER
  // ============================================================================

  describe("handleTrainingEffect", () => {
    it("should create pending state (basic mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH, CARD_RAGE] });
      const state = createTestGameState({ players: [player] });
      const effect: TrainingEffect = {
        type: EFFECT_TRAINING,
        mode: "basic",
      };

      const result = handleTrainingEffect(
        state, 0, player, effect, CARD_TRAINING
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingTraining).not.toBeNull();
      expect(result.state.players[0].pendingTraining?.mode).toBe("basic");
      expect(result.state.players[0].pendingTraining?.phase).toBe("select_card");
      expect(result.state.players[0].pendingTraining?.sourceCardId).toBe(CARD_TRAINING);
    });

    it("should create pending state (powered mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: TrainingEffect = {
        type: EFFECT_TRAINING,
        mode: "powered",
      };

      const result = handleTrainingEffect(
        state, 0, player, effect, CARD_TRAINING
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingTraining?.mode).toBe("powered");
    });

    it("should throw when no action cards in hand", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      const effect: TrainingEffect = {
        type: EFFECT_TRAINING,
        mode: "basic",
      };

      expect(() =>
        handleTrainingEffect(state, 0, player, effect, CARD_TRAINING)
      ).toThrow("No action cards available to throw away for Training");
    });

    it("should throw when sourceCardId is null", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: TrainingEffect = {
        type: EFFECT_TRAINING,
        mode: "basic",
      };

      expect(() =>
        handleTrainingEffect(state, 0, player, effect, null)
      ).toThrow("TrainingEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // COMMAND: PHASE 1 (select card to throw away)
  // ============================================================================

  describe("resolveTrainingCommand - phase 1", () => {
    it("should throw away the selected card and transition to phase 2", () => {
      // CARD_RAGE is red, so put a red AA in the offer
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_REFRESHING_WALK, CARD_PATH_FINDING] },
          spells: { cards: [] },
          units: { cards: [] },
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });

      const result = command.execute(state);

      // Card removed from hand
      expect(result.state.players[0].hand).not.toContain(CARD_RAGE);
      expect(result.state.players[0].hand).toContain(CARD_MARCH);

      // Card added to removedCards (permanent removal)
      expect(result.state.players[0].removedCards).toContain(CARD_RAGE);

      // CARD_DESTROYED event emitted
      expect(result.events).toContainEqual({
        type: CARD_DESTROYED,
        playerId: "player1",
        cardId: CARD_RAGE,
      });

      // Transitions to phase 2 with matching red AA
      const pending = result.state.players[0].pendingTraining;
      expect(pending?.phase).toBe("select_from_offer");
      expect(pending?.thrownCardColor).toBe("red");
      expect(pending?.availableOfferCards).toContain(CARD_BLOOD_RAGE);
      // Green AAs should NOT be in the available offer
      expect(pending?.availableOfferCards).not.toContain(CARD_REFRESHING_WALK);
    });

    it("should clear pending if no matching AA in offer after throwing card", () => {
      // Throw away a green card, but no green AAs in offer
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] }, // Only red AAs
          spells: { cards: [] },
          units: { cards: [] },
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green card
      });

      const result = command.execute(state);

      // Card still thrown away
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Pending cleared (nothing to gain)
      expect(result.state.players[0].pendingTraining).toBeNull();
    });
  });

  // ============================================================================
  // COMMAND: PHASE 2 (select AA from offer)
  // ============================================================================

  describe("resolveTrainingCommand - phase 2 basic (AA to discard)", () => {
    it("should add selected AA to discard pile (basic mode)", () => {
      const player = createTestPlayer({
        hand: [CARD_STAMINA], // remaining hand
        discard: [],
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_REFRESHING_WALK] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [CARD_IN_NEED],
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });

      const result = command.execute(state);

      // AA added to DISCARD PILE (not hand - basic mode)
      expect(result.state.players[0].discard).toContain(CARD_BLOOD_RAGE);
      // AA NOT added to hand
      expect(result.state.players[0].hand).not.toContain(CARD_BLOOD_RAGE);

      // Pending cleared
      expect(result.state.players[0].pendingTraining).toBeNull();

      // AA removed from offer
      expect(result.state.offers.advancedActions.cards).not.toContain(CARD_BLOOD_RAGE);

      // Offer replenished from deck
      expect(result.state.offers.advancedActions.cards).toContain(CARD_IN_NEED);

      // Deck decremented
      expect(result.state.decks.advancedActions).not.toContain(CARD_IN_NEED);

      // CARD_GAINED event emitted
      expect(result.events).toContainEqual({
        type: CARD_GAINED,
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });
    });
  });

  describe("resolveTrainingCommand - phase 2 powered (AA to hand)", () => {
    it("should add selected AA to hand (powered mode)", () => {
      const player = createTestPlayer({
        hand: [CARD_STAMINA],
        discard: [],
        pendingTraining: makePhase2Pending("powered", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_REFRESHING_WALK] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [],
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });

      const result = command.execute(state);

      // AA added to HAND (powered mode)
      expect(result.state.players[0].hand).toContain(CARD_BLOOD_RAGE);
      // AA NOT in discard
      expect(result.state.players[0].discard).not.toContain(CARD_BLOOD_RAGE);

      // Pending cleared
      expect(result.state.players[0].pendingTraining).toBeNull();

      // AA removed from offer
      expect(result.state.offers.advancedActions.cards).not.toContain(CARD_BLOOD_RAGE);
    });

    it("should not replenish offer when deck is empty", () => {
      const player = createTestPlayer({
        hand: [CARD_STAMINA],
        pendingTraining: makePhase2Pending("powered", "green", [CARD_REFRESHING_WALK]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_REFRESHING_WALK, CARD_BLOOD_RAGE] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [], // empty deck
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_REFRESHING_WALK,
      });

      const result = command.execute(state);

      // Offer only has 1 card left (no replenishment)
      expect(result.state.offers.advancedActions.cards).toHaveLength(1);
      expect(result.state.offers.advancedActions.cards).toContain(CARD_BLOOD_RAGE);
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("resolveTrainingCommand - undo", () => {
    it("should undo phase 1 (restore hand and removedCards)", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] },
          spells: { cards: [] },
          units: { cards: [] },
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });

      const afterExecute = command.execute(state);
      const afterUndo = command.undo(afterExecute.state);

      // Hand restored
      expect(afterUndo.state.players[0].hand).toContain(CARD_RAGE);
      expect(afterUndo.state.players[0].hand).toContain(CARD_MARCH);

      // removedCards restored
      expect(afterUndo.state.players[0].removedCards).not.toContain(CARD_RAGE);

      // Pending restored to phase 1
      expect(afterUndo.state.players[0].pendingTraining?.phase).toBe("select_card");
    });

    it("should undo phase 2 (restore hand, discard, offer, deck)", () => {
      const player = createTestPlayer({
        hand: [CARD_STAMINA],
        discard: [],
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE, CARD_REFRESHING_WALK] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [CARD_IN_NEED],
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });

      const afterExecute = command.execute(state);
      const afterUndo = command.undo(afterExecute.state);

      // Discard restored (AA removed)
      expect(afterUndo.state.players[0].discard).not.toContain(CARD_BLOOD_RAGE);

      // Offer restored
      expect(afterUndo.state.offers.advancedActions.cards).toContain(CARD_BLOOD_RAGE);

      // Deck restored
      expect(afterUndo.state.decks.advancedActions).toContain(CARD_IN_NEED);

      // Pending restored to phase 2
      expect(afterUndo.state.players[0].pendingTraining?.phase).toBe("select_from_offer");
    });
  });

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  describe("validators", () => {
    it("should reject when no pending Training", () => {
      const player = createTestPlayer({ pendingTraining: null });
      const state = createTestGameState({ players: [player] });

      const result = validateHasPendingTraining(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_MARCH,
      });

      expect(result.valid).toBe(false);
    });

    it("should accept when pending Training exists", () => {
      const player = createTestPlayer({
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateHasPendingTraining(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_MARCH,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject phase 1 selection of non-eligible card (wound)", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateTrainingSelection(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_WOUND,
      });

      expect(result.valid).toBe(false);
    });

    it("should reject phase 1 selection of Training itself", () => {
      const player = createTestPlayer({
        hand: [CARD_TRAINING, CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateTrainingSelection(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_TRAINING,
      });

      expect(result.valid).toBe(false);
    });

    it("should accept phase 1 selection of valid action card", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateTrainingSelection(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_MARCH,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject phase 2 selection of card not in available offer", () => {
      const player = createTestPlayer({
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateTrainingSelection(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_REFRESHING_WALK, // green, not in available
      });

      expect(result.valid).toBe(false);
    });

    it("should accept phase 2 selection of card in available offer", () => {
      const player = createTestPlayer({
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({ players: [player] });

      const result = validateTrainingSelection(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_BLOOD_RAGE,
      });

      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // VALID ACTIONS
  // ============================================================================

  describe("validActions", () => {
    it("should return training options in phase 1", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_WOUND],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const options = getTrainingOptions(state, player);

      expect(options).toBeDefined();
      expect(options?.phase).toBe("select_card");
      expect(options?.availableCardIds).toContain(CARD_MARCH);
      expect(options?.availableCardIds).toContain(CARD_RAGE);
      expect(options?.availableCardIds).not.toContain(CARD_WOUND);
    });

    it("should return training options in phase 2", () => {
      const player = createTestPlayer({
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({ players: [player] });

      const options = getTrainingOptions(state, player);

      expect(options).toBeDefined();
      expect(options?.phase).toBe("select_from_offer");
      expect(options?.availableOfferCards).toContain(CARD_BLOOD_RAGE);
    });

    it("should return undefined when no pending Training", () => {
      const player = createTestPlayer({ pendingTraining: null });
      const state = createTestGameState({ players: [player] });

      const options = getTrainingOptions(state, player);
      expect(options).toBeUndefined();
    });

    it("should return pending_training mode from getValidActions", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      expect(validActions.mode).toBe("pending_training");
    });
  });

  // ============================================================================
  // COMMAND FACTORY
  // ============================================================================

  describe("command factory", () => {
    it("should create command from action when pending Training exists", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveTrainingCommandFromAction(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_MARCH,
      });

      expect(command).not.toBeNull();
    });

    it("should return null when no pending Training", () => {
      const player = createTestPlayer({ pendingTraining: null });
      const state = createTestGameState({ players: [player] });

      const command = createResolveTrainingCommandFromAction(state, "player1", {
        type: RESOLVE_TRAINING_ACTION,
        cardId: CARD_MARCH,
      });

      expect(command).toBeNull();
    });

    it("should return null for non-training action type", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveTrainingCommandFromAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      });

      expect(command).toBeNull();
    });
  });

  // ============================================================================
  // DESCRIBE EFFECT
  // ============================================================================

  describe("describeEffect", () => {
    it("should describe basic effect", () => {
      const effect: TrainingEffect = { type: EFFECT_TRAINING, mode: "basic" };
      const desc = describeEffect(effect);
      expect(desc).toContain("discard pile");
    });

    it("should describe powered effect", () => {
      const effect: TrainingEffect = { type: EFFECT_TRAINING, mode: "powered" };
      const desc = describeEffect(effect);
      expect(desc).toContain("hand");
    });
  });

  // ============================================================================
  // EDGE CASES / FAQ RULINGS
  // ============================================================================

  describe("edge cases", () => {
    it("S2: cannot throw away Training itself (excluded from eligibility)", () => {
      const hand = [CARD_TRAINING, CARD_WOUND];
      const eligible = getCardsEligibleForTraining(hand, CARD_TRAINING);
      expect(eligible).toEqual([]);
    });

    it("S3: thrown-away card MUST match color of AA in offer", () => {
      // Player throws a green card, but only red AAs in offer
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] }, // Only red
          spells: { cards: [] },
          units: { cards: [] },
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green card
      });

      const result = command.execute(state);

      // No matching green AAs → pending cleared, nothing to gain
      expect(result.state.players[0].pendingTraining).toBeNull();
      // But card still thrown away
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
    });

    it("card is permanently removed (in removedCards, not discard)", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_MARCH],
        removedCards: [],
        pendingTraining: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] },
          spells: { cards: [] },
          units: { cards: [] },
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });

      const result = command.execute(state);

      // In removedCards (permanent)
      expect(result.state.players[0].removedCards).toContain(CARD_RAGE);
      // NOT in discard (not recycled)
      expect(result.state.players[0].discard).not.toContain(CARD_RAGE);
    });

    it("basic: gained AA goes to discard (NOT hand)", () => {
      const player = createTestPlayer({
        hand: [],
        discard: [],
        pendingTraining: makePhase2Pending("basic", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [],
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });

      const result = command.execute(state);

      expect(result.state.players[0].discard).toContain(CARD_BLOOD_RAGE);
      expect(result.state.players[0].hand).not.toContain(CARD_BLOOD_RAGE);
    });

    it("powered: gained AA goes to hand (NOT discard)", () => {
      const player = createTestPlayer({
        hand: [],
        discard: [],
        pendingTraining: makePhase2Pending("powered", "red", [CARD_BLOOD_RAGE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          advancedActions: { cards: [CARD_BLOOD_RAGE] },
          spells: { cards: [] },
          units: { cards: [] },
        },
        decks: {
          advancedActions: [],
          spells: [],
        },
      });

      const command = createResolveTrainingCommand({
        playerId: "player1",
        cardId: CARD_BLOOD_RAGE,
      });

      const result = command.execute(state);

      expect(result.state.players[0].hand).toContain(CARD_BLOOD_RAGE);
      expect(result.state.players[0].discard).not.toContain(CARD_BLOOD_RAGE);
    });
  });
});
