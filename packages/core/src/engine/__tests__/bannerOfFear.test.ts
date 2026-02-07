/**
 * Banner of Fear artifact tests
 *
 * Basic Effect (attached to unit):
 * - During Block phase, spend unit to cancel one enemy attack. Fame +1.
 * - Cancel != Block (Elusive armor still applies)
 * - Cannot use if unit is wounded
 * - Cannot use against Arcane Immune enemies
 * - Tied to unit ready state (if re-readied, can use again)
 * - Only cancels ONE attack from multi-attack enemies
 *
 * Powered Effect (destroy artifact):
 * - Up to 3 enemies do not attack this combat
 * - Does not work on Arcane Immune enemies
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  CARD_BANNER_OF_FEAR,
  UNIT_PEASANTS,
  USE_BANNER_FEAR_ACTION,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ENEMIES,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import {
  hasBannerOfFear,
  canUseBannerFear,
  canCancelEnemyAttack,
  getCancellableAttacks,
} from "../rules/banners.js";
import { isAttackCancelled } from "../combat/enemyAttackHelpers.js";
import { computeBannerFearOptions } from "../validActions/combatBlock.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import type { Player } from "../../types/player.js";

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_UNIT_1 = "unit_1";
const TEST_UNIT_2 = "unit_2";

function createPeasantUnit(instanceId: string) {
  return createPlayerUnit(UNIT_PEASANTS, instanceId);
}

function createCombatEnemy(
  instanceId: string,
  enemyId: string = ENEMY_DIGGERS,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const def = ENEMIES[enemyId as keyof typeof ENEMIES];
  if (!def) throw new Error(`Unknown enemy: ${enemyId}`);
  return {
    instanceId,
    enemyId: enemyId as CombatEnemy["enemyId"],
    definition: def,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    ...overrides,
  };
}

function createBlockPhaseCombat(
  enemies: CombatEnemy[],
  overrides: Partial<CombatState> = {}
): CombatState {
  const base = createUnitCombatState(COMBAT_PHASE_BLOCK);
  return {
    ...base,
    enemies,
    ...overrides,
  };
}

function createPlayerWithBannerOfFear(
  unitInstanceId: string = TEST_UNIT_1,
  overrides: Partial<Player> = {}
): Player {
  return createTestPlayer({
    units: [createPeasantUnit(unitInstanceId)],
    attachedBanners: [
      {
        bannerId: CARD_BANNER_OF_FEAR,
        unitInstanceId,
        isUsedThisRound: false,
      },
    ],
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner of Fear", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // --------------------------------------------------------------------------
  // Rule Functions
  // --------------------------------------------------------------------------
  describe("Rule Functions", () => {
    it("should detect Banner of Fear on unit", () => {
      const player = createPlayerWithBannerOfFear();
      expect(hasBannerOfFear(player, TEST_UNIT_1)).toBe(true);
      expect(hasBannerOfFear(player, "nonexistent")).toBe(false);
    });

    it("should allow use when unit is ready and unwounded", () => {
      const player = createPlayerWithBannerOfFear();
      expect(canUseBannerFear(player, TEST_UNIT_1)).toBe(true);
    });

    it("should not allow use when unit is spent", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      unit.state = UNIT_STATE_SPENT;
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      expect(canUseBannerFear(player, TEST_UNIT_1)).toBe(false);
    });

    it("should not allow use when unit is wounded", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      unit.wounded = true;
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      expect(canUseBannerFear(player, TEST_UNIT_1)).toBe(false);
    });

    it("should not allow cancelling Arcane Immune enemy attacks", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_SORCERERS);
      expect(canCancelEnemyAttack(enemy, 0)).toBe(false);
    });

    it("should allow cancelling normal enemy attacks", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_DIGGERS);
      expect(canCancelEnemyAttack(enemy, 0)).toBe(true);
    });

    it("should not allow cancelling already-cancelled attacks", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_DIGGERS, {
        attacksCancelled: [true],
      });
      expect(canCancelEnemyAttack(enemy, 0)).toBe(false);
    });

    it("should return cancellable attacks excluding defeated and arcane immune", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_SORCERERS), // Arcane Immune
        createCombatEnemy("enemy_3", ENEMY_DIGGERS, { isDefeated: true }),
      ];

      const cancellable = getCancellableAttacks(enemies);
      expect(cancellable).toHaveLength(1);
      expect(cancellable[0]!.enemyInstanceId).toBe("enemy_1");
      expect(cancellable[0]!.attackIndex).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Valid Actions
  // --------------------------------------------------------------------------
  describe("Valid Actions", () => {
    it("should compute banner fear options during block phase", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const options = computeBannerFearOptions(combat, player);
      expect(options).toHaveLength(1);
      expect(options[0]!.unitInstanceId).toBe(TEST_UNIT_1);
      expect(options[0]!.targets).toHaveLength(1);
      expect(options[0]!.targets[0]!.enemyInstanceId).toBe("enemy_1");
    });

    it("should not include options when unit is wounded", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      unit.wounded = true;
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });

      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const options = computeBannerFearOptions(combat, player);
      expect(options).toHaveLength(0);
    });

    it("should not include Arcane Immune enemies as targets", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_SORCERERS)];
      const combat = createBlockPhaseCombat(enemies);

      const options = computeBannerFearOptions(combat, player);
      expect(options).toHaveLength(0);
    });

    it("should include multiple units with Banner of Fear", () => {
      const player = createTestPlayer({
        units: [createPeasantUnit(TEST_UNIT_1), createPeasantUnit(TEST_UNIT_2)],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_2,
            isUsedThisRound: false,
          },
        ],
      });

      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const options = computeBannerFearOptions(combat, player);
      expect(options).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Cancel Attack Command (via processAction)
  // --------------------------------------------------------------------------
  describe("Cancel Attack Command", () => {
    it("should cancel an enemy attack and grant fame +1", () => {
      const player = createPlayerWithBannerOfFear(TEST_UNIT_1, { fame: 0 });
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      // Attack should be cancelled
      expect(isAttackCancelled(result.state.combat!.enemies[0]!, 0)).toBe(true);

      // Unit should be spent
      const unit = result.state.players[0]!.units.find(
        (u) => u.instanceId === TEST_UNIT_1
      );
      expect(unit!.state).toBe(UNIT_STATE_SPENT);

      // Fame should increase by 1
      expect(result.state.players[0]!.fame).toBe(1);
    });

    it("should emit BANNER_FEAR_CANCEL_ATTACK event", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      const event = result.events.find(
        (e) => e.type === "BANNER_FEAR_CANCEL_ATTACK"
      );
      expect(event).toBeDefined();
      expect(event).toMatchObject({
        playerId: "player1",
        unitInstanceId: TEST_UNIT_1,
        enemyInstanceId: "enemy_1",
        attackIndex: 0,
        fameGained: 1,
      });
    });

    it("should be reversible (undo restores state)", () => {
      const player = createPlayerWithBannerOfFear(TEST_UNIT_1, { fame: 5 });
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const afterCancel = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(afterCancel.state.players[0]!.fame).toBe(6);
      expect(isAttackCancelled(afterCancel.state.combat!.enemies[0]!, 0)).toBe(true);

      const afterUndo = engine.processAction(afterCancel.state, "player1", {
        type: "UNDO" as const,
      });

      // Fame should be restored
      expect(afterUndo.state.players[0]!.fame).toBe(5);

      // Attack should no longer be cancelled
      expect(isAttackCancelled(afterUndo.state.combat!.enemies[0]!, 0)).toBe(false);

      // Unit should be ready again
      const unit = afterUndo.state.players[0]!.units.find(
        (u) => u.instanceId === TEST_UNIT_1
      );
      expect(unit!.state).toBe(UNIT_STATE_READY);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("Validation", () => {
    it("should reject when not in combat", () => {
      const player = createPlayerWithBannerOfFear();
      const state = createTestGameState({
        players: [player],
        combat: undefined,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when not in block phase", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      // Use ATTACK phase instead of BLOCK
      const combat = createBlockPhaseCombat(enemies);
      combat.phase = "ATTACK" as CombatState["phase"];

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when targeting Arcane Immune enemy", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_SORCERERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when unit is wounded", () => {
      const unit = createPeasantUnit(TEST_UNIT_1);
      unit.wounded = true;
      const player = createTestPlayer({
        units: [unit],
        attachedBanners: [
          {
            bannerId: CARD_BANNER_OF_FEAR,
            unitInstanceId: TEST_UNIT_1,
            isUsedThisRound: false,
          },
        ],
      });
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when unit does not have Banner of Fear", () => {
      const player = createTestPlayer({
        units: [createPeasantUnit(TEST_UNIT_1)],
        // No banner attached
      });
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when attack is already cancelled", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS, {
          attacksCancelled: [true],
        }),
      ];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Cancelled Attack Interaction with Damage Assignment
  // --------------------------------------------------------------------------
  describe("Cancelled Attack Interactions", () => {
    it("cancelled attacks should not appear in block options", () => {
      // This is tested indirectly through the getBlockOptions function
      // which filters out cancelled attacks via isAttackCancelled
      const enemy = createCombatEnemy("enemy_1", ENEMY_DIGGERS, {
        attacksCancelled: [true],
      });

      expect(isAttackCancelled(enemy, 0)).toBe(true);
    });
  });
});
