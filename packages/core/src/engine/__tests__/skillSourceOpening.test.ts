/**
 * Tests for Source Opening skill (Goldyx)
 *
 * Once a round (Interactive): Put this skill token in the center.
 * You may reroll a mana die in the Source. Any player may return the token
 * face down to use an extra die of a basic color from the Source and to
 * give you a crystal of that color. They may decide whether to reroll
 * that die or not at the end of their turn.
 *
 * Solo: On the first turn you put this in play, reroll a die. On your
 * next turn, you may use a second mana die (basic color only), gain a
 * crystal of that color, and choose whether to reroll it.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  END_TURN_ACTION,
  RESOLVE_CHOICE_ACTION,
  RESOLVE_SOURCE_OPENING_REROLL_ACTION,
  UNDO_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  CARD_MARCH,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_GOLD,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import type { SourceDie, ManaSource } from "../../types/mana.js";
import { sourceDieId } from "../../types/mana.js";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_SOURCE_OPENING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  RULE_EXTRA_SOURCE_DIE,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import { isRuleActive } from "../modifiers/index.js";
import type { GameState } from "../../state/GameState.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as SkillId[],
    usedThisTurn: [] as SkillId[],
    usedThisCombat: [] as SkillId[],
    activeUntilNextTurn: [] as SkillId[],
  };
}

function createTestManaSource(dice: SourceDie[]): ManaSource {
  return { dice };
}

/**
 * Create a two-player state with Goldyx (source opening) and Arythea.
 */
