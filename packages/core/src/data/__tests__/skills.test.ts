/**
 * Tests for skill definitions and effects
 */

import { describe, it, expect } from "vitest";
import {
  SKILLS,
  SKILL_ARYTHEA_DARK_PATHS,
  getSkillDefinition,
} from "../skills/index.js";
import { CARD_CATEGORY_MOVEMENT } from "../../types/cards.js";
import { EFFECT_CONDITIONAL, EFFECT_GAIN_MOVE } from "../../types/effectTypes.js";
import { CONDITION_IS_NIGHT_OR_UNDERGROUND } from "../../types/conditions.js";
import { resolveEffect } from "../../engine/effects/index.js";
import { createTestGameState } from "../../engine/__tests__/testHelpers.js";
import { createCombatState } from "../../types/combat.js";
import { TIME_OF_DAY_DAY, TIME_OF_DAY_NIGHT, ENEMY_PROWLERS } from "@mage-knight/shared";

describe("Skill Definitions", () => {
  describe("Dark Paths (Arythea)", () => {
    const skill = SKILLS[SKILL_ARYTHEA_DARK_PATHS];

    it("should have correct metadata", () => {
      expect(skill.id).toBe(SKILL_ARYTHEA_DARK_PATHS);
      expect(skill.name).toBe("Dark Paths");
      expect(skill.heroId).toBe("arythea");
      expect(skill.description).toBe("Move 1 (Day) or Move 2 (Night)");
      expect(skill.usageType).toBe("once_per_turn");
    });

    it("should have Movement category", () => {
      expect(skill.categories).toEqual([CARD_CATEGORY_MOVEMENT]);
    });

    it("should have a conditional effect based on night/underground", () => {
      expect(skill.effect).toBeDefined();
      expect(skill.effect?.type).toBe(EFFECT_CONDITIONAL);
      if (skill.effect?.type === EFFECT_CONDITIONAL) {
        expect(skill.effect.condition.type).toBe(CONDITION_IS_NIGHT_OR_UNDERGROUND);
        expect(skill.effect.thenEffect.type).toBe(EFFECT_GAIN_MOVE);
        expect(skill.effect.elseEffect?.type).toBe(EFFECT_GAIN_MOVE);
      }
    });

    it("should grant Move 2 when thenEffect (night/underground)", () => {
      expect(skill.effect?.type).toBe(EFFECT_CONDITIONAL);
      if (skill.effect?.type === EFFECT_CONDITIONAL) {
        const thenEffect = skill.effect.thenEffect;
        expect(thenEffect.type).toBe(EFFECT_GAIN_MOVE);
        if (thenEffect.type === EFFECT_GAIN_MOVE) {
          expect(thenEffect.amount).toBe(2);
        }
      }
    });

    it("should grant Move 1 when elseEffect (day)", () => {
      expect(skill.effect?.type).toBe(EFFECT_CONDITIONAL);
      if (skill.effect?.type === EFFECT_CONDITIONAL) {
        const elseEffect = skill.effect.elseEffect;
        expect(elseEffect?.type).toBe(EFFECT_GAIN_MOVE);
        if (elseEffect?.type === EFFECT_GAIN_MOVE) {
          expect(elseEffect.amount).toBe(1);
        }
      }
    });

    it("should be retrievable via getSkillDefinition", () => {
      const retrieved = getSkillDefinition(SKILL_ARYTHEA_DARK_PATHS);
      expect(retrieved).toEqual(skill);
    });
  });

  describe("Dark Paths effect resolution", () => {
    const skill = SKILLS[SKILL_ARYTHEA_DARK_PATHS];

    function getEffect() {
      if (!skill.effect) throw new Error("Dark Paths should have an effect");
      return skill.effect;
    }

    it("should grant Move 1 during day", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat: null });
      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      expect(result.state.players[0]?.movePoints).toBe(5); // 4 base + 1
    });

    it("should grant Move 2 during night", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2
    });

    it("should grant Move 2 in dungeon combat during day", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        nightManaRules: true, // Dungeon
      };
      const state = createTestGameState({
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 (dungeon = night)
    });

    it("should grant Move 2 in tomb combat during day", () => {
      // Tombs also have nightManaRules = true
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        nightManaRules: true, // Tomb
      };
      const state = createTestGameState({
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 (tomb = night)
    });

    it("should grant Move 1 in monster den combat during day", () => {
      // Monster dens do NOT have night mana rules
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        nightManaRules: false,
      };
      const state = createTestGameState({
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      expect(result.state.players[0]?.movePoints).toBe(5); // 4 base + 1 (day rules)
    });

    it("movement points are standalone (added to accumulator)", () => {
      // "Standalone" means the movement points can be used independently
      // without needing to tack onto other movement - they simply add to movePoints
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const initialMovePoints = state.players[0]?.movePoints ?? 0;

      const result = resolveEffect(state, "player1", getEffect(), SKILL_ARYTHEA_DARK_PATHS);

      // Move points added directly (standalone)
      expect(result.state.players[0]?.movePoints).toBe(initialMovePoints + 2);
    });
  });
});
