/**
 * Tests for Mana Overload skill (Tovak)
 *
 * Skill effect: Once per round (interactive), choose a non-gold color and gain
 * a mana token of that color. Put skill in center with color marker.
 * First player to power a Deed card with that color that gives Move/Influence/
 * Attack/Block gets +4 from that card and returns the skill face down.
 *
 * Key rules:
 * - Once per round (interactive)
 * - Units don't trigger the +4 (units are not "cards")
 * - Mana payment effects (Pure Magic, Mana Bolt) don't count as "powering"
 * - Indirect effects don't trigger
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNDO_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  MANA_OVERLOAD_TRIGGERED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
  MANA_SOURCE_TOKEN,
  CARD_MARCH,
  CARD_RAGE,
  CARD_PROMISE,
  CARD_DETERMINATION,
  CARD_TRANQUILITY,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_MANA_OVERLOAD } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { COMBAT_PHASE_BLOCK, COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Mana Overload skill (Tovak)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation - color choice", () => {
    it("should create a pending choice with 5 non-gold colors", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        })
      );

      // Should have a pending choice with 5 options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(5);
    });

    it("should gain mana token after resolving color choice", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      // Choose green (index 2 = green in the order red, blue, green, white, black)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      // Should have gained a green mana token
      expect(afterChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // Should have set up center state
      expect(afterChoice.state.manaOverloadCenter).toEqual({
        markedColor: MANA_GREEN,
        ownerId: "player1",
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });
    });

    it("should place skill in center with correct color after red choice", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      // Choose red (index 0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.state.manaOverloadCenter).toEqual({
        markedColor: MANA_RED,
        ownerId: "player1",
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      expect(afterChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("cooldown", () => {
    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_TOVAK_MANA_OVERLOAD);
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [SKILL_TOVAK_MANA_OVERLOAD],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [SKILL_TOVAK_MANA_OVERLOAD],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_MANA_OVERLOAD,
          })
        );
      }
    });
  });

  describe("trigger - powered card with matching color", () => {
    it("should grant +4 move when powering a Move card with matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_GREEN,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // March powered gives Move 4 + Mana Overload +4 = 8
      expect(result.state.players[0].movePoints).toBe(8);

      // Should have triggered event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_OVERLOAD_TRIGGERED,
          playerId: "player1",
          bonusType: "move",
          bonusAmount: 4,
        })
      );

      // Center should be cleared
      expect(result.state.manaOverloadCenter).toBeNull();
    });

    it("should grant +4 attack when powering an Attack card with matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_RAGE],
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        manaOverloadCenter: {
          markedColor: MANA_RED,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Rage powered gives Attack 4 + Mana Overload +4 = 8
      expect(
        result.state.players[0].combatAccumulator.attack.normal
      ).toBe(8);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_OVERLOAD_TRIGGERED,
          bonusType: "attack",
        })
      );
    });

    it("should grant +4 influence when powering an Influence card with matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_PROMISE],
        pureMana: [{ color: MANA_WHITE, source: MANA_TOKEN_SOURCE_CARD }],
        influencePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_WHITE,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_PROMISE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Promise powered gives Influence 4 + Mana Overload +4 = 8
      expect(result.state.players[0].influencePoints).toBe(8);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_OVERLOAD_TRIGGERED,
          bonusType: "influence",
        })
      );
    });

    it("should grant +4 block when powering a Block card with matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_DETERMINATION],
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
        manaOverloadCenter: {
          markedColor: MANA_BLUE,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_DETERMINATION,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Determination powered gives Block 5 + Mana Overload +4 = 9
      expect(result.state.players[0].combatAccumulator.block).toBe(9);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_OVERLOAD_TRIGGERED,
          bonusType: "block",
        })
      );
    });

    it("should return skill to owner face-down after trigger", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
        skillFlipState: { flippedSkills: [] },
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_GREEN,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Skill should be flipped (face-down)
      expect(
        result.state.players[0].skillFlipState.flippedSkills
      ).toContain(SKILL_TOVAK_MANA_OVERLOAD);
    });
  });

  describe("non-trigger scenarios", () => {
    it("should not trigger when card is not powered", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_GREEN,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
      });

      // March basic gives Move 2, no +4 bonus
      expect(result.state.players[0].movePoints).toBe(2);

      // Center should still be active
      expect(result.state.manaOverloadCenter).not.toBeNull();
    });

    it("should not trigger when mana color does not match", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_RED, // Red, but card uses green
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // March powered gives Move 4, no +4 bonus (color mismatch)
      expect(result.state.players[0].movePoints).toBe(4);

      // Center should still be active
      expect(result.state.manaOverloadCenter).not.toBeNull();
    });

    it("should not trigger when powered effect has no Move/Influence/Attack/Block", () => {
      // Tranquility powered gives Heal 2 or Draw 2 — no applicable type
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_TRANQUILITY],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: {
          markedColor: MANA_GREEN,
          ownerId: "player1",
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_TRANQUILITY,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Center should still be active (tranquility only gives heal/draw)
      expect(result.state.manaOverloadCenter).not.toBeNull();
    });

    it("should not trigger when manaOverloadCenter is null", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player],
        manaOverloadCenter: null,
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // March powered gives Move 4, no bonus
      expect(result.state.players[0].movePoints).toBe(4);
    });
  });

  describe("multiplayer trigger", () => {
    it("should allow another player to trigger the bonus", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        hand: [CARD_MARCH],
        skillFlipState: { flippedSkills: [] },
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
        movePoints: 0,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // Player 2's turn
        manaOverloadCenter: {
          markedColor: MANA_GREEN,
          ownerId: "player1", // Player 1 owns the skill
          skillId: SKILL_TOVAK_MANA_OVERLOAD,
        },
      });

      const result = engine.processAction(state, "player2", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Player 2 gets +4 move: March 4 + bonus 4 = 8
      expect(result.state.players[1].movePoints).toBe(8);

      // Skill returns to player 1 (owner) face-down
      expect(
        result.state.players[0].skillFlipState.flippedSkills
      ).toContain(SKILL_TOVAK_MANA_OVERLOAD);

      // Center should be cleared
      expect(result.state.manaOverloadCenter).toBeNull();

      // Event should reference both players
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_OVERLOAD_TRIGGERED,
          playerId: "player2",
          ownerId: "player1",
        })
      );
    });
  });

  describe("undo", () => {
    it("should undo skill activation and clear pending choice", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      // Should have pending choice
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Should clear pending choice
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();

      // Should remove from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_TOVAK_MANA_OVERLOAD);
    });

    it("should undo choice resolution and clear center", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MANA_OVERLOAD],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MANA_OVERLOAD,
      });

      // Choose green (index 2)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      // Verify center was set
      expect(afterChoice.state.manaOverloadCenter).not.toBeNull();
      expect(afterChoice.state.players[0].pureMana).toHaveLength(1);

      // Undo the choice
      const afterUndo = engine.processAction(afterChoice.state, "player1", {
        type: UNDO_ACTION,
      });

      // Center should be cleared
      expect(afterUndo.state.manaOverloadCenter).toBeNull();

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);

      // Should have pending choice again
      expect(afterUndo.state.players[0].pendingChoice).not.toBeNull();
    });
  });
});
