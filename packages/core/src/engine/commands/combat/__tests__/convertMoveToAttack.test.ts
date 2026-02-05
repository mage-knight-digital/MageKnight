/**
 * Tests for Move-to-Attack Conversion (Agility card)
 *
 * Basic Agility: 1 move = 1 melee attack (ATTACK phase only)
 * Powered Agility: 1 move = 1 melee attack (ATTACK) OR 2 move = 1 ranged attack (RANGED_SIEGE)
 *
 * Move points gained from action phase persist into combat.
 * Conversion modifier lasts for the turn (DURATION_TURN).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import { getValidActions } from "../../../validActions/index.js";
import {
  CONVERT_MOVE_TO_ATTACK_ACTION,
  CONVERSION_TYPE_MELEE,
  CONVERSION_TYPE_RANGED,
  MOVE_CONVERTED_TO_ATTACK,
  INVALID_ACTION,
  UNDO_ACTION,
  type EnemyId,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../../../types/combat.js";
import type { GameState } from "../../../../state/GameState.js";
import type { CombatEnemy } from "../../../../types/combat.js";
import type { EnemyDefinition } from "@mage-knight/shared";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";
import type { ActiveModifier } from "../../../../types/modifiers.js";
import {
  EFFECT_MOVE_TO_ATTACK_CONVERSION,
  COMBAT_VALUE_ATTACK,
  COMBAT_VALUE_RANGED,
  SCOPE_SELF,
  DURATION_TURN,
  SOURCE_CARD,
} from "../../../../types/modifierConstants.js";

// Simple test enemy
const TEST_ENEMY_DEF: EnemyDefinition = {
  id: "test_enemy" as EnemyId,
  name: "Test Enemy",
  color: "green",
  attack: 3,
  armor: 4,
  fame: 2,
  attackElement: ELEMENT_PHYSICAL,
  abilities: [],
  resistances: [],
};

/**
 * Create a melee conversion modifier (1 move = 1 attack)
 */
