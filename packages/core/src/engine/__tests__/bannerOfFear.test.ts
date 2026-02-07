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
  ENEMY_MAGIC_FAMILIARS,
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
import {
  isAttackCancelled,
  isEnemyFullyDamageAssigned,
  getUnblockedAttackIndices,
  getAttacksNeedingDamageAssignment,
} from "../combat/enemyAttackHelpers.js";
import {
  computeBannerFearOptions,
  computeBlockPhaseOptions,
  getBlockOptions,
} from "../validActions/combatBlock.js";
import {
  resolveSelectCombatEnemy,
} from "../effects/combatEffects.js";
import { resolveEffect } from "../effects/index.js";
import { doesEnemyAttackThisCombat } from "../modifiers/index.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import type { Player } from "../../types/player.js";
import type { SelectCombatEnemyEffect, ResolveCombatEnemyTargetEffect } from "../../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../../types/modifierConstants.js";

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
  // Cancelled Attack Interactions with Damage Assignment & Block Options
  // --------------------------------------------------------------------------
  describe("Cancelled Attack Interactions", () => {
    it("cancelled attacks should not appear in block options", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_DIGGERS, {
        attacksCancelled: [true],
      });
      const state = createTestGameState({
        combat: createBlockPhaseCombat([enemy]),
      });

      const blockOpts = getBlockOptions(state, [enemy]);
      expect(blockOpts).toHaveLength(0);
    });

    it("isEnemyFullyDamageAssigned should skip cancelled attacks", () => {
      // Multi-attack enemy (Magic Familiars): 2 attacks
      // First attack cancelled, second attack has damage assigned
      const enemy = createCombatEnemy("enemy_1", ENEMY_MAGIC_FAMILIARS, {
        attacksCancelled: [true, false],
        attacksDamageAssigned: [false, true],
      });

      expect(isEnemyFullyDamageAssigned(enemy)).toBe(true);
    });

    it("isEnemyFullyDamageAssigned should return false when uncancelled attack lacks damage assignment", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_MAGIC_FAMILIARS, {
        attacksCancelled: [true, false],
        attacksDamageAssigned: [false, false],
      });

      expect(isEnemyFullyDamageAssigned(enemy)).toBe(false);
    });

    it("getUnblockedAttackIndices should exclude cancelled attacks", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_MAGIC_FAMILIARS, {
        attacksCancelled: [true, false],
      });

      const indices = getUnblockedAttackIndices(enemy);
      expect(indices).toEqual([1]); // Only attack index 1 (uncancelled)
    });

    it("getAttacksNeedingDamageAssignment should skip cancelled attacks", () => {
      const enemy = createCombatEnemy("enemy_1", ENEMY_MAGIC_FAMILIARS, {
        attacksCancelled: [true, false],
      });

      const attacks = getAttacksNeedingDamageAssignment(enemy);
      expect(attacks).toEqual([1]); // Only attack index 1 needs damage
    });
  });

  // --------------------------------------------------------------------------
  // Multi-target Enemy Selection (Powered Effect)
  // --------------------------------------------------------------------------
  describe("Powered Effect: Multi-target Selection", () => {
    const multiTargetEffect: SelectCombatEnemyEffect = {
      type: EFFECT_SELECT_COMBAT_ENEMY,
      excludeArcaneImmune: true,
      maxTargets: 3,
      template: {
        modifiers: [
          {
            modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
            duration: DURATION_COMBAT,
            description: "Target enemy does not attack",
          },
        ],
      },
    };

    it("should generate choice options with multi-target tracking", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      const result = resolveSelectCombatEnemy(state, multiTargetEffect, "player1");

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      expect(result.description).toContain("0/3 selected");

      // Each option should have multi-target tracking
      const option = result.dynamicChoiceOptions![0] as ResolveCombatEnemyTargetEffect;
      expect(option.multiTargetSource).toBeDefined();
      expect(option.remainingTargets).toBe(2); // 3 max - 0 so far - 1 for current = 2
      expect(option.alreadyTargeted).toEqual([]);
    });

    it("should filter already-targeted enemies on subsequent selections", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Simulate second selection: enemy_1 already targeted
      const result = resolveSelectCombatEnemy(
        state,
        multiTargetEffect,
        "player1",
        ["enemy_1"]
      );

      expect(result.requiresChoice).toBe(true);
      // 2 enemies + 1 "done" NOOP option
      expect(result.dynamicChoiceOptions).toHaveLength(3);
      expect(result.description).toContain("1/3 selected");

      // Verify enemy_1 is not in the options
      const enemyOptions = result.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      ) as ResolveCombatEnemyTargetEffect[];
      expect(enemyOptions.every((o) => o.enemyInstanceId !== "enemy_1")).toBe(true);

      // Verify NOOP "done" option exists
      const noopOption = result.dynamicChoiceOptions!.find(
        (o) => o.type === EFFECT_NOOP
      );
      expect(noopOption).toBeDefined();
    });

    it("should add done option when at least one target already selected", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // First selection: no "done" option
      const first = resolveSelectCombatEnemy(state, multiTargetEffect, "player1");
      const firstNoop = first.dynamicChoiceOptions!.find((o) => o.type === EFFECT_NOOP);
      expect(firstNoop).toBeUndefined();

      // Second selection (one already targeted): has "done" option
      const second = resolveSelectCombatEnemy(
        state,
        multiTargetEffect,
        "player1",
        ["enemy_1"]
      );
      const secondNoop = second.dynamicChoiceOptions!.find((o) => o.type === EFFECT_NOOP);
      expect(secondNoop).toBeDefined();
    });

    it("should return no eligible targets when all enemies are Arcane Immune", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_SORCERERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      const result = resolveSelectCombatEnemy(state, multiTargetEffect, "player1");

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toBe("No valid enemy targets");
    });

    it("should exclude Arcane Immune enemies from multi-target selection", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_SORCERERS), // Arcane Immune
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      const result = resolveSelectCombatEnemy(state, multiTargetEffect, "player1");

      expect(result.dynamicChoiceOptions).toHaveLength(1);
      const option = result.dynamicChoiceOptions![0] as ResolveCombatEnemyTargetEffect;
      expect(option.enemyInstanceId).toBe("enemy_1");
    });

    // --- Tests via resolveEffect() to exercise the registered handler loop-back ---

    it("should loop back for next target when resolving via effect registry", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Step 1: Initial selection creates choice with 3 enemy options
      const step1 = resolveEffect(state, "player1", multiTargetEffect);
      expect(step1.requiresChoice).toBe(true);
      expect(step1.dynamicChoiceOptions).toHaveLength(3);

      // Step 2: Resolve first choice (select enemy_1) via effect registry
      // This should apply modifier AND loop back for second selection
      const firstChoice = step1.dynamicChoiceOptions![0]!;
      const step2 = resolveEffect(step1.state, "player1", firstChoice);

      // Should loop back with another choice (2 remaining enemies + "done")
      expect(step2.requiresChoice).toBe(true);
      expect(step2.dynamicChoiceOptions).toHaveLength(3); // 2 enemies + done

      // Verify enemy_1 got the skip-attack modifier
      expect(doesEnemyAttackThisCombat(step2.state, "enemy_1")).toBe(false);

      // Verify enemy_1 is excluded from next selection
      const step2EnemyOptions = step2.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      ) as ResolveCombatEnemyTargetEffect[];
      expect(step2EnemyOptions.every((o) => o.enemyInstanceId !== "enemy_1")).toBe(true);

      // Step 3: Resolve second choice (select enemy_2)
      const secondEnemyChoice = step2.dynamicChoiceOptions!.find(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      )!;
      const step3 = resolveEffect(step2.state, "player1", secondEnemyChoice);

      // Should loop back with another choice (1 remaining enemy + "done")
      expect(step3.requiresChoice).toBe(true);
      expect(step3.dynamicChoiceOptions).toHaveLength(2); // 1 enemy + done

      // Verify enemy_2 also got the skip-attack modifier
      expect(doesEnemyAttackThisCombat(step3.state, "enemy_2")).toBe(false);

      // Step 4: Select "done" to stop early
      const doneOption = step3.dynamicChoiceOptions!.find(
        (o) => o.type === EFFECT_NOOP
      )!;
      const step4 = resolveEffect(step3.state, "player1", doneOption);

      // No more choices needed — NOOP resolves cleanly
      expect(step4.requiresChoice).toBeUndefined();
    });

    it("should stop loop-back when no eligible enemies remain", () => {
      // Only 1 eligible enemy with maxTargets: 3
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_SORCERERS), // Arcane Immune
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Step 1: Initial selection — only enemy_1 eligible
      const step1 = resolveEffect(state, "player1", multiTargetEffect);
      expect(step1.requiresChoice).toBe(true);
      expect(step1.dynamicChoiceOptions).toHaveLength(1);

      // Step 2: Select enemy_1 — no more eligible enemies, no loop-back
      const step2 = resolveEffect(step1.state, "player1", step1.dynamicChoiceOptions![0]!);

      // Should NOT require another choice (loop-back finds no eligible targets)
      expect(step2.requiresChoice).toBeUndefined();
      // But the modifier was still applied
      expect(doesEnemyAttackThisCombat(step2.state, "enemy_1")).toBe(false);
    });

    it("should select all 3 targets when maxTargets reached", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createBlockPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Walk through all 3 selections
      const step1 = resolveEffect(state, "player1", multiTargetEffect);
      const step2 = resolveEffect(step1.state, "player1", step1.dynamicChoiceOptions![0]!);
      const step2Enemy = step2.dynamicChoiceOptions!.find(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      )!;
      const step3 = resolveEffect(step2.state, "player1", step2Enemy);
      const step3Enemy = step3.dynamicChoiceOptions!.find(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      )!;
      const step4 = resolveEffect(step3.state, "player1", step3Enemy);

      // After 3 selections (maxTargets reached), remainingTargets = 0, no loop-back
      expect(step4.requiresChoice).toBeUndefined();

      // All 3 enemies should have skip-attack modifier
      expect(doesEnemyAttackThisCombat(step4.state, "enemy_1")).toBe(false);
      expect(doesEnemyAttackThisCombat(step4.state, "enemy_2")).toBe(false);
      expect(doesEnemyAttackThisCombat(step4.state, "enemy_3")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Validator Edge Cases
  // --------------------------------------------------------------------------
  describe("Validator Edge Cases", () => {
    it("should reject when unit is spent (not ready)", () => {
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

    it("should reject invalid attack index", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      // Diggers has only 1 attack (index 0), so index 1 is invalid
      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: TEST_UNIT_1,
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 1,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when unit not found", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_BANNER_FEAR_ACTION,
        unitInstanceId: "nonexistent_unit",
        targetEnemyInstanceId: "enemy_1",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });

    it("should reject when enemy not found", () => {
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
        targetEnemyInstanceId: "nonexistent_enemy",
        attackIndex: 0,
      });

      expect(result.events.some((e) => e.type === "INVALID_ACTION")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Undo: fameGained tracking
  // --------------------------------------------------------------------------
  describe("Undo: Combat fameGained Tracking", () => {
    it("should restore combat fameGained on undo", () => {
      const player = createPlayerWithBannerOfFear(TEST_UNIT_1, { fame: 0 });
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies, { fameGained: 3 });

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

      const afterUndo = engine.processAction(afterCancel.state, "player1", {
        type: "UNDO" as const,
      });

      expect(afterUndo.state.combat!.fameGained).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Valid Actions: no cancellable targets
  // --------------------------------------------------------------------------
  describe("Valid Actions: No Cancellable Targets", () => {
    it("should return empty options when all enemies are defeated", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS, { isDefeated: true }),
      ];
      const combat = createBlockPhaseCombat(enemies);

      const options = computeBannerFearOptions(combat, player);
      expect(options).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // computeBlockPhaseOptions integration
  // --------------------------------------------------------------------------
  describe("computeBlockPhaseOptions with Banner of Fear", () => {
    it("should include bannerFearOptions when player has usable Banner of Fear", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const options = computeBlockPhaseOptions(state, combat, player);
      expect(options.bannerFearOptions).toBeDefined();
      expect(options.bannerFearOptions).toHaveLength(1);
      expect(options.bannerFearOptions![0]!.unitInstanceId).toBe(TEST_UNIT_1);
    });

    it("should not include bannerFearOptions when no cancellable enemies", () => {
      const player = createPlayerWithBannerOfFear();
      const enemies = [createCombatEnemy("enemy_1", ENEMY_SORCERERS)]; // Arcane Immune
      const combat = createBlockPhaseCombat(enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      const options = computeBlockPhaseOptions(state, combat, player);
      expect(options.bannerFearOptions).toBeUndefined();
    });
  });
});
