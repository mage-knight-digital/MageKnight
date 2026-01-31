/**
 * Tests for Shield Mastery skill (Tovak)
 *
 * Skill effect: Block 3, or Fire Block 2, or Ice Block 2.
 * This is a combat-only skill that provides a choice of defensive options.
 * Elemental blocks are efficient against matching attack elements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_SHIELD_MASTERY } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import type { CombatState } from "../../types/combat.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { ELEMENT_FIRE, ELEMENT_ICE } from "@mage-knight/shared";

function createTestCombat(phase: CombatState["phase"] = COMBAT_PHASE_BLOCK): CombatState {
  return {
    phase,
    enemies: [{
      instanceId: "enemy_0",
      definition: {
        id: "orc" as EnemyTokenId,
        name: "Orc",
        attack: 4,
        armor: 3,
        fame: 2,
        abilities: [],
        resistances: [],
      },
      isDefeated: false,
      isBlocked: false,
      damageAssigned: 0,
      modifiers: [],
    }],
    isAtFortifiedSite: false,
    woundsThisCombat: 0,
    fameGained: 0,
    pendingBlock: {},
  };
}

describe("Shield Mastery skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it and is in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_SHIELD_MASTERY,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_SHIELD_MASTERY);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [], // No skills learned
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_SHIELD_MASTERY], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if not in combat (combat-only skill)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: null, // Not in combat
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("pending choice", () => {
    it("should create pending choice with 3 options after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(3);
      expect(updatedPlayer.pendingChoice?.skillId).toBe(SKILL_TOVAK_SHIELD_MASTERY);
      expect(updatedPlayer.pendingChoice?.cardId).toBeNull();
    });
  });

  describe("block options", () => {
    it("should grant Block 3 when choosing first option (physical)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        combatAccumulator: {
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
          attack: 0,
          attackElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          attackSources: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      // Choose Block 3 (index 0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_RESOLVED,
        })
      );

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.combatAccumulator.block).toBe(3);
      expect(updatedPlayer.combatAccumulator.blockElements.physical).toBe(3);
      expect(updatedPlayer.pendingChoice).toBeNull();
    });

    it("should grant Fire Block 2 when choosing second option", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        combatAccumulator: {
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
          attack: 0,
          attackElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          attackSources: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      // Choose Fire Block 2 (index 1)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.combatAccumulator.block).toBe(2);
      expect(updatedPlayer.combatAccumulator.blockElements.fire).toBe(2);
      // Check block source has correct element
      expect(updatedPlayer.combatAccumulator.blockSources).toContainEqual(
        expect.objectContaining({ element: ELEMENT_FIRE, value: 2 })
      );
    });

    it("should grant Ice Block 2 when choosing third option", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        combatAccumulator: {
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
          attack: 0,
          attackElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          attackSources: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      // Choose Ice Block 2 (index 2)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.combatAccumulator.block).toBe(2);
      expect(updatedPlayer.combatAccumulator.blockElements.ice).toBe(2);
      // Check block source has correct element
      expect(updatedPlayer.combatAccumulator.blockSources).toContainEqual(
        expect.objectContaining({ element: ELEMENT_ICE, value: 2 })
      );
    });
  });

  describe("undo", () => {
    it("should be undoable before choice is made", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_SHIELD_MASTERY,
      });

      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_SHIELD_MASTERY);
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_TOVAK_SHIELD_MASTERY);
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when in combat and available", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_SHIELD_MASTERY,
        })
      );
    });

    it("should not show skill in valid actions when not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: null, // Not in combat
      });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or Shield Mastery is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_SHIELD_MASTERY,
          })
        );
      }
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_SHIELD_MASTERY],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_SHIELD_MASTERY], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or Shield Mastery is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_SHIELD_MASTERY,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [], // No skills
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(),
      });

      const validActions = getValidActions(state, "player1");

      // Skills should be undefined since no skills are available
      expect(validActions.skills).toBeUndefined();
    });
  });
});
