import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  CARD_MARCH,
  CARD_RAGE,
  END_TURN_ACTION,
  INVALID_ACTION,
  MANA_GOLD,
  MANA_GREEN,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
  PLAY_CARD_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_MANA_ENHANCEMENT } from "../../data/skills/index.js";
import { SOURCE_SKILL } from "../../types/modifierConstants.js";
import { getValidActions } from "../validActions/index.js";
import { applyManaEnhancementTrigger } from "../commands/skills/manaEnhancementEffect.js";
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
});
