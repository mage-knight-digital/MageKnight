/**
 * Tests for Krang's Curse skill.
 *
 * Once per turn, during combat:
 * - Choose an enemy, then choose:
 *   - Reduce one enemy attack by 2 (min 0). Works vs Arcane Immunity.
 *   - Reduce enemy armor by 1 (min 1). Blocked by Arcane Immunity (option not offered).
 * - Cannot target fortified enemies during Ranged/Siege phase.
 * - For multi-attack enemies, choose which attack to reduce.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENEMY_PROWLERS,
  ENEMY_GUARDSMEN,
  ENEMY_GRIM_LEGIONNARIES,
  ENEMY_ZOMBIE_HORDE,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_CURSE } from "../../data/skills/index.js";
import { createCombatState } from "../../types/combat.js";
import {
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
} from "../modifiers/index.js";

function createKrangPlayer() {
  return createTestPlayer({
    hero: Hero.Krang,
    skills: [SKILL_KRANG_CURSE],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
  });
}

describe("Curse skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should not offer fortified targets during Ranged/Siege", () => {
    const player = createKrangPlayer();
    const state = createTestGameState({
      players: [player],
      combat: createCombatState([ENEMY_GUARDSMEN, ENEMY_PROWLERS]),
    });

    const activate = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_CURSE,
    });

    const pending = activate.state.players[0].pendingChoice;
    expect(pending).toBeDefined();

    const options = pending!.options as any[];
    const enemyNames = options.map((o) => o.enemyName).filter(Boolean);

    // Guardsmen are fortified (excluded in Ranged/Siege); Prowlers are not.
    expect(enemyNames).not.toContain("Guardsmen");
    expect(enemyNames).toContain("Prowlers");
  });

  it("should allow attack reduction vs Arcane Immune enemies but not offer armor reduction", () => {
    const player = createKrangPlayer();
    const state = createTestGameState({
      players: [player],
      combat: createCombatState([ENEMY_GRIM_LEGIONNARIES]),
    });

    const activate = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_CURSE,
    });

    // Single eligible enemy + only one curse option (attack) → auto-resolved
    expect(activate.state.players[0].pendingChoice).toBeNull();

    const enemy = activate.state.combat!.enemies[0]!;
    const effectiveAttack = getEffectiveEnemyAttack(
      activate.state,
      enemy.instanceId,
      enemy.definition.attack
    );
    expect(effectiveAttack).toBe(enemy.definition.attack - 2);
  });

  it("should prompt for attack index on multi-attack enemies and only reduce the chosen attack", () => {
    const player = createKrangPlayer();
    const state = createTestGameState({
      players: [player],
      combat: createCombatState([ENEMY_ZOMBIE_HORDE]),
    });

    const activate = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_CURSE,
    });

    // Single eligible enemy → auto-select enemy; choose attack reduction (first option)
    const chooseAttackReduction = engine.processAction(activate.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 0,
    });

    const attackIndexChoice = chooseAttackReduction.state.players[0].pendingChoice;
    expect(attackIndexChoice).toBeDefined();
    expect(attackIndexChoice!.options).toHaveLength(3);

    // Choose attack index 2 (third attack)
    const apply = engine.processAction(chooseAttackReduction.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 2,
    });

    const enemy = apply.state.combat!.enemies[0]!;
    expect(getEffectiveEnemyAttack(apply.state, enemy.instanceId, 1, 0)).toBe(1);
    expect(getEffectiveEnemyAttack(apply.state, enemy.instanceId, 1, 1)).toBe(1);
    expect(getEffectiveEnemyAttack(apply.state, enemy.instanceId, 1, 2)).toBe(0);
  });

  it("should reduce armor by 1 (min 1) on non-Arcane-Immune enemies", () => {
    const player = createKrangPlayer();
    const state = createTestGameState({
      players: [player],
      combat: createCombatState([ENEMY_PROWLERS]),
    });

    const activate = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_CURSE,
    });

    // Single eligible enemy → auto-select enemy; mode choice remains
    const modeChoice = activate.state.players[0].pendingChoice;
    expect(modeChoice).toBeDefined();
    expect(modeChoice!.options).toHaveLength(2);

    // Choose armor reduction (second option)
    const applyArmor = engine.processAction(activate.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    });

    const enemy = applyArmor.state.combat!.enemies[0]!;
    const baseArmor = enemy.definition.armor;
    const effectiveArmor = getEffectiveEnemyArmor(
      applyArmor.state,
      enemy.instanceId,
      baseArmor,
      enemy.definition.resistances.length,
      "player1"
    );
    expect(effectiveArmor).toBe(Math.max(1, baseArmor - 1));
  });
});
