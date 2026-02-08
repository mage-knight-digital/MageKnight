/**
 * Tests for Counterattack card scaling effect (per enemy blocked)
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { evaluateScalingFactor } from "../effects/scalingEvaluator.js";
import { resolveEffect } from "../effects/index.js";
import { SCALING_PER_ENEMY_BLOCKED } from "../../types/scaling.js";
import { createCombatState, COMBAT_CONTEXT_COOPERATIVE_ASSAULT } from "../../types/combat.js";
import type { CombatEnemy } from "../../types/combat.js";
import {
  ENEMY_PROWLERS,
  ENEMY_ALTEM_GUARDSMEN,
  ENEMY_ORC_SKIRMISHERS,
  CARD_COUNTERATTACK,
} from "@mage-knight/shared";
import { attackPerEnemyBlocked } from "../../data/effectHelpers.js";
import { COUNTERATTACK } from "../../data/advancedActions/red/counterattack.js";
import type { ScalingEffect } from "../../types/cards.js";
import { getEnemy } from "@mage-knight/shared";

describe("Counterattack - SCALING_PER_ENEMY_BLOCKED", () => {
  describe("evaluateScalingFactor", () => {
    it("should return 0 when not in combat", () => {
      const state = createTestGameState({ combat: null });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count).toBe(0);
    });

    it("should return 0 when no enemies are blocked", () => {
      const combat = createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN]);
      const state = createTestGameState({ combat });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count).toBe(0);
    });

    it("should count single blocked enemy", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_ALTEM_GUARDSMEN,
            definition: getEnemy(ENEMY_ALTEM_GUARDSMEN),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count).toBe(1);
    });

    it("should count multiple blocked enemies", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_ALTEM_GUARDSMEN,
            definition: getEnemy(ENEMY_ALTEM_GUARDSMEN),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_2",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count).toBe(2);
    });

    it("should not count summoned enemies", () => {
      const baseCombat = createCombatState([ENEMY_PROWLERS]);
      const summonedEnemy: CombatEnemy = {
        instanceId: "enemy_1",
        enemyId: ENEMY_PROWLERS,
        definition: getEnemy(ENEMY_PROWLERS),
        isBlocked: true,
        isDefeated: false,
        damageAssigned: false,
        isRequiredForConquest: false,
        summonedByInstanceId: "enemy_0",
      };
      const combat = {
        ...baseCombat,
        enemies: [
          { ...baseCombat.enemies[0]!, isBlocked: true },
          summonedEnemy,
        ],
      };
      const state = createTestGameState({ combat });
      const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      // Only 1 (the non-summoned one), even though summoned is also blocked
      expect(count).toBe(1);
    });

    it("should only count enemies assigned to player in cooperative assault", () => {
      const combat = {
        ...createCombatState(
          [ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS],
          false,
          {
            combatContext: COMBAT_CONTEXT_COOPERATIVE_ASSAULT,
            enemyAssignments: {
              player1: ["enemy_0", "enemy_2"],
              player2: ["enemy_1"],
            },
          }
        ),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_ALTEM_GUARDSMEN,
            definition: getEnemy(ENEMY_ALTEM_GUARDSMEN),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_2",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });

      // Player 1 has enemy_0 and enemy_2 (both blocked)
      const count1 = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count1).toBe(2);

      // Player 2 has enemy_1 (blocked)
      const player2 = createTestPlayer({ id: "player2" });
      const state2 = createTestGameState({ combat, players: [createTestPlayer(), player2] });
      const count2 = evaluateScalingFactor(state2, "player2", { type: SCALING_PER_ENEMY_BLOCKED });
      expect(count2).toBe(1);
    });

    describe("multi-attack enemies", () => {
      it("should not count multi-attack enemy with only some attacks blocked", () => {
        const orcDef = getEnemy(ENEMY_ORC_SKIRMISHERS);
        const combat = {
          ...createCombatState([ENEMY_ORC_SKIRMISHERS]),
          enemies: [
            {
              instanceId: "enemy_0",
              enemyId: ENEMY_ORC_SKIRMISHERS,
              definition: orcDef,
              isBlocked: false, // NOT fully blocked
              isDefeated: false,
              damageAssigned: false,
              isRequiredForConquest: true,
              attacksBlocked: [true, false], // Only first attack blocked
            },
          ],
        };
        const state = createTestGameState({ combat });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
        expect(count).toBe(0);
      });

      it("should count multi-attack enemy when ALL attacks are blocked", () => {
        const orcDef = getEnemy(ENEMY_ORC_SKIRMISHERS);
        const combat = {
          ...createCombatState([ENEMY_ORC_SKIRMISHERS]),
          enemies: [
            {
              instanceId: "enemy_0",
              enemyId: ENEMY_ORC_SKIRMISHERS,
              definition: orcDef,
              isBlocked: true, // ALL attacks blocked
              isDefeated: false,
              damageAssigned: false,
              isRequiredForConquest: true,
              attacksBlocked: [true, true],
            },
          ],
        };
        const state = createTestGameState({ combat });
        const count = evaluateScalingFactor(state, "player1", { type: SCALING_PER_ENEMY_BLOCKED });
        expect(count).toBe(1);
      });
    });
  });

  describe("resolveEffect with Counterattack", () => {
    it("should apply base attack when no enemies blocked", () => {
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ combat });
      const effect = attackPerEnemyBlocked(2, 2); // 2 base + 2 per blocked

      const result = resolveEffect(state, "player1", effect, CARD_COUNTERATTACK);

      // 2 base + (2 × 0 blocked) = 2
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(2);
    });

    it("should scale basic effect: Attack 2 + (2 × enemies blocked)", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_ALTEM_GUARDSMEN,
            definition: getEnemy(ENEMY_ALTEM_GUARDSMEN),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_2",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", COUNTERATTACK.basicEffect, CARD_COUNTERATTACK);

      // 2 base + (2 × 2 blocked) = 6
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(6);
    });

    it("should scale powered effect: Attack 4 + (3 × enemies blocked)", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_ALTEM_GUARDSMEN, ENEMY_PROWLERS]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_1",
            enemyId: ENEMY_ALTEM_GUARDSMEN,
            definition: getEnemy(ENEMY_ALTEM_GUARDSMEN),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
          {
            instanceId: "enemy_2",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", COUNTERATTACK.poweredEffect, CARD_COUNTERATTACK);

      // 4 base + (3 × 3 blocked) = 13
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(13);
    });

    it("should mark result as containsScaling", () => {
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", COUNTERATTACK.basicEffect, CARD_COUNTERATTACK);

      expect(result.containsScaling).toBe(true);
    });

    it("all attack points combine into single melee attack", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: getEnemy(ENEMY_PROWLERS),
            isBlocked: true,
            isDefeated: false,
            damageAssigned: false,
            isRequiredForConquest: true,
          },
        ],
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", COUNTERATTACK.basicEffect, CARD_COUNTERATTACK);

      // 2 base + (2 × 1 blocked) = 4, all as single melee attack
      const accumulator = result.state.players[0]?.combatAccumulator;
      expect(accumulator?.attack.normal).toBe(4);
      // Should not have ranged or siege
      expect(accumulator?.attack.ranged).toBe(0);
      expect(accumulator?.attack.siege).toBe(0);
    });
  });

  describe("Counterattack card structure", () => {
    it("should have correct card metadata", () => {
      expect(COUNTERATTACK.id).toBe(CARD_COUNTERATTACK);
      expect(COUNTERATTACK.name).toBe("Counterattack");
      expect(COUNTERATTACK.sidewaysValue).toBe(1);
    });

    it("basic effect should be scaling with per-enemy-blocked factor", () => {
      const effect = COUNTERATTACK.basicEffect as ScalingEffect;
      expect(effect.type).toBe("scaling");
      expect(effect.scalingFactor.type).toBe(SCALING_PER_ENEMY_BLOCKED);
      expect(effect.baseEffect.amount).toBe(2);
      expect(effect.amountPerUnit).toBe(2);
    });

    it("powered effect should be scaling with per-enemy-blocked factor", () => {
      const effect = COUNTERATTACK.poweredEffect as ScalingEffect;
      expect(effect.type).toBe("scaling");
      expect(effect.scalingFactor.type).toBe(SCALING_PER_ENEMY_BLOCKED);
      expect(effect.baseEffect.amount).toBe(4);
      expect(effect.amountPerUnit).toBe(3);
    });
  });
});
