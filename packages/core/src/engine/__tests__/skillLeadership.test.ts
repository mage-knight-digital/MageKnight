/**
 * Tests for Leadership skill (Norowas)
 *
 * Skill: Once per turn, when activating a Unit, add +3 to its Block,
 * or +2 to its Attack, or +1 to its Ranged (not Siege) Attack.
 *
 * Key rules:
 * - Bonus only applies to units that have the matching base ability (FAQ S1)
 * - In Attack Phase, +2 Attack applies to Siege/Ranged units too (FAQ S2)
 * - Bonus inherits element from unit ability
 * - Bonus inherits efficiency modifiers (2x vs Swift) (FAQ S4)
 * - Only one unit per turn can receive the bonus
 * - Works with Call to Arms activated units (FAQ Q3)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
  ACTIVATE_UNIT_ACTION,
  UNIT_STATE_SPENT,
  UNIT_PEASANTS,
  UNIT_UTEM_GUARDSMEN,
  UNIT_CATAPULTS,
  UNIT_UTEM_CROSSBOWMEN,
  ENEMY_PROWLERS,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_LEADERSHIP } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { createPlayerUnit } from "../../types/unit.js";
import { createCombatState } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { EFFECT_LEADERSHIP_BONUS } from "../../types/modifierConstants.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Leadership skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during combat and present 3 choices", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_LEADERSHIP,
        })
      );

      // Should present pending choice with 3 options
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(3);
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_NOROWAS_LEADERSHIP
      );
    });

    it("should reject if not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject if already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_NOROWAS_LEADERSHIP],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should be available in all combat phases", () => {
      for (const phase of [COMBAT_PHASE_RANGED_SIEGE, COMBAT_PHASE_BLOCK, COMBAT_PHASE_ATTACK]) {
        const player = createTestPlayer({
          hero: Hero.Norowas,
          skills: [SKILL_NOROWAS_LEADERSHIP],
          skillCooldowns: { ...defaultCooldowns },
        });
        const combat = { ...createCombatState([ENEMY_PROWLERS]), phase };
        const state = createTestGameState({ players: [player], combat });

        const validActions = getValidActions(state, "player1");
        const skills = getSkillsFromValidActions(validActions);
        expect(skills).toBeDefined();
        expect(skills?.activatable).toContainEqual(
          expect.objectContaining({ skillId: SKILL_NOROWAS_LEADERSHIP })
        );
      }
    });
  });

  describe("choice resolution - creates modifier", () => {
    it("should create Leadership block bonus modifier when choosing Block +3", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      // Choose Block +3 (index 0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({ type: CHOICE_RESOLVED })
      );

      // Should have a Leadership bonus modifier in active modifiers
      const leadershipMod = afterChoice.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeDefined();
      expect(leadershipMod?.effect).toEqual(
        expect.objectContaining({
          type: EFFECT_LEADERSHIP_BONUS,
          bonusType: "block",
          amount: 3,
        })
      );
    });

    it("should create Leadership attack bonus modifier when choosing Attack +2", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      // Choose Attack +2 (index 1)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      const leadershipMod = afterChoice.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod?.effect).toEqual(
        expect.objectContaining({
          type: EFFECT_LEADERSHIP_BONUS,
          bonusType: "attack",
          amount: 2,
        })
      );
    });

    it("should create Leadership ranged bonus modifier when choosing Ranged +1", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });

      // Choose Ranged +1 (index 2)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      const leadershipMod = afterChoice.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod?.effect).toEqual(
        expect.objectContaining({
          type: EFFECT_LEADERSHIP_BONUS,
          bonusType: "ranged_attack",
          amount: 1,
        })
      );
    });
  });

  describe("Peasants - Block +3 or Attack +2 (has both abilities)", () => {
    it("should add +3 Block when Peasant uses Block ability with Block bonus", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Block +3
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Block +3
      });

      // Activate Peasant Block ability (index 1: Block 2)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_1",
        abilityIndex: 1, // Block ability
      });

      // Peasant Block 2 + Leadership +3 = Block 5
      expect(afterActivate.state.players[0].combatAccumulator.block).toBe(5);
      expect(afterActivate.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Leadership modifier should be consumed
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeUndefined();
    });

    it("should add +2 Attack when Peasant uses Attack ability with Attack bonus", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // Activate Peasant Attack ability (index 0: Attack 2)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_1",
        abilityIndex: 0, // Attack ability
      });

      // Peasant Attack 2 + Leadership +2 = Attack 4
      expect(afterActivate.state.players[0].combatAccumulator.attack.normal).toBe(4);
    });
  });

  describe("Thugs - Block only for Attack (effect-based), no Ranged", () => {
    // Thugs have Block 3 (value-based) and Attack 3 (effect-based)
    // Leadership bonus only applies to value-based abilities
    it("should add +3 Block when Thugs use Block ability with Block bonus", () => {
      const unit = createPlayerUnit("thugs" as never, "thugs_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Block +3
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Block +3
      });

      // Activate Thugs Block ability (index 0: Block 3)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 0, // Block ability
      });

      // Thugs Block 3 + Leadership +3 = Block 6
      expect(afterActivate.state.players[0].combatAccumulator.block).toBe(6);
    });
  });

  describe("Catapults - Siege Attack (FAQ S2)", () => {
    it("should NOT apply +2 Attack bonus to Catapults in Ranged/Siege phase", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapults_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      // Ranged/Siege phase
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // Activate Catapults Siege Attack 3 (index 0)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapults_1",
        abilityIndex: 0, // Siege Attack 3
      });

      // Siege Attack in Ranged/Siege phase: Leadership Attack bonus does NOT apply
      // Catapults Siege 3, no bonus
      expect(afterActivate.state.players[0].combatAccumulator.attack.siege).toBe(3);

      // Leadership modifier should NOT be consumed (didn't apply)
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeDefined();
    });

    it("should apply +2 Attack bonus to Catapults in Attack phase (FAQ S2)", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapults_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      // Attack phase
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // Activate Catapults Siege Attack 3 (index 0)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapults_1",
        abilityIndex: 0, // Siege Attack 3
      });

      // In Attack Phase, +2 Attack applies to Siege units too
      // Catapults Siege 3 + Leadership +2 = Siege 5
      expect(afterActivate.state.players[0].combatAccumulator.attack.siege).toBe(5);

      // Leadership modifier should be consumed
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeUndefined();
    });

    it("should NOT apply Ranged +1 bonus to Catapults (Siege, not Ranged)", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapults_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Ranged +1
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2, // Ranged +1
      });

      // Activate Catapults Siege Attack 3 (index 0)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapults_1",
        abilityIndex: 0,
      });

      // Ranged bonus does NOT apply to Siege Attack
      expect(afterActivate.state.players[0].combatAccumulator.attack.siege).toBe(3);

      // Leadership modifier should NOT be consumed
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeDefined();
    });
  });

  describe("Utem Guardsmen - Block with countsTwiceAgainstSwift (FAQ S4)", () => {
    it("should add +3 Block that also counts twice against Swift", () => {
      const unit = createPlayerUnit(UNIT_UTEM_GUARDSMEN, "guardsmen_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Block +3
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Block +3
      });

      // Activate Utem Guardsmen Block 4 (index 1, countsTwiceAgainstSwift)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardsmen_1",
        abilityIndex: 1, // Block 4 ability
      });

      // Block 4 + Leadership +3 = Block 7
      expect(afterActivate.state.players[0].combatAccumulator.block).toBe(7);
      // The entire amount (base + bonus) should be in swiftBlockElements
      // because countsTwiceAgainstSwift applies to the full ability value
      expect(
        afterActivate.state.players[0].combatAccumulator.swiftBlockElements.physical
      ).toBe(7);
    });
  });

  describe("Utem Crossbowmen - Ranged Attack", () => {
    it("should add +1 Ranged Attack when using Ranged ability with Ranged bonus", () => {
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Ranged +1
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2, // Ranged +1
      });

      // Activate Utem Crossbowmen Ranged Attack 2 (index 1)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "crossbow_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Ranged Attack 2 + Leadership +1 = Ranged Attack 3
      expect(afterActivate.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Leadership modifier should be consumed
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeUndefined();
    });
  });

  describe("element inheritance", () => {
    it("should inherit physical element from unit ability", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // Activate Peasant Attack 2 (physical element)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_1",
        abilityIndex: 0,
      });

      // Total attack should be physical (2 + 2 = 4)
      expect(afterActivate.state.players[0].combatAccumulator.attack.normalElements.physical).toBe(4);
    });
  });

  describe("one unit per turn limit", () => {
    it("should only apply to one unit activation, then be consumed", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const unit2 = createPlayerUnit(UNIT_PEASANTS, "peasant_2");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit1, unit2],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // First unit: Attack 2 + Leadership +2 = 4
      const afterFirst = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_1",
        abilityIndex: 0,
      });
      expect(afterFirst.state.players[0].combatAccumulator.attack.normal).toBe(4);

      // Second unit: Attack 2, no bonus (modifier consumed)
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_2",
        abilityIndex: 0,
      });
      // 4 from first + 2 from second = 6 (not 8)
      expect(afterSecond.state.players[0].combatAccumulator.attack.normal).toBe(6);
    });
  });

  describe("non-matching ability does not consume modifier", () => {
    it("should not consume Attack bonus when unit uses Block ability", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
        units: [unit],
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Leadership and choose Attack +2
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEADERSHIP,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack +2
      });

      // Activate Peasant Block ability (index 1: Block 2)
      const afterActivate = engine.processAction(afterChoice.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasant_1",
        abilityIndex: 1, // Block ability
      });

      // Block should be just 2 (no bonus from Attack modifier)
      expect(afterActivate.state.players[0].combatAccumulator.block).toBe(2);

      // Leadership modifier should still be present (not consumed)
      const leadershipMod = afterActivate.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_LEADERSHIP_BONUS
      );
      expect(leadershipMod).toBeDefined();
    });
  });

  describe("valid actions", () => {
    it("should show Leadership in valid actions during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_NOROWAS_LEADERSHIP })
      );
    });

    it("should not show Leadership outside combat", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({ skillId: SKILL_NOROWAS_LEADERSHIP })
        );
      }
    });

    it("should not show Leadership when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEADERSHIP],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_NOROWAS_LEADERSHIP],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({ skillId: SKILL_NOROWAS_LEADERSHIP })
        );
      }
    });
  });
});
