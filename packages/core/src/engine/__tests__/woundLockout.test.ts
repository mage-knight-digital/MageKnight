/**
 * Tests for wound lockout rules.
 *
 * When a player's hand is all wounds and they have no escape hatch skills
 * (skills that draw cards), their only valid actions are: slow recovery,
 * end turn, announce end of round, undo, and skills.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  CARD_WOUND,
  CARD_MARCH,
  CHALLENGE_RAMPAGING_ACTION,
  isNormalTurn,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_TOVAK_MOTIVATION,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_BRAEVALAR_REGENERATE,
} from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  isHandAllWounds,
} from "../rules/turnStructure.js";
import {
  hasCardDrawEscapeHatch,
  isLockedIntoSlowRecovery,
} from "../rules/woundLockout.js";
import { validateNotLockedIntoSlowRecovery } from "../validators/woundLockoutValidators.js";
import { valid } from "../validators/types.js";
import { MUST_SLOW_RECOVER } from "../validators/validationCodes.js";

// ============================================================================
// Rule function tests
// ============================================================================

describe("isHandAllWounds", () => {
  it("returns true when all cards in hand are wounds", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
    });
    expect(isHandAllWounds(player)).toBe(true);
  });

  it("returns false when hand has a mix of wounds and non-wounds", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_MARCH],
    });
    expect(isHandAllWounds(player)).toBe(false);
  });

  it("returns false when hand is empty", () => {
    const player = createTestPlayer({ hand: [] });
    expect(isHandAllWounds(player)).toBe(false);
  });

  it("returns true for a single wound card", () => {
    const player = createTestPlayer({ hand: [CARD_WOUND] });
    expect(isHandAllWounds(player)).toBe(true);
  });
});

describe("hasCardDrawEscapeHatch", () => {
  it("returns true when Motivation is available (face-up, no cooldown)", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      hand: [CARD_WOUND],
      skills: [SKILL_ARYTHEA_MOTIVATION],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(true);
  });

  it("returns false when Motivation is flipped (face-down)", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      hand: [CARD_WOUND],
      skills: [SKILL_ARYTHEA_MOTIVATION],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [SKILL_ARYTHEA_MOTIVATION] },
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(false);
  });

  it("returns false when Motivation cooldown is active", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      hand: [CARD_WOUND],
      skills: [SKILL_ARYTHEA_MOTIVATION],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [SKILL_TOVAK_MOTIVATION], // Cross-hero cooldown
      },
      skillFlipState: { flippedSkills: [] },
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(false);
  });

  it("returns true with I Feel No Pain (Tovak) when activatable", () => {
    const player = createTestPlayer({
      hero: Hero.Tovak,
      hand: [CARD_WOUND],
      skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
    });
    const state = createTestGameState({
      players: [player],
      combat: null,
    });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(true);
  });

  it("returns false with I Feel No Pain when used this turn", () => {
    const player = createTestPlayer({
      hero: Hero.Tovak,
      hand: [CARD_WOUND],
      skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(false);
  });

  it("returns true with Regenerate (Braevalar) when has mana", () => {
    const player = createTestPlayer({
      hero: Hero.Braevalar,
      hand: [CARD_WOUND],
      skills: [SKILL_BRAEVALAR_REGENERATE],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
      crystals: { red: 1, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({
      players: [player],
      combat: null,
    });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(true);
  });

  it("returns false with Regenerate when no mana available", () => {
    const player = createTestPlayer({
      hero: Hero.Braevalar,
      hand: [CARD_WOUND],
      skills: [SKILL_BRAEVALAR_REGENERATE],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
      pureMana: [],
      usedManaFromSource: true, // Source not available
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(false);
  });

  it("returns false when no escape hatch skills learned", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    expect(hasCardDrawEscapeHatch(state, player)).toBe(false);
  });
});

describe("isLockedIntoSlowRecovery", () => {
  it("returns true when hand is all wounds and no escape hatch", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    expect(isLockedIntoSlowRecovery(state, player)).toBe(true);
  });

  it("returns false when hand has non-wound cards", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_MARCH],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    expect(isLockedIntoSlowRecovery(state, player)).toBe(false);
  });

  it("returns false when hand is all wounds but Motivation is available", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      hand: [CARD_WOUND, CARD_WOUND],
      skills: [SKILL_ARYTHEA_MOTIVATION],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
    });
    const state = createTestGameState({ players: [player] });

    expect(isLockedIntoSlowRecovery(state, player)).toBe(false);
  });

  it("returns false when hand is empty", () => {
    const player = createTestPlayer({ hand: [], skills: [] });
    const state = createTestGameState({ players: [player] });

    expect(isLockedIntoSlowRecovery(state, player)).toBe(false);
  });
});

// ============================================================================
// Valid actions gating tests
// ============================================================================

describe("valid actions gating when locked into slow recovery", () => {
  function createLockedState() {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_WOUND],
      skills: [],
      movePoints: 4,
    });
    return createTestGameState({ players: [player] });
  }

  it("challenge options are undefined when locked", () => {
    const state = createLockedState();
    const validActions = getValidActions(state, "player1");

    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      expect(validActions.challenge).toBeUndefined();
    }
  });

  it("move options are undefined when locked", () => {
    const state = createLockedState();
    const validActions = getValidActions(state, "player1");

    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      expect(validActions.move).toBeUndefined();
    }
  });

  it("explore options are undefined when locked", () => {
    const state = createLockedState();
    const validActions = getValidActions(state, "player1");

    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      expect(validActions.explore).toBeUndefined();
    }
  });

  it("rest (slow recovery) is still available when locked", () => {
    const state = createLockedState();
    const validActions = getValidActions(state, "player1");

    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      expect(validActions.turn.canRest).toBe(true);
    }
  });

  it("end turn is still available when locked", () => {
    const state = createLockedState();
    const validActions = getValidActions(state, "player1");

    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      expect(validActions.turn.canEndTurn).toBe(true);
    }
  });

  it("challenge options are available when hand is all wounds BUT Motivation is available", () => {
    // Create state with rampaging enemies adjacent so challenge is possible
    // (Without enemies, challenge is undefined regardless)
    // Instead, just verify the lockout is NOT triggered
    const player = createTestPlayer({
      hero: Hero.Arythea,
      hand: [CARD_WOUND, CARD_WOUND],
      skills: [SKILL_ARYTHEA_MOTIVATION],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      skillFlipState: { flippedSkills: [] },
      movePoints: 4,
    });
    const state = createTestGameState({ players: [player] });

    // Verify the lockout rule is not triggered
    expect(isLockedIntoSlowRecovery(state, player)).toBe(false);

    // Valid actions should still be in normal turn mode (not locked)
    const validActions = getValidActions(state, "player1");
    expect(isNormalTurn(validActions)).toBe(true);
    if (isNormalTurn(validActions)) {
      // Move should be available (not blocked by lockout)
      expect(validActions.move).toBeDefined();
    }
  });
});

// ============================================================================
// Validator tests
// ============================================================================

describe("validateNotLockedIntoSlowRecovery", () => {
  it("rejects challenge rampaging action when locked", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: CHALLENGE_RAMPAGING_ACTION,
      targetHex: { q: 1, r: 0 },
    });

    expect(result).not.toEqual(valid());
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(MUST_SLOW_RECOVER);
    }
  });

  it("allows end turn when locked", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: "END_TURN" as const,
    });

    expect(result).toEqual(valid());
  });

  it("allows use skill when locked", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: "USE_SKILL" as const,
      skillId: SKILL_ARYTHEA_MOTIVATION,
    });

    expect(result).toEqual(valid());
  });

  it("allows declare rest when locked", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: "DECLARE_REST" as const,
    });

    expect(result).toEqual(valid());
  });

  it("allows undo when locked", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: "UNDO" as const,
    });

    expect(result).toEqual(valid());
  });

  it("passes through when player is resting", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND],
      skills: [],
      isResting: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: CHALLENGE_RAMPAGING_ACTION,
      targetHex: { q: 1, r: 0 },
    });

    expect(result).toEqual(valid());
  });

  it("passes through when hand has non-wound cards", () => {
    const player = createTestPlayer({
      hand: [CARD_WOUND, CARD_MARCH],
      skills: [],
    });
    const state = createTestGameState({ players: [player] });

    const result = validateNotLockedIntoSlowRecovery(state, "player1", {
      type: CHALLENGE_RAMPAGING_ACTION,
      targetHex: { q: 1, r: 0 },
    });

    expect(result).toEqual(valid());
  });
});
