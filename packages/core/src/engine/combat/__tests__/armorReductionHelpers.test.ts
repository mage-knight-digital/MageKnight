/**
 * Armor reduction helper unit tests
 *
 * Tests for the applyArmorReductions function used by Explosive Bolt.
 */

import { describe, it, expect } from "vitest";
import { applyArmorReductions } from "../armorReductionHelpers.js";
import {
  createTestGameState,
  createTestPlayer,
} from "../../__tests__/testHelpers.js";
import type { GameState } from "../../../state/GameState.js";
import type { CombatEnemy, CombatState } from "../../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_CONTEXT_STANDARD,
} from "../../../types/combat.js";
import {
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  ENEMY_DIGGERS,
  ENEMIES,
} from "@mage-knight/shared";
import type { EnemyId } from "@mage-knight/shared";
import { getEffectiveEnemyArmor } from "../../modifiers/combat.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const definition = ENEMIES[enemyId as keyof typeof ENEMIES];
  if (!definition) {
    throw new Error(`Unknown enemy: ${enemyId}`);
  }
  return {
    instanceId,
    enemyId: enemyId as EnemyId,
    definition,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    ...overrides,
  };
}

function createCombatStateWithEnemies(enemies: CombatEnemy[]): CombatState {
  return {
    enemies,
    phase: COMBAT_PHASE_RANGED_SIEGE,
    woundsThisCombat: 0,
    woundsAddedToHandThisCombat: false,
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
  };
}

function createCombatGameState(enemies: CombatEnemy[]): GameState {
  const player = createTestPlayer({ id: "player1" });
  return createTestGameState({
    players: [player],
    combat: createCombatStateWithEnemies(enemies),
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe("applyArmorReductions", () => {
  it("applies -1 armor to a surviving enemy", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_1", ENEMY_PROWLERS),
    ]);

    const result = applyArmorReductions(state, "player1", 1);

    const prowlerDef = ENEMIES[ENEMY_PROWLERS];
    const effectiveArmor = getEffectiveEnemyArmor(
      result,
      "enemy_1",
      prowlerDef.armor,
      prowlerDef.resistances.length,
      "player1"
    );
    expect(effectiveArmor).toBe(prowlerDef.armor - 1);
  });

  it("stacks multiple reductions on same enemy when only one target", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_1", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_2", ENEMY_DIGGERS),
    ]);

    // 2 reductions but only 1 valid target
    const result = applyArmorReductions(state, "player1", 2);

    const diggerDef = ENEMIES[ENEMY_DIGGERS];
    const effectiveArmor = getEffectiveEnemyArmor(
      result,
      "enemy_2",
      diggerDef.armor,
      diggerDef.resistances.length,
      "player1"
    );
    // Diggers have armor 3, reduced by 2 → 1 (or armor - 2 if armor > 3)
    expect(effectiveArmor).toBe(Math.max(1, diggerDef.armor - 2));
  });

  it("spreads reductions across multiple surviving enemies", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_1", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_2", ENEMY_PROWLERS),
      createCombatEnemy("enemy_3", ENEMY_PROWLERS),
    ]);

    // 2 reductions, 2 valid targets → 1 each
    const result = applyArmorReductions(state, "player1", 2);

    const prowlerDef = ENEMIES[ENEMY_PROWLERS];
    const armor2 = getEffectiveEnemyArmor(
      result,
      "enemy_2",
      prowlerDef.armor,
      prowlerDef.resistances.length,
      "player1"
    );
    const armor3 = getEffectiveEnemyArmor(
      result,
      "enemy_3",
      prowlerDef.armor,
      prowlerDef.resistances.length,
      "player1"
    );
    expect(armor2).toBe(prowlerDef.armor - 1);
    expect(armor3).toBe(prowlerDef.armor - 1);
  });

  it("skips Fire Resistant enemies", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_1", ENEMY_FIRE_MAGES),
      createCombatEnemy("enemy_2", ENEMY_PROWLERS),
    ]);

    const result = applyArmorReductions(state, "player1", 1);

    const fireMageDef = ENEMIES[ENEMY_FIRE_MAGES];
    const prowlerDef = ENEMIES[ENEMY_PROWLERS];

    // Fire Mages should not be affected
    const fireMageArmor = getEffectiveEnemyArmor(
      result,
      "enemy_1",
      fireMageDef.armor,
      fireMageDef.resistances.length,
      "player1"
    );
    expect(fireMageArmor).toBe(fireMageDef.armor);

    // Prowler should be reduced
    const prowlerArmor = getEffectiveEnemyArmor(
      result,
      "enemy_2",
      prowlerDef.armor,
      prowlerDef.resistances.length,
      "player1"
    );
    expect(prowlerArmor).toBe(prowlerDef.armor - 1);
  });

  it("does nothing when no valid targets exist", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS, { isDefeated: true }),
      createCombatEnemy("enemy_1", ENEMY_FIRE_MAGES),
    ]);

    const before = state.activeModifiers.length;
    const result = applyArmorReductions(state, "player1", 1);

    // No new modifiers should be added (Fire Mages are immune)
    expect(result.activeModifiers.length).toBe(before);
  });

  it("does nothing with zero reductions", () => {
    const state = createCombatGameState([
      createCombatEnemy("enemy_0", ENEMY_PROWLERS),
      createCombatEnemy("enemy_1", ENEMY_PROWLERS),
    ]);

    const before = state.activeModifiers.length;
    const result = applyArmorReductions(state, "player1", 0);

    expect(result.activeModifiers.length).toBe(before);
  });

  it("does nothing when not in combat", () => {
    const state = createTestGameState();
    const result = applyArmorReductions(state, "player1", 2);
    expect(result.activeModifiers.length).toBe(0);
  });
});
