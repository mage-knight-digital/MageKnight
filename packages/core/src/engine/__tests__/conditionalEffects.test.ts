/**
 * Tests for conditional effects system
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import { evaluateCondition } from "../effects/conditionEvaluator.js";
import { resolveEffect } from "../effects/index.js";
import {
  CONDITION_TIME_OF_DAY,
  CONDITION_IN_PHASE,
  CONDITION_ON_TERRAIN,
  CONDITION_IN_COMBAT,
  CONDITION_BLOCKED_SUCCESSFULLY,
  CONDITION_ENEMY_DEFEATED_THIS_COMBAT,
  CONDITION_MANA_USED_THIS_TURN,
  CONDITION_HAS_WOUNDS_IN_HAND,
  CONDITION_IS_NIGHT_OR_UNDERGROUND,
} from "../../types/conditions.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  createCombatState,
} from "../../types/combat.js";
import {
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_FOREST,
  TERRAIN_PLAINS,
  MANA_RED,
  MANA_BLUE,
  CARD_WOUND,
  CARD_MARCH,
  hexKey,
} from "@mage-knight/shared";
import {
  move,
  attack,
  compound,
  influence,
  ifNight,
  ifDay,
  ifNightOrUnderground,
  ifInPhase,
  ifOnTerrain,
  ifInCombat,
  ifBlockedSuccessfully,
  ifEnemyDefeated,
  ifManaUsed,
  ifHasWoundsInHand,
} from "../../data/effectHelpers.js";
import { ENEMY_PROWLERS } from "@mage-knight/shared";
import { daySharpshooting } from "../../data/skills/norowas/daySharpshooting.js";
import { brightNegotiation } from "../../data/skills/norowas/brightNegotiation.js";

describe("Conditional Effects", () => {
  describe("evaluateCondition", () => {
    describe("TIME_OF_DAY condition", () => {
      it("should return true when time of day matches", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
        const condition = { type: CONDITION_TIME_OF_DAY, time: TIME_OF_DAY_NIGHT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false when time of day does not match", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
        const condition = { type: CONDITION_TIME_OF_DAY, time: TIME_OF_DAY_NIGHT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should work for day condition", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
        const condition = { type: CONDITION_TIME_OF_DAY, time: TIME_OF_DAY_DAY } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("IN_COMBAT condition", () => {
      it("should return false when not in combat", () => {
        const state = createTestGameState({ combat: null });
        const condition = { type: CONDITION_IN_COMBAT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when in combat", () => {
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_IN_COMBAT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("IN_PHASE condition", () => {
      it("should return false when not in combat", () => {
        const state = createTestGameState({ combat: null });
        const condition = { type: CONDITION_IN_PHASE, phases: [COMBAT_PHASE_ATTACK] } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when in matching phase", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          phase: COMBAT_PHASE_ATTACK,
        };
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_IN_PHASE, phases: [COMBAT_PHASE_ATTACK] } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false when in different phase", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          phase: COMBAT_PHASE_BLOCK,
        };
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_IN_PHASE, phases: [COMBAT_PHASE_ATTACK] } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when phase is in list of phases", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          phase: COMBAT_PHASE_BLOCK,
        };
        const state = createTestGameState({ combat });
        const condition = {
          type: CONDITION_IN_PHASE,
          phases: [COMBAT_PHASE_ATTACK, COMBAT_PHASE_BLOCK],
        } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("ON_TERRAIN condition", () => {
      it("should return false when player has no position", () => {
        const player = createTestPlayer({ position: null });
        const state = createTestGameState({
          players: [player],
        });
        const condition = { type: CONDITION_ON_TERRAIN, terrain: TERRAIN_FOREST } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when on matching terrain", () => {
        const player = createTestPlayer({ position: { q: 0, r: 1 } }); // Forest hex in test map
        const hexes = {
          [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_FOREST),
        };
        const state = createTestGameState({
          players: [player],
          map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
        });
        const condition = { type: CONDITION_ON_TERRAIN, terrain: TERRAIN_FOREST } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false when on different terrain", () => {
        const player = createTestPlayer({ position: { q: 0, r: 0 } });
        const hexes = {
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        };
        const state = createTestGameState({
          players: [player],
          map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
        });
        const condition = { type: CONDITION_ON_TERRAIN, terrain: TERRAIN_FOREST } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });
    });

    describe("BLOCKED_SUCCESSFULLY condition", () => {
      it("should return false when not in combat", () => {
        const state = createTestGameState({ combat: null });
        const condition = { type: CONDITION_BLOCKED_SUCCESSFULLY } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return false when damage not fully blocked", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          allDamageBlockedThisPhase: false,
        };
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_BLOCKED_SUCCESSFULLY } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when all damage blocked", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          allDamageBlockedThisPhase: true,
        };
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_BLOCKED_SUCCESSFULLY } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("ENEMY_DEFEATED_THIS_COMBAT condition", () => {
      it("should return false when not in combat", () => {
        const state = createTestGameState({ combat: null });
        const condition = { type: CONDITION_ENEMY_DEFEATED_THIS_COMBAT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return false when no enemies defeated", () => {
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_ENEMY_DEFEATED_THIS_COMBAT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when an enemy is defeated", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          enemies: [
            {
              instanceId: "enemy_0",
              enemyId: ENEMY_PROWLERS,
              definition: { id: ENEMY_PROWLERS, armor: 4, attack: 3 },
              isBlocked: false,
              isDefeated: true,
              damageAssigned: false,
            },
          ],
        };
        const state = createTestGameState({ combat });
        const condition = { type: CONDITION_ENEMY_DEFEATED_THIS_COMBAT } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("MANA_USED_THIS_TURN condition", () => {
      it("should return false when no mana used", () => {
        const player = createTestPlayer({ manaUsedThisTurn: [] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_MANA_USED_THIS_TURN } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when any mana used (no color specified)", () => {
        const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_MANA_USED_THIS_TURN } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return true when specific color used", () => {
        const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED, MANA_BLUE] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_MANA_USED_THIS_TURN, color: MANA_RED } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false when specific color not used", () => {
        const player = createTestPlayer({ manaUsedThisTurn: [MANA_BLUE] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_MANA_USED_THIS_TURN, color: MANA_RED } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });
    });

    describe("HAS_WOUNDS_IN_HAND condition", () => {
      it("should return false when no wounds in hand", () => {
        const player = createTestPlayer({ hand: [CARD_MARCH] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_HAS_WOUNDS_IN_HAND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true when wounds in hand", () => {
        const player = createTestPlayer({ hand: [CARD_MARCH, CARD_WOUND] });
        const state = createTestGameState({ players: [player] });
        const condition = { type: CONDITION_HAS_WOUNDS_IN_HAND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });
    });

    describe("IS_NIGHT_OR_UNDERGROUND condition", () => {
      it("should return true during night", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
        const condition = { type: CONDITION_IS_NIGHT_OR_UNDERGROUND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false during day (outdoors)", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat: null });
        const condition = { type: CONDITION_IS_NIGHT_OR_UNDERGROUND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });

      it("should return true in dungeon combat during day (nightManaRules)", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          nightManaRules: true, // Dungeon/Tomb combat
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });
        const condition = { type: CONDITION_IS_NIGHT_OR_UNDERGROUND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return true in dungeon combat during night", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          nightManaRules: true,
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT, combat });
        const condition = { type: CONDITION_IS_NIGHT_OR_UNDERGROUND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(true);
      });

      it("should return false in normal combat during day", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          nightManaRules: false, // Normal outdoor combat
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });
        const condition = { type: CONDITION_IS_NIGHT_OR_UNDERGROUND } as const;

        expect(evaluateCondition(state, "player1", condition)).toBe(false);
      });
    });

    describe("unknown player", () => {
      it("should return false for unknown player", () => {
        const state = createTestGameState();
        const condition = { type: CONDITION_IN_COMBAT } as const;

        expect(evaluateCondition(state, "unknown_player", condition)).toBe(false);
      });
    });
  });

  describe("resolveEffect with conditional", () => {
    it("should apply thenEffect when condition is met", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const effect = ifNight(move(4), move(2));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(8); // 4 base + 4 from effect
    });

    it("should apply elseEffect when condition is not met", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
      const effect = ifNight(move(4), move(2));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 from else
    });

    it("should do nothing when condition not met and no elseEffect", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
      const effect = ifNight(move(4)); // No else effect

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(4); // Unchanged from base
      expect(result.description).toBe("Condition not met (no else branch)");
    });

    it("should work with ifDay helper", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
      const effect = ifDay(move(5), move(3));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(9); // 4 base + 5 from effect
    });

    it("should work with ifInCombat helper", () => {
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ combat });
      const effect = ifInCombat(attack(5), move(2));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(5);
    });

    it("should work nested inside CompoundEffect", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const effect = compound([move(2), ifNight(attack(3))]);

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 from compound
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(3);
    });

    it("should handle nested conditional effects", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      // If night, then (if night again = bonus)
      const effect = ifNight(ifNight(move(10), move(5)), move(1));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(14); // 4 base + 10 from nested
    });

    it("should work with ifInPhase during combat", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ combat });
      const effect = ifInPhase([COMBAT_PHASE_ATTACK], attack(6), attack(2));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(6);
    });

    it("should work with ifOnTerrain", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 }, movePoints: 4 });
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_FOREST),
      };
      const state = createTestGameState({
        players: [player],
        map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
      });
      const effect = ifOnTerrain(TERRAIN_FOREST, move(3), move(1));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(7); // 4 base + 3 forest bonus
    });

    it("should work with ifHasWoundsInHand", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND, CARD_MARCH], movePoints: 4 });
      const state = createTestGameState({ players: [player] });
      const effect = ifHasWoundsInHand(move(2), move(5));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 (has wound)
    });

    it("should work with ifBlockedSuccessfully", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        allDamageBlockedThisPhase: true,
      };
      const state = createTestGameState({ combat });
      const effect = ifBlockedSuccessfully(attack(4), attack(1));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(4);
    });

    it("should work with ifEnemyDefeated", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: { id: ENEMY_PROWLERS, armor: 4, attack: 3 },
            isBlocked: false,
            isDefeated: true,
            damageAssigned: false,
          },
        ],
      };
      const state = createTestGameState({ combat });
      const effect = ifEnemyDefeated(attack(5), attack(2));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(5);
    });

    it("should work with ifManaUsed", () => {
      const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED], movePoints: 4 });
      const state = createTestGameState({ players: [player] });
      const effect = ifManaUsed(move(3), move(1));

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(7); // 4 base + 3 (mana used)
    });

    it("should work with ifManaUsed with specific color", () => {
      const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED], movePoints: 4 });
      const state = createTestGameState({ players: [player] });
      const effect = ifManaUsed(move(3), move(1), MANA_BLUE);

      const result = resolveEffect(state, "player1", effect, "test-card");

      expect(result.state.players[0]?.movePoints).toBe(5); // 4 base + 1 (blue not used)
    });

    describe("ifDay (Double Time pattern)", () => {
      it("should grant Move 2 during day", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
        const effect = ifDay(move(2), move(1));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.movePoints).toBe(6); // 4 base + 2 day bonus
      });

      it("should grant Move 1 at night", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
        const effect = ifDay(move(2), move(1));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.movePoints).toBe(5); // 4 base + 1 night bonus
      });

      it("movement points are standalone (usable independently)", () => {
        // Standalone means the effect adds directly to movePoints,
        // not requiring combination with other movement effects
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
        const effect = ifDay(move(2), move(1));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        // Verify movement points were added directly
        expect(result.state.players[0]?.movePoints).toBe(6);
        // The description confirms the gain was applied
        expect(result.description).toContain("Gained 2 Move");
      });
    });

    describe("ifNightOrUnderground (Dark Negotiation pattern)", () => {
      it("should grant Influence 3 at night", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
        const effect = ifNightOrUnderground(influence(3), influence(2));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(3);
      });

      it("should grant Influence 2 during day (outdoors)", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat: null });
        const effect = ifNightOrUnderground(influence(3), influence(2));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(2);
      });

      it("should grant Influence 3 in dungeon combat during day", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          nightManaRules: true, // Dungeon/Tomb
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });
        const effect = ifNightOrUnderground(influence(3), influence(2));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(3);
      });

      it("should grant Influence 2 in normal outdoor combat during day", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          nightManaRules: false, // Normal outdoor combat
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });
        const effect = ifNightOrUnderground(influence(3), influence(2));

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(2);
      });
    });

    describe("Day Sharpshooting (Norowas)", () => {
      it("should grant Ranged Attack 2 during day on the surface", () => {
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });

        const effect = daySharpshooting.effect;
        if (!effect) {
          throw new Error("Day Sharpshooting effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(2);
      });

      it("should grant Ranged Attack 1 at night on the surface", () => {
        const combat = createCombatState([ENEMY_PROWLERS]);
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT, combat });

        const effect = daySharpshooting.effect;
        if (!effect) {
          throw new Error("Day Sharpshooting effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(1);
      });

      it("should grant Ranged Attack 1 in a dungeon during day", () => {
        const combat = createCombatState([ENEMY_PROWLERS], false, {
          nightManaRules: true,
        });
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });

        const effect = daySharpshooting.effect;
        if (!effect) {
          throw new Error("Day Sharpshooting effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(1);
      });

      it("should only apply during ranged/siege phase", () => {
        const combat = {
          ...createCombatState([ENEMY_PROWLERS]),
          phase: COMBAT_PHASE_BLOCK,
        };
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });

        const effect = daySharpshooting.effect;
        if (!effect) {
          throw new Error("Day Sharpshooting effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(0);
      });
    });

    describe("Bright Negotiation (Norowas)", () => {
      it("should grant Influence 3 during day on the surface", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat: null });

        const effect = brightNegotiation.effect;
        if (!effect) {
          throw new Error("Bright Negotiation effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(3);
      });

      it("should grant Influence 2 at night on the surface", () => {
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT, combat: null });

        const effect = brightNegotiation.effect;
        if (!effect) {
          throw new Error("Bright Negotiation effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(2);
      });

      it("should grant Influence 2 in a dungeon during day", () => {
        const combat = createCombatState([ENEMY_PROWLERS], false, {
          nightManaRules: true,
        });
        const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY, combat });

        const effect = brightNegotiation.effect;
        if (!effect) {
          throw new Error("Bright Negotiation effect is missing");
        }

        const result = resolveEffect(state, "player1", effect, "test-skill");

        expect(result.state.players[0]?.influencePoints).toBe(2);
      });
    });
  });

  describe("effect helpers", () => {
    it("move helper creates correct effect", () => {
      const effect = move(5);
      expect(effect.type).toBe("gain_move");
      expect(effect.amount).toBe(5);
    });

    it("attack helper creates correct effect", () => {
      const effect = attack(3);
      expect(effect.type).toBe("gain_attack");
      expect(effect.amount).toBe(3);
      expect(effect.combatType).toBe("melee");
    });

    it("compound helper creates correct effect", () => {
      const effect = compound([move(2), attack(3)]);
      expect(effect.type).toBe("compound");
      expect(effect.effects).toHaveLength(2);
    });

    it("ifNight creates correct conditional", () => {
      const effect = ifNight(move(4), move(2));
      expect(effect.type).toBe("conditional");
      expect(effect.condition.type).toBe(CONDITION_TIME_OF_DAY);
      if (effect.condition.type === CONDITION_TIME_OF_DAY) {
        expect(effect.condition.time).toBe(TIME_OF_DAY_NIGHT);
      }
      expect(effect.thenEffect).toEqual(move(4));
      expect(effect.elseEffect).toEqual(move(2));
    });

    it("ifDay creates correct conditional", () => {
      const effect = ifDay(move(4));
      expect(effect.type).toBe("conditional");
      expect(effect.condition.type).toBe(CONDITION_TIME_OF_DAY);
      if (effect.condition.type === CONDITION_TIME_OF_DAY) {
        expect(effect.condition.time).toBe(TIME_OF_DAY_DAY);
      }
    });

    it("ifNightOrUnderground creates correct conditional", () => {
      const effect = ifNightOrUnderground(influence(3), influence(2));
      expect(effect.type).toBe("conditional");
      expect(effect.condition.type).toBe(CONDITION_IS_NIGHT_OR_UNDERGROUND);
      expect(effect.thenEffect).toEqual(influence(3));
      expect(effect.elseEffect).toEqual(influence(2));
    });

    it("influence helper creates correct effect", () => {
      const effect = influence(5);
      expect(effect.type).toBe("gain_influence");
      expect(effect.amount).toBe(5);
    });
  });
});
