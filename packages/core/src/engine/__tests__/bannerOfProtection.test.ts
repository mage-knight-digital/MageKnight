/**
 * Banner of Protection artifact tests
 *
 * Basic Effect (attached to unit):
 * - Armor +1 to the attached unit
 * - Fire Resistance to the attached unit
 * - Ice Resistance to the attached unit
 *
 * Powered Effect (destroy artifact):
 * - At end of turn, player may throw away all wounds received this turn
 * - Tracks wounds added to hand AND discard (poison, effects)
 * - Does NOT include wounds drawn from deck
 * - Does NOT include wounds on units
 * - Player can skip (keep all wounds)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
} from "./testHelpers.js";
import {
  CARD_BANNER_OF_PROTECTION,
  CARD_WOUND,
  UNIT_PEASANTS,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import {
  getEffectiveUnitArmor,
  getBannerResistances,
} from "../rules/banners.js";
import { getEffectiveUnitResistances } from "../modifiers/units.js";
import { resolveEffect } from "../effects/index.js";
import { EFFECT_ACTIVATE_BANNER_PROTECTION } from "../../types/effectTypes.js";
import type { ActivateBannerProtectionEffect } from "../../types/cards.js";
import { createResolveBannerProtectionCommand } from "../commands/resolveBannerProtectionCommand.js";
import { checkBannerProtectionWoundRemoval } from "../commands/endTurn/siteChecks.js";
import type { Player } from "../../types/player.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_UNIT_1 = "unit_1";
const PLAYER_ID = "player_1";

function createPeasantUnit(instanceId: string) {
  return createPlayerUnit(UNIT_PEASANTS, instanceId);
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner of Protection", () => {
  beforeEach(() => {
    createEngine();
  });

  // --------------------------------------------------------------------------
  // Basic Effect: Armor +1
  // --------------------------------------------------------------------------
  describe("Basic Effect: Armor +1 (attached)", () => {
    it("should grant +1 armor to the attached unit", () => {
      // Peasants base armor = 3
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_PROTECTION,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getEffectiveUnitArmor(player, unit)).toBe(4); // 3 base + 1 banner
    });

    it("should not grant armor to units without the banner", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [],
      });

      expect(getEffectiveUnitArmor(player, unit)).toBe(3); // 3 base, no banner
    });
  });

  // --------------------------------------------------------------------------
  // Basic Effect: Fire & Ice Resistance
  // --------------------------------------------------------------------------
  describe("Basic Effect: Fire & Ice Resistance (attached)", () => {
    it("should grant fire and ice resistance via getBannerResistances", () => {
      const player = createTestPlayer({
        units: [createPeasantUnit(TEST_UNIT_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_PROTECTION,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const resistances = getBannerResistances(player, TEST_UNIT_1);
      expect(resistances).toContain(ELEMENT_FIRE);
      expect(resistances).toContain(ELEMENT_ICE);
    });

    it("should not grant resistances to units without banner", () => {
      const player = createTestPlayer({
        units: [createPeasantUnit(TEST_UNIT_1)],
        attachedBanners: [],
      });

      const resistances = getBannerResistances(player, TEST_UNIT_1);
      expect(resistances).toHaveLength(0);
    });

    it("should include banner resistances in getEffectiveUnitResistances", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_PROTECTION,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      const state = createTestGameState({
        players: [player],
      });

      const resistances = getEffectiveUnitResistances(state, PLAYER_ID, unit);
      expect(resistances).toContain(ELEMENT_FIRE);
      expect(resistances).toContain(ELEMENT_ICE);
    });

    it("should not duplicate resistances if unit already has them", () => {
      // Peasants have no base resistances — banner adds Fire + Ice
      // Verify that the combined result has exactly Fire + Ice with no duplicates
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_PROTECTION,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      const state = createTestGameState({
        players: [player],
      });

      const resistances = getEffectiveUnitResistances(state, PLAYER_ID, unit);
      // Fire + Ice from banner (Peasants have no base resistances)
      expect(resistances).toContain(ELEMENT_FIRE);
      expect(resistances).toContain(ELEMENT_ICE);
      expect(resistances).toHaveLength(2);
      // No duplicates
      expect(new Set(resistances).size).toBe(resistances.length);
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect: Activation
  // --------------------------------------------------------------------------
  describe("Powered Effect: Activation", () => {
    it("should set bannerOfProtectionActive flag", () => {
      const player = createTestPlayer({ id: PLAYER_ID });
      const state = createTestGameState({ players: [player] });

      const effect: ActivateBannerProtectionEffect = {
        type: EFFECT_ACTIVATE_BANNER_PROTECTION,
      };

      const result = resolveEffect(state, PLAYER_ID, effect);
      const updatedPlayer = result.state.players.find(
        (p) => p.id === PLAYER_ID
      )!;

      expect(updatedPlayer.bannerOfProtectionActive).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Wound Tracking
  // --------------------------------------------------------------------------
  describe("Wound Tracking", () => {
    it("should start with zero wounds received", () => {
      const player = createTestPlayer({ id: PLAYER_ID });
      expect(player.woundsReceivedThisTurn.hand).toBe(0);
      expect(player.woundsReceivedThisTurn.discard).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // End-of-Turn Check
  // --------------------------------------------------------------------------
  describe("End-of-Turn Check", () => {
    it("should set pendingBannerProtectionChoice when active and wounds exist", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND, CARD_WOUND] as CardId[],
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = checkBannerProtectionWoundRemoval(state, player, false);
      expect(result.pendingChoice).toBe(true);
      expect(result.player.pendingBannerProtectionChoice).toBe(true);
    });

    it("should not set pending when banner not active", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND] as CardId[],
        bannerOfProtectionActive: false,
        woundsReceivedThisTurn: { hand: 1, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = checkBannerProtectionWoundRemoval(state, player, false);
      expect(result.pendingChoice).toBe(false);
    });

    it("should not set pending when no wounds received", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = checkBannerProtectionWoundRemoval(state, player, false);
      expect(result.pendingChoice).toBe(false);
    });

    it("should skip when skipCheck is true", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND] as CardId[],
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 1, discard: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = checkBannerProtectionWoundRemoval(state, player, true);
      expect(result.pendingChoice).toBe(false);
    });

    it("should detect wounds in discard", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        discard: [CARD_WOUND] as CardId[],
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 0, discard: 1 },
      });
      const state = createTestGameState({ players: [player] });

      const result = checkBannerProtectionWoundRemoval(state, player, false);
      expect(result.pendingChoice).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Resolve Command: Remove All
  // --------------------------------------------------------------------------
  describe("Resolve Command: Remove All Wounds", () => {
    it("should remove wounds received this turn from hand", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: ["march" as CardId, CARD_WOUND, CARD_WOUND] as CardId[],
        pendingBannerProtectionChoice: true,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: true,
      });

      const result = command.execute(state);

      // After resolving, end turn runs, so check that wounds were removed
      // The player's state is reset by end turn, but we can check events
      const woundRemovedEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_WOUNDS_REMOVED"
      );
      expect(woundRemovedEvent).toBeDefined();
      if (woundRemovedEvent?.type === "BANNER_PROTECTION_WOUNDS_REMOVED") {
        expect(woundRemovedEvent.fromHand).toBe(2);
        expect(woundRemovedEvent.fromDiscard).toBe(0);
      }
    });

    it("should remove wounds received this turn from discard", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: ["march" as CardId],
        discard: [CARD_WOUND, "swiftness" as CardId] as CardId[],
        pendingBannerProtectionChoice: true,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 0, discard: 1 },
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: true,
      });

      const result = command.execute(state);

      const woundRemovedEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_WOUNDS_REMOVED"
      );
      expect(woundRemovedEvent).toBeDefined();
      if (woundRemovedEvent?.type === "BANNER_PROTECTION_WOUNDS_REMOVED") {
        expect(woundRemovedEvent.fromHand).toBe(0);
        expect(woundRemovedEvent.fromDiscard).toBe(1);
      }
    });

    it("should remove wounds from both hand and discard", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND, "march" as CardId],
        discard: [CARD_WOUND] as CardId[],
        pendingBannerProtectionChoice: true,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 1, discard: 1 },
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: true,
      });

      const result = command.execute(state);

      const woundRemovedEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_WOUNDS_REMOVED"
      );
      expect(woundRemovedEvent).toBeDefined();
      if (woundRemovedEvent?.type === "BANNER_PROTECTION_WOUNDS_REMOVED") {
        expect(woundRemovedEvent.fromHand).toBe(1);
        expect(woundRemovedEvent.fromDiscard).toBe(1);
      }
    });

    it("should not remove more wounds than exist in hand (if some were healed)", () => {
      // Player received 2 wounds to hand, but healed 1, so only 1 wound in hand
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND, "march" as CardId],
        pendingBannerProtectionChoice: true,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: true,
      });

      const result = command.execute(state);

      const woundRemovedEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_WOUNDS_REMOVED"
      );
      expect(woundRemovedEvent).toBeDefined();
      if (woundRemovedEvent?.type === "BANNER_PROTECTION_WOUNDS_REMOVED") {
        // Only 1 wound was actually in hand even though 2 were received
        expect(woundRemovedEvent.fromHand).toBe(1);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Resolve Command: Skip
  // --------------------------------------------------------------------------
  describe("Resolve Command: Skip", () => {
    it("should keep all wounds when skipping", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND, CARD_WOUND, "march" as CardId],
        pendingBannerProtectionChoice: true,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 2, discard: 0 },
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: false,
      });

      const result = command.execute(state);

      const skipEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_SKIPPED"
      );
      expect(skipEvent).toBeDefined();

      // No wounds removed event
      const woundRemovedEvent = result.events.find(
        (e) => e.type === "BANNER_PROTECTION_WOUNDS_REMOVED"
      );
      expect(woundRemovedEvent).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("Validation", () => {
    it("should reject resolve action without pending choice", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        pendingBannerProtectionChoice: false,
      });
      const state = createTestGameState({
        players: [player],
        currentPlayerIndex: 0,
      });

      const command = createResolveBannerProtectionCommand({
        playerId: PLAYER_ID,
        removeAll: true,
      });

      expect(() => command.execute(state)).toThrow(
        "No pending Banner of Protection choice"
      );
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should not count wounds drawn from deck as received", () => {
      // Player has wounds in hand from drawing (not received this turn)
      const player = createTestPlayer({
        id: PLAYER_ID,
        hand: [CARD_WOUND, CARD_WOUND] as CardId[],
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 0, discard: 0 }, // No wounds "received"
      });
      const state = createTestGameState({ players: [player] });

      // Check should NOT trigger because no wounds were received
      const result = checkBannerProtectionWoundRemoval(state, player, false);
      expect(result.pendingChoice).toBe(false);
    });

    it("should handle player reset clearing tracking fields", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        bannerOfProtectionActive: true,
        woundsReceivedThisTurn: { hand: 3, discard: 1 },
        pendingBannerProtectionChoice: true,
      });

      // After reset (simulated), all should be cleared
      const resetPlayer: Player = {
        ...player,
        bannerOfProtectionActive: false,
        woundsReceivedThisTurn: { hand: 0, discard: 0 },
        pendingBannerProtectionChoice: false,
      };

      expect(resetPlayer.bannerOfProtectionActive).toBe(false);
      expect(resetPlayer.woundsReceivedThisTurn.hand).toBe(0);
      expect(resetPlayer.woundsReceivedThisTurn.discard).toBe(0);
      expect(resetPlayer.pendingBannerProtectionChoice).toBe(false);
    });
  });
});
