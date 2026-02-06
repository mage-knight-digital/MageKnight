/**
 * Demolish / Disintegrate Spell Tests
 *
 * Tests for:
 * - Card definition and registration
 * - Basic (Demolish): Ignore site fortifications + Armor -1 to all enemies
 * - Powered (Disintegrate): Destroy target enemy + conditional Armor -1
 * - Fire Resistance exclusion for armor reduction
 * - Arcane Immunity blocking
 * - Phase restriction for powered effect
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_DEMOLISH,
  ENEMY_DIGGERS,
  ENEMY_FIRE_MAGES,
  ENEMY_SORCERERS,
  ENEMY_WOLF_RIDERS,
  RESIST_FIRE,
  getEnemy,
} from "@mage-knight/shared";
import { DEMOLISH } from "../../data/spells/red/demolish.js";
import { getSpellCard } from "../../data/spells/index.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  MANA_RED,
  MANA_BLACK,
} from "@mage-knight/shared";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import { getEffectiveEnemyArmor } from "../modifiers/combat.js";
import {
  addModifier,
} from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ALL_ENEMIES,
  SOURCE_CARD,
  RULE_IGNORE_FORTIFICATION,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
} from "../../types/combat.js";
import { isRuleActive } from "../modifiers/index.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

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

function createStateWithCombat(
  enemies: CombatEnemy[],
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_BLOCK = COMBAT_PHASE_RANGED_SIEGE,
  isAtFortifiedSite = false
): GameState {
  const player = createTestPlayer({ id: "player1" });
  const state = createTestGameState({ players: [player] });
  return {
    ...state,
    combat: {
      phase,
      enemies,
      isAtFortifiedSite,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      fameGained: 0,
      unitsAllowed: true,
      enemyAssignments: undefined,
      assaultOrigin: undefined,
    },
    activeModifiers: [],
  };
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Demolish / Disintegrate Spell", () => {
  describe("card definition", () => {
    it("should be registered in spell cards", () => {
      const card = getSpellCard(CARD_DEMOLISH);
      expect(card).toBeDefined();
      expect(card?.name).toBe("Demolish");
    });

    it("should have correct metadata", () => {
      expect(DEMOLISH.id).toBe(CARD_DEMOLISH);
      expect(DEMOLISH.name).toBe("Demolish");
      expect(DEMOLISH.poweredName).toBe("Disintegrate");
      expect(DEMOLISH.cardType).toBe(DEED_CARD_TYPE_SPELL);
      expect(DEMOLISH.sidewaysValue).toBe(1);
    });

    it("should be powered by black + red mana", () => {
      expect(DEMOLISH.poweredBy).toEqual([MANA_BLACK, MANA_RED]);
    });

    it("should have combat category", () => {
      expect(DEMOLISH.categories).toEqual([CATEGORY_COMBAT]);
    });
  });

  // ============================================================================
  // BASIC EFFECT: DEMOLISH
  // ============================================================================

  describe("basic effect (Demolish)", () => {
    const basicEffect = DEMOLISH.basicEffect;

    describe("ignore site fortifications", () => {
      it("should apply RULE_IGNORE_FORTIFICATION modifier", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
        ], COMBAT_PHASE_RANGED_SIEGE, true);

        const result = resolveEffect(state, "player1", basicEffect);

        // Should have applied the ignore fortification modifier
        expect(isRuleActive(result.state, "player1", RULE_IGNORE_FORTIFICATION)).toBe(true);
      });
    });

    describe("armor reduction", () => {
      it("should reduce armor by 1 for normal enemies", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // armor 4, no resistances
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        const effectiveArmor = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_WOLF_RIDERS).armor,
          0,
          "player1"
        );
        expect(effectiveArmor).toBe(3); // 4 - 1 = 3
      });

      it("should reduce armor for all enemies", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // armor 4
          createCombatEnemy("enemy_1", ENEMY_DIGGERS), // armor 3, no fire resistance
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        const armor0 = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_WOLF_RIDERS).armor,
          0,
          "player1"
        );
        const armor1 = getEffectiveEnemyArmor(
          result.state,
          "enemy_1",
          getEnemy(ENEMY_DIGGERS).armor,
          0,
          "player1"
        );
        expect(armor0).toBe(3); // 4 - 1
        expect(armor1).toBe(2); // 3 - 1
      });

      it("should not reduce armor below minimum of 1", () => {
        // Create state with an enemy at armor 1 (simulated through modifier)
        let state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // armor 4
        ]);

        // Pre-apply a -3 armor modifier to bring it to 1
        state = addModifier(state, {
          source: { type: SOURCE_CARD, cardId: "test" as CardId, playerId: "player1" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ALL_ENEMIES },
          effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -3, minimum: 1 },
          createdAtRound: 1,
          createdByPlayerId: "player1",
        });

        const result = resolveEffect(state, "player1", basicEffect);

        const effectiveArmor = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_WOLF_RIDERS).armor,
          0,
          "player1"
        );
        // 4 - 3 - 1 = 0, but minimum is 1
        expect(effectiveArmor).toBe(1);
      });
    });

    describe("fire resistance", () => {
      it("should NOT reduce armor for Fire Resistant enemies", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // has Fire Resistance
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        const effectiveArmor = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_FIRE_MAGES).armor,
          getEnemy(ENEMY_FIRE_MAGES).resistances.length,
          "player1"
        );
        // Fire Mages armor = 5, should stay 5 (no reduction due to Fire Resistance)
        expect(effectiveArmor).toBe(5);
      });

      it("should reduce armor for non-resistant enemies while skipping resistant ones", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // no resistances
          createCombatEnemy("enemy_1", ENEMY_FIRE_MAGES), // Fire Resistant
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        const armor0 = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_WOLF_RIDERS).armor,
          0,
          "player1"
        );
        const armor1 = getEffectiveEnemyArmor(
          result.state,
          "enemy_1",
          getEnemy(ENEMY_FIRE_MAGES).armor,
          getEnemy(ENEMY_FIRE_MAGES).resistances.length,
          "player1"
        );
        expect(armor0).toBe(3); // 4 - 1 = reduced
        expect(armor1).toBe(5); // unchanged - Fire Resistant
      });

      it("should still ignore fortifications against Fire Resistant enemies", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
        ], COMBAT_PHASE_RANGED_SIEGE, true);

        const result = resolveEffect(state, "player1", basicEffect);

        // Fortification bypass targets the site structure, not the enemy
        expect(isRuleActive(result.state, "player1", RULE_IGNORE_FORTIFICATION)).toBe(true);
      });
    });

    describe("arcane immunity", () => {
      it("should NOT reduce armor for Arcane Immune enemies", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
        ]);

        const result = resolveEffect(state, "player1", basicEffect);

        const effectiveArmor = getEffectiveEnemyArmor(
          result.state,
          "enemy_0",
          getEnemy(ENEMY_SORCERERS).armor,
          getEnemy(ENEMY_SORCERERS).resistances.length,
          "player1"
        );
        // Sorcerers armor = 6, should stay 6 (Arcane Immunity blocks modifiers)
        expect(effectiveArmor).toBe(6);
      });
    });

    describe("resolvability", () => {
      it("should be resolvable when in combat", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ]);
        expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
      });

      it("should be resolvable even without combat (fortification modifier still applies)", () => {
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({ players: [player] });
        // Compound effects are resolvable if any sub-effect is resolvable
        // The fortification modifier applies regardless of combat
        expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
      });
    });
  });

  // ============================================================================
  // POWERED EFFECT: DISINTEGRATE
  // ============================================================================

  describe("powered effect (Disintegrate)", () => {
    const poweredEffect = DEMOLISH.poweredEffect;

    describe("phase restriction", () => {
      it("should NOT be resolvable in ranged/siege phase", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ], COMBAT_PHASE_RANGED_SIEGE);
        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });

      it("should NOT be resolvable in block phase", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ], COMBAT_PHASE_BLOCK);
        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });

      it("should be resolvable in attack phase", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ], COMBAT_PHASE_ATTACK);
        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(true);
      });
    });

    describe("enemy destruction", () => {
      it("should present enemy choices for destruction", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ], COMBAT_PHASE_ATTACK);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toBeDefined();
        expect(result.dynamicChoiceOptions!.length).toBe(2);
      });

      it("should defeat selected enemy and apply armor reduction to all", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // armor 4
          createCombatEnemy("enemy_1", ENEMY_DIGGERS), // armor 3
        ], COMBAT_PHASE_ATTACK);

        // Resolve entry effect (select enemy)
        const selectResult = resolveEffect(state, "player1", poweredEffect);
        expect(selectResult.dynamicChoiceOptions).toBeDefined();

        // Choose first enemy
        const choiceEffect = selectResult.dynamicChoiceOptions![0]!;
        const result = resolveEffect(selectResult.state, "player1", choiceEffect);

        // First enemy should be defeated
        expect(result.state.combat?.enemies[0]?.isDefeated).toBe(true);
        // Second enemy should NOT be defeated
        expect(result.state.combat?.enemies[1]?.isDefeated).toBe(false);

        // Armor reduction applied to all enemies (via bundled effect)
        const armor1 = getEffectiveEnemyArmor(
          result.state,
          "enemy_1",
          getEnemy(ENEMY_DIGGERS).armor,
          0,
          "player1"
        );
        expect(armor1).toBe(2); // 3 - 1 = 2
      });

      it("should award fame for defeated enemy", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // 3 fame
        ], COMBAT_PHASE_ATTACK);

        const selectResult = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = selectResult.dynamicChoiceOptions![0]!;
        const result = resolveEffect(selectResult.state, "player1", choiceEffect);

        const player = result.state.players.find((p) => p.id === "player1");
        expect(player?.fame).toBe(3);
        expect(result.state.combat?.fameGained).toBe(3);
      });
    });

    describe("fire resistance", () => {
      it("should NOT allow targeting Fire Resistant enemies for destruction", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // Fire Resistant
        ], COMBAT_PHASE_ATTACK);

        // Not resolvable - no valid targets
        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });

      it("should exclude Fire Resistant enemies from choices", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // Fire Resistant - excluded
          createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS), // Valid target
        ], COMBAT_PHASE_ATTACK);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.dynamicChoiceOptions!.length).toBe(1);
      });

      it("should NOT reduce armor for Fire Resistant enemies (via bundled effect)", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // Valid target
          createCombatEnemy("enemy_1", ENEMY_FIRE_MAGES), // Fire Resistant
        ], COMBAT_PHASE_ATTACK);

        const selectResult = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = selectResult.dynamicChoiceOptions![0]!;
        const result = resolveEffect(selectResult.state, "player1", choiceEffect);

        // Fire Resistant enemy's armor should be unchanged
        const armor1 = getEffectiveEnemyArmor(
          result.state,
          "enemy_1",
          getEnemy(ENEMY_FIRE_MAGES).armor,
          getEnemy(ENEMY_FIRE_MAGES).resistances.length,
          "player1"
        );
        expect(armor1).toBe(5); // unchanged
      });
    });

    describe("arcane immunity", () => {
      it("should NOT allow targeting Arcane Immune enemies for destruction", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
        ], COMBAT_PHASE_ATTACK);

        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });

      it("should exclude Arcane Immune enemies from choices", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune - excluded
          createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS), // Valid target
        ], COMBAT_PHASE_ATTACK);

        const result = resolveEffect(state, "player1", poweredEffect);

        expect(result.dynamicChoiceOptions!.length).toBe(1);
      });

      it("should NOT reduce armor for Arcane Immune enemies (via bundled effect)", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // Valid target
          createCombatEnemy("enemy_1", ENEMY_SORCERERS), // Arcane Immune
        ], COMBAT_PHASE_ATTACK);

        const selectResult = resolveEffect(state, "player1", poweredEffect);
        const choiceEffect = selectResult.dynamicChoiceOptions![0]!;
        const result = resolveEffect(selectResult.state, "player1", choiceEffect);

        // Arcane Immune enemy's armor should be unchanged
        const armor1 = getEffectiveEnemyArmor(
          result.state,
          "enemy_1",
          getEnemy(ENEMY_SORCERERS).armor,
          getEnemy(ENEMY_SORCERERS).resistances.length,
          "player1"
        );
        expect(armor1).toBe(6); // unchanged
      });
    });

    describe("resolvability", () => {
      it("should NOT be resolvable outside combat", () => {
        const player = createTestPlayer({ id: "player1" });
        const state = createTestGameState({ players: [player] });
        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });

      it("should NOT be resolvable when all enemies are defeated", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
        ], COMBAT_PHASE_ATTACK);

        // Mark enemy defeated
        const updatedState = {
          ...state,
          combat: {
            ...state.combat!,
            enemies: state.combat!.enemies.map((e) => ({ ...e, isDefeated: true })),
          },
        };

        expect(isEffectResolvable(updatedState, "player1", poweredEffect)).toBe(false);
      });

      it("should NOT be resolvable when only Fire Resistant and Arcane Immune enemies remain", () => {
        const state = createStateWithCombat([
          createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
          createCombatEnemy("enemy_1", ENEMY_SORCERERS),
        ], COMBAT_PHASE_ATTACK);

        expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
      });
    });
  });

  // ============================================================================
  // MODIFIER QUERY: excludeResistance on EnemyStatModifier
  // ============================================================================

  describe("excludeResistance on EnemyStatModifier", () => {
    it("should skip armor reduction for enemies with the excluded resistance", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // Fire Resistant
      ]);

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "demolish" as CardId, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
          excludeResistance: RESIST_FIRE,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_0",
        getEnemy(ENEMY_FIRE_MAGES).armor,
        getEnemy(ENEMY_FIRE_MAGES).resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(5); // unchanged
    });

    it("should apply armor reduction for enemies without the excluded resistance", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // no resistances
      ]);

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "demolish" as CardId, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ALL_ENEMIES },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
          excludeResistance: RESIST_FIRE,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      const effectiveArmor = getEffectiveEnemyArmor(
        state,
        "enemy_0",
        getEnemy(ENEMY_WOLF_RIDERS).armor,
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(3); // 4 - 1 = 3
    });
  });
});
