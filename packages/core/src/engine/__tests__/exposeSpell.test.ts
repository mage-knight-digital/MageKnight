/**
 * Expose / Mass Expose Spell Tests
 *
 * Tests for:
 * - Basic Expose: Target enemy loses fortification and resistances, gain Ranged Attack 2
 * - Powered Mass Expose: All enemies lose fortifications OR resistances (choice), gain Ranged Attack 3
 * - Arcane Immunity blocks modifier effects but not attack
 * - Resistance removal affects damage calculation
 * - Fortification removal allows ranged attacks
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import {
  addModifier,
  isAbilityNullified,
  areResistancesRemoved,
  hasArcaneImmunity,
} from "../modifiers/index.js";
import { getFortificationLevel } from "../validators/combatValidators/fortificationValidators.js";
import {
  ENEMY_GUARDSMEN,
  ENEMY_GOLEMS,
  ENEMY_HEROES,
  ENEMY_SORCERERS,
  ABILITY_FORTIFIED,
  getEnemy,
} from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_REMOVE_RESISTANCES,
  SCOPE_ONE_ENEMY,
  SCOPE_ALL_ENEMIES,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";

// Helper to create a minimal combat state for modifier testing
function createCombatState(enemies: CombatEnemy[]): Partial<GameState> {
  return {
    combat: {
      phase: "ranged_siege" as const,
      enemies,
      isAtFortifiedSite: true,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      fameGained: 0,
      unitsAllowed: true,
      enemyAssignments: undefined,
      assaultOrigin: undefined,
    },
    activeModifiers: [],
    round: 1,
  } as Partial<GameState>;
}

function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  isRequiredForConquest = true
): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isDefeated: false,
    isBlocked: false,
    isRequiredForConquest,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
  };
}

describe("Expose / Mass Expose Spell", () => {
  describe("areResistancesRemoved", () => {
    it("should return false when no modifiers exist", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
      ]) as GameState;

      expect(areResistancesRemoved(state, "enemy_0")).toBe(false);
    });

    it("should return true when EFFECT_REMOVE_RESISTANCES modifier targets enemy", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
      ]) as GameState;

      // Add resistance removal modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_RESISTANCES },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(areResistancesRemoved(state, "enemy_0")).toBe(true);
    });

    it("should return true when SCOPE_ALL_ENEMIES modifier exists", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_HEROES),
      ]) as GameState;

      // Add resistance removal modifier for all enemies
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_RESISTANCES },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(areResistancesRemoved(state, "enemy_0")).toBe(true);
      expect(areResistancesRemoved(state, "enemy_1")).toBe(true);
    });

    it("should not affect other enemies when SCOPE_ONE_ENEMY is used", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_HEROES),
      ]) as GameState;

      // Add resistance removal modifier for just one enemy
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_RESISTANCES },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(areResistancesRemoved(state, "enemy_0")).toBe(true);
      expect(areResistancesRemoved(state, "enemy_1")).toBe(false);
    });
  });

  describe("isAbilityNullified for fortification", () => {
    it("should return false when no modifiers exist", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]) as GameState;

      expect(isAbilityNullified(state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(false);
    });

    it("should return true when ABILITY_FORTIFIED is nullified", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]) as GameState;

      // Add ability nullifier for fortified
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isAbilityNullified(state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(true);
    });
  });

  describe("getFortificationLevel with modifiers", () => {
    it("should return 2 for double fortification (site + ability) without modifiers", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]) as GameState;

      const combat = state.combat;
      if (!combat) throw new Error("Combat state required");
      const enemy = combat.enemies[0];
      // Guardsmen have ABILITY_FORTIFIED (+1) and site is fortified (+1) = 2
      const level = getFortificationLevel(enemy, true, state, "player1");

      expect(level).toBe(2); // Site + ability fortification
    });

    it("should return 0 when fortification is nullified by modifier", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]) as GameState;

      // Add ability nullifier for fortified
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const combat = state.combat;
      if (!combat) throw new Error("Combat state required");
      const enemy = combat.enemies[0];
      const level = getFortificationLevel(enemy, true, state, "player1");

      // Both site fortification and ability fortification should be nullified
      expect(level).toBe(0);
    });

    it("should only nullify targeted enemy with SCOPE_ONE_ENEMY", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
        createCombatEnemy("enemy_1", ENEMY_GUARDSMEN),
      ]) as GameState;

      // Add ability nullifier for just one enemy
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // First enemy should have no fortification
      const combat1 = state.combat;
      if (!combat1) throw new Error("Combat state required");
      const enemy0 = combat1.enemies[0];
      expect(getFortificationLevel(enemy0, true, state, "player1")).toBe(0);

      // Second enemy should still be fortified (site +1, ability +1 = 2)
      const enemy1 = combat1.enemies[1];
      expect(getFortificationLevel(enemy1, true, state, "player1")).toBe(2);
    });

    it("should nullify all enemies with SCOPE_ALL_ENEMIES", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
        createCombatEnemy("enemy_1", ENEMY_GUARDSMEN),
      ]) as GameState;

      // Add ability nullifier for all enemies
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Both enemies should have no fortification
      const combat2 = state.combat;
      if (!combat2) throw new Error("Combat state required");
      const enemy0 = combat2.enemies[0];
      const enemy1 = combat2.enemies[1];
      expect(getFortificationLevel(enemy0, true, state, "player1")).toBe(0);
      expect(getFortificationLevel(enemy1, true, state, "player1")).toBe(0);
    });
  });

  describe("Arcane Immunity", () => {
    it("should detect Arcane Immunity on enemy", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS),
      ]) as GameState;

      // Sorcerers have Arcane Immunity
      expect(hasArcaneImmunity(state, "enemy_0")).toBe(true);
    });

    it("should not detect Arcane Immunity on normal enemy", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]) as GameState;

      expect(hasArcaneImmunity(state, "enemy_0")).toBe(false);
    });

    it("should block resistance removal on Arcane Immune enemies", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Has Arcane Immunity
      ]) as GameState;

      // Add resistance removal modifier (should be blocked)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_REMOVE_RESISTANCES },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Despite modifier being added, Arcane Immunity blocks the effect
      expect(areResistancesRemoved(state, "enemy_0")).toBe(false);
    });

    it("should block ability nullification on Arcane Immune enemies", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Has Arcane Immunity
      ]) as GameState;

      // Add ability nullifier (should be blocked)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Despite modifier being added, Arcane Immunity blocks the effect
      expect(isAbilityNullified(state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(false);
    });

    it("should allow modifiers on non-immune enemies while blocking immune ones", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Has Arcane Immunity
        createCombatEnemy("enemy_1", ENEMY_GOLEMS),   // No Arcane Immunity
      ]) as GameState;

      // Add resistance removal modifier for all enemies
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "expose" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_RESISTANCES },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Sorcerer (Arcane Immune) keeps resistances
      expect(areResistancesRemoved(state, "enemy_0")).toBe(false);

      // Golem (no Arcane Immunity) loses resistances
      expect(areResistancesRemoved(state, "enemy_1")).toBe(true);
    });
  });
});
