import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ACTIVATE_UNIT_ACTION,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  END_TURN_ACTION,
  INVALID_ACTION,
  MANA_GOLD,
  MANA_GREEN,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
  PLAY_CARD_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  UNIT_HERBALIST,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_MANA_ENHANCEMENT } from "../../data/skills/index.js";
import { SOURCE_SKILL } from "../../types/modifierConstants.js";
import { getValidActions } from "../validActions/index.js";
import {
  applyManaEnhancementClaimBenefit,
  applyManaEnhancementTrigger,
} from "../commands/skills/manaEnhancementEffect.js";
import { createPlayerUnit } from "../../types/unit.js";
import type { GameState } from "../../state/GameState.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as SkillId[],
    usedThisTurn: [] as SkillId[],
    usedThisCombat: [] as SkillId[],
    activeUntilNextTurn: [] as SkillId[],
  };
}

function createTwoPlayerState(): GameState {
  const krang = createTestPlayer({
    id: "krang",
    hero: Hero.Krang,
    skills: [SKILL_KRANG_MANA_ENHANCEMENT],
    skillCooldowns: buildSkillCooldowns(),
    hand: [CARD_MARCH],
    deck: [CARD_RAGE],
    pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
  });

  const arythea = createTestPlayer({
    id: "arythea",
    hero: Hero.Arythea,
    hand: [],
    deck: [CARD_MARCH],
  });

  return createTestGameState({
    players: [krang, arythea],
    turnOrder: ["krang", "arythea"],
    currentPlayerIndex: 0,
  });
}

function triggerWithGreenPoweredCard(
  engine: MageKnightEngine,
  state: GameState
): GameState {
  const result = engine.processAction(state, "krang", {
    type: PLAY_CARD_ACTION,
    cardId: CARD_MARCH,
    powered: true,
    manaSource: {
      type: MANA_SOURCE_TOKEN,
      color: MANA_GREEN,
    },
  });

  return result.state;
}

