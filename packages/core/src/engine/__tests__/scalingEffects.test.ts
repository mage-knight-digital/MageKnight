/**
 * Tests for scaling effects system
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { evaluateScalingFactor } from "../effects/scalingEvaluator.js";
import { resolveEffect } from "../effects/resolveEffect.js";
import {
  SCALING_PER_ENEMY,
  SCALING_PER_WOUND_IN_HAND,
  SCALING_PER_UNIT,
} from "../../types/scaling.js";
import { createCombatState } from "../../types/combat.js";
import { createPlayerUnit } from "../../types/unit.js";
import {
  CARD_WOUND,
  CARD_MARCH,
  ENEMY_PROWLERS,
  ENEMY_ALTEM_GUARDSMEN,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  ELEMENT_FIRE,
} from "@mage-knight/shared";
import {
  fireAttackPerEnemy,
  fireBlockPerEnemy,
  attackPerWoundInHand,
  attackPerUnit,
  blockPerUnit,
  blockPerEnemy,
  scaling,
  scalingAttack,
} from "../../data/effectHelpers.js";
import { FLAME_WAVE } from "../../data/testCards.js";
import { EFFECT_GAIN_ATTACK, EFFECT_GAIN_BLOCK, EFFECT_CHOICE } from "../../types/effectTypes.js";
import type { ChoiceEffect, ScalingEffect } from "../../types/cards.js";

describe("Scaling Effects", () => {
  describe("evaluateScalingFactor", () => {
    describe("SCALING_PER_ENEMY", () => {
      it("should return 0 when not in combat", () => {
        const state = createTestGameState({ combat: null });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY });
        expect(count).toBe(0);
      });

      it("should count undefeated enemies in combat", () => {
        const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]);
        const state = createTestGameState({ combat });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY });
        expect(count).toBe(3);
      });

      it("should not count defeated enemies", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN]),
          enemies: [
            {
              instanceId: "enemy_0",
              enemyId: ENEMY_PROWLERS,
              definition: { id: ENEMY_PROWLERS, armor: 4, attack: 3 },
              isBlocked: false,
              isDefeated: false,
              damageAssigned: false,
            },
            {
              instanceId: "enemy_1",
              enemyId: ENEMY_ALTEM_GUARDSMEN,
              definition: { id: ENEMY_ALTEM_GUARDSMEN, armor: 3, attack: 3 },
              isBlocked: false,
              isDefeated: true, // This one is defeated
              damageAssigned: false,
            },
          ],
        };
        const state = createTestGameState({ combat });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY });
        expect(count).toBe(1);
      });
    });

    describe("SCALING_PER_WOUND_IN_HAND", () => {
      it("should return 0 when no wounds in hand", () => {
        const player = createTestPlayer({ hand: [CARD_MARCH, CARD_MARCH] });
        const state = createTestGameState({ players: [player] });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_IN_HAND });
        expect(count).toBe(0);
      });

      it("should count wounds in hand", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND, CARD_MARCH, CARD_WOUND, CARD_WOUND],
        });
        const state = createTestGameState({ players: [player] });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_WOUND_IN_HAND });
        expect(count).toBe(3);
      });
    });

    describe("SCALING_PER_UNIT", () => {
      it("should return 0 when no units", () => {
        const player = createTestPlayer({ units: [] });
        const state = createTestGameState({ players: [player] });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_UNIT });
        expect(count).toBe(0);
      });

      it("should count non-wounded units", () => {
        const player = createTestPlayer({
          units: [
            createPlayerUnit(UNIT_PEASANTS),
            createPlayerUnit(UNIT_FORESTERS),
            createPlayerUnit(UNIT_PEASANTS),
          ],
        });
        const state = createTestGameState({ players: [player] });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_UNIT });
        expect(count).toBe(3);
      });

      it("should not count wounded units", () => {
        const woundedUnit = { ...createPlayerUnit(UNIT_PEASANTS), wounded: true };
        const player = createTestPlayer({
          units: [
            createPlayerUnit(UNIT_PEASANTS),
            woundedUnit,
            createPlayerUnit(UNIT_FORESTERS),
          ],
        });
        const state = createTestGameState({ players: [player] });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_UNIT });
        expect(count).toBe(2);
      });
    });

    describe("unknown player", () => {
      it("should return 0 for unknown player", () => {
        const state = createTestGameState();
        const count = evaluateScalingFactor(state, "unknown_player", { type: SCALING_PER_ENEMY });
        expect(count).toBe(0);
      });
    });
  });

  describe("resolveEffect with scaling", () => {
    describe("fireAttackPerEnemy", () => {
      it("should apply base attack when no enemies", () => {
        const state = createTestGameState({ combat: null });
        const effect = fireAttackPerEnemy(5, 2); // 5 base + 2 per enemy

        const result = resolveEffect(state, "player1", effect, "flame_wave");

        // 5 base + (2 × 0 enemies) = 5
        expect(result.state.players[0]?.combatAccumulator.attack.normalElements.fire).toBe(5);
      });

      it("should scale attack by enemy count", () => {
        const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]);
        const state = createTestGameState({ combat });
        const effect = fireAttackPerEnemy(5, 2); // 5 base + 2 per enemy

        const result = resolveEffect(state, "player1", effect, "flame_wave");

        // 5 base + (2 × 3 enemies) = 11
        expect(result.state.players[0]?.combatAccumulator.attack.normalElements.fire).toBe(11);
      });

      it("should mark result as containsScaling", () => {
        const state = createTestGameState({ combat: null });
        const effect = fireAttackPerEnemy(5, 2);

        const result = resolveEffect(state, "player1", effect, "flame_wave");

        expect(result.containsScaling).toBe(true);
      });
    });

    describe("fireBlockPerEnemy", () => {
      it("should apply base block when no enemies", () => {
        const state = createTestGameState({ combat: null });
        const effect = fireBlockPerEnemy(7, 2); // 7 base + 2 per enemy

        const result = resolveEffect(state, "player1", effect, "flame_wave");

        // 7 base + (2 × 0 enemies) = 7
        expect(result.state.players[0]?.combatAccumulator.blockElements.fire).toBe(7);
      });

      it("should scale block by enemy count", () => {
        const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN]);
        const state = createTestGameState({ combat });
        const effect = fireBlockPerEnemy(7, 2); // 7 base + 2 per enemy

        const result = resolveEffect(state, "player1", effect, "flame_wave");

        // 7 base + (2 × 2 enemies) = 11
        expect(result.state.players[0]?.combatAccumulator.blockElements.fire).toBe(11);
      });
    });

    describe("attackPerWoundInHand", () => {
      it("should scale attack by wounds in hand", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        });
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ players: [player], combat });
        const effect = attackPerWoundInHand(0, 2); // 2 per wound

        const result = resolveEffect(state, "player1", effect, "blood_ritual");

        // 0 base + (2 × 2 wounds) = 4
        expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(4);
      });
    });

    describe("attackPerUnit", () => {
      it("should scale attack by unit count", () => {
        const player = createTestPlayer({
          units: [
            createPlayerUnit(UNIT_PEASANTS),
            createPlayerUnit(UNIT_FORESTERS),
          ],
        });
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ players: [player], combat });
        const effect = attackPerUnit(2, 1); // 2 base + 1 per unit

        const result = resolveEffect(state, "player1", effect, "shocktroops");

        // 2 base + (1 × 2 units) = 4
        expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(4);
      });
    });

    describe("blockPerUnit", () => {
      it("should scale block by unit count", () => {
        const player = createTestPlayer({
          units: [
            createPlayerUnit(UNIT_PEASANTS),
            createPlayerUnit(UNIT_FORESTERS),
            createPlayerUnit(UNIT_PEASANTS),
          ],
        });
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ players: [player], combat });
        const effect = blockPerUnit(1, 2); // 1 base + 2 per unit

        const result = resolveEffect(state, "player1", effect, "test");

        // 1 base + (2 × 3 units) = 7
        expect(result.state.players[0]?.combatAccumulator.block).toBe(7);
      });
    });
  });

  describe("scaling limits", () => {
    it("should apply minimum", () => {
      const effect = scalingAttack(0, { type: SCALING_PER_ENEMY }, 2, undefined, "melee", { minimum: 3 });
      const state = createTestGameState({ combat: null }); // 0 enemies

      const result = resolveEffect(state, "player1", effect, "test");

      // Would be 0, but minimum is 3
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(3);
    });

    it("should apply maximum", () => {
      const combat = createCombatState([
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
      ]); // 5 enemies
      const effect = scalingAttack(0, { type: SCALING_PER_ENEMY }, 2, undefined, "melee", { maximum: 6 });
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", effect, "test");

      // Would be 10 (5 × 2), but maximum is 6
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(6);
    });

    it("should apply both minimum and maximum", () => {
      const effect = scalingAttack(0, { type: SCALING_PER_ENEMY }, 2, undefined, "melee", {
        minimum: 2,
        maximum: 8,
      });

      // Test minimum
      const stateNoEnemies = createTestGameState({ combat: null });
      const resultMin = resolveEffect(stateNoEnemies, "player1", effect, "test");
      expect(resultMin.state.players[0]?.combatAccumulator.attack.normal).toBe(2);

      // Test maximum
      const combatManyEnemies = createCombatState([
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
        ENEMY_PROWLERS,
      ]); // 6 enemies = 12, capped at 8
      const stateManyEnemies = createTestGameState({ combat: combatManyEnemies });
      const resultMax = resolveEffect(stateManyEnemies, "player1", effect, "test");
      expect(resultMax.state.players[0]?.combatAccumulator.attack.normal).toBe(8);
    });
  });

  describe("FLAME_WAVE card integration (corrected)", () => {
    it("should have choice basic effect (Fire Attack 5 OR Fire Block 7)", () => {
      const effect = FLAME_WAVE.basicEffect;
      expect(effect.type).toBe(EFFECT_CHOICE);
      if (effect.type === EFFECT_CHOICE) {
        const choiceEffect = effect as ChoiceEffect;
        expect(choiceEffect.options).toHaveLength(2);

        // First option: Fire Attack 5
        const attackOption = choiceEffect.options[0];
        expect(attackOption?.type).toBe(EFFECT_GAIN_ATTACK);
        if (attackOption?.type === EFFECT_GAIN_ATTACK) {
          expect(attackOption.amount).toBe(5);
          expect(attackOption.element).toBe(ELEMENT_FIRE);
        }

        // Second option: Fire Block 7
        const blockOption = choiceEffect.options[1];
        expect(blockOption?.type).toBe(EFFECT_GAIN_BLOCK);
        if (blockOption?.type === EFFECT_GAIN_BLOCK) {
          expect(blockOption.amount).toBe(7);
          expect(blockOption.element).toBe(ELEMENT_FIRE);
        }
      }
    });

    it("should have choice powered effect with scaling options", () => {
      const effect = FLAME_WAVE.poweredEffect;
      expect(effect.type).toBe(EFFECT_CHOICE);
      if (effect.type === EFFECT_CHOICE) {
        const choiceEffect = effect as ChoiceEffect;
        expect(choiceEffect.options).toHaveLength(2);

        // Both options should be scaling effects
        const attackOption = choiceEffect.options[0] as ScalingEffect;
        expect(attackOption?.type).toBe("scaling");
        expect(attackOption?.scalingFactor.type).toBe(SCALING_PER_ENEMY);

        const blockOption = choiceEffect.options[1] as ScalingEffect;
        expect(blockOption?.type).toBe("scaling");
        expect(blockOption?.scalingFactor.type).toBe(SCALING_PER_ENEMY);
      }
    });

    it("should produce 11 fire attack with 3 enemies when attack option chosen (5 + 2×3)", () => {
      const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]);
      const state = createTestGameState({ combat });

      // Get the attack option from the powered effect choice
      const poweredEffect = FLAME_WAVE.poweredEffect as ChoiceEffect;
      const attackOption = poweredEffect.options[0];
      if (!attackOption) throw new Error("Attack option not found");

      const result = resolveEffect(state, "player1", attackOption, "flame_wave");

      expect(result.state.players[0]?.combatAccumulator.attack.normalElements.fire).toBe(11);
    });

    it("should produce 11 fire block with 2 enemies when block option chosen (7 + 2×2)", () => {
      const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN]);
      const state = createTestGameState({ combat });

      // Get the block option from the powered effect choice
      const poweredEffect = FLAME_WAVE.poweredEffect as ChoiceEffect;
      const blockOption = poweredEffect.options[1];
      if (!blockOption) throw new Error("Block option not found");

      const result = resolveEffect(state, "player1", blockOption, "flame_wave");

      expect(result.state.players[0]?.combatAccumulator.blockElements.fire).toBe(11);
    });

    it("should produce 5 fire attack with 0 enemies (just base)", () => {
      const state = createTestGameState({ combat: null });

      const poweredEffect = FLAME_WAVE.poweredEffect as ChoiceEffect;
      const attackOption = poweredEffect.options[0];
      if (!attackOption) throw new Error("Attack option not found");

      const result = resolveEffect(state, "player1", attackOption, "flame_wave");

      expect(result.state.players[0]?.combatAccumulator.attack.normalElements.fire).toBe(5);
    });

    it("should produce 7 fire block with 0 enemies (just base)", () => {
      const state = createTestGameState({ combat: null });

      const poweredEffect = FLAME_WAVE.poweredEffect as ChoiceEffect;
      const blockOption = poweredEffect.options[1];
      if (!blockOption) throw new Error("Block option not found");

      const result = resolveEffect(state, "player1", blockOption, "flame_wave");

      expect(result.state.players[0]?.combatAccumulator.blockElements.fire).toBe(7);
    });
  });

  describe("effect helper functions", () => {
    it("fireAttackPerEnemy creates correct effect structure", () => {
      const effect = fireAttackPerEnemy(5, 2);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.type).toBe(EFFECT_GAIN_ATTACK);
      expect(effect.baseEffect.amount).toBe(5);
      if (effect.baseEffect.type === EFFECT_GAIN_ATTACK) {
        expect(effect.baseEffect.element).toBe(ELEMENT_FIRE);
      }
      expect(effect.scalingFactor.type).toBe(SCALING_PER_ENEMY);
      expect(effect.amountPerUnit).toBe(2);
    });

    it("fireBlockPerEnemy creates correct effect structure", () => {
      const effect = fireBlockPerEnemy(7, 2);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.type).toBe(EFFECT_GAIN_BLOCK);
      expect(effect.baseEffect.amount).toBe(7);
      if (effect.baseEffect.type === EFFECT_GAIN_BLOCK) {
        expect(effect.baseEffect.element).toBe(ELEMENT_FIRE);
      }
      expect(effect.scalingFactor.type).toBe(SCALING_PER_ENEMY);
      expect(effect.amountPerUnit).toBe(2);
    });

    it("blockPerEnemy creates correct effect structure", () => {
      const effect = blockPerEnemy(3, 1);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.type).toBe(EFFECT_GAIN_BLOCK);
      expect(effect.baseEffect.amount).toBe(3);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_ENEMY);
      expect(effect.amountPerUnit).toBe(1);
    });

    it("attackPerWoundInHand creates correct effect structure", () => {
      const effect = attackPerWoundInHand(0, 3);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.amount).toBe(0);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_WOUND_IN_HAND);
      expect(effect.amountPerUnit).toBe(3);
    });

    it("attackPerUnit creates correct effect structure", () => {
      const effect = attackPerUnit(2, 1);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.amount).toBe(2);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_UNIT);
      expect(effect.amountPerUnit).toBe(1);
    });

    it("blockPerUnit creates correct effect structure", () => {
      const effect = blockPerUnit(1, 2);
      expect(effect.type).toBe("scaling");
      expect(effect.baseEffect.type).toBe(EFFECT_GAIN_BLOCK);
      expect(effect.baseEffect.amount).toBe(1);
      expect(effect.scalingFactor.type).toBe(SCALING_PER_UNIT);
      expect(effect.amountPerUnit).toBe(2);
    });

    it("scaling with minimum creates correct effect structure", () => {
      const baseEffect = { type: EFFECT_GAIN_ATTACK, amount: 0, combatType: "melee" } as const;
      const effect = scaling(baseEffect, { type: SCALING_PER_ENEMY }, 2, { minimum: 3 });
      expect(effect.minimum).toBe(3);
      expect(effect.maximum).toBeUndefined();
    });

    it("scaling with maximum creates correct effect structure", () => {
      const baseEffect = { type: EFFECT_GAIN_ATTACK, amount: 0, combatType: "melee" } as const;
      const effect = scaling(baseEffect, { type: SCALING_PER_ENEMY }, 2, { maximum: 10 });
      expect(effect.minimum).toBeUndefined();
      expect(effect.maximum).toBe(10);
    });

    it("scaling with both min and max creates correct effect structure", () => {
      const baseEffect = { type: EFFECT_GAIN_ATTACK, amount: 0, combatType: "melee" } as const;
      const effect = scaling(baseEffect, { type: SCALING_PER_ENEMY }, 2, { minimum: 2, maximum: 10 });
      expect(effect.minimum).toBe(2);
      expect(effect.maximum).toBe(10);
    });
  });
});
