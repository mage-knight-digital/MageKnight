/**
 * Arcane Immunity Tests
 *
 * Tests for Arcane Immunity ability enforcement on faction leaders
 * and other enemies with this ability (e.g., Sorcerers).
 *
 * Per rulebook: "The enemy is not affected by any non-Attack/non-Block effects
 * from any source (e.g., effects that destroy, prevent attacking, or reduce Armor).
 * Attacks and Blocks of any elements work normally."
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENEMY_SORCERERS,
  ENEMY_DIGGERS,
  ENEMY_ELEMENTALIST_LEADER,
  ENEMY_DARK_CRUSADER_LEADER,
  ABILITY_ARCANE_IMMUNITY,
} from "@mage-knight/shared";
import {
  resolveSelectCombatEnemy,
  resolveCombatEnemyTarget,
} from "../effects/combatEffects.js";
import { createCombatState } from "../../types/combat.js";
import {
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  DURATION_COMBAT,
} from "../../types/modifierConstants.js";
import { EFFECT_RESOLVE_COMBAT_ENEMY_TARGET } from "../../types/effectTypes.js";
import type { SelectCombatEnemyEffect, CombatEnemyTargetTemplate } from "../../types/cards.js";

describe("Arcane Immunity", () => {
  describe("Enemy targeting filtering", () => {
    it("should filter out Sorcerers from spell targeting when effect has modifiers", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity) and Diggers (no immunity)
      state = {
        ...state,
        combat: createCombatState([ENEMY_SORCERERS, ENEMY_DIGGERS], false),
      };

      // Create effect with armor reduction (should be blocked by Arcane Immunity)
      const effect: SelectCombatEnemyEffect = {
        type: "select_combat_enemy",
        includeDefeated: false,
        template: {
          modifiers: [
            {
              modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
              duration: DURATION_COMBAT,
              description: "Armor -2",
            },
          ],
        },
      };

      const result = resolveSelectCombatEnemy(state, effect);

      // Should only have Diggers as a valid target (Sorcerers are immune)
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const options = result.dynamicChoiceOptions;
      expect(options).toBeDefined();
      if (options && options.length > 0) {
        const option = options[0];
        expect(option).toBeDefined();
        expect(option.type).toBe(EFFECT_RESOLVE_COMBAT_ENEMY_TARGET);
        if (option.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET) {
          expect(option.enemyName).toBe("Diggers");
        }
      }
    });

    it("should filter out faction leader from spell targeting when effect defeats enemy", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with faction leader (has Arcane Immunity) and Diggers
      state = {
        ...state,
        combat: createCombatState([ENEMY_ELEMENTALIST_LEADER, ENEMY_DIGGERS], false),
      };

      // Create effect with defeat (should be blocked by Arcane Immunity)
      const effect: SelectCombatEnemyEffect = {
        type: "select_combat_enemy",
        includeDefeated: false,
        template: {
          defeat: true,
        },
      };

      const result = resolveSelectCombatEnemy(state, effect);

      // Should only have Diggers as a valid target
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const options = result.dynamicChoiceOptions;
      if (options && options.length > 0) {
        const option = options[0];
        if (option && option.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET) {
          expect(option.enemyName).toBe("Diggers");
        }
      }
    });

    it("should show immunity message when all enemies are immune", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with only Sorcerers (all immune)
      state = {
        ...state,
        combat: createCombatState([ENEMY_SORCERERS], false),
      };

      // Create effect with modifiers
      const effect: SelectCombatEnemyEffect = {
        type: "select_combat_enemy",
        includeDefeated: false,
        template: {
          modifiers: [
            {
              modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
              duration: DURATION_COMBAT,
            },
          ],
        },
      };

      const result = resolveSelectCombatEnemy(state, effect);

      // Should report that all enemies are immune
      expect(result.requiresChoice).toBeFalsy();
      expect(result.description).toContain("immune");
    });

    it("should allow targeting immune enemies with effects that have no restricted components", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers
      state = {
        ...state,
        combat: createCombatState([ENEMY_SORCERERS], false),
      };

      // Create effect with no modifiers or defeat (should be allowed)
      const effect: SelectCombatEnemyEffect = {
        type: "select_combat_enemy",
        includeDefeated: false,
        template: {},
      };

      const result = resolveSelectCombatEnemy(state, effect);

      // Should have Sorcerers as a valid target
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);
    });
  });

  describe("Effect resolution blocking", () => {
    it("should block modifiers on immune enemies at resolution time", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers
      state = {
        ...state,
        combat: createCombatState([ENEMY_SORCERERS], false),
      };

      // Try to resolve effect on Sorcerers (safety net check)
      const template: CombatEnemyTargetTemplate = {
        modifiers: [
          {
            modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
            duration: DURATION_COMBAT,
            description: "Armor -2",
          },
        ],
      };

      const result = resolveCombatEnemyTarget(
        state,
        "player1",
        {
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: "enemy_0",
          enemyName: "Sorcerers",
          template,
        }
      );

      // Should report immunity and not apply modifiers
      expect(result.description).toContain("immune");
      expect(result.description).toContain("Arcane Immunity");

      // Verify no modifiers were added
      expect(result.state.activeModifiers).toHaveLength(0);
    });

    it("should block defeat on immune enemies at resolution time", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with faction leader at level 2
      state = {
        ...state,
        combat: createCombatState(
          [{ enemyId: ENEMY_ELEMENTALIST_LEADER, level: 2 }],
          false
        ),
      };

      // Try to resolve defeat effect on faction leader
      const template: CombatEnemyTargetTemplate = {
        defeat: true,
      };

      const result = resolveCombatEnemyTarget(
        state,
        "player1",
        {
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: "enemy_0",
          enemyName: "Elementalist",
          template,
        }
      );

      // Should report immunity
      expect(result.description).toContain("immune");

      // Enemy should NOT be defeated
      const combat = result.state.combat;
      expect(combat).toBeDefined();
      if (combat) {
        const enemy = combat.enemies[0];
        expect(enemy).toBeDefined();
        if (enemy) {
          expect(enemy.isDefeated).toBe(false);
        }
      }
    });

    it("should allow effects with no restricted components on immune enemies", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers
      state = {
        ...state,
        combat: createCombatState([ENEMY_SORCERERS], false),
      };

      // Resolve effect with empty template
      const result = resolveCombatEnemyTarget(
        state,
        "player1",
        {
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: "enemy_0",
          enemyName: "Sorcerers",
          template: {},
        }
      );

      // Should not report immunity
      expect(result.description).not.toContain("immune");
      expect(result.description).toContain("Sorcerers");
    });
  });

  describe("Regular enemies (no immunity)", () => {
    it("should allow modifiers on non-immune enemies", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (no immunity)
      state = {
        ...state,
        combat: createCombatState([ENEMY_DIGGERS], false),
      };

      // Resolve effect with armor reduction
      const template: CombatEnemyTargetTemplate = {
        modifiers: [
          {
            modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
            duration: DURATION_COMBAT,
            description: "Armor -2",
          },
        ],
      };

      const result = resolveCombatEnemyTarget(
        state,
        "player1",
        {
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: "enemy_0",
          enemyName: "Diggers",
          template,
        }
      );

      // Should not report immunity
      expect(result.description).not.toContain("immune");
      expect(result.description).toContain("Armor -2");

      // Modifier should be added
      expect(result.state.activeModifiers.length).toBeGreaterThan(0);
    });

    it("should allow defeat on non-immune enemies", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers
      state = {
        ...state,
        combat: createCombatState([ENEMY_DIGGERS], false),
      };

      const template: CombatEnemyTargetTemplate = {
        defeat: true,
      };

      const result = resolveCombatEnemyTarget(
        state,
        "player1",
        {
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: "enemy_0",
          enemyName: "Diggers",
          template,
        }
      );

      // Enemy should be defeated
      const combat = result.state.combat;
      expect(combat).toBeDefined();
      if (combat) {
        const enemy = combat.enemies[0];
        expect(enemy).toBeDefined();
        if (enemy) {
          expect(enemy.isDefeated).toBe(true);
        }
      }
      expect(result.description).toContain("Defeated");
    });
  });

  describe("Ability verification", () => {
    it("should verify Sorcerers have Arcane Immunity", () => {
      const combat = createCombatState([ENEMY_SORCERERS], false);
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        expect(enemy.definition.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
      }
    });

    it("should verify faction leaders have Arcane Immunity", () => {
      const elementalistCombat = createCombatState([ENEMY_ELEMENTALIST_LEADER], false);
      const darkCrusaderCombat = createCombatState([ENEMY_DARK_CRUSADER_LEADER], false);

      const elementalist = elementalistCombat.enemies[0];
      const darkCrusader = darkCrusaderCombat.enemies[0];

      expect(elementalist).toBeDefined();
      expect(darkCrusader).toBeDefined();
      if (elementalist) {
        expect(elementalist.definition.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
      }
      if (darkCrusader) {
        expect(darkCrusader.definition.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
      }
    });

    it("should verify Diggers do NOT have Arcane Immunity", () => {
      const combat = createCombatState([ENEMY_DIGGERS], false);
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        expect(enemy.definition.abilities).not.toContain(ABILITY_ARCANE_IMMUNITY);
      }
    });
  });
});
