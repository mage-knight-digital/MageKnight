/**
 * Tests for Influence-to-Block Conversion (Diplomacy card)
 *
 * Basic Diplomacy: 1 influence = 1 physical block (BLOCK phase only)
 * Powered Diplomacy: 1 influence = 1 ice block OR 1 fire block (BLOCK phase only)
 *
 * All accumulated influence points from ANY source can be converted.
 * Conversion modifier lasts for the turn (DURATION_TURN).
 *
 * FAQ rulings:
 * S1: Not just Diplomacy's 2 influence — all influence from any card/source
 * S2: Playing other influence cards during combat block phase is allowed
 * S3: Influence-as-block only works during block phase
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import { getValidActions } from "../../../validActions/index.js";
import {
  CONVERT_INFLUENCE_TO_BLOCK_ACTION,
  INFLUENCE_CONVERTED_TO_BLOCK,
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
import { ELEMENT_PHYSICAL, ELEMENT_FIRE, ELEMENT_ICE } from "@mage-knight/shared";
import type { ActiveModifier } from "../../../../types/modifiers.js";
import {
  EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
  SCOPE_SELF,
  DURATION_TURN,
  SOURCE_CARD,
} from "../../../../types/modifierConstants.js";

// Simple test enemy
const TEST_ENEMY_DEF: EnemyDefinition = {
  id: "test_enemy" as EnemyId,
  name: "Test Enemy",
  color: "green",
  attack: 5,
  armor: 4,
  fame: 2,
  attackElement: ELEMENT_PHYSICAL,
  abilities: [],
  resistances: [],
};

/**
 * Create a physical block conversion modifier (basic Diplomacy)
 * 1 influence = 1 physical block
 */
