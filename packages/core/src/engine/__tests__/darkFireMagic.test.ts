/**
 * Tests for Dark Fire Magic skill (Arythea)
 *
 * Dark Fire Magic: Flip to gain 1 red crystal and 1 red or black mana token
 * - Once per round (flip skill)
 * - Grants 1 red crystal to inventory
 * - Player chooses red or black mana token
 * - Black mana follows normal day/night usage rules
 */

import { describe, it, expect } from "vitest";
import {
  MANA_RED,
  MANA_BLACK,
  SKILL_USED,
  CHOICE_REQUIRED,
  INVALID_ACTION,
  USE_SKILL_ACTION,
} from "@mage-knight/shared";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { createUseSkillCommand } from "../commands/useSkillCommand.js";
import { createResolveChoiceCommand } from "../commands/resolveChoiceCommand.js";
import { SKILL_ARYTHEA_DARK_FIRE_MAGIC } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { validateAction } from "../validators/index.js";
import { EFFECT_GAIN_MANA } from "../../types/effectTypes.js";

describe("Dark Fire Magic Skill", () => {
  describe("Skill Activation", () => {
    it("grants 1 red crystal when activated", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });
      const result = command.execute(state);

      // Check for SKILL_USED event
      const skillUsedEvent = result.events.find((e) => e.type === SKILL_USED);
      expect(skillUsedEvent).toBeDefined();
      if (skillUsedEvent?.type === SKILL_USED) {
        expect(skillUsedEvent.playerId).toBe("player1");
        expect(skillUsedEvent.skillId).toBe(SKILL_ARYTHEA_DARK_FIRE_MAGIC);
      }

      // Player should have 1 red crystal (effect updates state directly)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.crystals.red).toBe(1);
    });

    it("creates a pending choice for red or black mana", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });
      const result = command.execute(state);

      // Check for CHOICE_REQUIRED event
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Player should have a pending choice
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pendingChoice).not.toBeNull();
      expect(updatedPlayer?.pendingChoice?.options).toHaveLength(2);

      // Check the pending choice has skillId, not cardId
      expect(updatedPlayer?.pendingChoice?.sourceSkillId).toBe(SKILL_ARYTHEA_DARK_FIRE_MAGIC);

      // Check the options are mana gain effects
      const options = updatedPlayer?.pendingChoice?.options;
      expect(options?.[0]).toMatchObject({ type: EFFECT_GAIN_MANA, color: MANA_RED });
      expect(options?.[1]).toMatchObject({ type: EFFECT_GAIN_MANA, color: MANA_BLACK });
    });

    it("adds skill to round cooldown", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });
      const result = command.execute(state);

      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.skillCooldowns.usedThisRound).toContain(
        SKILL_ARYTHEA_DARK_FIRE_MAGIC
      );
    });
  });

  describe("Choice Resolution", () => {
    it("resolving choice with red mana grants red mana token", () => {
      // Set up player with pending choice (simulating post-skill-activation state)
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        pendingChoice: {
          sourceSkillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
          options: [
            { type: EFFECT_GAIN_MANA, color: MANA_RED },
            { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
          ],
        },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveChoiceCommand({
        playerId: "player1",
        choiceIndex: 0, // Red mana
      });
      const result = command.execute(state);

      // Player should have red mana token (state change, not event)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pureMana).toHaveLength(1);
      expect(updatedPlayer?.pureMana[0]?.color).toBe(MANA_RED);

      // Pending choice should be cleared
      expect(updatedPlayer?.pendingChoice).toBeNull();
    });

    it("resolving choice with black mana grants black mana token", () => {
      // Set up player with pending choice
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        pendingChoice: {
          sourceSkillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
          options: [
            { type: EFFECT_GAIN_MANA, color: MANA_RED },
            { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
          ],
        },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveChoiceCommand({
        playerId: "player1",
        choiceIndex: 1, // Black mana
      });
      const result = command.execute(state);

      // Player should have black mana token
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.pureMana).toHaveLength(1);
      expect(updatedPlayer?.pureMana[0]?.color).toBe(MANA_BLACK);

      // Pending choice should be cleared
      expect(updatedPlayer?.pendingChoice).toBeNull();
    });
  });

  describe("Cooldown Validation", () => {
    it("cannot activate skill if already used this round", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });
      const result = command.execute(state);

      // Should emit invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("used this round");
      }
    });
  });

  describe("Ownership Validation", () => {
    it("cannot activate skill player does not own", () => {
      const player = createTestPlayer({
        skills: [], // Player has no skills
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });
      const result = command.execute(state);

      // Should emit invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("do not own");
      }
    });
  });

  describe("ValidActions Integration", () => {
    it("shows skill as activatable when owned and not on cooldown", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skillEffects).toBeDefined();
      expect(validActions.skillEffects?.activatableSkills).toHaveLength(1);
      expect(validActions.skillEffects?.activatableSkills[0].skillId).toBe(
        SKILL_ARYTHEA_DARK_FIRE_MAGIC
      );
    });

    it("does not show skill as activatable when on cooldown", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // skillEffects should be undefined or have empty activatableSkills
      if (validActions.skillEffects) {
        expect(validActions.skillEffects.activatableSkills).not.toContainEqual(
          expect.objectContaining({ skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC })
        );
      }
    });

    it("does not show skill when player does not own it", () => {
      const player = createTestPlayer({
        skills: [],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // skillEffects should be undefined when no skills available
      expect(validActions.skillEffects).toBeUndefined();
    });
  });

  describe("Validator Integration", () => {
    it("validates USE_SKILL_ACTION correctly", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
      });
      const state = createTestGameState({ players: [player] });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      };

      const result = validateAction(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("rejects USE_SKILL_ACTION for skill not owned", () => {
      const player = createTestPlayer({
        skills: [],
      });
      const state = createTestGameState({ players: [player] });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      };

      const result = validateAction(state, "player1", action);
      expect(result.valid).toBe(false);
    });

    it("rejects USE_SKILL_ACTION when on cooldown", () => {
      const player = createTestPlayer({
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      };

      const result = validateAction(state, "player1", action);
      expect(result.valid).toBe(false);
    });
  });
});
