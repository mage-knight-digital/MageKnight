/**
 * Tests for real Mage Knight cards using the conditional effects system
 *
 * This validates that our effect system can express real card patterns.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import { resolveEffect } from "../effects/resolveEffect.js";
import { createCombatState, COMBAT_PHASE_ATTACK, COMBAT_PHASE_BLOCK, COMBAT_PHASE_ASSIGN_DAMAGE } from "../../types/combat.js";
import {
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_PLAINS,
  hexKey,
  ENEMY_PROWLERS,
} from "@mage-knight/shared";

import {
  ICE_BOLT,
  FIREBALL,
  BURNING_SHIELD,
  COLD_TOUGHNESS,
  ONE_WITH_THE_LAND,
  RAGE,
  SWIFTNESS,
  PROMISE,
} from "../../data/testCards.js";
import {
  coldFireAttack,
  coldFireRangedAttack,
  coldFireBlock,
} from "../../data/effectHelpers.js";
import { ELEMENT_COLD_FIRE, MANA_RED, MANA_BLUE } from "@mage-knight/shared";
import { createEndCombatPhaseCommand } from "../commands/combat/endCombatPhaseCommand.js";

// Helper to get elemental attack values
function getRangedIce(state: ReturnType<typeof createTestGameState>): number {
  return state.players[0]?.combatAccumulator.attack.rangedElements.ice ?? 0;
}

function getRangedFire(state: ReturnType<typeof createTestGameState>): number {
  return state.players[0]?.combatAccumulator.attack.rangedElements.fire ?? 0;
}

function getBlockFire(state: ReturnType<typeof createTestGameState>): number {
  return state.players[0]?.combatAccumulator.blockElements.fire ?? 0;
}

function getAttackFire(state: ReturnType<typeof createTestGameState>): number {
  return state.players[0]?.combatAccumulator.attack.normalElements.fire ?? 0;
}

// getBlockIce is available for future tests when we add more ice block cards
// function getBlockIce(state: ReturnType<typeof createTestGameState>): number {
//   return state.players[0]?.combatAccumulator.blockElements.ice ?? 0;
// }

describe("Real Card Validation", () => {
  describe("Ice Bolt (Day/Night pattern)", () => {
    it("should deal Ice Ranged Attack 3 during day", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
      const result = resolveEffect(state, "player1", ICE_BOLT.basicEffect, ICE_BOLT.id);

      expect(getRangedIce(result.state)).toBe(3);
    });

    it("should deal Ice Ranged Attack 5 at night (bonus)", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const result = resolveEffect(state, "player1", ICE_BOLT.basicEffect, ICE_BOLT.id);

      expect(getRangedIce(result.state)).toBe(5);
    });

    it("powered effect should be Ice Ranged Attack 7 regardless of time", () => {
      const dayState = createTestGameState({ timeOfDay: TIME_OF_DAY_DAY });
      const nightState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });

      const dayResult = resolveEffect(dayState, "player1", ICE_BOLT.poweredEffect, ICE_BOLT.id);
      const nightResult = resolveEffect(nightState, "player1", ICE_BOLT.poweredEffect, ICE_BOLT.id);

      expect(getRangedIce(dayResult.state)).toBe(7);
      expect(getRangedIce(nightResult.state)).toBe(7);
    });
  });

  describe("Fireball (Simple elemental pattern)", () => {
    it("basic effect should be Fire Ranged Attack 3", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", FIREBALL.basicEffect, FIREBALL.id);

      expect(getRangedFire(result.state)).toBe(3);
    });

    it("powered effect should be Fire Ranged Attack 5", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", FIREBALL.poweredEffect, FIREBALL.id);

      expect(getRangedFire(result.state)).toBe(5);
    });
  });

  describe("Burning Shield (Nested conditional pattern)", () => {
    it("should provide Fire Block 4 in block phase", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
        allDamageBlockedThisPhase: false,
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", BURNING_SHIELD.basicEffect, BURNING_SHIELD.id);

      expect(getBlockFire(result.state)).toBe(4);
      // No attack bonus yet (not in attack phase, not blocked successfully)
      expect(getAttackFire(result.state)).toBe(0);
    });

    it("should NOT provide attack bonus if block failed", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
        allDamageBlockedThisPhase: false,
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", BURNING_SHIELD.basicEffect, BURNING_SHIELD.id);

      // Fire block still applies (compound effect)
      expect(getBlockFire(result.state)).toBe(4);
      // But no attack because block wasn't successful
      expect(getAttackFire(result.state)).toBe(0);
    });

    it("should provide Fire Attack 4 in attack phase after successful block", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
        allDamageBlockedThisPhase: true,
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", BURNING_SHIELD.basicEffect, BURNING_SHIELD.id);

      expect(getBlockFire(result.state)).toBe(4);
      expect(getAttackFire(result.state)).toBe(4);
    });

    it("powered version should provide Fire Attack 6 after successful block", () => {
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
        allDamageBlockedThisPhase: true,
      };
      const state = createTestGameState({ combat });

      const result = resolveEffect(state, "player1", BURNING_SHIELD.poweredEffect, BURNING_SHIELD.id);

      expect(getBlockFire(result.state)).toBe(4);
      expect(getAttackFire(result.state)).toBe(6);
    });
  });

  describe("Cold Toughness (Choice pattern)", () => {
    it("basic effect should offer choice between Attack 2 and Ice Block 3", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", COLD_TOUGHNESS.basicEffect, COLD_TOUGHNESS.id);

      // Choice effects require player input
      expect(result.requiresChoice).toBe(true);
    });

    it("powered effect should offer choice between Attack 4 and Ice Block 5", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", COLD_TOUGHNESS.poweredEffect, COLD_TOUGHNESS.id);

      expect(result.requiresChoice).toBe(true);
    });
  });

  describe("One With the Land (Multi-terrain conditional)", () => {
    it("should give Move 2 on plains (no terrain bonus)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 }, movePoints: 0 });
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      };
      const state = createTestGameState({
        players: [player],
        map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
      });

      const result = resolveEffect(state, "player1", ONE_WITH_THE_LAND.basicEffect, ONE_WITH_THE_LAND.id);

      expect(result.state.players[0]?.movePoints).toBe(2);
    });

    it("should give Move 4 in forest (terrain bonus)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 }, movePoints: 0 });
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_FOREST),
      };
      const state = createTestGameState({
        players: [player],
        map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
      });

      const result = resolveEffect(state, "player1", ONE_WITH_THE_LAND.basicEffect, ONE_WITH_THE_LAND.id);

      expect(result.state.players[0]?.movePoints).toBe(4);
    });

    it("should give Move 4 in hills (terrain bonus)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 }, movePoints: 0 });
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_HILLS),
      };
      const state = createTestGameState({
        players: [player],
        map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
      });

      const result = resolveEffect(state, "player1", ONE_WITH_THE_LAND.basicEffect, ONE_WITH_THE_LAND.id);

      expect(result.state.players[0]?.movePoints).toBe(4);
    });

    it("powered effect should give Move 6 regardless of terrain", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 }, movePoints: 0 });
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      };
      const state = createTestGameState({
        players: [player],
        map: { hexes, tiles: [], tileDeck: { countryside: [], core: [] } },
      });

      const result = resolveEffect(state, "player1", ONE_WITH_THE_LAND.poweredEffect, ONE_WITH_THE_LAND.id);

      expect(result.state.players[0]?.movePoints).toBe(6);
    });
  });

  describe("Rage (Basic choice pattern)", () => {
    it("basic effect should require choice", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", RAGE.basicEffect, RAGE.id);

      expect(result.requiresChoice).toBe(true);
    });

    it("powered effect should give Attack 4 (no choice)", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", RAGE.poweredEffect, RAGE.id);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.state.players[0]?.combatAccumulator.attack.normal).toBe(4);
    });
  });

  describe("Swiftness (Different effect when powered)", () => {
    it("basic effect should give Move 2", () => {
      const player = createTestPlayer({ movePoints: 0 });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", SWIFTNESS.basicEffect, SWIFTNESS.id);

      expect(result.state.players[0]?.movePoints).toBe(2);
    });

    it("powered effect should give Ranged Attack 3 (completely different!)", () => {
      const state = createTestGameState();

      const result = resolveEffect(state, "player1", SWIFTNESS.poweredEffect, SWIFTNESS.id);

      expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(3);
      // No move points from powered
      expect(result.state.players[0]?.movePoints).toBe(4); // unchanged from default
    });
  });

  describe("Promise (Simple scaling pattern)", () => {
    it("basic effect should give Influence 2", () => {
      const player = createTestPlayer({ influencePoints: 0 });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", PROMISE.basicEffect, PROMISE.id);

      expect(result.state.players[0]?.influencePoints).toBe(2);
    });

    it("powered effect should give Influence 4", () => {
      const player = createTestPlayer({ influencePoints: 0 });
      const state = createTestGameState({ players: [player] });

      const result = resolveEffect(state, "player1", PROMISE.poweredEffect, PROMISE.id);

      expect(result.state.players[0]?.influencePoints).toBe(4);
    });
  });
});

describe("Elemental Effect Accumulation", () => {
  it("should track fire ranged attacks in rangedElements.fire", () => {
    const state = createTestGameState();
    const result = resolveEffect(state, "player1", FIREBALL.basicEffect, "fireball");

    expect(result.state.players[0]?.combatAccumulator.attack.rangedElements.fire).toBe(3);
    // Normal ranged should be 0 (fire is separate)
    expect(result.state.players[0]?.combatAccumulator.attack.ranged).toBe(0);
  });

  it("should track ice ranged attacks in rangedElements.ice", () => {
    const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
    const result = resolveEffect(state, "player1", ICE_BOLT.basicEffect, "ice_bolt");

    expect(result.state.players[0]?.combatAccumulator.attack.rangedElements.ice).toBe(5);
  });

  it("should track fire block in blockElements.fire", () => {
    const combat = createCombatState([ENEMY_PROWLERS]);
    const state = createTestGameState({ combat });
    const result = resolveEffect(state, "player1", BURNING_SHIELD.basicEffect, "burning_shield");

    expect(result.state.players[0]?.combatAccumulator.blockElements.fire).toBe(4);
  });
});

describe("Cold Fire Helpers", () => {
  it("should create cold fire attack with correct element", () => {
    const effect = coldFireAttack(5);
    expect(effect.element).toBe(ELEMENT_COLD_FIRE);
    expect(effect.amount).toBe(5);
    expect(effect.combatType).toBe("melee");
  });

  it("should create cold fire ranged attack with correct element", () => {
    const effect = coldFireRangedAttack(4);
    expect(effect.element).toBe(ELEMENT_COLD_FIRE);
    expect(effect.amount).toBe(4);
    expect(effect.combatType).toBe("ranged");
  });

  it("should create cold fire block with correct element", () => {
    const effect = coldFireBlock(3);
    expect(effect.element).toBe(ELEMENT_COLD_FIRE);
    expect(effect.amount).toBe(3);
  });

  it("should track cold fire attack in accumulator", () => {
    const state = createTestGameState();
    const result = resolveEffect(state, "player1", coldFireAttack(5), "test");

    expect(result.state.players[0]?.combatAccumulator.attack.normalElements.coldFire).toBe(5);
  });
});

describe("Condition Wiring", () => {
  describe("allDamageBlockedThisPhase", () => {
    it("should be false initially", () => {
      const combat = createCombatState([ENEMY_PROWLERS]);
      expect(combat.allDamageBlockedThisPhase).toBe(false);
    });

    it("should be set to true when all enemies are blocked after block phase", () => {
      // Create combat in block phase with one blocked enemy
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: {
              id: ENEMY_PROWLERS,
              armor: 4,
              attack: 3,
              attackElement: undefined,
              fame: 2,
              abilities: [],
            },
            isBlocked: true, // Enemy is blocked
            isDefeated: false,
            damageAssigned: false,
          },
        ],
      };
      const state = createTestGameState({ combat });

      // End block phase
      const command = createEndCombatPhaseCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Should be in assign damage phase with allDamageBlockedThisPhase = true
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);
      expect(result.state.combat?.allDamageBlockedThisPhase).toBe(true);
    });

    it("should be set to false when some enemies are not blocked", () => {
      // Create combat in block phase with one unblocked enemy
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
        enemies: [
          {
            instanceId: "enemy_0",
            enemyId: ENEMY_PROWLERS,
            definition: {
              id: ENEMY_PROWLERS,
              armor: 4,
              attack: 3,
              attackElement: undefined,
              fame: 2,
              abilities: [],
            },
            isBlocked: false, // Enemy NOT blocked
            isDefeated: false,
            damageAssigned: false,
          },
        ],
      };
      const state = createTestGameState({ combat });

      // End block phase
      const command = createEndCombatPhaseCommand({ playerId: "player1" });
      const result = command.execute(state);

      // Should be in assign damage phase with allDamageBlockedThisPhase = false
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);
      expect(result.state.combat?.allDamageBlockedThisPhase).toBe(false);
    });
  });

  describe("manaUsedThisTurn", () => {
    it("should be empty initially", () => {
      const player = createTestPlayer();
      expect(player.manaUsedThisTurn).toEqual([]);
    });

    it("should track mana colors when player uses mana", () => {
      const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED] });
      expect(player.manaUsedThisTurn).toContain(MANA_RED);
    });

    it("should support tracking multiple mana colors", () => {
      const player = createTestPlayer({ manaUsedThisTurn: [MANA_RED, MANA_BLUE] });
      expect(player.manaUsedThisTurn).toContain(MANA_RED);
      expect(player.manaUsedThisTurn).toContain(MANA_BLUE);
      expect(player.manaUsedThisTurn.length).toBe(2);
    });
  });

  describe("containsConditional flag", () => {
    it("should be set when resolving conditional effect", () => {
      const state = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const result = resolveEffect(state, "player1", ICE_BOLT.basicEffect, ICE_BOLT.id);

      expect(result.containsConditional).toBe(true);
    });

    it("should not be set for simple effects", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", FIREBALL.basicEffect, FIREBALL.id);

      expect(result.containsConditional).toBeUndefined();
    });
  });
});