function createPhysicalConversionModifier(playerId: string): ActiveModifier {
  return {
    source: { type: SOURCE_CARD, cardId: "diplomacy" as any, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
      costPerPoint: 1,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  };
}

/**
 * Create an ice block conversion modifier (powered Diplomacy, ice chosen)
 * 1 influence = 1 ice block
 */
function createIceConversionModifier(playerId: string): ActiveModifier {
  return {
    source: { type: SOURCE_CARD, cardId: "diplomacy" as any, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
      costPerPoint: 1,
      element: ELEMENT_ICE,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  };
}

/**
 * Create a fire block conversion modifier (powered Diplomacy, fire chosen)
 * 1 influence = 1 fire block
 */
function createFireConversionModifier(playerId: string): ActiveModifier {
  return {
    source: { type: SOURCE_CARD, cardId: "diplomacy" as any, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
      costPerPoint: 1,
      element: ELEMENT_FIRE,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  };
}

/**
 * Helper to set up combat state in BLOCK phase with influence conversion.
 */
function setupInfluenceConversionCombat(
  state: GameState,
  phase: typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_RANGED_SIEGE,
  influencePoints: number,
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
    influencePoints,
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

describe("Convert Influence to Block (Diplomacy)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic physical conversion (1:1)", () => {
    it("should convert influence points to physical block in block phase", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 3,
      });

      // Should emit conversion event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INFLUENCE_CONVERTED_TO_BLOCK,
          influencePointsSpent: 3,
          blockGained: 3,
          blockElement: "physical",
        })
      );

      // Influence should be deducted
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(2);

      // Block should be added to accumulator
      expect(player?.combatAccumulator.block).toBe(3);
      expect(player?.combatAccumulator.blockElements.physical).toBe(3);
    });

    it("should allow converting all influence points", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        4,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 4,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(0);
      expect(player?.combatAccumulator.block).toBe(4);
    });

    it("should allow multiple conversions (FAQ S1: all influence from any source)", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        8,
        [createPhysicalConversionModifier("player1")]
      );

      // Convert 3 influence
      let result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 3,
      });

      // Convert 2 more
      result = engine.processAction(result.state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 2,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(3);
      expect(player?.combatAccumulator.block).toBe(5);
    });
  });

  describe("powered elemental conversion", () => {
    it("should convert influence to ice block when ice modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        4,
        [createIceConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 3,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INFLUENCE_CONVERTED_TO_BLOCK,
          influencePointsSpent: 3,
          blockGained: 3,
          blockElement: "ice",
        })
      );

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(1);
      expect(player?.combatAccumulator.block).toBe(3);
      expect(player?.combatAccumulator.blockElements.ice).toBe(3);
    });

    it("should convert influence to fire block when fire modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [createFireConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 2,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INFLUENCE_CONVERTED_TO_BLOCK,
          influencePointsSpent: 2,
          blockGained: 2,
          blockElement: "fire",
        })
      );

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(3);
      expect(player?.combatAccumulator.block).toBe(2);
      expect(player?.combatAccumulator.blockElements.fire).toBe(2);
    });
  });

  describe("validation", () => {
    it("should reject conversion when not in combat", () => {
      let state = createTestGameState();
      state = {
        ...state,
        activeModifiers: [createPhysicalConversionModifier("player1")],
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, influencePoints: 5 } : p
        ),
      };

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject conversion in wrong phase - attack (FAQ S3: block phase only)", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_ATTACK,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject conversion in wrong phase - ranged/siege (FAQ S3: block phase only)", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_RANGED_SIEGE,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject conversion without active modifier", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [] // No modifiers
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject when insufficient influence points", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        2,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 3,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject zero influence points", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      const result = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 0,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  describe("undo", () => {
    it("should be reversible via undo", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      // Convert 3 influence to 3 block
      const convertResult = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 3,
      });

      const playerAfterConvert = convertResult.state.players.find((p) => p.id === "player1");
      expect(playerAfterConvert?.influencePoints).toBe(2);
      expect(playerAfterConvert?.combatAccumulator.block).toBe(3);

      // Undo
      const undoResult = engine.processAction(convertResult.state, "player1", {
        type: UNDO_ACTION,
      });

      const playerAfterUndo = undoResult.state.players.find((p) => p.id === "player1");
      expect(playerAfterUndo?.influencePoints).toBe(5);
      expect(playerAfterUndo?.combatAccumulator.block).toBe(0);
    });

    it("should undo ice conversion correctly", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        6,
        [createIceConversionModifier("player1")]
      );

      // Convert 4 influence to 4 ice block
      const convertResult = engine.processAction(state, "player1", {
        type: CONVERT_INFLUENCE_TO_BLOCK_ACTION,
        influencePointsToSpend: 4,
      });

      // Undo
      const undoResult = engine.processAction(convertResult.state, "player1", {
        type: UNDO_ACTION,
      });

      const player = undoResult.state.players.find((p) => p.id === "player1");
      expect(player?.influencePoints).toBe(6);
      expect(player?.combatAccumulator.block).toBe(0);
      expect(player?.combatAccumulator.blockElements.ice).toBe(0);
    });
  });

  describe("valid actions integration", () => {
    it("should include conversion option in block phase when modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [createPhysicalConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.influenceToBlockConversion).toBeDefined();
      expect(validActions.combat?.influenceToBlockConversion).toMatchObject({
        blockElement: "physical",
        costPerPoint: 1,
        maxBlockGainable: 5,
      });
      expect(validActions.combat?.availableInfluenceForConversion).toBe(5);
    });

    it("should include ice conversion option when ice modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        3,
        [createIceConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.influenceToBlockConversion).toMatchObject({
        blockElement: "ice",
        costPerPoint: 1,
        maxBlockGainable: 3,
      });
    });

    it("should include fire conversion option when fire modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        4,
        [createFireConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.influenceToBlockConversion).toMatchObject({
        blockElement: "fire",
        costPerPoint: 1,
        maxBlockGainable: 4,
      });
    });

    it("should not include conversion option when no modifier active", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        5,
        [] // No modifiers
      );

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.influenceToBlockConversion).toBeUndefined();
    });

    it("should not include conversion option when player has 0 influence", () => {
      let state = createTestGameState();
      state = setupInfluenceConversionCombat(
        state,
        COMBAT_PHASE_BLOCK,
        0,
        [createPhysicalConversionModifier("player1")]
      );

      const validActions = getValidActions(state, "player1");
      // maxBlockGainable is 0, so the option should not be included
      expect(validActions.combat?.influenceToBlockConversion).toBeUndefined();
    });
  });
});
