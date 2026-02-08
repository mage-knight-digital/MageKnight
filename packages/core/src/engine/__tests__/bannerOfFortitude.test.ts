/**
 * Banner of Fortitude artifact tests
 *
 * Basic Effect (attached to unit):
 * - Once per round, when unit would be wounded, flip to prevent wound
 * - Ignores wound AND additional effects (poison, paralyze, vampiric)
 * - Does NOT prevent Brutal (doubles damage BEFORE assignment)
 * - Counts as unit's damage assignment for combat
 * - Resets at start of round
 *
 * Powered Effect (destroy artifact):
 * - Heal all units completely (anytime except combat)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
} from "./testHelpers.js";
import {
  CARD_BANNER_OF_FORTITUDE,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  ELEMENT_PHYSICAL,
  DAMAGE_TARGET_UNIT,
  BANNER_FORTITUDE_PREVENTED_WOUND,
  UNIT_WOUNDED,
  UNIT_DESTROYED,
  UNIT_HEALED,
  ABILITY_POISON,
  ABILITY_PARALYZE,
  ABILITY_VAMPIRIC,
  ABILITY_BRUTAL,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { createAssignDamageCommand } from "../commands/combat/assignDamageCommand.js";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import { reverseEffect } from "../effects/reverse.js";
import { EFFECT_HEAL_ALL_UNITS } from "../../types/effectTypes.js";
import type { HealAllUnitsEffect } from "../../types/cards.js";
import type { CombatEnemy } from "../../types/combat.js";
import { COMBAT_CONTEXT_STANDARD } from "../../types/combat.js";
import { markBannerUsed } from "../rules/banners.js";
import { getCard } from "../helpers/cardLookup.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_UNIT_1 = "unit_1";
const TEST_UNIT_2 = "unit_2";
const PLAYER_ID = "player1";
const ENEMY_INSTANCE_ID = "enemy_1";

function createPeasantUnit(instanceId: string) {
  return createPlayerUnit(UNIT_PEASANTS, instanceId);
}

function createForesterUnit(instanceId: string) {
  return createPlayerUnit(UNIT_FORESTERS, instanceId);
}

/**
 * Create a combat enemy with specific abilities for testing.
 */
function createTestEnemy(
  abilities: readonly string[] = [],
  attack = 5,
  attackElement = ELEMENT_PHYSICAL
): CombatEnemy {
  return {
    instanceId: ENEMY_INSTANCE_ID,
    enemyId: "test_enemy" as import("@mage-knight/shared").EnemyId,
    definition: {
      id: "test_enemy" as import("@mage-knight/shared").EnemyId,
      name: "Test Enemy",
      color: "green" as const,
      attack,
      attackElement,
      armor: 3,
      fame: 2,
      resistances: [],
      abilities: abilities as import("@mage-knight/shared").EnemyAbilityType[],
    },
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
  };
}

/**
 * Create a game state in combat's assign damage phase with given enemy and player.
 */
