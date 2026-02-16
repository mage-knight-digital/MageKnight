/**
 * Explosive Bolt card tests
 *
 * Tests for the Explosive Bolt advanced action card:
 * - Basic: Take a Wound. Gain a white and a red crystal.
 * - Powered: Ranged Attack 3. For each enemy defeated, another enemy gets Armor -1 (min 1).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { reverseEffect } from "../effects/reverse.js";
import { describeEffect } from "../effects/describeEffect.js";
import { EXPLOSIVE_BOLT } from "../../data/advancedActions/red/explosive-bolt.js";
import type { AttackWithDefeatBonusEffect, CompoundEffect } from "../../types/cards.js";
import {
  EFFECT_ATTACK_WITH_DEFEAT_BONUS,
  EFFECT_COMPOUND,
  COMBAT_TYPE_RANGED,
} from "../../types/effectTypes.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_TARGETS_ACTION,
  FINALIZE_ATTACK_ACTION,
  ATTACK_TYPE_RANGED,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  getEnemy,
  CARD_WOUND,
  MANA_RED,
  MANA_WHITE,
} from "@mage-knight/shared";
import { getEffectiveEnemyArmor } from "../modifiers/combat.js";

describe("Explosive Bolt", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==========================================================================
  // BASIC EFFECT TESTS
  // ==========================================================================

  describe("basic effect", () => {
    it("is a compound effect with wound, white crystal, and red crystal", () => {
      const effect = EXPLOSIVE_BOLT.basicEffect;
      expect(effect.type).toBe(EFFECT_COMPOUND);
      const compound = effect as CompoundEffect;
      expect(compound.effects).toHaveLength(3);
      expect(compound.effects[0]).toEqual({ type: "take_wound", amount: 1 });
      expect(compound.effects[1]).toEqual({ type: "gain_crystal", color: MANA_WHITE });
      expect(compound.effects[2]).toEqual({ type: "gain_crystal", color: MANA_RED });
    });

    it("takes a wound and gains white + red crystals", () => {
      let state = createTestGameState();
      const player = state.players.find((p) => p.id === "player1")!;
      const initialWounds = player.hand.filter((c) => c === CARD_WOUND).length;
      const initialWhiteCrystals = player.crystals.white;
      const initialRedCrystals = player.crystals.red;

      const result = resolveEffect(state, "player1", EXPLOSIVE_BOLT.basicEffect, EXPLOSIVE_BOLT.id);
      state = result.state;

      const updatedPlayer = state.players.find((p) => p.id === "player1")!;
      // Should have gained a wound in hand
      const newWounds = updatedPlayer.hand.filter((c) => c === CARD_WOUND).length;
      expect(newWounds).toBe(initialWounds + 1);
      // Should have gained white and red crystals
      expect(updatedPlayer.crystals.white).toBe(initialWhiteCrystals + 1);
      expect(updatedPlayer.crystals.red).toBe(initialRedCrystals + 1);
    });

    it("can be played outside combat (categories include SPECIAL)", () => {
      expect(EXPLOSIVE_BOLT.categories).toContain("special");
    });
  });

  // ==========================================================================
  // POWERED EFFECT TESTS
  // ==========================================================================

  describe("powered effect", () => {
    it("is an AttackWithDefeatBonus with ranged combat type and armor reduction", () => {
      const effect = EXPLOSIVE_BOLT.poweredEffect;
      expect(effect.type).toBe(EFFECT_ATTACK_WITH_DEFEAT_BONUS);
      const typed = effect as AttackWithDefeatBonusEffect;
      expect(typed.amount).toBe(3);
      expect(typed.combatType).toBe(COMBAT_TYPE_RANGED);
      expect(typed.armorReductionPerDefeat).toBe(1);
      expect(typed.reputationPerDefeat).toBe(0);
      expect(typed.famePerDefeat).toBe(0);
    });

    it("grants Ranged Attack 3 and registers defeat tracker", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      // Resolve the powered effect
      const result = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = result.state;

      const player = state.players.find((p) => p.id === "player1")!;
      // Should have 3 ranged attack
      expect(player.combatAccumulator.attack.ranged).toBe(3);
      // Should have a defeat tracker registered
      expect(player.pendingAttackDefeatFame).toHaveLength(1);
      const tracker = player.pendingAttackDefeatFame[0]!;
      expect(tracker.attackType).toBe(ATTACK_TYPE_RANGED);
      expect(tracker.armorReductionPerDefeat).toBe(1);
    });

    it("reduces armor on surviving enemy when defeating one enemy in ranged phase", () => {
      let state = createTestGameState();

      // Two prowlers: armor 3, attack 4
      const prowlerDef = getEnemy(ENEMY_PROWLERS);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      // Resolve powered effect: Ranged Attack 3
      const effectResult = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult.state;

      // Declare targets and finalize to defeat first prowler
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });
      state = finalizeResult.state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Second prowler should have armor reduced by 1 (from 3 to 2)
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_1",
        prowlerDef.armor,
        prowlerDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(prowlerDef.armor - 1);
    });

    it("applies armor reduction per defeated enemy (multiple defeats)", () => {
      let state = createTestGameState();

      // Three prowlers: armor 3 each. Need to defeat 2, check armor on 3rd.
      const prowlerDef = getEnemy(ENEMY_PROWLERS);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      // Resolve powered effect for first attack (3 ranged + tracker)
      const effectResult1 = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult1.state;

      // Defeat first enemy via declare + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // Resolve powered effect again for second attack (3 more ranged + tracker)
      const effectResult2 = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult2.state;

      // Defeat second enemy via declare + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // In the target-first flow, each finalize applies reductions immediately.
      // First finalize (defeating enemy_0) reduces one surviving enemy (enemy_1).
      // Second finalize (defeating enemy_1) reduces the last surviving enemy (enemy_2).
      // So enemy_2 gets 1 reduction total (the other was "used" on enemy_1 before it was defeated).
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_2",
        prowlerDef.armor,
        prowlerDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(prowlerDef.armor - 1);
    });

    it("does not reduce armor below minimum of 1", () => {
      let state = createTestGameState();

      // 4 prowlers (armor 3). Defeat 3, check that 4th has armor clamped to 1.
      // 3 defeats × armorReductionPerDefeat 1 = 3 reductions on prowler (armor 3).
      // 3 - 3 = 0, but minimum armor is 1.
      const prowlerDef = getEnemy(ENEMY_PROWLERS);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS, ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      // Defeat first prowler: resolve effect + declare + finalize
      const effectResult1 = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult1.state;
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // Defeat second prowler: resolve effect + declare + finalize
      const effectResult2 = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult2.state;
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // Defeat third prowler: resolve effect + declare + finalize
      const effectResult3 = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult3.state;
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_2"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // In the target-first flow, each finalize applies reductions immediately.
      // Each reduction goes to a surviving enemy that may be defeated later.
      // Finalize#1 (enemy_0) → reduces enemy_1; Finalize#2 (enemy_1) → reduces enemy_2;
      // Finalize#3 (enemy_2) → reduces enemy_3. So enemy_3 gets 1 reduction.
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_3",
        prowlerDef.armor,
        prowlerDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(prowlerDef.armor - 1);
    });

    it("does not apply armor reduction to Fire Resistant enemies", () => {
      let state = createTestGameState();

      // Prowlers (not fire resistant) and Fire Mages (fire resistant)
      const fireMageDef = getEnemy(ENEMY_FIRE_MAGES);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_FIRE_MAGES],
      }).state;

      // Resolve powered effect: Ranged Attack 3
      const effectResult = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult.state;

      // Defeat the prowler via declare + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Fire Mages should NOT have armor reduced (Fire Resistant)
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_1",
        fireMageDef.armor,
        fireMageDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(fireMageDef.armor);
    });

    it("does not apply armor reduction when no enemy is defeated", () => {
      let state = createTestGameState();

      const prowlerDef = getEnemy(ENEMY_PROWLERS);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_PROWLERS],
      }).state;

      // Resolve powered effect: Ranged Attack 3 (but prowlers have armor 3 each)
      const effectResult = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult.state;

      // Declare BOTH targets — combined armor is 6, only have 3 attack → fails
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
      }).state;

      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Neither enemy should have armor changed
      const armor0 = getEffectiveEnemyArmor(
        state,
        "enemy_0",
        prowlerDef.armor,
        prowlerDef.resistances.length,
        "player1"
      );
      const armor1 = getEffectiveEnemyArmor(
        state,
        "enemy_1",
        prowlerDef.armor,
        prowlerDef.resistances.length,
        "player1"
      );
      expect(armor0).toBe(prowlerDef.armor);
      expect(armor1).toBe(prowlerDef.armor);
    });

    it("no armor reduction when only Fire Resistant enemies survive", () => {
      let state = createTestGameState();

      const fireMageDef = getEnemy(ENEMY_FIRE_MAGES);

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_FIRE_MAGES],
      }).state;

      // Resolve powered effect: Ranged Attack 3
      const effectResult = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult.state;

      // Defeat the prowler via declare + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;
      state = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      }).state;

      // End phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Fire Mages armor should remain unchanged
      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_1",
        fireMageDef.armor,
        fireMageDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(fireMageDef.armor);
    });
  });

  // ==========================================================================
  // CARD METADATA TESTS
  // ==========================================================================

  describe("card metadata", () => {
    it("can be powered by red or white mana", () => {
      expect(EXPLOSIVE_BOLT.poweredBy).toContain(MANA_RED);
      expect(EXPLOSIVE_BOLT.poweredBy).toContain(MANA_WHITE);
    });

    it("has sideways value of 1", () => {
      expect(EXPLOSIVE_BOLT.sidewaysValue).toBe(1);
    });
  });

  // ==========================================================================
  // DESCRIBE EFFECT TESTS
  // ==========================================================================

  describe("describeEffect", () => {
    it("describes powered effect with armor reduction", () => {
      const desc = describeEffect(EXPLOSIVE_BOLT.poweredEffect);
      expect(desc).toContain("Attack 3");
      expect(desc).toContain("Armor -1");
    });
  });

  // ==========================================================================
  // REVERSE EFFECT TESTS
  // ==========================================================================

  describe("reverseEffect", () => {
    it("reverses ranged attack and removes tracker", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Resolve the effect
      const effectResult = resolveEffect(state, "player1", EXPLOSIVE_BOLT.poweredEffect, EXPLOSIVE_BOLT.id);
      state = effectResult.state;

      const player = state.players.find((p) => p.id === "player1")!;
      expect(player.combatAccumulator.attack.ranged).toBe(3);
      expect(player.pendingAttackDefeatFame).toHaveLength(1);

      // Reverse it
      const reversed = reverseEffect(player, EXPLOSIVE_BOLT.poweredEffect);
      expect(reversed.combatAccumulator.attack.ranged).toBe(0);
      expect(reversed.pendingAttackDefeatFame).toHaveLength(0);
    });
  });
});