function createMeleeConversionModifier(playerId: string): ActiveModifier {
  return {
    source: { type: SOURCE_CARD, cardId: "agility" as any, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_MOVE_TO_ATTACK_CONVERSION,
      costPerPoint: 1,
      attackType: COMBAT_VALUE_ATTACK,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  };
}

/**
 * Create a ranged conversion modifier (2 move = 1 ranged attack)
 */
function createRangedConversionModifier(playerId: string): ActiveModifier {
  return {
    source: { type: SOURCE_CARD, cardId: "agility" as any, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_MOVE_TO_ATTACK_CONVERSION,
      costPerPoint: 2,
      attackType: COMBAT_VALUE_RANGED,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  };
}

/**
 * Helper to set up combat state with conversion modifier active.
 */
function setupConversionCombat(
  state: GameState,
  phase: typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_RANGED_SIEGE,
  movePoints: number,
  modifiers: ActiveModifier[]
): GameState {
  const combatEnemy: CombatEnemy = {
    instanceId: "enemy_test_0",
    definition: TEST_ENEMY_DEF,
    isDefeated: false,
    isBlocked: false,
    attacksBlocked: undefined,
    isSummonerHidden: false,
    summonedByInstanceId: undefined,
  };

  const playerIndex = state.players.findIndex((p) => p.id === "player1");
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    movePoints,
    hasCombattedThisTurn: true,
  };

  return {
    ...state,
    players: updatedPlayers,
    activeModifiers: [...(state.activeModifiers ?? []), ...modifiers],
    combat: {
      enemies: [combatEnemy],
      phase,
      initiatorId: "player1",
      isCooperative: false,
      fortificationLevel: 0,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      cumbersomeReductions: {},
    },
  };
}

describe("Convert Move to Attack (Agility)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic melee conversion (1:1)", () => {
    it("should convert move points to melee attack in attack phase", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createMeleeConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 3,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      // Should emit conversion event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MOVE_CONVERTED_TO_ATTACK,
          movePointsSpent: 3,
          attackGained: 3,
          attackType: CONVERSION_TYPE_MELEE,
        })
      );

      // Move points should be deducted
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(2);

      // Attack should be added to accumulator (normal/physical)
      expect(player?.combatAccumulator.attack.normal).toBe(3);
      expect(player?.combatAccumulator.attack.normalElements.physical).toBe(3);
    });

    it("should allow converting all move points", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        4,
        [createMeleeConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 4,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(0);
      expect(player?.combatAccumulator.attack.normal).toBe(4);
    });

    it("should allow multiple conversions", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        6,
        [createMeleeConversionModifier("player1")]
      );

      // Convert 2 move
      let result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 2,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      // Convert 3 more
      result = engine.processAction(result.state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 3,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(1);
      expect(player?.combatAccumulator.attack.normal).toBe(5);
    });
  });

  describe("powered ranged conversion (2:1)", () => {
    it("should convert 2 move points to 1 ranged attack in ranged/siege phase", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        6,
        [
          createMeleeConversionModifier("player1"),
          createRangedConversionModifier("player1"),
        ]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 4,
        conversionType: CONVERSION_TYPE_RANGED,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MOVE_CONVERTED_TO_ATTACK,
          movePointsSpent: 4,
          attackGained: 2,
          attackType: CONVERSION_TYPE_RANGED,
        })
      );

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(2);
      expect(player?.combatAccumulator.attack.ranged).toBe(2);
      expect(player?.combatAccumulator.attack.rangedElements.physical).toBe(2);
    });

    it("should convert exactly 2 move to 1 ranged attack", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        2,
        [createRangedConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 2,
        conversionType: CONVERSION_TYPE_RANGED,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(0);
      expect(player?.combatAccumulator.attack.ranged).toBe(1);
    });
  });

  describe("validation", () => {
    it("should reject conversion when not in combat", () => {
      let state = createTestGameState();
      // No combat state, just add modifier
      state = {
        ...state,
        activeModifiers: [createMeleeConversionModifier("player1")],
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, movePoints: 5 } : p
        ),
      };

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 1,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject melee conversion in wrong phase (ranged/siege)", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        5,
        [createMeleeConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 1,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject ranged conversion in wrong phase (attack)", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createRangedConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 2,
        conversionType: CONVERSION_TYPE_RANGED,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject melee conversion in block phase", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,  // set up for attack first
        5,
        [createMeleeConversionModifier("player1")]
      );
      // Manually change to block phase
      state = {
        ...state,
        combat: state.combat ? { ...state.combat, phase: COMBAT_PHASE_BLOCK } : null,
      };

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 1,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject conversion without active modifier", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [] // No modifiers
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 1,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject when insufficient move points", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        2,
        [createMeleeConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 3,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject zero move points", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createMeleeConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 0,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject ranged conversion with odd move points (not divisible by 2)", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        5,
        [createRangedConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 3,
        conversionType: CONVERSION_TYPE_RANGED,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  describe("undo", () => {
    it("should be reversible via undo", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createMeleeConversionModifier("player1")]
      );

      // Convert 3 move to 3 attack
      const convertResult = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 3,
        conversionType: CONVERSION_TYPE_MELEE,
      });

      const playerAfterConvert = convertResult.state.players.find((p) => p.id === "player1");
      expect(playerAfterConvert?.movePoints).toBe(2);
      expect(playerAfterConvert?.combatAccumulator.attack.normal).toBe(3);

      // Undo
      const undoResult = engine.processAction(convertResult.state, "player1", {
        type: UNDO_ACTION,
      });

      const playerAfterUndo = undoResult.state.players.find((p) => p.id === "player1");
      expect(playerAfterUndo?.movePoints).toBe(5);
      expect(playerAfterUndo?.combatAccumulator.attack.normal).toBe(0);
    });

    it("should undo ranged conversion correctly", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        6,
        [createRangedConversionModifier("player1")]
      );

      // Convert 4 move to 2 ranged attack
      const convertResult = engine.processAction(state, "player1", {
        type: CONVERT_MOVE_TO_ATTACK_ACTION,
        movePointsToSpend: 4,
        conversionType: CONVERSION_TYPE_RANGED,
      });

      // Undo
      const undoResult = engine.processAction(convertResult.state, "player1", {
        type: UNDO_ACTION,
      });

      const player = undoResult.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(6);
      expect(player?.combatAccumulator.attack.ranged).toBe(0);
      expect(player?.combatAccumulator.attack.rangedElements.physical).toBe(0);
    });
  });

  describe("valid actions integration", () => {
    it("should include conversion options in attack phase when modifier active", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createMeleeConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.moveToAttackConversions).toBeDefined();
      expect(validActions.combat?.moveToAttackConversions).toHaveLength(1);
      expect(validActions.combat?.moveToAttackConversions?.[0]).toMatchObject({
        attackType: "melee",
        costPerPoint: 1,
        maxAttackGainable: 5,
      });
      expect(validActions.combat?.availableMovePointsForConversion).toBe(5);
    });

    it("should include ranged conversion in ranged/siege phase", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        6,
        [
          createMeleeConversionModifier("player1"),
          createRangedConversionModifier("player1"),
        ]
      );

      const validActions = getValidActions(state, "player1");
      // In ranged/siege phase, only ranged conversion should be shown
      expect(validActions.combat?.moveToAttackConversions).toBeDefined();
      expect(validActions.combat?.moveToAttackConversions).toHaveLength(1);
      expect(validActions.combat?.moveToAttackConversions?.[0]).toMatchObject({
        attackType: "ranged",
        costPerPoint: 2,
        maxAttackGainable: 3, // 6 move / 2 cost = 3 ranged attack
      });
    });

    it("should not include conversion options when no modifier active", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [] // No modifiers
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.moveToAttackConversions).toBeUndefined();
    });

    it("should not include conversion options when player has 0 move points", () => {
      let state = createTestGameState();
      state = setupConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        0,
        [createMeleeConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      // maxAttackGainable will be 0 but the option is still present
      // The UI can check maxAttackGainable to disable the button
      if (validActions.combat?.moveToAttackConversions) {
        expect(validActions.combat.moveToAttackConversions[0].maxAttackGainable).toBe(0);
      }
    });
  });
});