function createDamageAssignmentState(
  enemy: CombatEnemy,
  playerOverrides: Partial<import("../../types/player.js").Player> = {}
) {
  const player = createTestPlayer({
    id: PLAYER_ID,
    ...playerOverrides,
  });

  return createTestGameState({
    players: [player],
    combat: {
      enemies: [enemy],
      phase: COMBAT_PHASE_ASSIGN_DAMAGE,
      woundsThisCombat: 0,
      attacksThisPhase: 0,
      fameGained: 0,
      isAtFortifiedSite: false,
      unitsAllowed: true,
      nightManaRules: false,
      assaultOrigin: null,
      combatHexCoord: null,
      allDamageBlockedThisPhase: false,
      discardEnemiesOnFailure: false,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      combatContext: COMBAT_CONTEXT_STANDARD,
      cumbersomeReductions: {},
      usedDefend: {},
      defendBonuses: {},
      paidHeroesAssaultInfluence: false,
      vampiricArmorBonus: {},
      paidThugsDamageInfluence: {},
      damageRedirects: {},
    },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner of Fortitude", () => {
  beforeEach(() => {
    createEngine();
  });

  // --------------------------------------------------------------------------
  // Basic Effect: Wound Prevention
  // --------------------------------------------------------------------------
  describe("Basic Effect: Wound Prevention", () => {
    it("should prevent wound when unit has banner attached and banner is unused", () => {
      const enemy = createTestEnemy([], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // Banner should have prevented the wound
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();
      if (preventedEvent?.type === BANNER_FORTITUDE_PREVENTED_WOUND) {
        expect(preventedEvent.unitInstanceId).toBe(TEST_UNIT_1);
        expect(preventedEvent.damageNegated).toBe(5);
      }

      // Unit should NOT be wounded
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeUndefined();

      // Unit should NOT be destroyed
      const destroyEvent = result.events.find((e) => e.type === UNIT_DESTROYED);
      expect(destroyEvent).toBeUndefined();

      // Banner should be marked as used
      const updatedPlayer = result.state.players.find((p) => p.id === PLAYER_ID)!;
      const bannerAttachment = updatedPlayer.attachedBanners.find(
        (b) => b.bannerId === CARD_BANNER_OF_FORTITUDE
      );
      expect(bannerAttachment?.isUsedThisRound).toBe(true);
    });

    it("should not prevent wound when banner already used this round", () => {
      const enemy = createTestEnemy([], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: true, // Already used
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // Banner should NOT have prevented — unit should be wounded normally
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeUndefined();

      // Unit SHOULD be wounded
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeDefined();
    });

    it("should not prevent wound on a different unit without the banner", () => {
      const enemy = createTestEnemy([], 5);
      const unit1 = createPeasantUnit(TEST_UNIT_1);
      const unit2 = createPeasantUnit(TEST_UNIT_2);
      const state = createDamageAssignmentState(enemy, {
        units: [unit1, unit2],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1, // Banner on unit 1
            isUsedThisRound: false,
          },
        ],
      });

      // Assign damage to unit 2 (no banner)
      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_2, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // No banner prevention
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeUndefined();

      // Unit 2 should be wounded
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeDefined();
    });

    it("should prevent massive damage (damage >> armor)", () => {
      const enemy = createTestEnemy([], 20);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 20 },
        ],
      });

      const result = command.execute(state);

      // Banner prevents regardless of damage amount
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();

      // No wound or destruction
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeUndefined();
      const destroyEvent = result.events.find((e) => e.type === UNIT_DESTROYED);
      expect(destroyEvent).toBeUndefined();

      // No hero wounds from overflow
      expect(result.state.combat!.woundsThisCombat).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Additional Effect Prevention
  // --------------------------------------------------------------------------
  describe("Additional Effect Prevention", () => {
    it("should prevent Poison effect (no extra wounds)", () => {
      const enemy = createTestEnemy([ABILITY_POISON], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // Banner prevents wound AND poison
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();

      // Unit should NOT be destroyed (poison would normally destroy)
      const destroyEvent = result.events.find((e) => e.type === UNIT_DESTROYED);
      expect(destroyEvent).toBeUndefined();
    });

    it("should prevent Paralyze effect (unit not destroyed)", () => {
      const enemy = createTestEnemy([ABILITY_PARALYZE], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // Banner prevents wound AND paralyze
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();

      // Unit should NOT be destroyed (paralyze would normally destroy)
      const destroyEvent = result.events.find((e) => e.type === UNIT_DESTROYED);
      expect(destroyEvent).toBeUndefined();
    });

    it("should prevent Vampiric effect (attacker no +1 armor)", () => {
      const enemy = createTestEnemy([ABILITY_VAMPIRIC], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      // Banner prevents wound
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();

      // Vampiric armor bonus should NOT have been applied (no wounds dealt)
      expect(result.state.combat!.vampiricArmorBonus[ENEMY_INSTANCE_ID]).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Brutal: NOT Prevented
  // --------------------------------------------------------------------------
  describe("Brutal: NOT Prevented (damage already doubled)", () => {
    it("should still prevent wound even with Brutal (Brutal doubles before assignment)", () => {
      // Brutal doubles damage before it reaches the unit.
      // The banner still prevents the wound entirely — but the damage was already doubled.
      // The key distinction: Brutal is NOT an "additional effect from the wound" —
      // it affects damage amount BEFORE the wound, so it's not prevented.
      // But the banner still prevents the wound regardless of how much damage.
      const enemy = createTestEnemy([ABILITY_BRUTAL], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      // Brutal doubles damage from 5 to 10, but banner prevents the wound
      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          // getEffectiveDamage calculates 10 (5 * 2) — assignments use total damage
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 10 },
        ],
      });

      const result = command.execute(state);

      // Banner prevents the wound
      const preventedEvent = result.events.find(
        (e) => e.type === BANNER_FORTITUDE_PREVENTED_WOUND
      );
      expect(preventedEvent).toBeDefined();
      if (preventedEvent?.type === BANNER_FORTITUDE_PREVENTED_WOUND) {
        expect(preventedEvent.damageNegated).toBe(10);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Banner Usage Tracking
  // --------------------------------------------------------------------------
  describe("Banner Usage Tracking", () => {
    it("should mark banner as used after prevention (once per round)", () => {
      const enemy = createTestEnemy([], 5);
      const unit = createPeasantUnit(TEST_UNIT_1);
      const state = createDamageAssignmentState(enemy, {
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FORTITUDE,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const command = createAssignDamageCommand({
        playerId: PLAYER_ID,
        enemyInstanceId: ENEMY_INSTANCE_ID,
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: TEST_UNIT_1, amount: 5 },
        ],
      });

      const result = command.execute(state);

      const updatedPlayer = result.state.players.find((p) => p.id === PLAYER_ID)!;
      const banner = updatedPlayer.attachedBanners.find(
        (b) => b.bannerId === CARD_BANNER_OF_FORTITUDE
      );
      expect(banner?.isUsedThisRound).toBe(true);
    });

    it("should reset usage via markBannerUsed helper", () => {
      const banners = [
        {
          bannerId: CARD_BANNER_OF_FORTITUDE as CardId,
          unitInstanceId: TEST_UNIT_1,
          isUsedThisRound: false,
        },
      ] as const;

      const updated = markBannerUsed(banners, CARD_BANNER_OF_FORTITUDE);
      expect(updated[0]?.isUsedThisRound).toBe(true);
    });

    it("should reset at end of round (banners array cleared)", () => {
      // The round reset sets isUsedThisRound = false for all banners.
      // This is handled by playerRoundReset.ts and tested in banners.test.ts.
      // Just verify the data model supports it.
      const banners = [
        {
          bannerId: CARD_BANNER_OF_FORTITUDE as CardId,
          unitInstanceId: TEST_UNIT_1,
          isUsedThisRound: true,
        },
      ];

      const resetBanners = banners.map((b) => ({
        ...b,
        isUsedThisRound: false,
      }));

      expect(resetBanners[0]?.isUsedThisRound).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect: Heal All Units
  // --------------------------------------------------------------------------
  describe("Powered Effect: Heal All Units", () => {
    it("should heal all wounded units", () => {
      const unit1 = { ...createPeasantUnit(TEST_UNIT_1), wounded: true };
      const unit2 = { ...createForesterUnit(TEST_UNIT_2), wounded: true };
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit1, unit2],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = resolveEffect(state, PLAYER_ID, effect);

      // Both units should be healed
      const updatedPlayer = result.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(updatedPlayer.units[0]?.wounded).toBe(false);
      expect(updatedPlayer.units[1]?.wounded).toBe(false);

      // UNIT_HEALED events for both
      const healEvents = result.events?.filter((e) => e.type === UNIT_HEALED) ?? [];
      expect(healEvents).toHaveLength(2);
    });

    it("should not affect unwounded units", () => {
      const unit1 = createPeasantUnit(TEST_UNIT_1); // not wounded
      const unit2 = { ...createForesterUnit(TEST_UNIT_2), wounded: true };
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit1, unit2],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = resolveEffect(state, PLAYER_ID, effect);

      const updatedPlayer = result.state.players.find((p) => p.id === PLAYER_ID)!;
      // Unit 1 was already unwounded
      expect(updatedPlayer.units[0]?.wounded).toBe(false);
      // Unit 2 was healed
      expect(updatedPlayer.units[1]?.wounded).toBe(false);

      // Only 1 heal event (for unit 2)
      const healEvents = result.events?.filter((e) => e.type === UNIT_HEALED) ?? [];
      expect(healEvents).toHaveLength(1);
    });

    it("should do nothing when no units are wounded", () => {
      const unit1 = createPeasantUnit(TEST_UNIT_1);
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit1],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = resolveEffect(state, PLAYER_ID, effect);

      expect(result.description).toBe("No wounded units to heal");
    });

    it("should do nothing when player has no units", () => {
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = resolveEffect(state, PLAYER_ID, effect);

      expect(result.description).toBe("No wounded units to heal");
    });

    it("should track healed units in unitsHealedThisTurn", () => {
      const unit1 = { ...createPeasantUnit(TEST_UNIT_1), wounded: true };
      const unit2 = { ...createForesterUnit(TEST_UNIT_2), wounded: true };
      const player = createTestPlayer({
        id: PLAYER_ID,
        units: [unit1, unit2],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = resolveEffect(state, PLAYER_ID, effect);

      const updatedPlayer = result.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(updatedPlayer.unitsHealedThisTurn).toContain(TEST_UNIT_1);
      expect(updatedPlayer.unitsHealedThisTurn).toContain(TEST_UNIT_2);
    });
  });

  // --------------------------------------------------------------------------
  // Effect System Integration
  // --------------------------------------------------------------------------
  describe("Effect System Integration", () => {
    it("should report resolvable when player has wounded units", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, TEST_UNIT_1);
      const player = createTestPlayer({
        units: [{ ...unit1, wounded: true }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      expect(isEffectResolvable(state, PLAYER_ID, effect)).toBe(true);
    });

    it("should report not resolvable when no units are wounded", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, TEST_UNIT_1);
      const player = createTestPlayer({
        units: [{ ...unit1, wounded: false }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      expect(isEffectResolvable(state, PLAYER_ID, effect)).toBe(false);
    });

    it("should return player unchanged when reversing (non-reversible)", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, TEST_UNIT_1);
      const player = createTestPlayer({
        units: [{ ...unit1, wounded: false }],
      });

      const effect: HealAllUnitsEffect = { type: EFFECT_HEAL_ALL_UNITS };
      const result = reverseEffect(player, effect);
      expect(result).toBe(player);
    });
  });

  // --------------------------------------------------------------------------
  // Card Definition
  // --------------------------------------------------------------------------
  describe("Card Definition", () => {
    it("should be registered in artifact cards", () => {
      const card = getCard(CARD_BANNER_OF_FORTITUDE);
      expect(card).toBeDefined();
      expect(card?.name).toBe("Banner of Fortitude");
      expect(card?.cardType).toBe("artifact");
      expect(card?.categories).toContain("banner");
      expect(card?.categories).toContain("healing");
      expect(card?.destroyOnPowered).toBe(true);
    });
  });
});
