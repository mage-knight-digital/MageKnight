/**
 * Tests for Regenerate skill (Krang).
 *
 * Once per turn, except in combat (healing effect):
 * Pay a mana of any color and discard a Wound.
 * If red mana was used, or player has strictly lowest fame, draw a card.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  INVALID_ACTION,
  MANA_BLACK,
  MANA_BLUE,
  MANA_GREEN,
  MANA_RED,
  MANA_SOURCE_TOKEN,
  MANA_WHITE,
  SKILL_USED,
  TIME_OF_DAY_NIGHT,
  USE_SKILL_ACTION,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import type { ManaColor, ManaSourceInfo } from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_REGENERATE } from "../../data/skills/index.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";

function tokenMana(color: ManaColor): ManaSourceInfo {
  return { type: MANA_SOURCE_TOKEN, color };
}

describe("Regenerate skill (Krang)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it.each([MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE])(
    "activates with %s mana and consumes wound",
    (manaColor) => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: manaColor, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_REGENERATE,
        manaSource: tokenMana(manaColor),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_REGENERATE,
        })
      );
      expect(result.state.players[0]?.hand).not.toContain(CARD_WOUND);
      expect(result.state.players[0]?.pureMana).toHaveLength(0);
      expect(result.state.players[0]?.skillCooldowns.usedThisTurn).toContain(
        SKILL_KRANG_REGENERATE
      );
    }
  );

  it("draws when red mana is spent", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      deck: [CARD_RAGE],
      pureMana: [{ color: MANA_RED, source: "card" as const }],
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_RED),
    });

    expect(result.state.players[0]?.hand).toContain(CARD_RAGE);
    expect(result.state.players[0]?.deck).toHaveLength(0);
  });

  it("does not draw when non-red mana is spent in solo play", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      deck: [CARD_RAGE],
      pureMana: [{ color: MANA_BLUE, source: "card" as const }],
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_BLUE),
    });

    expect(result.state.players[0]?.hand).toEqual([CARD_MARCH]);
    expect(result.state.players[0]?.deck).toEqual([CARD_RAGE]);
  });

  it("draws when player has strictly lowest fame", () => {
    const player1 = createTestPlayer({
      id: "player1",
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      deck: [CARD_RAGE],
      fame: 2,
      pureMana: [{ color: MANA_BLUE, source: "card" as const }],
    });
    const player2 = createTestPlayer({
      id: "player2",
      hero: Hero.Arythea,
      fame: 5,
      position: { q: 1, r: 0 },
    });
    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_BLUE),
    });

    expect(result.state.players[0]?.hand).toContain(CARD_RAGE);
  });

  it("draws only one card when both red mana and lowest fame are true", () => {
    const player1 = createTestPlayer({
      id: "player1",
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      deck: [CARD_RAGE, CARD_MARCH],
      fame: 1,
      pureMana: [{ color: MANA_RED, source: "card" as const }],
    });
    const player2 = createTestPlayer({
      id: "player2",
      hero: Hero.Arythea,
      fame: 8,
      position: { q: 1, r: 0 },
    });
    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_RED),
    });

    expect(result.state.players[0]?.hand).toEqual([CARD_MARCH, CARD_RAGE]);
    expect(result.state.players[0]?.deck).toEqual([CARD_MARCH]);
  });

  it("requires wound in hand", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH],
      pureMana: [{ color: MANA_RED, source: "card" as const }],
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_RED),
    });
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );

    const validActions = getValidActions(state, "player1");
    const skills = getSkillsFromValidActions(validActions);
    expect(
      skills?.activatable.find((s) => s.skillId === SKILL_KRANG_REGENERATE)
    ).toBeUndefined();
  });

  it("cannot be used during combat", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      pureMana: [{ color: MANA_RED, source: "card" as const }],
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_RED),
    });
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );

    const validActions = getValidActions(state, "player1");
    const skills = getSkillsFromValidActions(validActions);
    expect(
      skills?.activatable.find((s) => s.skillId === SKILL_KRANG_REGENERATE)
    ).toBeUndefined();
  });

  it("accepts black mana at night", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      pureMana: [{ color: MANA_BLACK, source: "card" as const }],
    });
    const state = createTestGameState({
      players: [player],
      timeOfDay: TIME_OF_DAY_NIGHT,
    });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_BLACK),
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({ type: SKILL_USED })
    );
  });

  it("rejects black mana during day", () => {
    const player = createTestPlayer({
      hero: Hero.Krang,
      skills: [SKILL_KRANG_REGENERATE],
      hand: [CARD_MARCH, CARD_WOUND],
      pureMana: [{ color: MANA_BLACK, source: "card" as const }],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_KRANG_REGENERATE,
      manaSource: tokenMana(MANA_BLACK),
    });
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: INVALID_ACTION })
    );

    const validActions = getValidActions(state, "player1");
    const skills = getSkillsFromValidActions(validActions);
    expect(
      skills?.activatable.find((s) => s.skillId === SKILL_KRANG_REGENERATE)
    ).toBeUndefined();
  });
});
