/**
 * Banner of Glory artifact tests
 *
 * Basic Effect (attached to unit):
 * - Armor +1 to the attached unit
 * - +1 tack-on to attacks and blocks (requires base ability)
 * - Fame +1 when attached unit attacks or blocks
 *
 * Powered Effect (destroy artifact):
 * - All units get Armor +1 this turn
 * - All units get +1 to attacks and blocks (tack-on)
 * - Fame +1 for each unit that attacks or blocks this turn
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  CARD_BANNER_OF_GLORY,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  ACTIVATE_UNIT_ACTION,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import {
  getEffectiveUnitArmor,
  getBannerAttackTackOn,
  getBannerBlockTackOn,
  shouldBannerGrantFame,
  unitHasBaseAttack,
  unitHasBaseBlock,
} from "../rules/banners.js";
import { computeAvailableUnitTargets } from "../validActions/combatDamage.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_UNIT_ARMOR_BONUS,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_UNIT_BLOCK_BONUS,
  EFFECT_BANNER_GLORY_FAME_TRACKING,
  SCOPE_ALL_UNITS,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { getUnitArmorBonus, getUnitBlockBonus, getUnitAttackBonus } from "../modifiers/index.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_UNIT_1 = "unit_1";
const TEST_UNIT_2 = "unit_2";

function createPeasantUnit(instanceId: string) {
  return createPlayerUnit(UNIT_PEASANTS, instanceId);
}

function createForestersUnit(instanceId: string) {
  return createPlayerUnit(UNIT_FORESTERS, instanceId);
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner of Glory", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
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
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getEffectiveUnitArmor(player, unit)).toBe(4); // 3 base + 1 banner
    });

    it("should not affect units without the banner attached", () => {
      const unit1 = createPeasantUnit(TEST_UNIT_1);
      const unit2 = createPeasantUnit(TEST_UNIT_2);
      const player = createTestPlayer({
        units: [unit1, unit2],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getEffectiveUnitArmor(player, unit1)).toBe(4); // Banner attached
      expect(getEffectiveUnitArmor(player, unit2)).toBe(3); // No banner
    });

    it("should show correct armor in damage assignment valid actions", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const targets = computeAvailableUnitTargets(
        player,
        ELEMENT_PHYSICAL,
        true, // unitsAllowed
      );

      expect(targets).toHaveLength(1);
      expect(targets[0]!.armor).toBe(4); // 3 base + 1 banner
    });
  });

  // --------------------------------------------------------------------------
  // Basic Effect: Attack/Block Tack-On
  // --------------------------------------------------------------------------
  describe("Basic Effect: Attack/Block Tack-On (attached)", () => {
    it("should detect base attack ability on Peasants", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      expect(unitHasBaseAttack(unit)).toBe(true);
    });

    it("should detect base block ability on Peasants", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      expect(unitHasBaseBlock(unit)).toBe(true);
    });

    it("should detect base block but no base attack on Foresters", () => {
      const unit = createForestersUnit(TEST_UNIT_1);
      expect(unitHasBaseAttack(unit)).toBe(false);
      expect(unitHasBaseBlock(unit)).toBe(true);
    });

    it("should give +1 attack tack-on when banner is attached to unit with base attack", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getBannerAttackTackOn(player, unit)).toBe(1);
    });

    it("should give +1 block tack-on when banner is attached to unit with base block", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getBannerBlockTackOn(player, unit)).toBe(1);
    });

    it("should not give attack tack-on when unit has no base attack (Foresters)", () => {
      const unit = createForestersUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getBannerAttackTackOn(player, unit)).toBe(0);
    });

    it("should give block tack-on to Foresters (has base block)", () => {
      const unit = createForestersUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(getBannerBlockTackOn(player, unit)).toBe(1);
    });

    it("should return 0 for tack-on when no banner attached", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({ units: [unit] });

      expect(getBannerAttackTackOn(player, unit)).toBe(0);
      expect(getBannerBlockTackOn(player, unit)).toBe(0);
    });

    it("should apply +1 attack tack-on when activating unit ability in combat", () => {
      // Peasants: Attack 2 (ability index 0)
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      // Peasants Attack 2 + 1 banner tack-on = 3
      expect(result.state.players[0]!.combatAccumulator.attack.normal).toBe(3);
    });

    it("should apply +1 block tack-on when activating unit block ability in combat", () => {
      // Peasants: Block 2 (ability index 1)
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 1, // Block 2
      });

      // Peasants Block 2 + 1 banner tack-on = 3
      expect(result.state.players[0]!.combatAccumulator.block).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Basic Effect: Fame +1 on Attack/Block
  // --------------------------------------------------------------------------
  describe("Basic Effect: Fame +1 on Attack/Block (attached)", () => {
    it("should detect when banner should grant fame", () => {
      const player = createTestPlayer({
        units: [createPeasantUnit(TEST_UNIT_1)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      expect(shouldBannerGrantFame(player, TEST_UNIT_1)).toBe(true);
      expect(shouldBannerGrantFame(player, TEST_UNIT_2)).toBe(false);
    });

    it("should grant +1 fame when attached unit attacks", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should grant +1 fame when attached unit blocks", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 1, // Block 2
      });

      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should not grant fame when activating unit without banner", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      expect(result.state.players[0]!.fame).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect: Armor +1 to All Units (via modifier)
  // --------------------------------------------------------------------------
  describe("Powered Effect: Armor +1 to All Units", () => {
    it("should return armor bonus from active modifier", () => {
      const state = createTestGameState({
        activeModifiers: [
          {
            id: "mod_test_armor",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_ARMOR_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      expect(getUnitArmorBonus(state, "player1")).toBe(1);
    });

    it("should show combined armor (banner attached + powered modifier) in valid actions", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      const state = createTestGameState({
        players: [player],
        activeModifiers: [
          {
            id: "mod_test_armor",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_ARMOR_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const targets = computeAvailableUnitTargets(
        player,
        ELEMENT_PHYSICAL,
        true,
        undefined,
        state,
        "player1"
      );

      // Peasants 3 base + 1 banner attached + 1 powered modifier = 5
      expect(targets[0]!.armor).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect: Attack/Block Bonus to All Units (via modifier)
  // --------------------------------------------------------------------------
  describe("Powered Effect: Attack/Block Bonus to All Units", () => {
    it("should return attack bonus from active modifier", () => {
      const state = createTestGameState({
        activeModifiers: [
          {
            id: "mod_test_attack",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_ATTACK_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      expect(getUnitAttackBonus(state, "player1")).toBe(1);
    });

    it("should return block bonus from active modifier", () => {
      const state = createTestGameState({
        activeModifiers: [
          {
            id: "mod_test_block",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_BLOCK_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      expect(getUnitBlockBonus(state, "player1")).toBe(1);
    });

    it("should apply powered attack bonus when activating unit attack", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_test_attack",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_ATTACK_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      // Peasants Attack 2 + 1 powered bonus = 3
      expect(result.state.players[0]!.combatAccumulator.attack.normal).toBe(3);
    });

    it("should apply powered block bonus when activating unit block", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
        activeModifiers: [
          {
            id: "mod_test_block",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_BLOCK_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 1, // Block 2
      });

      // Peasants Block 2 + 1 powered bonus = 3
      expect(result.state.players[0]!.combatAccumulator.block).toBe(3);
    });

    it("should stack attached banner and powered bonus", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_test_attack",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_ALL_UNITS },
            effect: { type: EFFECT_UNIT_ATTACK_BONUS, amount: 1 },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      // Peasants Attack 2 + 1 banner tack-on + 1 powered bonus = 4
      expect(result.state.players[0]!.combatAccumulator.attack.normal).toBe(4);
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect: Fame Tracking
  // --------------------------------------------------------------------------
  describe("Powered Effect: Fame Tracking (modifier)", () => {
    it("should grant +1 fame when unit attacks with fame tracking active", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should grant +1 fame when unit blocks with fame tracking active", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 1, // Block 2
      });

      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should not grant fame twice for the same unit", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
      });

      // Unit already tracked as awarded
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: {
              type: EFFECT_BANNER_GLORY_FAME_TRACKING,
              unitInstanceIdsAwarded: [TEST_UNIT_1],
            },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0, // Attack 2
      });

      // No fame because unit was already tracked
      expect(result.state.players[0]!.fame).toBe(0);
    });

    it("should track unit instance IDs in the modifier after granting fame", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0,
      });

      // Find the fame tracking modifier
      const fameModifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_BANNER_GLORY_FAME_TRACKING
      );
      expect(fameModifier).toBeDefined();
      expect(
        (fameModifier!.effect as { unitInstanceIdsAwarded: string[] }).unitInstanceIdsAwarded
      ).toContain(TEST_UNIT_1);
    });

    it("should stack banner attached fame and powered fame tracking", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 0,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0,
      });

      // +1 from attached banner + 1 from powered tracking = 2
      expect(result.state.players[0]!.fame).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Undo
  // --------------------------------------------------------------------------
  describe("Undo", () => {
    it("should undo fame gained from banner attached on unit activation", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 5,
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_GLORY,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0,
      });

      expect(afterActivate.state.players[0]!.fame).toBe(6); // +1 fame

      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO" as const,
      });

      expect(afterUndo.state.players[0]!.fame).toBe(5); // Restored
    });

    it("should undo fame and modifier changes from powered tracking", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        fame: 5,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        activeModifiers: [
          {
            id: "mod_fame_track",
            source: { type: SOURCE_CARD, cardId: CARD_BANNER_OF_GLORY, playerId: "player1" },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: { type: EFFECT_BANNER_GLORY_FAME_TRACKING, unitInstanceIdsAwarded: [] },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      });

      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: TEST_UNIT_1,
        abilityIndex: 0,
      });

      expect(afterActivate.state.players[0]!.fame).toBe(6);

      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO" as const,
      });

      expect(afterUndo.state.players[0]!.fame).toBe(5);
      // Modifier should be restored to original (empty tracking)
      const fameModifier = afterUndo.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_BANNER_GLORY_FAME_TRACKING
      );
      expect(fameModifier).toBeDefined();
      expect(
        (fameModifier!.effect as { unitInstanceIdsAwarded: string[] }).unitInstanceIdsAwarded
      ).toHaveLength(0);
    });
  });
});
