/**
 * Tests for Spirit Guides skill (Krang)
 *
 * Once a turn: Move 1 and you may add +1 to a Block of any type in the Block phase.
 *
 * FAQ Rulings:
 * - S1: +1 applies to any block source (cards, skills, units)
 * - S2: Works with Diplomacy's Influence-to-Block (including elemental)
 * - S3: Move is immediate; +1 Block persists throughout Block phase
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_SPIRIT_GUIDES } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import type { CombatState } from "../../types/combat.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { EFFECT_COMBAT_VALUE, COMBAT_VALUE_BLOCK, SCOPE_SELF } from "../../types/modifierConstants.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as string[],
    usedThisTurn: [] as string[],
    usedThisCombat: [] as string[],
    activeUntilNextTurn: [] as string[],
  };
}

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
    pendingSwiftBlock: {},
    pendingDamage: {},
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    combatContext: "standard",
  };
}

describe("Spirit Guides skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================================
  // ACTIVATION: Move 1 + Block modifier
  // ============================================================================

  describe("activation", () => {
    it("should grant Move 1 immediately on activation", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_SPIRIT_GUIDES,
        })
      );

      expect(result.state.players[0].movePoints).toBe(1);
    });

    it("should apply +1 Block modifier on activation", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      // Check that a CombatValue block modifier was applied
      const blockModifiers = result.state.activeModifiers.filter(
        (m) =>
          m.effect.type === EFFECT_COMBAT_VALUE &&
          m.effect.valueType === COMBAT_VALUE_BLOCK &&
          m.effect.amount === 1
      );
      expect(blockModifiers).toHaveLength(1);
      expect(blockModifiers[0].scope.type).toBe(SCOPE_SELF);
    });

    it("should activate both outside and inside combat", () => {
      // Outside combat - move point is useful
      const playerOutside = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
        movePoints: 0,
      });
      const stateOutside = createTestGameState({ players: [playerOutside] });

      const resultOutside = engine.processAction(stateOutside, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(resultOutside.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );

      // Inside combat - block bonus is useful
      const playerInside = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
        movePoints: 0,
      });
      const stateInside = createTestGameState({
        players: [playerInside],
        combat: createTestCombat(),
      });

      const resultInside = engine.processAction(stateInside, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(resultInside.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );
    });
  });

  // ============================================================================
  // ONCE PER TURN USAGE
  // ============================================================================

  describe("once per turn", () => {
    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_KRANG_SPIRIT_GUIDES);
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_KRANG_SPIRIT_GUIDES],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("undo", () => {
    it("should be undoable after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      expect(afterSkill.state.players[0].movePoints).toBe(1);
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_KRANG_SPIRIT_GUIDES);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].movePoints).toBe(0);
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_KRANG_SPIRIT_GUIDES);

      // Block modifier should be removed
      const blockModifiers = afterUndo.state.activeModifiers.filter(
        (m) =>
          m.effect.type === EFFECT_COMBAT_VALUE &&
          m.effect.valueType === COMBAT_VALUE_BLOCK
      );
      expect(blockModifiers).toHaveLength(0);
    });
  });

  // ============================================================================
  // VALID ACTIONS
  // ============================================================================

  describe("valid actions", () => {
    it("should show skill in valid actions when available outside combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_SPIRIT_GUIDES,
        })
      );
    });

    it("should show skill in valid actions when in combat block phase", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({
        players: [player],
        combat: createTestCombat(COMBAT_PHASE_BLOCK),
      });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_SPIRIT_GUIDES,
        })
      );
    });

    it("should not show skill when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_KRANG_SPIRIT_GUIDES],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_KRANG_SPIRIT_GUIDES,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      expect(getSkillsFromValidActions(validActions)).toBeUndefined();
    });
  });

  // ============================================================================
  // BLOCK BONUS APPLICATION (S1 - Any block source)
  // ============================================================================

  describe("block bonus modifier", () => {
    it("should create a turn-duration modifier", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      const blockModifier = result.state.activeModifiers.find(
        (m) =>
          m.effect.type === EFFECT_COMBAT_VALUE &&
          m.effect.valueType === COMBAT_VALUE_BLOCK
      );

      expect(blockModifier).toBeDefined();
      expect(blockModifier!.duration).toBe("turn");
      expect(blockModifier!.effect.type).toBe(EFFECT_COMBAT_VALUE);
    });

    it("should apply +1 to block regardless of element (S1)", () => {
      // The CombatValueModifier with no element field applies to all elements
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_SPIRIT_GUIDES],
        skillCooldowns: buildSkillCooldowns(),
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_SPIRIT_GUIDES,
      });

      const blockModifier = result.state.activeModifiers.find(
        (m) =>
          m.effect.type === EFFECT_COMBAT_VALUE &&
          m.effect.valueType === COMBAT_VALUE_BLOCK
      );

      // No element restriction means it applies to physical, fire, ice, cold fire
      expect(blockModifier!.effect).not.toHaveProperty("element");
    });
  });
});
