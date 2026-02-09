/**
 * Tests for Battle Frenzy skill (Krang)
 *
 * Once a turn: Attack 2, or you may flip this token to get Attack 4 instead
 * this turn. If you spend a turn resting, you may flip this token back.
 *
 * Key rules:
 * - S1: Attack can be used standalone (not combined with another attack)
 * - S2: Can rest without wounds to flip back
 * - S3: Automatically flips back at round start
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
  ENEMY_ORC,
  CARD_MARCH,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_BATTLE_FRENZY } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { createCombatState, COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import { processPlayerRoundReset } from "../commands/endRound/playerRoundReset.js";
import { createRng } from "../../utils/rng.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Battle Frenzy skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during attack phase and present 2 choices", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_BATTLE_FRENZY,
        })
      );

      // Should present pending choice with 2 options
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(2);
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_KRANG_BATTLE_FRENZY
      );
    });

    it("should reject if already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });

    it("should reject if not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });
  });

  describe("Attack 2 option (stay face-up)", () => {
    it("should grant Attack 2 when option 0 is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      let state = createTestGameState({ players: [player], combat });

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      }).state;

      // Choose option 0: Attack 2
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have 2 melee attack accumulated
      expect(state.players[0].combatAccumulator.attack.normal).toBe(2);
    });

    it("should keep skill face-up when Attack 2 is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      let state = createTestGameState({ players: [player], combat });

      // Activate and choose Attack 2
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skill should remain face-up
      expect(
        state.players[0].skillFlipState.flippedSkills
      ).not.toContain(SKILL_KRANG_BATTLE_FRENZY);
    });
  });

  describe("Attack 4 option (flip face-down)", () => {
    it("should grant Attack 4 when option 1 is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      let state = createTestGameState({ players: [player], combat });

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      }).state;

      // Choose option 1: Attack 4
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Should have 4 melee attack accumulated
      expect(state.players[0].combatAccumulator.attack.normal).toBe(4);
    });

    it("should flip skill face-down when Attack 4 is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      let state = createTestGameState({ players: [player], combat });

      // Activate and choose Attack 4
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Skill should be flipped face-down
      expect(
        state.players[0].skillFlipState.flippedSkills
      ).toContain(SKILL_KRANG_BATTLE_FRENZY);
    });
  });

  describe("face-down state blocks activation", () => {
    it("should reject activation when skill is face-down", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
        skillFlipState: {
          flippedSkills: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });

    it("should not appear in valid actions when face-down", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
        skillFlipState: {
          flippedSkills: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_KRANG_BATTLE_FRENZY
      );
      expect(found).toBeUndefined();
    });
  });

  describe("valid actions", () => {
    it("should appear in valid actions during attack phase when face-up", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions).toBeDefined();
      expect(skillOptions!.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_BATTLE_FRENZY,
        })
      );
    });

    it("should not appear in valid actions outside combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_KRANG_BATTLE_FRENZY
      );
      expect(found).toBeUndefined();
    });
  });

  describe("rest flip-back (S2)", () => {
    it("should flip skill back face-up when resting", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [CARD_MARCH],
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
        skillFlipState: {
          flippedSkills: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Declare rest
      state = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      }).state;

      // Complete rest (discard the march card)
      state = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH],
        announceEndOfRound: false,
      }).state;

      // Skill should be flipped back face-up
      expect(
        state.players[0].skillFlipState.flippedSkills
      ).not.toContain(SKILL_KRANG_BATTLE_FRENZY);
    });

    it("should allow resting without wounds to flip back (S2)", () => {
      // Player has no wounds - just a regular card
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [CARD_MARCH],
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
        skillFlipState: {
          flippedSkills: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Declare rest
      state = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      }).state;

      // Complete rest
      state = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH],
        announceEndOfRound: false,
      }).state;

      // Skill should be flipped back
      expect(state.players[0].skillFlipState.flippedSkills).toHaveLength(0);
    });
  });

  describe("round-start flip-back (S3)", () => {
    it("should automatically flip back at round start", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
        skillFlipState: {
          flippedSkills: [SKILL_KRANG_BATTLE_FRENZY],
        },
      });

      // Verify the flip state exists before round reset
      expect(player.skillFlipState.flippedSkills).toContain(
        SKILL_KRANG_BATTLE_FRENZY
      );

      // Test via the round reset function directly
      const state = createTestGameState({ players: [player] });
      const result = processPlayerRoundReset(state, createRng(42));

      // After round reset, flipped skills should be empty
      expect(result.players[0].skillFlipState.flippedSkills).toHaveLength(0);
    });
  });

  describe("standalone attack (S1)", () => {
    it("should be usable as standalone attack without another attack source", () => {
      // Player has no attack cards in hand - only Battle Frenzy for attack
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        skills: [SKILL_KRANG_BATTLE_FRENZY],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      combat.phase = COMBAT_PHASE_ATTACK;
      let state = createTestGameState({ players: [player], combat });

      // Activate Battle Frenzy as sole attack source
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_FRENZY,
      }).state;

      // Choose Attack 2
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have 2 attack accumulated - no other attack source needed
      expect(state.players[0].combatAccumulator.attack.normal).toBe(2);
    });
  });
});
