/**
 * Stout Resolve Tests
 *
 * Tests for the EFFECT_DISCARD_FOR_BONUS mechanic:
 * - Basic: Choose Move/Influence/Attack/Block 2. Optionally discard 1 wound for +1.
 * - Powered: Choose Move/Influence/Attack/Block 3. Optionally discard any cards (max 1 wound) for +2 each.
 *
 * Covers:
 * - Card eligibility for discard filters
 * - Effect handler creates pending state
 * - Command resolution with bonus calculation
 * - ValidActions computation
 * - Validator acceptance and rejection
 * - Undo support
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { PendingDiscardForBonus } from "../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_WOUND,
  CARD_MARCH,
  CARD_RAGE,
  CARD_SWIFTNESS,
  CARD_STAMINA,
  CARD_STOUT_RESOLVE,
  RESOLVE_DISCARD_FOR_BONUS_ACTION,
} from "@mage-knight/shared";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_DISCARD_FOR_BONUS,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import type { CardEffect } from "../../types/cards.js";
import {
  getCardsEligibleForDiscardForBonus,
  handleDiscardForBonus,
} from "../effects/stoutResolveEffects.js";
import { createResolveDiscardForBonusCommand } from "../commands/resolveDiscardForBonusCommand.js";
import {
  validateHasPendingDiscardForBonus,
  validateDiscardForBonusSelection,
} from "../validators/discardForBonusValidators.js";
import { getDiscardForBonusOptions } from "../validActions/pending.js";
import { createTestPlayer, createTestGameState, createUnitCombatState } from "./testHelpers.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import {
  DISCARD_FOR_BONUS_REQUIRED,
  DISCARD_FOR_BONUS_CARD_NOT_ELIGIBLE,
  DISCARD_FOR_BONUS_TOO_MANY_WOUNDS,
  DISCARD_FOR_BONUS_TOO_MANY_CARDS,
  DISCARD_FOR_BONUS_INVALID_CHOICE,
} from "../validators/validationCodes.js";

// ============================================================================
// SHARED TEST DATA
// ============================================================================

const BASIC_CHOICE_OPTIONS: readonly CardEffect[] = [
  { type: EFFECT_GAIN_MOVE, amount: 2 },
  { type: EFFECT_GAIN_INFLUENCE, amount: 2 },
  { type: EFFECT_GAIN_ATTACK, amount: 2, combatType: COMBAT_TYPE_MELEE },
  { type: EFFECT_GAIN_BLOCK, amount: 2 },
];

const POWERED_CHOICE_OPTIONS: readonly CardEffect[] = [
  { type: EFFECT_GAIN_MOVE, amount: 3 },
  { type: EFFECT_GAIN_INFLUENCE, amount: 3 },
  { type: EFFECT_GAIN_ATTACK, amount: 3, combatType: COMBAT_TYPE_MELEE },
  { type: EFFECT_GAIN_BLOCK, amount: 3 },
];

function createPendingBasic(): PendingDiscardForBonus {
  return {
    sourceCardId: CARD_STOUT_RESOLVE,
    choiceOptions: BASIC_CHOICE_OPTIONS,
    bonusPerCard: 1,
    maxDiscards: 1,
    discardFilter: "wound_only",
  };
}

function createPendingPowered(): PendingDiscardForBonus {
  return {
    sourceCardId: CARD_STOUT_RESOLVE,
    choiceOptions: POWERED_CHOICE_OPTIONS,
    bonusPerCard: 2,
    maxDiscards: Infinity,
    discardFilter: "any_max_one_wound",
  };
}

function createStateWithPending(
  pending: PendingDiscardForBonus,
  hand: readonly CardId[] = [CARD_MARCH, CARD_WOUND]
): GameState {
  const player = createTestPlayer({
    hand,
    pendingDiscardForBonus: pending,
    playArea: [CARD_STOUT_RESOLVE],
  });

  return createTestGameState({ players: [player] });
}

// ============================================================================
// CARD ELIGIBILITY TESTS
// ============================================================================

describe("Stout Resolve", () => {
  describe("getCardsEligibleForDiscardForBonus", () => {
    describe("wound_only filter (basic effect)", () => {
      it("should return only wound cards", () => {
        const hand: CardId[] = [CARD_MARCH, CARD_WOUND, CARD_RAGE, CARD_WOUND];

        const eligible = getCardsEligibleForDiscardForBonus(hand, "wound_only");

        expect(eligible).toHaveLength(2);
        expect(eligible.every((id) => id === CARD_WOUND)).toBe(true);
      });

      it("should return empty array when no wounds in hand", () => {
        const hand: CardId[] = [CARD_MARCH, CARD_RAGE, CARD_SWIFTNESS];

        const eligible = getCardsEligibleForDiscardForBonus(hand, "wound_only");

        expect(eligible).toHaveLength(0);
      });

      it("should return empty array for empty hand", () => {
        const eligible = getCardsEligibleForDiscardForBonus([], "wound_only");

        expect(eligible).toHaveLength(0);
      });
    });

    describe("any_max_one_wound filter (powered effect)", () => {
      it("should return all cards including wounds", () => {
        const hand: CardId[] = [CARD_MARCH, CARD_WOUND, CARD_RAGE];

        const eligible = getCardsEligibleForDiscardForBonus(hand, "any_max_one_wound");

        expect(eligible).toHaveLength(3);
        expect(eligible).toContain(CARD_MARCH);
        expect(eligible).toContain(CARD_WOUND);
        expect(eligible).toContain(CARD_RAGE);
      });

      it("should return empty array for empty hand", () => {
        const eligible = getCardsEligibleForDiscardForBonus([], "any_max_one_wound");

        expect(eligible).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // EFFECT HANDLER TESTS
  // ============================================================================

  describe("handleDiscardForBonus", () => {
    it("should create pending state on player", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = handleDiscardForBonus(
        state,
        0,
        player,
        {
          type: EFFECT_DISCARD_FOR_BONUS,
          choiceOptions: BASIC_CHOICE_OPTIONS,
          bonusPerCard: 1,
          maxDiscards: 1,
          discardFilter: "wound_only",
        },
        CARD_STOUT_RESOLVE
      );

      expect(result.requiresChoice).toBe(true);
      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.pendingDiscardForBonus).not.toBeNull();
      expect(updatedPlayer.pendingDiscardForBonus!.sourceCardId).toBe(CARD_STOUT_RESOLVE);
      expect(updatedPlayer.pendingDiscardForBonus!.bonusPerCard).toBe(1);
      expect(updatedPlayer.pendingDiscardForBonus!.maxDiscards).toBe(1);
      expect(updatedPlayer.pendingDiscardForBonus!.discardFilter).toBe("wound_only");
      // Outside combat, Attack and Block are filtered out (only Move and Influence are resolvable)
      expect(updatedPlayer.pendingDiscardForBonus!.choiceOptions).toEqual([
        BASIC_CHOICE_OPTIONS[0],
        BASIC_CHOICE_OPTIONS[1],
      ]);
    });

    it("should include all four options when in combat", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      const state = createTestGameState({ players: [player], combat });

      const result = handleDiscardForBonus(
        state,
        0,
        player,
        {
          type: EFFECT_DISCARD_FOR_BONUS,
          choiceOptions: BASIC_CHOICE_OPTIONS,
          bonusPerCard: 1,
          maxDiscards: 1,
          discardFilter: "wound_only",
        },
        CARD_STOUT_RESOLVE
      );

      expect(result.requiresChoice).toBe(true);
      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.pendingDiscardForBonus!.choiceOptions).toEqual(BASIC_CHOICE_OPTIONS);
    });

    it("should throw when no sourceCardId provided", () => {
      const player = createTestPlayer();
      const state = createTestGameState({ players: [player] });

      expect(() =>
        handleDiscardForBonus(
          state,
          0,
          player,
          {
            type: EFFECT_DISCARD_FOR_BONUS,
            choiceOptions: BASIC_CHOICE_OPTIONS,
            bonusPerCard: 1,
            maxDiscards: 1,
            discardFilter: "wound_only",
          },
          null
        )
      ).toThrow("DiscardForBonusEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // COMMAND EXECUTION TESTS
  // ============================================================================

  describe("resolveDiscardForBonusCommand", () => {
    describe("basic effect (wound_only, max 1 discard, +1 bonus)", () => {
      it("should resolve with no discards (0 bonus)", () => {
        const state = createStateWithPending(createPendingBasic());

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [],
          choiceIndex: 0, // Move 2
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        // Should gain Move 2 (no bonus)
        expect(player.movePoints).toBe(2);
        expect(player.pendingDiscardForBonus).toBeNull();
      });

      it("should resolve discarding 1 wound for +1 to Move", () => {
        const state = createStateWithPending(createPendingBasic(), [CARD_MARCH, CARD_WOUND]);

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_WOUND],
          choiceIndex: 0, // Move 2 + 1 = 3
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        // Should gain Move 3 (2 + 1 bonus)
        expect(player.movePoints).toBe(3);
        // Wound should be moved from hand to discard
        expect(player.hand).not.toContain(CARD_WOUND);
        expect(player.discard).toContain(CARD_WOUND);
        expect(player.pendingDiscardForBonus).toBeNull();
      });

      it("should resolve discarding 1 wound for +1 to Influence", () => {
        const state = createStateWithPending(createPendingBasic(), [CARD_MARCH, CARD_WOUND]);

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_WOUND],
          choiceIndex: 1, // Influence 2 + 1 = 3
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        expect(player.influencePoints).toBe(3);
        expect(player.pendingDiscardForBonus).toBeNull();
      });

      it("should generate card discarded events", () => {
        const state = createStateWithPending(createPendingBasic(), [CARD_MARCH, CARD_WOUND]);

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_WOUND],
          choiceIndex: 0,
        });

        const result = cmd.execute(state);

        expect(result.events.length).toBeGreaterThan(0);
        expect(result.events.some((e) => e.type === "CARD_DISCARDED")).toBe(true);
      });
    });

    describe("powered effect (any_max_one_wound, unlimited discards, +2 bonus)", () => {
      it("should resolve with no discards (0 bonus)", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_RAGE, CARD_WOUND]
        );

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [],
          choiceIndex: 0, // Move 3
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        expect(player.movePoints).toBe(3);
        expect(player.pendingDiscardForBonus).toBeNull();
      });

      it("should resolve discarding 2 non-wound cards for +4 to Move", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_RAGE, CARD_SWIFTNESS, CARD_STAMINA]
        );

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_MARCH, CARD_RAGE],
          choiceIndex: 0, // Move 3 + 4 = 7
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        expect(player.movePoints).toBe(7);
        expect(player.hand).not.toContain(CARD_MARCH);
        expect(player.hand).not.toContain(CARD_RAGE);
        expect(player.discard).toContain(CARD_MARCH);
        expect(player.discard).toContain(CARD_RAGE);
        expect(player.pendingDiscardForBonus).toBeNull();
      });

      it("should resolve discarding 1 wound + 1 card for +4 to Influence", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_WOUND, CARD_RAGE]
        );

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_WOUND, CARD_MARCH],
          choiceIndex: 1, // Influence 3 + 4 = 7
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        expect(player.influencePoints).toBe(7);
        expect(player.hand).toEqual([CARD_RAGE]);
        expect(player.discard).toContain(CARD_WOUND);
        expect(player.discard).toContain(CARD_MARCH);
      });

      it("should resolve discarding 1 card for +2 to Block", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_RAGE]
        );

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_MARCH],
          choiceIndex: 3, // Block 3 + 2 = 5
        });

        const result = cmd.execute(state);
        const player = result.state.players[0]!;

        expect(player.combatAccumulator.block).toBe(5);
        expect(player.pendingDiscardForBonus).toBeNull();
      });
    });

    describe("undo", () => {
      it("should restore hand, discard, and pending state after undo", () => {
        const pending = createPendingBasic();
        const state = createStateWithPending(pending, [CARD_MARCH, CARD_WOUND]);

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_WOUND],
          choiceIndex: 0,
        });

        const executed = cmd.execute(state);
        const undone = cmd.undo(executed.state);
        const player = undone.state.players[0]!;

        // Hand should be restored
        expect(player.hand).toContain(CARD_WOUND);
        expect(player.hand).toContain(CARD_MARCH);
        // Discard should be restored
        expect(player.discard).not.toContain(CARD_WOUND);
        // Pending state should be restored
        expect(player.pendingDiscardForBonus).toEqual(pending);
        // Move points should be restored
        expect(player.movePoints).toBe(0);
      });

      it("should restore correctly after powered effect undo", () => {
        const pending = createPendingPowered();
        const state = createStateWithPending(
          pending,
          [CARD_MARCH, CARD_RAGE, CARD_WOUND]
        );

        const cmd = createResolveDiscardForBonusCommand({
          playerId: "player1",
          cardIds: [CARD_MARCH, CARD_WOUND],
          choiceIndex: 0, // Move 3 + 4 = 7
        });

        const executed = cmd.execute(state);
        const undone = cmd.undo(executed.state);
        const player = undone.state.players[0]!;

        expect(player.hand).toHaveLength(3);
        expect(player.hand).toContain(CARD_MARCH);
        expect(player.hand).toContain(CARD_RAGE);
        expect(player.hand).toContain(CARD_WOUND);
        expect(player.movePoints).toBe(0);
        expect(player.pendingDiscardForBonus).toEqual(pending);
      });
    });
  });

  // ============================================================================
  // VALID ACTIONS TESTS
  // ============================================================================

  describe("getDiscardForBonusOptions", () => {
    it("should return undefined when no pending state", () => {
      const state = createTestGameState();
      const player = state.players[0]!;

      const options = getDiscardForBonusOptions(state, player);

      expect(options).toBeUndefined();
    });

    it("should return options for basic effect with wound in hand", () => {
      const state = createStateWithPending(
        createPendingBasic(),
        [CARD_MARCH, CARD_WOUND, CARD_RAGE]
      );
      const player = state.players[0]!;

      const options = getDiscardForBonusOptions(state, player);

      expect(options).toBeDefined();
      expect(options!.sourceCardId).toBe(CARD_STOUT_RESOLVE);
      expect(options!.bonusPerCard).toBe(1);
      expect(options!.maxDiscards).toBe(1);
      expect(options!.discardFilter).toBe("wound_only");
      // Only wound is eligible
      expect(options!.availableCardIds).toHaveLength(1);
      expect(options!.availableCardIds[0]).toBe(CARD_WOUND);
      expect(options!.choiceCount).toBe(4);
    });

    it("should return options for powered effect with all cards eligible", () => {
      const state = createStateWithPending(
        createPendingPowered(),
        [CARD_MARCH, CARD_WOUND, CARD_RAGE]
      );
      const player = state.players[0]!;

      const options = getDiscardForBonusOptions(state, player);

      expect(options).toBeDefined();
      expect(options!.sourceCardId).toBe(CARD_STOUT_RESOLVE);
      expect(options!.bonusPerCard).toBe(2);
      expect(options!.maxDiscards).toBe(Infinity);
      expect(options!.discardFilter).toBe("any_max_one_wound");
      // All cards are eligible
      expect(options!.availableCardIds).toHaveLength(3);
      expect(options!.choiceCount).toBe(4);
    });

    it("should return empty available cards for basic effect with no wounds", () => {
      const state = createStateWithPending(
        createPendingBasic(),
        [CARD_MARCH, CARD_RAGE]
      );
      const player = state.players[0]!;

      const options = getDiscardForBonusOptions(state, player);

      expect(options).toBeDefined();
      expect(options!.availableCardIds).toHaveLength(0);
    });
  });

  // ============================================================================
  // VALIDATOR TESTS
  // ============================================================================

  describe("validators", () => {
    describe("validateHasPendingDiscardForBonus", () => {
      it("should reject when no pending state exists", () => {
        const state = createTestGameState();
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [],
          choiceIndex: 0,
        } as const;

        const result = validateHasPendingDiscardForBonus(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_REQUIRED);
        }
      });

      it("should accept when pending state exists", () => {
        const state = createStateWithPending(createPendingBasic());
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [],
          choiceIndex: 0,
        } as const;

        const result = validateHasPendingDiscardForBonus(state, "player1", action);

        expect(result.valid).toBe(true);
      });
    });

    describe("validateDiscardForBonusSelection", () => {
      it("should accept empty card selection (no discard)", () => {
        const state = createStateWithPending(createPendingBasic());
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should reject invalid choice index (negative)", () => {
        const state = createStateWithPending(createPendingBasic());
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [] as readonly CardId[],
          choiceIndex: -1,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_INVALID_CHOICE);
        }
      });

      it("should reject invalid choice index (too high)", () => {
        const state = createStateWithPending(createPendingBasic());
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [] as readonly CardId[],
          choiceIndex: 4, // Only 0-3 valid
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_INVALID_CHOICE);
        }
      });

      it("should reject non-wound card for wound_only filter", () => {
        const state = createStateWithPending(
          createPendingBasic(),
          [CARD_MARCH, CARD_WOUND]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_MARCH] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_CARD_NOT_ELIGIBLE);
        }
      });

      it("should accept wound card for wound_only filter", () => {
        const state = createStateWithPending(
          createPendingBasic(),
          [CARD_MARCH, CARD_WOUND]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_WOUND] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should reject too many discards for basic effect (max 1)", () => {
        // Create state with 2 wounds to try discarding both
        const pending = createPendingBasic();
        const state = createStateWithPending(
          pending,
          [CARD_MARCH, CARD_WOUND, CARD_WOUND]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_WOUND, CARD_WOUND] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_TOO_MANY_CARDS);
        }
      });

      it("should reject discarding 2 wounds for powered effect (max 1 wound)", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_WOUND, CARD_WOUND]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_WOUND, CARD_WOUND] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.code).toBe(DISCARD_FOR_BONUS_TOO_MANY_WOUNDS);
        }
      });

      it("should accept 1 wound + multiple non-wound cards for powered effect", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_SWIFTNESS]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_WOUND, CARD_MARCH, CARD_RAGE] as readonly CardId[],
          choiceIndex: 0,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should accept multiple non-wound cards without wound for powered effect", () => {
        const state = createStateWithPending(
          createPendingPowered(),
          [CARD_MARCH, CARD_RAGE, CARD_SWIFTNESS]
        );
        const action = {
          type: RESOLVE_DISCARD_FOR_BONUS_ACTION,
          cardIds: [CARD_MARCH, CARD_RAGE, CARD_SWIFTNESS] as readonly CardId[],
          choiceIndex: 1,
        } as const;

        const result = validateDiscardForBonusSelection(state, "player1", action);

        expect(result.valid).toBe(true);
      });
    });
  });
});
