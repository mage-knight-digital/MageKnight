import { describe, it, expect } from "vitest";
import {
  RETURN_INTERACTIVE_SKILL_ACTION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
} from "../../data/skills/index.js";
import {
  validateNotOwnSkill,
  validateShamanicRitualFlipBack,
  validateSkillInCenter,
} from "../validators/returnInteractiveSkillValidators.js";
import {
  ALREADY_ACTED,
  MUST_COMPLETE_REST,
  PLAYER_NOT_FOUND,
  SKILL_NOT_IN_CENTER,
} from "../validators/validationCodes.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

describe("returnInteractiveSkillValidators (Shamanic Ritual)", () => {
  it("validateSkillInCenter returns valid when owner has flipped Shamanic Ritual", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          hero: Hero.Krang,
          skills: [SKILL_KRANG_SHAMANIC_RITUAL],
          skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
        }),
      ],
    });

    const result = validateSkillInCenter(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(true);
  });

  it("validateSkillInCenter rejects Shamanic Ritual when not flipped", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          hero: Hero.Krang,
          skills: [SKILL_KRANG_SHAMANIC_RITUAL],
          skillFlipState: { flippedSkills: [] },
        }),
      ],
    });

    const result = validateSkillInCenter(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(SKILL_NOT_IN_CENTER);
    }
  });

  it("validateSkillInCenter returns PLAYER_NOT_FOUND for missing player", () => {
    const state = createTestGameState({ players: [] });

    const result = validateSkillInCenter(state, "missing", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(PLAYER_NOT_FOUND);
    }
  });

  it("validateShamanicRitualFlipBack returns valid for non-Shamanic skill id", () => {
    const state = createTestGameState();

    const result = validateShamanicRitualFlipBack(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
    });

    expect(result.valid).toBe(true);
  });

  it("validateShamanicRitualFlipBack returns PLAYER_NOT_FOUND when player missing", () => {
    const state = createTestGameState({ players: [] });

    const result = validateShamanicRitualFlipBack(state, "missing", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(PLAYER_NOT_FOUND);
    }
  });

  it("validateShamanicRitualFlipBack rejects while resting", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          isResting: true,
          skills: [SKILL_KRANG_SHAMANIC_RITUAL],
          skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
        }),
      ],
    });

    const result = validateShamanicRitualFlipBack(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(MUST_COMPLETE_REST);
    }
  });

  it("validateShamanicRitualFlipBack rejects after action already taken", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          hasTakenActionThisTurn: true,
          skills: [SKILL_KRANG_SHAMANIC_RITUAL],
          skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
        }),
      ],
    });

    const result = validateShamanicRitualFlipBack(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(ALREADY_ACTED);
    }
  });

  it("validateNotOwnSkill always allows Shamanic Ritual flip-back path", () => {
    const state = createTestGameState({
      players: [
        createTestPlayer({
          skills: [SKILL_KRANG_SHAMANIC_RITUAL],
          skillFlipState: { flippedSkills: [SKILL_KRANG_SHAMANIC_RITUAL] },
        }),
      ],
    });

    const result = validateNotOwnSkill(state, "player1", {
      type: RETURN_INTERACTIVE_SKILL_ACTION,
      skillId: SKILL_KRANG_SHAMANIC_RITUAL,
    });

    expect(result.valid).toBe(true);
  });
});