describe("Mana Enhancement skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("triggers on basic mana spend, grants crystal, and places token in center", () => {
    const state = createTwoPlayerState();

    const result = engine.processAction(state, "krang", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: true,
      manaSource: {
        type: MANA_SOURCE_TOKEN,
        color: MANA_GREEN,
      },
    });

    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );

    const krang = result.state.players.find((p) => p.id === "krang");
    expect(krang?.crystals.green).toBe(1);
    expect(krang?.skillCooldowns.usedThisRound).toContain(
      SKILL_KRANG_MANA_ENHANCEMENT
    );

    expect(result.state.manaEnhancementCenter).toEqual({
      markedColor: MANA_GREEN,
      ownerId: "krang",
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });

    const centerModifier = result.state.activeModifiers.find(
      (m) =>
        m.source.type === SOURCE_SKILL &&
        m.source.skillId === SKILL_KRANG_MANA_ENHANCEMENT &&
        m.source.playerId === "krang"
    );
    expect(centerModifier).toBeDefined();
  });

  it("does not trigger on non-basic mana spend", () => {
    const state = createTwoPlayerState();
    const result = applyManaEnhancementTrigger(state, "krang", MANA_GOLD);

    expect(result).toBe(state);
    expect(result.manaEnhancementCenter).toBeNull();
    const krang = result.players.find((p) => p.id === "krang");
    expect(krang?.crystals.green).toBe(0);
    expect(krang?.skillCooldowns.usedThisRound).not.toContain(
      SKILL_KRANG_MANA_ENHANCEMENT
    );
  });

  it("shows as returnable to other players and claiming grants marked mana", () => {
    const triggered = triggerWithGreenPoweredCard(engine, createTwoPlayerState());
    const onArytheaTurn: GameState = {
      ...triggered,
      currentPlayerIndex: 1,
    };

    const validActions = getValidActions(onArytheaTurn, "arythea");
    if ("returnableSkills" in validActions && validActions.returnableSkills) {
      expect(validActions.returnableSkills.returnable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_MANA_ENHANCEMENT,
        })
      );
    } else {
      expect(validActions).toHaveProperty("returnableSkills");
    }

    const claimResult = engine.processAction(onArytheaTurn, "arythea", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });

    const arythea = claimResult.state.players.find((p) => p.id === "arythea");
    expect(arythea?.pureMana).toContainEqual({
      color: MANA_GREEN,
      source: MANA_TOKEN_SOURCE_CARD,
    });

    expect(claimResult.state.manaEnhancementCenter).toBeNull();
    const krang = claimResult.state.players.find((p) => p.id === "krang");
    expect(krang?.skillFlipState.flippedSkills).toContain(
      SKILL_KRANG_MANA_ENHANCEMENT
    );
  });

  it("undoing claimed Mana Enhancement restores center token", () => {
    const triggered = triggerWithGreenPoweredCard(engine, createTwoPlayerState());
    const onArytheaTurn: GameState = {
      ...triggered,
      currentPlayerIndex: 1,
    };

    const claimResult = engine.processAction(onArytheaTurn, "arythea", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });
    const undoResult = engine.processAction(claimResult.state, "arythea", {
      type: "UNDO",
    });

    expect(undoResult.state.manaEnhancementCenter).toEqual({
      markedColor: MANA_GREEN,
      ownerId: "krang",
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });

  });

  it("rejects claiming your own Mana Enhancement token", () => {
    const triggered = triggerWithGreenPoweredCard(engine, createTwoPlayerState());

    const result = engine.processAction(triggered, "krang", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
      })
    );
  });

  it("expires unclaimed center token at start of Krang's next turn", () => {
    const triggered = triggerWithGreenPoweredCard(engine, createTwoPlayerState());

    const afterKrangTurn = engine.processAction(triggered, "krang", {
      type: END_TURN_ACTION,
    });
    const afterArytheaTurn = engine.processAction(afterKrangTurn.state, "arythea", {
      type: END_TURN_ACTION,
    });

    expect(afterArytheaTurn.state.manaEnhancementCenter).toBeNull();
    const centerModifier = afterArytheaTurn.state.activeModifiers.find(
      (m) =>
        m.source.type === SOURCE_SKILL &&
        m.source.skillId === SKILL_KRANG_MANA_ENHANCEMENT &&
        m.source.playerId === "krang"
    );
    expect(centerModifier).toBeUndefined();
  });

  it("undoing a powered card play restores Mana Enhancement crystal and center state", () => {
    const state = createTwoPlayerState();
    const played = engine.processAction(state, "krang", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: true,
      manaSource: {
        type: MANA_SOURCE_TOKEN,
        color: MANA_GREEN,
      },
    });

    const undone = engine.processAction(played.state, "krang", { type: "UNDO" });
    const krang = undone.state.players.find((p) => p.id === "krang");

    expect(krang?.crystals.green).toBe(0);
    expect(krang?.skillCooldowns.usedThisRound).not.toContain(
      SKILL_KRANG_MANA_ENHANCEMENT
    );
    expect(undone.state.manaEnhancementCenter).toBeNull();
    expect(
      undone.state.activeModifiers.some(
        (modifier) =>
          modifier.source.type === SOURCE_SKILL &&
          modifier.source.skillId === SKILL_KRANG_MANA_ENHANCEMENT
      )
    ).toBe(false);
  });

  it("undoing a mana-powered unit activation restores Mana Enhancement state", () => {
    const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
    const krang = createTestPlayer({
      id: "krang",
      hero: Hero.Krang,
      skills: [SKILL_KRANG_MANA_ENHANCEMENT],
      skillCooldowns: buildSkillCooldowns(),
      units: [herbalist],
      commandTokens: 1,
      hand: [CARD_WOUND],
      pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
    });

    const state = createTestGameState({
      players: [krang],
      turnOrder: ["krang"],
      currentPlayerIndex: 0,
      combat: null,
    });

    const activated = engine.processAction(state, "krang", {
      type: ACTIVATE_UNIT_ACTION,
      unitInstanceId: "herbalist_1",
      abilityIndex: 0,
      manaSource: {
        type: MANA_SOURCE_TOKEN,
        color: MANA_GREEN,
      },
    });

    expect(activated.state.players[0]?.crystals.green).toBe(1);
    expect(activated.state.manaEnhancementCenter).toEqual({
      markedColor: MANA_GREEN,
      ownerId: "krang",
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    });

    const undone = engine.processAction(activated.state, "krang", { type: "UNDO" });
    const undoneKrang = undone.state.players[0];
    expect(undoneKrang?.crystals.green).toBe(0);
    expect(undoneKrang?.skillCooldowns.usedThisRound).not.toContain(
      SKILL_KRANG_MANA_ENHANCEMENT
    );
    expect(undone.state.manaEnhancementCenter).toBeNull();
  });

  it("does not trigger if trigger owner does not exist", () => {
    const state = createTwoPlayerState();
    const result = applyManaEnhancementTrigger(state, "missing-player", MANA_GREEN);
    expect(result).toBe(state);
  });

  it("claim benefit is a no-op when no center token exists", () => {
    const state = createTwoPlayerState();
    const result = applyManaEnhancementClaimBenefit(state, "arythea");
    expect(result).toBe(state);
  });

  it("claim benefit clears center when claimant does not exist", () => {
    const state = createTwoPlayerState();
    state.manaEnhancementCenter = {
      markedColor: MANA_GREEN,
      ownerId: "krang",
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    };

    const result = applyManaEnhancementClaimBenefit(state, "missing-player");
    expect(result).not.toBe(state);
    expect(result.manaEnhancementCenter).toBeNull();
  });

  it("claim benefit clears center when player disappears after index lookup", () => {
    const state = createTwoPlayerState();
    state.manaEnhancementCenter = {
      markedColor: MANA_GREEN,
      ownerId: "krang",
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    };

    const arytheaIndex = state.players.findIndex((p) => p.id === "arythea");
    const arythea = state.players[arytheaIndex];
    if (!arythea) {
      throw new Error("Expected Arythea player");
    }

    Object.defineProperty(arythea, "id", {
      configurable: true,
      get() {
        const players = state.players as Array<(typeof state.players)[number] | undefined>;
        delete players[arytheaIndex];
        return "arythea";
      },
    });

    const result = applyManaEnhancementClaimBenefit(state, "arythea");
    expect(result.manaEnhancementCenter).toBeNull();
  });
});
