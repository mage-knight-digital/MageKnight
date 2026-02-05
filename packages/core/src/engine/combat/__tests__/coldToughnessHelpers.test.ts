/**
 * Cold Toughness Helper Unit Tests
 *
 * Tests for the bonus calculation logic independent of game state.
 */

import { describe, it, expect } from "vitest";
import {
  calculateColdToughnessBonus,
  countAttackColors,
  isCountableAbility,
  getColdToughnessBlockBonus,
} from "../coldToughnessHelpers.js";
import type { CombatEnemy } from "../../../types/combat.js";
import type { EnemyDefinition, EnemyAbilityType, Element } from "@mage-knight/shared";
import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ABILITY_BRUTAL,
  ABILITY_SWIFT,
  ABILITY_POISON,
  ABILITY_PARALYZE,
  ABILITY_FORTIFIED,
  ABILITY_UNFORTIFIED,
  ABILITY_ELUSIVE,
  ABILITY_ARCANE_IMMUNITY,
  ABILITY_ASSASSINATION,
  ABILITY_CUMBERSOME,
  ABILITY_VAMPIRIC,
  ABILITY_DEFEND,
  RESIST_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
  ENEMY_HIGH_DRAGON,
  ENEMY_DELPHANA_MASTERS,
  ENEMIES,
} from "@mage-knight/shared";
import { createTestGameState } from "../../__tests__/testHelpers.js";
import { addModifier } from "../../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_SELF,
  SOURCE_CARD,
  EFFECT_COLD_TOUGHNESS_BLOCK,
} from "../../../types/modifierConstants.js";
import type { CardId } from "@mage-knight/shared";

// ============================================================================
// Test Helpers
// ============================================================================

function createCombatEnemy(
  definition: EnemyDefinition,
  instanceId: string = "enemy_0"
): CombatEnemy {
  return {
    instanceId,
    enemyId: definition.id,
    definition,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
  };
}

function makeEnemy(
  abilities: readonly EnemyAbilityType[],
  attackElement: Element = ELEMENT_PHYSICAL,
  resistances: readonly string[] = []
): CombatEnemy {
  return createCombatEnemy({
    id: "test_enemy" as EnemyDefinition["id"],
    name: "Test Enemy",
    color: "green",
    attack: 5,
    attackElement,
    armor: 5,
    fame: 5,
    resistances: resistances as EnemyDefinition["resistances"],
    abilities,
  });
}

// ============================================================================
// countAttackColors
// ============================================================================

describe("countAttackColors", () => {
  it("returns 0 for physical attack (no color icon)", () => {
    expect(countAttackColors(ELEMENT_PHYSICAL)).toBe(0);
  });

  it("returns 1 for fire attack", () => {
    expect(countAttackColors(ELEMENT_FIRE)).toBe(1);
  });

  it("returns 1 for ice attack", () => {
    expect(countAttackColors(ELEMENT_ICE)).toBe(1);
  });

  it("returns 2 for cold fire attack (counts as both fire and ice)", () => {
    expect(countAttackColors(ELEMENT_COLD_FIRE)).toBe(2);
  });
});

// ============================================================================
// isCountableAbility
// ============================================================================

describe("isCountableAbility", () => {
  it("counts offensive abilities", () => {
    expect(isCountableAbility(ABILITY_SWIFT)).toBe(true);
    expect(isCountableAbility(ABILITY_BRUTAL)).toBe(true);
    expect(isCountableAbility(ABILITY_POISON)).toBe(true);
    expect(isCountableAbility(ABILITY_PARALYZE)).toBe(true);
    expect(isCountableAbility(ABILITY_ASSASSINATION)).toBe(true);
    expect(isCountableAbility(ABILITY_CUMBERSOME)).toBe(true);
    expect(isCountableAbility(ABILITY_VAMPIRIC)).toBe(true);
  });

  it("counts defensive abilities (except Arcane Immunity)", () => {
    expect(isCountableAbility(ABILITY_FORTIFIED)).toBe(true);
    expect(isCountableAbility(ABILITY_UNFORTIFIED)).toBe(true);
    expect(isCountableAbility(ABILITY_ELUSIVE)).toBe(true);
    expect(isCountableAbility(ABILITY_DEFEND)).toBe(true);
  });

  it("does not count Arcane Immunity", () => {
    expect(isCountableAbility(ABILITY_ARCANE_IMMUNITY)).toBe(false);
  });
});

// ============================================================================
// calculateColdToughnessBonus
// ============================================================================

