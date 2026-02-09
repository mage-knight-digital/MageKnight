import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestHex, createTestPlayer } from "./testHelpers.js";
import {
  INVALID_ACTION,
  MANA_GREEN,
  MANA_TOKEN_SOURCE_CARD,
  MIN_REPUTATION,
  RECRUIT_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  UNDO_ACTION,
  UNIT_THUGS,
  USE_SKILL_ACTION,
  hexKey,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_KRANG_ARCANE_DISGUISE,
} from "../../data/skills/index.js";
import { SiteType } from "../../types/map.js";
import { getValidActions } from "../validActions/index.js";
import { isRuleActive } from "../modifiers/index.js";
import { getReputationCostModifier } from "../rules/unitRecruitment.js";
import { validateReputationNotX } from "../validators/units/recruitmentValidators.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_IGNORE_REPUTATION,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

function createArcaneState(overrides: Parameters<typeof createTestPlayer>[0] = {}) {
  const player = createTestPlayer({
    hero: Hero.Krang,
    skills: [SKILL_KRANG_ARCANE_DISGUISE],
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

describe("Arcane Disguise skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("creates a pending choice with 2 options", () => {
    const state = createArcaneState();

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });

    expect(result.state.players[0].pendingChoice).not.toBeNull();
    expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
  });

  it("choice 0 grants Influence 2 and stays face-up", () => {
    const state = createArcaneState();

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });
    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 0,
    });

    expect(afterChoice.state.players[0].influencePoints).toBe(2);
    expect(afterChoice.state.players[0].skillFlipState.flippedSkills).not.toContain(
      SKILL_KRANG_ARCANE_DISGUISE
    );
  });

  it("choice 1 applies ignore-reputation rule and flips face-down", () => {
    const state = createArcaneState();

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });
    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 1,
    });

    expect(afterChoice.state.players[0].skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_ARCANE_DISGUISE
    );
    expect(
      isRuleActive(afterChoice.state, "player1", RULE_IGNORE_REPUTATION)
    ).toBe(true);
  });

  it("shows flip-back as returnable skill when face-down and green mana is available", () => {
    const state = createArcaneState({
      skillFlipState: { flippedSkills: [SKILL_KRANG_ARCANE_DISGUISE] },
      pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
    });

    const validActions = getValidActions(state, "player1");
    expect(validActions.mode).toBe("normal_turn");

    if (validActions.mode === "normal_turn") {
      expect(validActions.returnableSkills?.returnable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_KRANG_ARCANE_DISGUISE })
      );
    }
  });

  it("flip-back spends one green mana token and does not consume action", () => {
    const state = createArcaneState({
      hasTakenActionThisTurn: false,
      skillFlipState: { flippedSkills: [SKILL_KRANG_ARCANE_DISGUISE] },
      pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
    });

    const result = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });

    const player = result.state.players[0];
    expect(player.skillFlipState.flippedSkills).not.toContain(
      SKILL_KRANG_ARCANE_DISGUISE
    );
    expect(player.pureMana).toHaveLength(0);
    expect(player.hasTakenActionThisTurn).toBe(false);
  });

  it("undoing flip-back restores green mana and face-down state", () => {
    const state = createArcaneState({
      skillFlipState: { flippedSkills: [SKILL_KRANG_ARCANE_DISGUISE] },
      pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
    });

    const afterFlipBack = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });
    const afterUndo = engine.processAction(afterFlipBack.state, "player1", {
      type: UNDO_ACTION,
    });

    const player = afterUndo.state.players[0];
    expect(player.skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_ARCANE_DISGUISE
    );
    expect(player.pureMana).toContainEqual({
      color: MANA_GREEN,
      source: MANA_TOKEN_SOURCE_CARD,
    });
  });

  it("rejects flip-back without green mana token", () => {
    const state = createArcaneState({
      skillFlipState: { flippedSkills: [SKILL_KRANG_ARCANE_DISGUISE] },
      pureMana: [],
    });

    const result = engine.processAction(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_ARCANE_DISGUISE,
    });

    expect(result.events[0]?.type).toBe(INVALID_ACTION);
  });

  it("allows recruitment at X reputation and neutralizes reputation modifier while active", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_ARCANE_DISGUISE],
      reputation: MIN_REPUTATION,
      position: { q: 0, r: 0 },
    });
    const villageHex = createTestHex(0, 0, undefined, {
      type: SiteType.Village,
      owner: null,
      isConquered: false,
      isBurned: false,
    });
    const state = createTestGameState({
      players: [player],
      map: {
        hexes: { [hexKey({ q: 0, r: 0 })]: villageHex },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
      activeModifiers: [
        {
          id: "arcane_ignore_rep",
          source: {
            type: SOURCE_SKILL,
            skillId: SKILL_KRANG_ARCANE_DISGUISE,
            playerId: "player1",
          },
          duration: DURATION_TURN,
          scope: { type: SCOPE_SELF },
          effect: { type: EFFECT_RULE_OVERRIDE, rule: RULE_IGNORE_REPUTATION },
          createdAtRound: 1,
          createdByPlayerId: "player1",
        },
      ],
    });

    const validationResult = validateReputationNotX(state, "player1", {
      type: RECRUIT_UNIT_ACTION,
      unitId: UNIT_THUGS,
      influenceSpent: 0,
    });
    expect(validationResult.valid).toBe(true);

    expect(
      getReputationCostModifier(MIN_REPUTATION, UNIT_THUGS, false, true)
    ).toBe(0);
  });
});
