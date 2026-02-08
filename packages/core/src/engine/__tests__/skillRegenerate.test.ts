/**
 * Tests for Regenerate skill (Braevalar)
 *
 * Skill effect: Pay mana of any color, throw away a Wound from hand.
 * If green mana was used, or player has the least Fame (not tied), draw a card.
 *
 * FAQ:
 * S1: Must throw away a Wound - cannot just pay mana to draw.
 * S2: Black mana permitted at night.
 * S3: Healing effect - cannot be used during combat.
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
  SKILL_USED,
  INVALID_ACTION,
  CARD_WOUND,
  CARD_MARCH,
  CARD_RAGE,
  MANA_RED,
  MANA_GREEN,
  MANA_BLUE,
  MANA_BLACK,
  MANA_SOURCE_TOKEN,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import type { ManaSourceInfo } from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_REGENERATE } from "../../data/skills/index.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";
import { getSkillsFromValidActions } from "@mage-knight/shared";

/** Helper to create a mana source info for a token of a given color */
function tokenMana(color: string): ManaSourceInfo {
  return { type: MANA_SOURCE_TOKEN, color: color as ManaSourceInfo["color"] };
}

describe("Regenerate skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate with mana and wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_REGENERATE,
        })
      );
    });

    it("should consume the mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.state.players[0]?.pureMana).toHaveLength(0);
    });

    it("should remove wound from hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.state.players[0]?.hand).not.toContain(CARD_WOUND);
    });

    it("should return wound to wound pile", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const initialWoundPile = 10;
      const state = createTestGameState({
        players: [player],
        woundPileCount: initialWoundPile,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.state.woundPileCount).toBe(initialWoundPile + 1);
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(
        result.state.players[0]?.skillCooldowns.usedThisTurn
      ).toContain(SKILL_BRAEVALAR_REGENERATE);
    });
  });

  describe("card draw bonus - green mana", () => {
    it("should draw a card when green mana is spent", () => {
      const deckCard = CARD_RAGE;
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      // Wound removed, deck card drawn
      expect(result.state.players[0]?.hand).toContain(deckCard);
      expect(result.state.players[0]?.hand).not.toContain(CARD_WOUND);
      expect(result.state.players[0]?.deck).toHaveLength(0);
    });

    it("should not draw a card when non-green mana is spent (solo play)", () => {
      const deckCard = CARD_RAGE;
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      // Wound removed but no card drawn (solo = no lowest fame bonus)
      expect(result.state.players[0]?.hand).toEqual([CARD_MARCH]);
      expect(result.state.players[0]?.deck).toEqual([deckCard]);
    });

    it("should handle empty deck when green mana draw is triggered", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      // Wound removed, no card drawn (empty deck)
      expect(result.state.players[0]?.hand).toEqual([CARD_MARCH]);
    });
  });

  describe("card draw bonus - lowest fame", () => {
    it("should draw a card when player has strictly lowest fame", () => {
      const deckCard = CARD_RAGE;
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        fame: 5,
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 15,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      // Card drawn because player1 has strictly lowest fame
      expect(result.state.players[0]?.hand).toContain(deckCard);
    });

    it("should NOT draw a card when fame is tied for lowest", () => {
      const deckCard = CARD_RAGE;
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        fame: 10,
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 10,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      // No card drawn - fame is tied
      expect(result.state.players[0]?.hand).toEqual([CARD_MARCH]);
      expect(result.state.players[0]?.deck).toEqual([deckCard]);
    });

    it("should NOT draw a card for lowest fame in solo play", () => {
      const deckCard = CARD_RAGE;
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        fame: 0,
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      // No card drawn in solo play (no comparison possible)
      expect(result.state.players[0]?.hand).toEqual([CARD_MARCH]);
    });

    it("should draw a card when green mana AND lowest fame both apply", () => {
      const deckCard = CARD_RAGE;
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        deck: [deckCard],
        fame: 0,
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 10,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      // Still only draws one card (both conditions met but effect is the same)
      expect(result.state.players[0]?.hand).toContain(deckCard);
      expect(result.state.players[0]?.deck).toHaveLength(0);
    });
  });

  describe("wound requirement (S1)", () => {
    it("should reject activation when no wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not show in valid actions when no wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeUndefined();
    });
  });

  describe("combat restriction (S3)", () => {
    it("should reject activation during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not show in valid actions during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeUndefined();
    });
  });

  describe("mana requirement", () => {
    it("should reject activation without mana source", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        // No manaSource provided
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not show in valid actions when no mana available", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeUndefined();
    });

    it("should show in valid actions when mana token available", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_BLUE, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeDefined();
    });

    it("should show in valid actions when crystal available", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [],
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeDefined();
    });
  });

  describe("black mana at night (S2)", () => {
    it("should accept black mana at night", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_BLACK, source: "card" as const }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_BLACK),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_REGENERATE,
        })
      );
      // Wound removed
      expect(result.state.players[0]?.hand).not.toContain(CARD_WOUND);
    });

    it("should show in valid actions with black mana at night", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_BLACK, source: "card" as const }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeDefined();
    });

    it("should not show in valid actions with only black mana during day", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_BLACK, source: "card" as const }],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeUndefined();
    });
  });

  describe("once per turn cooldown", () => {
    it("should reject activation when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_BRAEVALAR_REGENERATE],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not show in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_BRAEVALAR_REGENERATE],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      const regenerateOption = skills?.activatable.find(
        (s) => s.skillId === SKILL_BRAEVALAR_REGENERATE
      );
      expect(regenerateOption).toBeUndefined();
    });
  });

  describe("tracks mana color used", () => {
    it("should track the mana color in manaUsedThisTurn", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_REGENERATE],
        hand: [CARD_MARCH, CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_REGENERATE,
        manaSource: tokenMana(MANA_GREEN),
      });

      expect(result.state.players[0]?.manaUsedThisTurn).toContain(MANA_GREEN);
    });
  });
});
