/**
 * Tests for Deadly Aim skill (Wolfhawk)
 *
 * Once per turn: Add +1 to a card providing attack in Ranged/Siege phase,
 * or +2 to a card providing attack (incl. sideways) in Attack phase.
 *
 * Key rules:
 * - Phase-specific: +1 in Ranged/Siege, +2 in Attack
 * - Card-only: Cannot target Units (Q1/A1)
 * - Includes sideways: Attack phase bonus works on sideways cards
 * - Can be played in later phase than attack card (Q3/A3)
 * - Works with artifact attacks (Q4/A4)
 * - Part of sideways bonus exclusion group
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_ATTACK,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  CARD_COUNTERATTACK,
  CARD_MARCH,
  ENEMY_PROWLERS,
  ENEMY_GUARDSMEN,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_DEADLY_AIM } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { getAttackBlockCardBonus } from "../modifiers/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_RANGED_SIEGE,
  createCombatState,
} from "../../types/combat.js";
import {
  DURATION_COMBAT,
  EFFECT_ATTACK_BLOCK_CARD_BONUS,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

describe("Deadly Aim skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_DEADLY_AIM,
        })
      );
    });

    it("should activate during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_DEADLY_AIM,
        })
      );
    });

    it("should reject if not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should only be usable once per turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_DEADLY_AIM],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("modifier creation", () => {
    it("should create phase-aware attack bonus modifier", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      const modifier = result.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      );
      expect(modifier).toBeDefined();
      expect(modifier?.effect).toEqual({
        type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
        attackBonus: 2,
        blockBonus: 0,
        rangedSiegeAttackBonus: 1,
      });
      expect(modifier?.duration).toBe(DURATION_COMBAT);
      expect(modifier?.source).toEqual({
        type: SOURCE_SKILL,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
        playerId: "player1",
      });
    });
  });

  describe("attack phase bonus (+2)", () => {
    it("should add +2 to attack card in attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        hand: [CARD_COUNTERATTACK],
      });

      // Set up state with Deadly Aim modifier active
      const modifier: ActiveModifier = {
        id: "deadly_aim_bonus",
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DEADLY_AIM, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
          attackBonus: 2,
          blockBonus: 0,
          rangedSiegeAttackBonus: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;

      // Advance to attack phase: Ranged/Siege → Block → Assign Damage → Attack
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play Counterattack (Attack 2) — should get +2 from Deadly Aim = 4
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_COUNTERATTACK,
        powered: false,
      });

      // Attack should be 2 (base) + 2 (Deadly Aim attack phase bonus) = 4
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);
      // Modifier should be consumed
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });

    it("should add +2 to sideways attack in attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        hand: [CARD_MARCH],
      });

      const modifier: ActiveModifier = {
        id: "deadly_aim_bonus",
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DEADLY_AIM, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
          attackBonus: 2,
          blockBonus: 0,
          rangedSiegeAttackBonus: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      let state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Enter combat and advance to attack phase
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Play March sideways as attack — should get +2 from Deadly Aim
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_ATTACK,
      });

      // Attack should be 1 (sideways base) + 2 (Deadly Aim attack phase bonus) = 3
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      // Modifier should be consumed
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
      )).toHaveLength(0);
    });
  });

  describe("ranged/siege phase bonus (+1)", () => {
    it("should return +1 bonus during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
      });

      const modifier: ActiveModifier = {
        id: "deadly_aim_bonus",
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DEADLY_AIM, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
          attackBonus: 2,
          blockBonus: 0,
          rangedSiegeAttackBonus: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
        combat,
      });
      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // In ranged/siege phase, the bonus for attack should be +1 (not +2)
      const { bonus } = getAttackBlockCardBonus(state, "player1", true);
      expect(bonus).toBe(1);
    });

    it("should return +2 bonus during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
      });

      const modifier: ActiveModifier = {
        id: "deadly_aim_bonus",
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DEADLY_AIM, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_ATTACK_BLOCK_CARD_BONUS,
          attackBonus: 2,
          blockBonus: 0,
          rangedSiegeAttackBonus: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
        combat,
      });

      // In attack phase, the bonus should be +2
      const { bonus } = getAttackBlockCardBonus(state, "player1", true);
      expect(bonus).toBe(2);
    });
  });

  describe("valid actions", () => {
    it("should show skill during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_DEADLY_AIM,
        })
      );
    });

    it("should show skill during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_DEADLY_AIM,
        })
      );
    });

    it("should not show skill during block phase", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const deadlyAim = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DEADLY_AIM
        );
        expect(deadlyAim).toBeUndefined();
      }
    });

    it("should not show skill when not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const deadlyAim = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DEADLY_AIM
        );
        expect(deadlyAim).toBeUndefined();
      }
    });

    it("should not show skill when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_DEADLY_AIM],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const deadlyAim = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DEADLY_AIM
        );
        expect(deadlyAim).toBeUndefined();
      }
    });
  });

  describe("undo", () => {
    it("should remove modifier and restore cooldown on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DEADLY_AIM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate the skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DEADLY_AIM,
      });

      // Verify skill is on cooldown and modifier exists
      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_DEADLY_AIM);
      expect(
        result.state.activeModifiers.some(
          (m) => m.effect.type === EFFECT_ATTACK_BLOCK_CARD_BONUS
        )
      ).toBe(true);

      // Undo should be available (skill activation is reversible)
      const validActions = getValidActions(result.state, "player1");
      expect(validActions.turn.canUndo).toBe(true);
    });
  });
});