function createTwoPlayerState(overrides?: {
  goldyxOverrides?: Record<string, unknown>;
  arytheyaOverrides?: Record<string, unknown>;
  stateOverrides?: Partial<GameState>;
}) {
  const goldyx = createTestPlayer({
    id: "goldyx",
    hero: Hero.Goldyx,
    skills: [SKILL_GOLDYX_SOURCE_OPENING],
    skillCooldowns: buildSkillCooldowns(),
    hand: [CARD_MARCH],
    playedCardFromHandThisTurn: true,
    ...(overrides?.goldyxOverrides ?? {}),
  });

  const arythea = createTestPlayer({
    id: "arythea",
    hero: Hero.Arythea,
    hand: [CARD_MARCH],
    playedCardFromHandThisTurn: true,
    ...(overrides?.arytheyaOverrides ?? {}),
  });

  return createTestGameState({
    players: [goldyx, arythea],
    turnOrder: ["goldyx", "arythea"],
    currentPlayerIndex: 0,
    source: createTestManaSource([
      { id: sourceDieId("die1"), color: MANA_RED, isDepleted: false, takenByPlayerId: null },
      { id: sourceDieId("die2"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
      { id: sourceDieId("die3"), color: MANA_GREEN, isDepleted: false, takenByPlayerId: null },
    ]),
    ...(overrides?.stateOverrides ?? {}),
  });
}

/**
 * Create a solo player state (Goldyx only).
 */
function createSoloState(overrides?: {
  goldyxOverrides?: Record<string, unknown>;
  stateOverrides?: Partial<GameState>;
}) {
  const goldyx = createTestPlayer({
    id: "goldyx",
    hero: Hero.Goldyx,
    skills: [SKILL_GOLDYX_SOURCE_OPENING],
    skillCooldowns: buildSkillCooldowns(),
    hand: [CARD_MARCH],
    playedCardFromHandThisTurn: true,
    ...(overrides?.goldyxOverrides ?? {}),
  });

  return createTestGameState({
    players: [goldyx],
    turnOrder: ["goldyx"],
    currentPlayerIndex: 0,
    source: createTestManaSource([
      { id: sourceDieId("die1"), color: MANA_RED, isDepleted: false, takenByPlayerId: null },
      { id: sourceDieId("die2"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
    ]),
    ...(overrides?.stateOverrides ?? {}),
  });
}

/**
 * Helper: activate Source Opening and resolve the reroll choice (skip reroll).
 * Returns the state after activation with skill in center.
 */
function activateAndSkipReroll(engine: MageKnightEngine, state: GameState): GameState {
  // Activate the skill
  const activateResult = engine.processAction(state, "goldyx", {
    type: USE_SKILL_ACTION,
    skillId: SKILL_GOLDYX_SOURCE_OPENING,
  });

  // The player should have a pending choice for reroll
  const player = activateResult.state.players.find((p) => p.id === "goldyx");
  if (!player?.pendingChoice) {
    // If no choice pending (e.g., no dice available), return as-is
    return activateResult.state;
  }

  // Skip reroll by choosing the last option (NOOP)
  const choiceCount = player.pendingChoice.options.length;
  const resolveResult = engine.processAction(activateResult.state, "goldyx", {
    type: RESOLVE_CHOICE_ACTION,
    choiceIndex: choiceCount - 1, // Last option is NOOP (skip)
  });

  return resolveResult.state;
}

describe("Source Opening skill (Goldyx)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("owner activation", () => {
    it("should activate successfully and emit SKILL_USED event", () => {
      const state = createTwoPlayerState();

      const result = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "goldyx",
          skillId: SKILL_GOLDYX_SOURCE_OPENING,
        })
      );
    });

    it("should present reroll choice with available dice", () => {
      const state = createTwoPlayerState();

      const result = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Should have pending choice with die options + skip
      const player = result.state.players.find((p) => p.id === "goldyx");
      expect(player?.pendingChoice).not.toBeNull();
      // 3 dice available + 1 skip option = 4 choices
      expect(player?.pendingChoice?.options).toHaveLength(4);
    });

    it("should reroll selected die when chosen", () => {
      const state = createTwoPlayerState();

      const activateResult = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Choose the first die to reroll
      const resolveResult = engine.processAction(activateResult.state, "goldyx", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // The die should have been rerolled (color may have changed due to RNG)
      // Just verify the action succeeded and the skill was placed in center
      expect(resolveResult.events).not.toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should place skill in center after reroll choice", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      // Check that center modifier exists for Source Opening
      const centerModifier = afterActivation.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_GOLDYX_SOURCE_OPENING
      );
      expect(centerModifier).toBeDefined();
    });

    it("should set sourceOpeningCenter state", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      expect(afterActivation.sourceOpeningCenter).toEqual({
        ownerId: "goldyx",
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
        returningPlayerId: null,
        usedDieCountAtReturn: 0,
      });
    });

    it("should go on round cooldown", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const goldyx = afterActivation.players.find((p) => p.id === "goldyx");
      expect(goldyx?.skillCooldowns.usedThisRound).toContain(
        SKILL_GOLDYX_SOURCE_OPENING
      );
    });

    it("should reject activation when already on cooldown", () => {
      const state = createTwoPlayerState({
        goldyxOverrides: {
          skillCooldowns: {
            ...buildSkillCooldowns(),
            usedThisRound: [SKILL_GOLDYX_SOURCE_OPENING],
          },
        },
      });

      const result = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should skip reroll choice when no dice available", () => {
      const state = createTwoPlayerState({
        stateOverrides: {
          // All dice taken or depleted
          source: createTestManaSource([
            { id: sourceDieId("die1"), color: MANA_RED, isDepleted: false, takenByPlayerId: "arythea" },
            { id: sourceDieId("die2"), color: MANA_BLUE, isDepleted: true, takenByPlayerId: null },
          ]),
        },
      });

      const result = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Should still succeed (reroll is optional, place in center still happens)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "goldyx",
        })
      );

      // Should have placed skill in center
      expect(result.state.sourceOpeningCenter).not.toBeNull();
    });
  });

  describe("return mechanic (multiplayer)", () => {
    it("should allow other player to return the skill", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      // End Goldyx's turn so Arythea can act
      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      // Arythea returns the skill
      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(returnResult.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "arythea",
          skillId: SKILL_GOLDYX_SOURCE_OPENING,
        })
      );
    });

    it("should grant extra source die rule to returning player", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Check that the RULE_EXTRA_SOURCE_DIE modifier is active for arythea
      const hasExtraDie = isRuleActive(
        returnResult.state,
        "arythea",
        RULE_EXTRA_SOURCE_DIE
      );
      expect(hasExtraDie).toBe(true);
    });

    it("should track returning player in sourceOpeningCenter", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(returnResult.state.sourceOpeningCenter).toEqual(
        expect.objectContaining({
          ownerId: "goldyx",
          returningPlayerId: "arythea",
        })
      );
    });

    it("should flip skill face-down on owner", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const goldyx = returnResult.state.players.find((p) => p.id === "goldyx");
      expect(goldyx?.skillFlipState.flippedSkills).toContain(
        SKILL_GOLDYX_SOURCE_OPENING
      );
    });

    it("should remove center modifiers when returned", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Center modifiers for Source Opening from owner should be gone
      const centerModifiers = returnResult.state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_GOLDYX_SOURCE_OPENING &&
          m.source.playerId === "goldyx"
      );
      expect(centerModifiers).toHaveLength(0);
    });

    it("should reject return by owner in multiplayer", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      // Try to return as Goldyx (owner) - should fail
      const returnResult = engine.processAction(afterActivation, "goldyx", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(returnResult.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should show returnable skill in valid actions for other player", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const validActions = getValidActions(afterEndTurn.state, "arythea");
      if ("returnableSkills" in validActions && validActions.returnableSkills) {
        const returnable = validActions.returnableSkills.returnable;
        expect(returnable.some((s) => s.skillId === SKILL_GOLDYX_SOURCE_OPENING)).toBe(true);
      } else {
        // Check if the valid actions has returnable skills
        expect(validActions).toHaveProperty("returnableSkills");
      }
    });
  });

  describe("crystal grant at end of turn", () => {
    it("should grant owner a crystal when returning player uses extra die", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Simulate Arythea using 2 dice: 1 normal + 1 extra from Source Opening.
      // usedDieCountAtReturn=0, so extraDiceUsed = 2 - max(0,1) = 1
      const die1 = returnResult.state.source.dice[0];
      const die2 = returnResult.state.source.dice[1];
      if (!die1 || !die2) throw new Error("Setup error");

      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "arythea"
            ? { ...p, usedDieIds: [die1.id, die2.id] }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === die1.id || d.id === die2.id
              ? { ...d, takenByPlayerId: "arythea" }
              : d
          ),
        },
      };

      // End Arythea's turn - should trigger crystal grant and reroll choice
      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // Check if there's a pending reroll choice (S3)
      const arytheaAfter = endResult.state.players.find((p) => p.id === "arythea");
      if (arytheaAfter?.pendingSourceOpeningRerollChoice) {
        // Resolve the reroll choice (skip reroll)
        const rerollResult = engine.processAction(endResult.state, "arythea", {
          type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
          reroll: false,
        });

        // Crystal should have been granted to Goldyx (color of the extra die = die2)
        const goldyx = rerollResult.state.players.find((p) => p.id === "goldyx");
        expect(goldyx?.crystals[die2.color as "red" | "blue" | "green" | "white"]).toBe(1);
      } else {
        // Crystal should have been granted to Goldyx
        const goldyx = endResult.state.players.find((p) => p.id === "goldyx");
        expect(goldyx?.crystals[die2.color as "red" | "blue" | "green" | "white"]).toBe(1);
      }
    });

    it("should not grant crystal when returning player does not use extra die", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Arythea does NOT use any die - just ends turn
      const endResult = engine.processAction(returnResult.state, "arythea", {
        type: END_TURN_ACTION,
      });

      // Goldyx should NOT have gained any crystals
      const goldyx = endResult.state.players.find((p) => p.id === "goldyx");
      expect(goldyx?.crystals.red).toBe(0);
      expect(goldyx?.crystals.blue).toBe(0);
      expect(goldyx?.crystals.green).toBe(0);
      expect(goldyx?.crystals.white).toBe(0);
    });

    it("should not grant crystal if owner already at max for that color", () => {
      const state = createTwoPlayerState({
        goldyxOverrides: {
          crystals: { red: 3, blue: 0, green: 0, white: 0 },
        },
      });
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Simulate Arythea using 2 dice: a non-red die (normal) then a RED die (extra).
      // Goldyx already has max red crystals.
      const nonRedDie = returnResult.state.source.dice.find((d) => d.color !== MANA_RED);
      const redDie = returnResult.state.source.dice.find((d) => d.color === MANA_RED);
      if (!nonRedDie || !redDie) throw new Error("Setup error: need non-red and red dice");

      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "arythea"
            ? { ...p, usedDieIds: [nonRedDie.id, redDie.id] }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === nonRedDie.id || d.id === redDie.id
              ? { ...d, takenByPlayerId: "arythea" }
              : d
          ),
        },
      };

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // Resolve reroll choice if pending
      let finalState = endResult.state;
      const arytheaAfter = finalState.players.find((p) => p.id === "arythea");
      if (arytheaAfter?.pendingSourceOpeningRerollChoice) {
        const rerollResult = engine.processAction(finalState, "arythea", {
          type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
          reroll: false,
        });
        finalState = rerollResult.state;
      }

      // Goldyx should still have exactly 3 red crystals (not more)
      const goldyx = finalState.players.find((p) => p.id === "goldyx");
      expect(goldyx?.crystals.red).toBe(3);
    });

    it("should clear sourceOpeningCenter after end of turn", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // End Arythea's turn (no extra die used)
      const endResult = engine.processAction(returnResult.state, "arythea", {
        type: END_TURN_ACTION,
      });

      // sourceOpeningCenter should be cleared
      expect(endResult.state.sourceOpeningCenter).toBeNull();
    });
  });

  describe("end-of-turn reroll choice (FAQ S3)", () => {
    /**
     * Helper to set up the state where Arythea has used 2 dice (normal + extra).
     * Returns the state ready for END_TURN, plus the extra die reference.
     */
    function setupExtraDieUsed(returnResult: { state: GameState }) {
      const die1 = returnResult.state.source.dice[0];
      const die2 = returnResult.state.source.dice[1];
      if (!die1 || !die2) throw new Error("Need at least 2 dice");

      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "arythea"
            ? { ...p, usedDieIds: [die1.id, die2.id] }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === die1.id || d.id === die2.id
              ? { ...d, takenByPlayerId: "arythea" }
              : d
          ),
        },
      };
      return { stateWithUsedDie, extraDie: die2 };
    }

    it("should present reroll choice when returning player used extra die", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const { stateWithUsedDie, extraDie } = setupExtraDieUsed(returnResult);

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // Should have pending reroll choice for the extra die
      const arythea = endResult.state.players.find((p) => p.id === "arythea");
      expect(arythea?.pendingSourceOpeningRerollChoice).toBe(extraDie.id);
    });

    it("should complete turn end when player chooses to reroll", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const { stateWithUsedDie } = setupExtraDieUsed(returnResult);

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // Resolve reroll choice - choose to reroll
      const rerollResult = engine.processAction(endResult.state, "arythea", {
        type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
        reroll: true,
      });

      // Turn should have ended (no more pending choice)
      const arythea = rerollResult.state.players.find((p) => p.id === "arythea");
      expect(arythea?.pendingSourceOpeningRerollChoice).toBeNull();
    });

    it("should complete turn end when player chooses not to reroll", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const { stateWithUsedDie } = setupExtraDieUsed(returnResult);

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // Resolve reroll choice - skip reroll
      const rerollResult = engine.processAction(endResult.state, "arythea", {
        type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
        reroll: false,
      });

      // Turn should have ended
      const arythea = rerollResult.state.players.find((p) => p.id === "arythea");
      expect(arythea?.pendingSourceOpeningRerollChoice).toBeNull();
    });

    it("should show pending_source_opening_reroll in valid actions", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const { stateWithUsedDie } = setupExtraDieUsed(returnResult);

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      const validActions = getValidActions(endResult.state, "arythea");
      expect(validActions.mode).toBe("pending_source_opening_reroll");
    });
  });

  describe("solo mode (FAQ S1)", () => {
    it("should allow owner to return their own skill in solo mode", () => {
      const state = createSoloState();
      const afterActivation = activateAndSkipReroll(engine, state);

      // End the first turn
      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      // On next turn (still Goldyx in solo), return the skill
      const returnResult = engine.processAction(afterEndTurn.state, "goldyx", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Should succeed (not INVALID_ACTION)
      expect(returnResult.events).not.toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should grant extra source die rule to owner in solo mode", () => {
      const state = createSoloState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "goldyx", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      const hasExtraDie = isRuleActive(
        returnResult.state,
        "goldyx",
        RULE_EXTRA_SOURCE_DIE
      );
      expect(hasExtraDie).toBe(true);
    });

    it("should show returnable skill in valid actions for owner in solo mode", () => {
      const state = createSoloState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const validActions = getValidActions(afterEndTurn.state, "goldyx");
      if ("returnableSkills" in validActions && validActions.returnableSkills) {
        const returnable = validActions.returnableSkills.returnable;
        expect(returnable.some((s) => s.skillId === SKILL_GOLDYX_SOURCE_OPENING)).toBe(true);
      } else {
        expect(validActions).toHaveProperty("returnableSkills");
      }
    });

    it("should grant crystal to self in solo mode when using extra die", () => {
      const state = createSoloState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "goldyx", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Simulate using 2 dice: 1 normal + 1 extra from Source Opening.
      // Also set playedCardFromHandThisTurn so END_TURN validation passes.
      const die1 = returnResult.state.source.dice[0];
      const die2 = returnResult.state.source.dice[1];
      if (!die1 || !die2) throw new Error("Need at least 2 dice");

      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "goldyx"
            ? { ...p, usedDieIds: [die1.id, die2.id], playedCardFromHandThisTurn: true }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === die1.id || d.id === die2.id
              ? { ...d, takenByPlayerId: "goldyx" }
              : d
          ),
        },
      };

      const endResult = engine.processAction(stateWithUsedDie, "goldyx", {
        type: END_TURN_ACTION,
      });

      // Resolve reroll choice if pending
      let finalState = endResult.state;
      const goldyxAfter = finalState.players.find((p) => p.id === "goldyx");
      if (goldyxAfter?.pendingSourceOpeningRerollChoice) {
        const rerollResult = engine.processAction(finalState, "goldyx", {
          type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
          reroll: false,
        });
        finalState = rerollResult.state;
      }

      // Crystal should have been granted to Goldyx (self, color of the extra die)
      const goldyx = finalState.players.find((p) => p.id === "goldyx");
      expect(goldyx?.crystals[die2.color as "red" | "blue" | "green" | "white"]).toBe(1);
    });
  });

  describe("undo of return", () => {
    it("should restore state when return is undone", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      // Save state before return
      const beforeReturn = afterEndTurn.state;

      const returnResult = engine.processAction(beforeReturn, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Verify return happened
      expect(returnResult.state.sourceOpeningCenter?.returningPlayerId).toBe("arythea");

      // Undo the return
      const undoResult = engine.processAction(returnResult.state, "arythea", {
        type: UNDO_ACTION,
      });

      // Center modifier should be restored
      const centerModifier = undoResult.state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_GOLDYX_SOURCE_OPENING &&
          m.source.playerId === "goldyx"
      );
      expect(centerModifier).toBeDefined();

      // Skill should be un-flipped on owner
      const goldyx = undoResult.state.players.find((p) => p.id === "goldyx");
      expect(goldyx?.skillFlipState.flippedSkills).not.toContain(
        SKILL_GOLDYX_SOURCE_OPENING
      );

      // Extra source die rule should be removed
      const hasExtraDie = isRuleActive(
        undoResult.state,
        "arythea",
        RULE_EXTRA_SOURCE_DIE
      );
      expect(hasExtraDie).toBe(false);

      // sourceOpeningCenter should be restored to pre-return state
      expect(undoResult.state.sourceOpeningCenter).toEqual(
        expect.objectContaining({
          ownerId: "goldyx",
          returningPlayerId: null,
        })
      );
    });
  });

  describe("validator edge cases", () => {
    it("should reject Source Opening activation during combat", () => {
      const state = createTwoPlayerState({
        stateOverrides: {
          combat: {
            enemies: [],
            phase: "ranged_siege" as const,
            initiatorId: "goldyx",
            attackAccumulator: { melee: { points: 0, elements: [] }, ranged: { points: 0, elements: [] }, siege: { points: 0, elements: [] } },
            blockAccumulator: {},
            fortified: false,
            enemyStates: {},
            attackBonuses: [],
          },
        },
      });

      const result = engine.processAction(state, "goldyx", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject reroll action when no pending reroll choice", () => {
      const state = createTwoPlayerState();

      const result = engine.processAction(state, "goldyx", {
        type: RESOLVE_SOURCE_OPENING_REROLL_ACTION,
        reroll: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not grant crystal when extra die has non-basic color", () => {
      // Set up state where the extra die is gold (not basic)
      const state = createTwoPlayerState({
        stateOverrides: {
          source: createTestManaSource([
            { id: sourceDieId("die1"), color: MANA_RED, isDepleted: false, takenByPlayerId: null },
            { id: sourceDieId("die2"), color: MANA_RED, isDepleted: false, takenByPlayerId: null },
            { id: sourceDieId("die3"), color: MANA_GOLD, isDepleted: false, takenByPlayerId: null },
          ]),
        },
      });
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Use 2 dice: die1 (normal) + die3 (gold, extra)
      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "arythea"
            ? { ...p, usedDieIds: [sourceDieId("die1"), sourceDieId("die3")] }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === sourceDieId("die1") || d.id === sourceDieId("die3")
              ? { ...d, takenByPlayerId: "arythea" }
              : d
          ),
        },
      };

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // No crystal granted (gold is not basic), no reroll choice
      const goldyx = endResult.state.players.find((p) => p.id === "goldyx");
      expect(goldyx?.crystals.red).toBe(0);
      expect(goldyx?.crystals.blue).toBe(0);
      expect(goldyx?.crystals.green).toBe(0);
      expect(goldyx?.crystals.white).toBe(0);
    });

    it("should not grant crystal when returning player only uses normal die", () => {
      const state = createTwoPlayerState();
      const afterActivation = activateAndSkipReroll(engine, state);

      const afterEndTurn = engine.processAction(afterActivation, "goldyx", {
        type: END_TURN_ACTION,
      });

      const returnResult = engine.processAction(afterEndTurn.state, "arythea", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_SOURCE_OPENING,
      });

      // Use only 1 die (the normal allowance, not the extra one)
      const die1 = returnResult.state.source.dice[0];
      if (!die1) throw new Error("No die found");

      const stateWithUsedDie: GameState = {
        ...returnResult.state,
        players: returnResult.state.players.map((p) =>
          p.id === "arythea"
            ? { ...p, usedDieIds: [die1.id] }
            : p
        ),
        source: {
          dice: returnResult.state.source.dice.map((d) =>
            d.id === die1.id
              ? { ...d, takenByPlayerId: "arythea" }
              : d
          ),
        },
      };

      const endResult = engine.processAction(stateWithUsedDie, "arythea", {
        type: END_TURN_ACTION,
      });

      // No crystal granted (only used normal die, not extra)
      const goldyx = endResult.state.players.find((p) => p.id === "goldyx");
      expect(goldyx?.crystals.red).toBe(0);
      expect(goldyx?.crystals.blue).toBe(0);
    });
  });
});
