import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  INVALID_ACTION,
  MANA_BLACK,
  MANA_GOLD,
  MANA_TOKEN_SOURCE_CARD,
  RESOLVE_CHOICE_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  UNDO_ACTION,
  USE_SKILL_ACTION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_SHAMANIC_RITUAL } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

function createKrangShamanState(overrides: Parameters<typeof createTestPlayer>[0] = {}) {
  const player = createTestPlayer({
    hero: Hero.Krang,
    skills: [SKILL_KRANG_SHAMANIC_RITUAL],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
    ...overrides,
  });

  return createTestGameState({ players: [player] });
}

describe("Shamanic Ritual skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("creates a pending choice with all 6 mana colors", () => {
    const state = createKrangShamanState();

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.state.players[0].pendingChoice).not.toBeNull();
    expect(result.state.players[0].pendingChoice?.options).toHaveLength(6);
  });

  it("can choose gold mana and flips face-down", () => {
    const state = createKrangShamanState();

    const afterSkill = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    const afterChoice = engine.processAction(afterSkill.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 4,
    });

    expect(afterChoice.state.players[0].pureMana).toContainEqual({
      color: MANA_GOLD,
      source: MANA_TOKEN_SOURCE_CARD,
    });
    expect(afterChoice.state.players[0].skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
  });

  it("can choose black mana", () => {
    const state = createKrangShamanState();

    const afterSkill = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    const afterChoice = engine.processAction(afterSkill.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 5,
    });

    expect(afterChoice.state.players[0].pureMana).toContainEqual({
      color: MANA_BLACK,
      source: MANA_TOKEN_SOURCE_CARD,
    });
  });

  it("undoing mana choice restores pending choice and unflips skill", () => {
    const state = createKrangShamanState();

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });
    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 0,
    });
    expect(afterChoice.state.players[0].skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );

    const afterUndo = engine.processAction(afterChoice.state, "player1", {
      type: UNDO_ACTION,
    });

    expect(afterUndo.state.players[0].pendingChoice).not.toBeNull();
    expect(afterUndo.state.players[0].skillFlipState.flippedSkills).not.toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
  });

  it("shows flip-back as returnable skill when face-down and action available", () => {
    const state = createKrangShamanState({
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
    });

    const validActions = getValidActions(state, "player1");
    expect(validActions.mode).toBe("normal_turn");

    if (validActions.mode === "normal_turn") {
      expect(validActions.returnableSkills?.returnable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_KRANG_SHAMANIC_RITUAL })
      );
    }
  });

  it("flip-back consumes action and allows reuse in same round", () => {
    const state = createKrangShamanState({
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
      skillCooldowns: {
        usedThisRound: [SKILL_KRANG_SHAMANIC_RITUAL],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
    });

    const afterFlipBack = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    const playerAfterFlipBack = afterFlipBack.state.players[0];
    expect(playerAfterFlipBack.hasTakenActionThisTurn).toBe(true);
    expect(playerAfterFlipBack.skillFlipState.flippedSkills).not.toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
    expect(playerAfterFlipBack.skillCooldowns.usedThisRound).not.toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );

    const reuse = engine.processAction(afterFlipBack.state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });
    expect(reuse.events[0]?.type).not.toBe(INVALID_ACTION);
  });

  it("undoing flip-back restores action state and usedThisRound when originally present", () => {
    const state = createKrangShamanState({
      hasTakenActionThisTurn: false,
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
      skillCooldowns: {
        usedThisRound: [SKILL_KRANG_SHAMANIC_RITUAL],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
    });

    const afterFlipBack = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });
    const afterUndo = engine.processAction(afterFlipBack.state, "player1", {
      type: UNDO_ACTION,
    });

    const player = afterUndo.state.players[0];
    expect(player.hasTakenActionThisTurn).toBe(false);
    expect(player.skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
    expect(player.skillCooldowns.usedThisRound).toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
  });

  it("undoing flip-back keeps usedThisRound empty when originally absent", () => {
    const state = createKrangShamanState({
      hasTakenActionThisTurn: false,
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
    });

    const afterFlipBack = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });
    const afterUndo = engine.processAction(afterFlipBack.state, "player1", {
      type: UNDO_ACTION,
    });

    const player = afterUndo.state.players[0];
    expect(player.skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
    expect(player.skillCooldowns.usedThisRound).not.toContain(
      SKILL_KRANG_SHAMANIC_RITUAL
    );
  });

  it("rejects flip-back while resting", () => {
    const state = createKrangShamanState({
      isResting: true,
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
    });

    const result = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.events[0]?.type).toBe(INVALID_ACTION);
  });

  it("rejects flip-back after action already taken", () => {
    const state = createKrangShamanState({
      hasTakenActionThisTurn: true,
      skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
    });

    const result = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.events[0]?.type).toBe(INVALID_ACTION);
  });
});