describe("calculateColdToughnessBonus", () => {
  it("returns 0 for enemy with Arcane Immunity", () => {
    const enemy = makeEnemy(
      [ABILITY_ARCANE_IMMUNITY, ABILITY_BRUTAL],
      ELEMENT_FIRE,
      [RESIST_FIRE, RESIST_ICE]
    );
    expect(calculateColdToughnessBonus(enemy)).toBe(0);
  });

  it("counts only abilities for physical-attack enemy with no resistances", () => {
    const enemy = makeEnemy([ABILITY_BRUTAL], ELEMENT_PHYSICAL);
    // 1 ability + 0 attack colors + 0 resistances = 1
    expect(calculateColdToughnessBonus(enemy)).toBe(1);
  });

  it("counts abilities, resistances, and attack colors", () => {
    const enemy = makeEnemy([ABILITY_BRUTAL], ELEMENT_FIRE, [RESIST_FIRE]);
    // 1 ability + 1 attack color + 1 resistance = 3
    expect(calculateColdToughnessBonus(enemy)).toBe(3);
  });

  // === FAQ Examples ===

  it("High Dragon: Cold Fire, Brutal, Fire Res, Ice Res = 5 bonus", () => {
    const highDragon = createCombatEnemy(ENEMIES[ENEMY_HIGH_DRAGON]);
    // Cold Fire (+2) + Brutal (+1) + Fire Res (+1) + Ice Res (+1) = 5
    expect(calculateColdToughnessBonus(highDragon)).toBe(5);
  });

  it("Delphana Masters: Cold Fire, Assassination, Paralyze, Fire Res, Ice Res = 6 bonus", () => {
    const delphana = createCombatEnemy(ENEMIES[ENEMY_DELPHANA_MASTERS]);
    // Cold Fire (+2) + Assassination (+1) + Paralyze (+1) + Fire Res (+1) + Ice Res (+1) = 6
    expect(calculateColdToughnessBonus(delphana)).toBe(6);
  });

  it("basic enemy with no abilities or resistances and physical attack = 0", () => {
    const enemy = makeEnemy([], ELEMENT_PHYSICAL);
    expect(calculateColdToughnessBonus(enemy)).toBe(0);
  });

  it("enemy with ice attack and ice resistance = 2", () => {
    const enemy = makeEnemy([], ELEMENT_ICE, [RESIST_ICE]);
    // 0 abilities + 1 attack color + 1 resistance = 2
    expect(calculateColdToughnessBonus(enemy)).toBe(2);
  });

  it("enemy with multiple abilities and resistances", () => {
    const enemy = makeEnemy(
      [ABILITY_SWIFT, ABILITY_BRUTAL, ABILITY_FORTIFIED],
      ELEMENT_ICE,
      [RESIST_PHYSICAL, RESIST_ICE]
    );
    // 3 abilities + 1 attack color + 2 resistances = 6
    expect(calculateColdToughnessBonus(enemy)).toBe(6);
  });
});

// ============================================================================
// getColdToughnessBlockBonus (integration with modifier system)
// ============================================================================

describe("getColdToughnessBlockBonus", () => {
  it("returns 0 when modifier is not active", () => {
    const enemy = makeEnemy([ABILITY_BRUTAL], ELEMENT_FIRE, [RESIST_FIRE]);
    const state = createTestGameState();
    expect(getColdToughnessBlockBonus(state, "player1", enemy)).toBe(0);
  });

  it("returns bonus when Cold Toughness modifier is active", () => {
    const enemy = makeEnemy([ABILITY_BRUTAL], ELEMENT_FIRE, [RESIST_FIRE]);
    const baseState = createTestGameState();

    // Add Cold Toughness modifier
    const state = addModifier(baseState, {
      source: { type: SOURCE_CARD, cardId: "cold_toughness" as CardId, playerId: "player1" },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_COLD_TOUGHNESS_BLOCK },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    });

    // 1 ability + 1 attack color + 1 resistance = 3
    expect(getColdToughnessBlockBonus(state, "player1", enemy)).toBe(3);
  });

  it("returns 0 for enemy with Arcane Immunity even when modifier is active", () => {
    const enemy = makeEnemy(
      [ABILITY_ARCANE_IMMUNITY, ABILITY_BRUTAL],
      ELEMENT_FIRE,
      [RESIST_FIRE]
    );
    const baseState = createTestGameState();

    const state = addModifier(baseState, {
      source: { type: SOURCE_CARD, cardId: "cold_toughness" as CardId, playerId: "player1" },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_COLD_TOUGHNESS_BLOCK },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    });

    expect(getColdToughnessBlockBonus(state, "player1", enemy)).toBe(0);
  });

  it("returns 0 for a different player", () => {
    const enemy = makeEnemy([ABILITY_BRUTAL], ELEMENT_FIRE);
    const baseState = createTestGameState();

    const state = addModifier(baseState, {
      source: { type: SOURCE_CARD, cardId: "cold_toughness" as CardId, playerId: "player1" },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_COLD_TOUGHNESS_BLOCK },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    });

    expect(getColdToughnessBlockBonus(state, "player2", enemy)).toBe(0);
  });
});
