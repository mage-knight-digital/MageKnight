/**
 * Sword of Justice Tests
 *
 * Tests for:
 * - Basic effect: Discard for attack (Attack 3 per card)
 * - Basic effect: Fame +1 per enemy defeated this turn
 * - Powered effect: Double physical attacks in Attack phase
 * - Powered effect: Enemies lose physical resistance (not Arcane Immune)
 * - Powered effect: Artifact destroyed after use
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import {
  addModifier,
  isPhysicalResistanceRemoved,
  isPhysicalAttackDoubled,
  hasArcaneImmunity,
} from "../modifiers/index.js";
import { getEnemyResistances } from "../validActions/combatHelpers.js";
import {
  ENEMY_GOLEMS,
  ENEMY_SORCERERS,
  ENEMY_IRONCLADS,
  getEnemy,
  RESIST_PHYSICAL,
} from "@mage-knight/shared";
import {
  DURATION_COMBAT,
  EFFECT_DOUBLE_PHYSICAL_ATTACKS,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  SCOPE_ALL_ENEMIES,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";
import { CARD_WOUND } from "@mage-knight/shared";

// Helper to create a minimal combat state for modifier testing
function createCombatState(enemies: CombatEnemy[]): Partial<GameState> {
  return {
    combat: {
      phase: "attack" as const,
      enemies,
      isAtFortifiedSite: false,
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

describe("Sword of Justice", () => {
  describe("Discard for Attack Effect", () => {
    it("should filter out wound cards from eligible cards", () => {
      const hand = [
        "march" as CardId,
        CARD_WOUND,
        "rage" as CardId,
        CARD_WOUND,
        "swiftness" as CardId,
      ];

      const eligible = getCardsEligibleForDiscardForAttack(hand);

      expect(eligible).toHaveLength(3);
      expect(eligible).toContain("march");
      expect(eligible).toContain("rage");
      expect(eligible).toContain("swiftness");
      expect(eligible).not.toContain(CARD_WOUND);
    });

    it("should return empty array when all cards are wounds", () => {
      const hand = [CARD_WOUND, CARD_WOUND, CARD_WOUND];

      const eligible = getCardsEligibleForDiscardForAttack(hand);

      expect(eligible).toHaveLength(0);
    });

    it("should return empty array when hand is empty", () => {
      const hand: CardId[] = [];

      const eligible = getCardsEligibleForDiscardForAttack(hand);

      expect(eligible).toHaveLength(0);
    });
  });

  describe("Physical Resistance Removal", () => {
    it("should return false when no modifiers exist", () => {
      const state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS), // Has physical resistance
      ]) as GameState;

      expect(isPhysicalResistanceRemoved(state, "enemy_0")).toBe(false);
    });

    it("should return true when EFFECT_REMOVE_PHYSICAL_RESISTANCE modifier exists", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
      ]) as GameState;

      // Add physical resistance removal modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isPhysicalResistanceRemoved(state, "enemy_0")).toBe(true);
    });

    it("should not affect Arcane Immune enemies", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Has Arcane Immunity
      ]) as GameState;

      // Add physical resistance removal modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Sorcerer (Arcane Immune) should keep physical resistance
      expect(hasArcaneImmunity(state, "enemy_0")).toBe(true);
      expect(isPhysicalResistanceRemoved(state, "enemy_0")).toBe(false);
    });

    it("should affect enemies without Arcane Immunity", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_IRONCLADS), // Has physical resistance, no Arcane Immunity
      ]) as GameState;

      // Add physical resistance removal modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Ironclad should lose physical resistance
      expect(hasArcaneImmunity(state, "enemy_0")).toBe(false);
      expect(isPhysicalResistanceRemoved(state, "enemy_0")).toBe(true);
    });

    it("should only remove physical resistance, not other resistances", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_GOLEMS), // Has physical resistance
      ]) as GameState;

      // Add physical resistance removal modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const combat = state.combat;
      expect(combat).toBeDefined();
      const enemy = combat?.enemies[0];
      expect(enemy).toBeDefined();
      if (!enemy) throw new Error("Enemy not found");

      const effectiveResistances = getEnemyResistances(state, enemy);

      // Physical resistance should be removed
      expect(effectiveResistances).not.toContain(RESIST_PHYSICAL);

      // Check that the original definition still has physical resistance
      expect(enemy.definition.resistances).toContain(RESIST_PHYSICAL);
    });
  });

  describe("Physical Attack Doubling", () => {
    it("should return false when no modifiers exist", () => {
      const state = createCombatState([]) as GameState;

      expect(isPhysicalAttackDoubled(state, "player1")).toBe(false);
    });

    it("should return true when EFFECT_DOUBLE_PHYSICAL_ATTACKS modifier exists", () => {
      let state = createCombatState([]) as GameState;

      // Add double physical attacks modifier
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_DOUBLE_PHYSICAL_ATTACKS },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isPhysicalAttackDoubled(state, "player1")).toBe(true);
    });

    it("should only affect the player with the modifier", () => {
      let state = createCombatState([]) as GameState;

      // Add double physical attacks modifier for player1
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: { type: EFFECT_DOUBLE_PHYSICAL_ATTACKS },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      expect(isPhysicalAttackDoubled(state, "player1")).toBe(true);
      expect(isPhysicalAttackDoubled(state, "player2")).toBe(false);
    });
  });

  describe("Arcane Immunity interaction", () => {
    it("should allow modifiers on non-immune enemies while blocking immune ones", () => {
      let state = createCombatState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Has Arcane Immunity
        createCombatEnemy("enemy_1", ENEMY_GOLEMS),    // No Arcane Immunity
      ]) as GameState;

      // Add physical resistance removal modifier for all enemies
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "sword_of_justice" as CardId,
          playerId: "player1",
        },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: { type: EFFECT_REMOVE_PHYSICAL_RESISTANCE },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Sorcerer (Arcane Immune) keeps physical resistance
      expect(isPhysicalResistanceRemoved(state, "enemy_0")).toBe(false);

      // Golem (no Arcane Immunity) loses physical resistance
      expect(isPhysicalResistanceRemoved(state, "enemy_1")).toBe(true);
    });
  });
});
