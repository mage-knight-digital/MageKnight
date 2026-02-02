/**
 * Tests for Polarization skill (Arythea)
 *
 * Skill effect: Once per turn, convert one mana to its opposite color.
 * - Basic: Red↔Blue, Green↔White
 * - Day: Black → Gold → any basic color (cannot power spells)
 * - Night: Gold → Black (can power spells)
 *
 * Works on any mana form: tokens, crystals, or Source dice.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_POLARIZATION } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { sourceDieId, type ManaSource } from "../../types/mana.js";

function createManaSource(dice: Array<{ id: string; color: string }>): ManaSource {
  return {
    dice: dice.map((d) => ({
      id: sourceDieId(d.id),
      color: d.color as "red" | "blue" | "green" | "white" | "gold" | "black",
      isDepleted: false,
      takenByPlayerId: null,
    })),
  };
}

describe("Polarization skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it and has a token", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_POLARIZATION,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_ARYTHEA_POLARIZATION
      );
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [], // No skills learned
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_POLARIZATION], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("pending choice", () => {
    it("should create pending choice after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.skillId).toBe(
        SKILL_ARYTHEA_POLARIZATION
      );
      expect(updatedPlayer.pendingChoice?.cardId).toBeNull();
    });

    it("should have option to convert red to blue", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(1);
      // The option should be PolarizeMana with target blue (red's opposite)
      expect(updatedPlayer.pendingChoice?.options[0]).toMatchObject({
        type: "polarize_mana",
        sourceColor: MANA_RED,
        targetColor: MANA_BLUE,
      });
    });
  });

  describe("basic conversions", () => {
    it("should convert red token to blue", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      // Choose conversion (index 0 = red → blue)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_RESOLVED,
        })
      );

      // Should have blue mana token (converted from red)
      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_BLUE })
      );
      // Should NOT have red token anymore (it was converted)
      expect(updatedPlayer.pureMana).not.toContainEqual(
        expect.objectContaining({ color: MANA_RED })
      );
      // Should have exactly 1 token (not 2)
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pendingChoice).toBeNull();
    });

    it("should convert blue token to red", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      // Choose conversion
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_RED })
      );
    });

    it("should convert green token to white", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_WHITE })
      );
    });

    it("should convert white token to green", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_WHITE, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_GREEN })
      );
    });
  });

  describe("day-specific conversions (black → basic)", () => {
    it("should offer 4 basic color options when converting black at day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_BLACK, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = afterSkill.state.players[0];
      // Black at day can convert to any of the 4 basic colors
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(4);

      const colors = updatedPlayer.pendingChoice?.options.map(
        (opt) => (opt as { targetColor: string }).targetColor
      );
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });

    it("should not offer black conversion options at day", () => {
      // Gold cannot convert at day (gold→black is night only)
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_GOLD, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Skill should not be activatable with only gold during day
      // (gold has no valid conversions at day)
      const validActions = getValidActions(state, "player1");

      // Skills should not include Polarization
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_POLARIZATION,
          })
        );
      }
    });

    it("should set cannotPowerSpells flag when converting black at day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_BLACK, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      // Choose first conversion option (black → red)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const updatedPlayer = afterChoice.state.players[0];
      // The converted token should have cannotPowerSpells set to true
      // because black→basic at day cannot be used to power spell stronger effects
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]?.cannotPowerSpells).toBe(true);
    });
  });

  describe("night-specific conversions (gold → black)", () => {
    it("should offer black conversion option when converting gold at night", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_GOLD, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = afterSkill.state.players[0];
      // Gold at night can only convert to black
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(1);
      expect(updatedPlayer.pendingChoice?.options[0]).toMatchObject({
        type: "polarize_mana",
        sourceColor: MANA_GOLD,
        targetColor: MANA_BLACK,
      });
    });

    it("should convert gold to black at night", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_GOLD, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_BLACK })
      );
      // Converted token should NOT have cannotPowerSpells flag
      // Gold→Black at night CAN power spells
      expect(updatedPlayer.pureMana[0]?.cannotPowerSpells).toBeUndefined();
    });

    it("should not offer gold conversion options at night (black cannot convert)", () => {
      // Black cannot convert at night (black→gold is day only)
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_BLACK, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Skill should not be activatable with only black during night
      const validActions = getValidActions(state, "player1");

      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_POLARIZATION,
          })
        );
      }
    });
  });

  describe("crystal conversion", () => {
    it("should offer conversion option when player has crystal", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [],
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = afterSkill.state.players[0];
      // Should have option to convert red crystal to blue
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(1);
      expect(updatedPlayer.pendingChoice?.options[0]).toMatchObject({
        type: "polarize_mana",
        sourceType: "crystal",
        sourceColor: MANA_RED,
        targetColor: MANA_BLUE,
      });
    });
  });

  describe("undo", () => {
    it("should be undoable before choice is made", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_ARYTHEA_POLARIZATION);
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_ARYTHEA_POLARIZATION);
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when convertible mana available", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_POLARIZATION,
        })
      );
    });

    it("should not show skill when no convertible mana available", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [], // No mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: { dice: [] }, // No source dice either
      });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or Polarization is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_POLARIZATION,
          })
        );
      }
    });

    it("should not show skill when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_POLARIZATION], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const validActions = getValidActions(state, "player1");

      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_POLARIZATION,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [], // No skills
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const validActions = getValidActions(state, "player1");

      // Skills should be undefined since no skills are available
      expect(validActions.skills).toBeUndefined();
    });
  });

  describe("source dice conversion", () => {
    it("should offer conversion option for source dice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POLARIZATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        source: createManaSource([{ id: "die1", color: "red" }]),
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POLARIZATION,
      });

      const updatedPlayer = afterSkill.state.players[0];
      // Should have option to convert red die to blue
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(1);
      expect(updatedPlayer.pendingChoice?.options[0]).toMatchObject({
        type: "polarize_mana",
        sourceType: "die",
        sourceColor: MANA_RED,
        targetColor: MANA_BLUE,
      });
    });
  });
});
