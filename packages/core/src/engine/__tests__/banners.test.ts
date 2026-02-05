/**
 * Banner Mechanics Tests
 *
 * Tests for:
 * - Assigning banners from hand to units
 * - Replacing existing banners (old goes to discard)
 * - Validation (card in hand, is banner, has units, target unit exists)
 * - Banner detachment on unit destruction
 * - End-of-round banner usage reset
 * - Valid actions (banners field in normal turn)
 * - Banner rules (isBannerArtifact, usage tracking)
 * - Undo support
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import {
  ASSIGN_BANNER_ACTION,
  BANNER_ASSIGNED,
  BANNER_DETACHED,
  BANNER_DETACH_REASON_REPLACED,
  BANNER_DETACH_REASON_UNIT_DESTROYED,
  BANNERS_RESET,
  INVALID_ACTION,
  CARD_BANNER_OF_GLORY,
  CARD_MARCH,
  UNIT_PEASANTS,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { createPlayerUnit } from "../../types/unit.js";
import { isBannerArtifact, getBannerForUnit, isBannerUsedThisRound, markBannerUsed } from "../rules/banners.js";
import { getCard } from "../helpers/cardLookup.js";
import { getBannerOptions } from "../validActions/banners.js";
import { processPlayerRoundReset } from "../commands/endRound/playerRoundReset.js";
import { detachBannerFromUnit } from "../commands/banners/bannerDetachment.js";
import { createRng } from "../../utils/rng.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_UNIT_ID_1 = "unit_1";
const TEST_UNIT_ID_2 = "unit_2";

function createTestUnit(instanceId: string) {
  return createPlayerUnit(UNIT_PEASANTS, instanceId);
}

function createStateWithBannerInHand(
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    hand: [CARD_BANNER_OF_GLORY, CARD_MARCH],
    units: [createTestUnit(TEST_UNIT_ID_1)],
    ...playerOverrides,
  });
  return createTestGameState({ players: [player] });
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner Mechanics", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // --------------------------------------------------------------------------
  // Assignment
  // --------------------------------------------------------------------------
  describe("Assign Banner", () => {
    it("should assign banner from hand to unit", () => {
      const state = createStateWithBannerInHand();

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      const player = result.state.players[0]!;

      // Banner removed from hand
      expect(player.hand).not.toContain(CARD_BANNER_OF_GLORY);
      expect(player.hand).toContain(CARD_MARCH);

      // Banner attached to unit
      expect(player.attachedBanners).toHaveLength(1);
      expect(player.attachedBanners[0]).toEqual({
        bannerId: CARD_BANNER_OF_GLORY,
        unitInstanceId: TEST_UNIT_ID_1,
        isUsedThisRound: false,
      });

      // Correct event emitted
      const bannerEvent = result.events.find((e) => e.type === BANNER_ASSIGNED);
      expect(bannerEvent).toEqual({
        type: BANNER_ASSIGNED,
        playerId: "player1",
        bannerCardId: CARD_BANNER_OF_GLORY,
        unitInstanceId: TEST_UNIT_ID_1,
      });
    });

    it("should replace existing banner on same unit (old goes to discard)", () => {
      // Start with a banner already attached
      const existingBannerId = "banner_of_fear" as CardId;
      const state = createStateWithBannerInHand({
        attachedBanners: [
          {
            bannerId: existingBannerId,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: false,
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      const player = result.state.players[0]!;

      // Old banner goes to discard
      expect(player.discard).toContain(existingBannerId);

      // New banner is attached
      expect(player.attachedBanners).toHaveLength(1);
      expect(player.attachedBanners[0]!.bannerId).toBe(CARD_BANNER_OF_GLORY);

      // Detach event emitted for old banner
      const detachEvent = result.events.find((e) => e.type === BANNER_DETACHED);
      expect(detachEvent).toEqual({
        type: BANNER_DETACHED,
        playerId: "player1",
        bannerCardId: existingBannerId,
        unitInstanceId: TEST_UNIT_ID_1,
        reason: BANNER_DETACH_REASON_REPLACED,
        destination: "discard",
      });
    });

    it("should support undo of banner assignment", () => {
      const state = createStateWithBannerInHand();

      // Assign banner
      const afterAssign = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      expect(afterAssign.state.players[0]!.attachedBanners).toHaveLength(1);

      // Undo
      const afterUndo = engine.processAction(afterAssign.state, "player1", {
        type: "UNDO" as const,
      });

      const player = afterUndo.state.players[0]!;
      expect(player.hand).toContain(CARD_BANNER_OF_GLORY);
      expect(player.attachedBanners).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("Validation", () => {
    it("should reject if banner not in hand", () => {
      const state = createStateWithBannerInHand({
        hand: [CARD_MARCH], // No banner in hand
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: INVALID_ACTION }),
        ])
      );
    });

    it("should reject if card is not a banner artifact", () => {
      const state = createStateWithBannerInHand({
        hand: [CARD_MARCH],
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_MARCH,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: INVALID_ACTION }),
        ])
      );
    });

    it("should reject if player has no units", () => {
      const state = createStateWithBannerInHand({
        units: [],
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: TEST_UNIT_ID_1,
      });

      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: INVALID_ACTION }),
        ])
      );
    });

    it("should reject if target unit does not exist", () => {
      const state = createStateWithBannerInHand();

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_BANNER_ACTION,
        bannerCardId: CARD_BANNER_OF_GLORY,
        targetUnitInstanceId: "nonexistent_unit",
      });

      expect(result.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: INVALID_ACTION }),
        ])
      );
    });
  });

  // --------------------------------------------------------------------------
  // Valid Actions
  // --------------------------------------------------------------------------
  describe("Valid Actions", () => {
    it("should include banner options when player has banner in hand and units", () => {
      const state = createStateWithBannerInHand();
      const player = state.players[0]!;

      const options = getBannerOptions(state, player);

      expect(options).toBeDefined();
      expect(options!.assignable).toHaveLength(1);
      expect(options!.assignable[0]!.bannerCardId).toBe(CARD_BANNER_OF_GLORY);
      expect(options!.assignable[0]!.targetUnits).toContain(TEST_UNIT_ID_1);
    });

    it("should return undefined when no banners in hand", () => {
      const state = createStateWithBannerInHand({
        hand: [CARD_MARCH],
      });
      const player = state.players[0]!;

      expect(getBannerOptions(state, player)).toBeUndefined();
    });

    it("should return undefined when player has no units", () => {
      const state = createStateWithBannerInHand({
        units: [],
      });
      const player = state.players[0]!;

      expect(getBannerOptions(state, player)).toBeUndefined();
    });

    it("should include all units as targets", () => {
      const state = createStateWithBannerInHand({
        units: [createTestUnit(TEST_UNIT_ID_1), createTestUnit(TEST_UNIT_ID_2)],
      });
      const player = state.players[0]!;

      const options = getBannerOptions(state, player);
      expect(options!.assignable[0]!.targetUnits).toEqual([
        TEST_UNIT_ID_1,
        TEST_UNIT_ID_2,
      ]);
    });
  });

  // --------------------------------------------------------------------------
  // Banner Rules
  // --------------------------------------------------------------------------
  describe("Banner Rules", () => {
    it("should identify banner artifacts", () => {
      const card = getCard(CARD_BANNER_OF_GLORY);
      expect(card).not.toBeNull();
      expect(isBannerArtifact(card!)).toBe(true);
    });

    it("should not identify non-banner cards as banners", () => {
      const card = getCard(CARD_MARCH);
      expect(card).not.toBeNull();
      expect(isBannerArtifact(card!)).toBe(false);
    });

    it("should find banner for a unit", () => {
      const player = createTestPlayer({
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getBannerForUnit(player, TEST_UNIT_ID_1)).toEqual({
        bannerId: CARD_BANNER_OF_GLORY,
        unitInstanceId: TEST_UNIT_ID_1,
        isUsedThisRound: false,
      });
      expect(getBannerForUnit(player, TEST_UNIT_ID_2)).toBeUndefined();
    });

    it("should track per-banner usage", () => {
      const player = createTestPlayer({
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(isBannerUsedThisRound(player, CARD_BANNER_OF_GLORY)).toBe(false);

      const updated = markBannerUsed(
        player.attachedBanners,
        CARD_BANNER_OF_GLORY
      );
      const updatedPlayer = { ...player, attachedBanners: updated };

      expect(isBannerUsedThisRound(updatedPlayer, CARD_BANNER_OF_GLORY)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // End of Round
  // --------------------------------------------------------------------------
  describe("End of Round", () => {
    it("should reset banner usage at end of round", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [createTestUnit(TEST_UNIT_ID_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: true,
          },
        ],
      });

      const state = createTestGameState({ players: [player] });
      const rng = createRng(42);
      const result = processPlayerRoundReset(state, rng);

      const updatedPlayer = result.players[0]!;
      expect(updatedPlayer.attachedBanners).toHaveLength(1);
      expect(updatedPlayer.attachedBanners[0]!.isUsedThisRound).toBe(false);
    });

    it("should emit BANNERS_RESET event when player has banners", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [createTestUnit(TEST_UNIT_ID_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: true,
          },
        ],
      });

      const state = createTestGameState({ players: [player] });
      const rng = createRng(42);
      const result = processPlayerRoundReset(state, rng);

      const resetEvent = result.events.find((e) => e.type === BANNERS_RESET);
      expect(resetEvent).toEqual({
        type: BANNERS_RESET,
        playerId: "player1",
        bannerCount: 1,
      });
    });

    it("should not emit BANNERS_RESET when player has no banners", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });

      const state = createTestGameState({ players: [player] });
      const rng = createRng(42);
      const result = processPlayerRoundReset(state, rng);

      const resetEvent = result.events.find((e) => e.type === BANNERS_RESET);
      expect(resetEvent).toBeUndefined();
    });

    it("should keep banners attached after round reset", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        units: [createTestUnit(TEST_UNIT_ID_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: true,
          },
        ],
      });

      const state = createTestGameState({ players: [player] });
      const rng = createRng(42);
      const result = processPlayerRoundReset(state, rng);

      const updatedPlayer = result.players[0]!;
      expect(updatedPlayer.attachedBanners).toHaveLength(1);
      expect(updatedPlayer.attachedBanners[0]!.bannerId).toBe(
        CARD_BANNER_OF_GLORY
      );
      expect(updatedPlayer.attachedBanners[0]!.unitInstanceId).toBe(
        TEST_UNIT_ID_1
      );
    });
  });

  // --------------------------------------------------------------------------
  // Banner Detachment Helpers
  // --------------------------------------------------------------------------
  describe("Banner Detachment", () => {
    it("detachBannerFromUnit should handle unit with no banner", () => {
      const player = createTestPlayer({
        units: [createTestUnit(TEST_UNIT_ID_1)],
        attachedBanners: [],
      });

      const result = detachBannerFromUnit(
        player,
        TEST_UNIT_ID_1,
        BANNER_DETACH_REASON_UNIT_DESTROYED
      );

      expect(result.events).toHaveLength(0);
      expect(result.updatedAttachedBanners).toHaveLength(0);
      expect(result.updatedDiscard).toEqual(player.discard);
    });

    it("detachBannerFromUnit should move banner to discard on unit destruction", () => {
      const player = createTestPlayer({
        units: [createTestUnit(TEST_UNIT_ID_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_ID_1,
            isUsedThisRound: false,
          },
        ],
        discard: [],
      });

      const result = detachBannerFromUnit(
        player,
        TEST_UNIT_ID_1,
        BANNER_DETACH_REASON_UNIT_DESTROYED
      );

      expect(result.updatedAttachedBanners).toHaveLength(0);
      expect(result.updatedDiscard).toContain(CARD_BANNER_OF_GLORY);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        type: BANNER_DETACHED,
        playerId: "player1",
        bannerCardId: CARD_BANNER_OF_GLORY,
        unitInstanceId: TEST_UNIT_ID_1,
        reason: BANNER_DETACH_REASON_UNIT_DESTROYED,
        destination: "discard",
      });
    });
  });
});
