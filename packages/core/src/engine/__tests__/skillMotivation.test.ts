/**
 * Tests for Motivation skill functionality
 *
 * Motivation is a flip skill that:
 * - Draws 2 cards
 * - Grants mana if player has lowest fame (or in solo)
 * - Can be used on any player's turn
 * - Can be used during combat
 * - Has lockout until end of next turn
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { createUseSkillCommand } from "../commands/useSkillCommand.js";
import { createResetPlayer } from "../commands/endTurn/playerReset.js";
import {
  validateSkillCooldown,
  validateSkillTurnRestriction,
  validateSkillNotDuringTactics,
  validateSkillCombatRestriction,
} from "../validators/skillValidators.js";
import { getSkillOptions, getOutOfTurnSkillOptions } from "../validActions/skills.js";
import { evaluateCondition } from "../effects/conditionEvaluator.js";
import {
  SKILL_TOVAK_MOTIVATION,
  SKILL_WOLFHAWK_MOTIVATION,
} from "../../data/skills/index.js";
import {
  CONDITION_HAS_LOWEST_FAME_OR_SOLO,
} from "../../types/conditions.js";
import {
  CARD_MARCH,
  ROUND_PHASE_TACTICS_SELECTION,
  ROUND_PHASE_PLAYER_TURNS,
  USE_SKILL_ACTION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";

describe("Motivation Skill", () => {
  describe("Effect: Draws 2 cards", () => {
    it("should draw 2 cards when skill is used", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        hand: [CARD_MARCH],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH, "card3" as typeof CARD_MARCH],
        fame: 0,
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);

      // Player should have drawn 2 cards
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hand.length).toBe(3); // 1 original + 2 drawn
      expect(updatedPlayer?.deck.length).toBe(1); // 3 - 2 = 1
    });

    it("should not reshuffle if deck is empty", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        hand: [CARD_MARCH],
        deck: ["card1" as typeof CARD_MARCH], // Only 1 card in deck
        discard: ["discard1" as typeof CARD_MARCH, "discard2" as typeof CARD_MARCH],
        fame: 0,
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);

      // Player should only have drawn 1 card (no reshuffle)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hand.length).toBe(2); // 1 original + 1 drawn
      expect(updatedPlayer?.deck.length).toBe(0);
      expect(updatedPlayer?.discard.length).toBe(2); // Discard unchanged
    });
  });

  describe("Effect: Lowest fame bonus", () => {
    it("should grant mana if player has strictly lowest fame in multiplayer", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        fame: 0, // Lowest fame
        hand: [],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH],
      });

      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        fame: 10, // Higher fame
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      // Tovak should get blue mana
      expect(updatedPlayer?.pureMana.some((t) => t.color === "blue")).toBe(true);
    });

    it("should NOT grant mana if fame is tied with another player", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        fame: 5, // Tied fame
        hand: [],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH],
        pureMana: [],
      });

      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        fame: 5, // Tied fame
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      // No mana should be granted (tied is not "lowest")
      expect(updatedPlayer?.pureMana.filter((t) => t.color === "blue").length).toBe(0);
    });

    it("should always grant mana in solo game", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        fame: 100, // High fame doesn't matter in solo
        hand: [],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH],
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player], // Solo game
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      // Solo always gets mana
      expect(updatedPlayer?.pureMana.some((t) => t.color === "blue")).toBe(true);
    });

    it("should grant fame instead of mana for Wolfhawk", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        fame: 0,
        hand: [],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH],
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player], // Solo game
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      // Wolfhawk gets +1 fame instead of mana
      expect(updatedPlayer?.fame).toBe(1);
      expect(updatedPlayer?.pureMana.length).toBe(0);
    });
  });

  describe("Condition: HasLowestFameOrSolo", () => {
    it("should return true in solo game", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 100,
      });

      const state = createTestGameState({
        players: [player],
      });

      const result = evaluateCondition(
        state,
        "player1",
        { type: CONDITION_HAS_LOWEST_FAME_OR_SOLO }
      );

      expect(result).toBe(true);
    });

    it("should return true when player has strictly lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        fame: 5,
      });

      const player2 = createTestPlayer({
        id: "player2",
        fame: 10,
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const result = evaluateCondition(
        state,
        "player1",
        { type: CONDITION_HAS_LOWEST_FAME_OR_SOLO }
      );

      expect(result).toBe(true);
    });

    it("should return false when fame is tied", () => {
      const player1 = createTestPlayer({
        id: "player1",
        fame: 10,
      });

      const player2 = createTestPlayer({
        id: "player2",
        fame: 10,
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const result = evaluateCondition(
        state,
        "player1",
        { type: CONDITION_HAS_LOWEST_FAME_OR_SOLO }
      );

      expect(result).toBe(false);
    });
  });

  describe("Timing: Cannot use during tactics selection", () => {
    it("should fail validation during tactics phase", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const state = createTestGameState({
        players: [player],
        roundPhase: ROUND_PHASE_TACTICS_SELECTION,
        availableTactics: [],
        tacticsSelectionOrder: ["player1"],
        currentTacticSelector: "player1",
      });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      } as const;

      const result = validateSkillNotDuringTactics(state, "player1", action);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("SKILL_NOT_USABLE_DURING_TACTICS");
      }
    });

    it("should not show skills in validActions during tactics phase", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const state = createTestGameState({
        players: [player],
        roundPhase: ROUND_PHASE_TACTICS_SELECTION,
      });

      const options = getSkillOptions(state, player, false);

      expect(options).toBeUndefined();
    });
  });

  describe("Timing: Can use during combat", () => {
    it("should pass combat restriction validation", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const state = createTestGameState({
        players: [player],
        combat: {
          enemies: [],
          phase: "RANGED_SIEGE",
          woundsThisCombat: 0,
          attacksThisPhase: 0,
          fameGained: 0,
          isAtFortifiedSite: false,
          unitsAllowed: true,
          nightManaRules: false,
          assaultOrigin: null,
          combatHexCoord: null,
          allDamageBlockedThisPhase: false,
          discardEnemiesOnFailure: false,
          pendingDamage: {},
          pendingBlock: {},
        },
      });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      } as const;

      const result = validateSkillCombatRestriction(state, "player1", action);

      expect(result.valid).toBe(true);
    });

    it("should show Motivation in skill options during combat", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const state = createTestGameState({
        players: [player],
        combat: {
          enemies: [],
          phase: "RANGED_SIEGE",
          woundsThisCombat: 0,
          attacksThisPhase: 0,
          fameGained: 0,
          isAtFortifiedSite: false,
          unitsAllowed: true,
          nightManaRules: false,
          assaultOrigin: null,
          combatHexCoord: null,
          allDamageBlockedThisPhase: false,
          discardEnemiesOnFailure: false,
          pendingDamage: {},
          pendingBlock: {},
        },
      });

      const options = getSkillOptions(state, player, true);

      expect(options?.usableSkills.some((s) => s.skillId === SKILL_TOVAK_MOTIVATION)).toBe(true);
    });
  });

  describe("Timing: Can use on other players' turns", () => {
    it("should pass turn restriction validation when not player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // Player 2's turn
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      } as const;

      // Player 1 tries to use Motivation on Player 2's turn
      const result = validateSkillTurnRestriction(state, "player1", action);

      expect(result.valid).toBe(true);
    });

    it("should return out-of-turn skill options for player not on their turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
      });

      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });

      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // Player 2's turn
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      // Player 1 should have out-of-turn skill options
      const options = getOutOfTurnSkillOptions(state, player1, false);

      expect(options?.usableSkills.some((s) => s.skillId === SKILL_TOVAK_MOTIVATION)).toBe(true);
    });
  });

  describe("Cooldown: Lockout until end of next turn", () => {
    it("should add skill to activeUntilNextTurn when used", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        hand: [],
        deck: ["card1" as typeof CARD_MARCH, "card2" as typeof CARD_MARCH],
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      const result = command.execute(state);
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");

      expect(updatedPlayer?.skillCooldowns.usedThisRound).toContain(SKILL_TOVAK_MOTIVATION);
      expect(updatedPlayer?.skillCooldowns.usedThisTurn).toContain(SKILL_TOVAK_MOTIVATION);
      expect(updatedPlayer?.skillCooldowns.activeUntilNextTurn).toContain(SKILL_TOVAK_MOTIVATION);
    });

    it("should fail validation when skill is in activeUntilNextTurn", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_TOVAK_MOTIVATION], // Locked
        },
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const action = {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      } as const;

      const result = validateSkillCooldown(state, "player1", action);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("SKILL_LOCKED_UNTIL_NEXT_TURN");
      }
    });

    it("should keep skill locked after current turn ends (used this turn)", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_TOVAK_MOTIVATION],
          usedThisTurn: [SKILL_TOVAK_MOTIVATION], // Used this turn
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_TOVAK_MOTIVATION],
        },
        hand: [],
        deck: [],
        discard: [],
        playArea: [],
      });

      const cardFlow = {
        playArea: [] as typeof CARD_MARCH[],
        hand: [] as typeof CARD_MARCH[],
        deck: [] as typeof CARD_MARCH[],
        discard: [] as typeof CARD_MARCH[],
      };

      const resetPlayer = createResetPlayer(player, cardFlow);

      // Skill should still be in activeUntilNextTurn (lockout persists)
      expect(resetPlayer.skillCooldowns.activeUntilNextTurn).toContain(SKILL_TOVAK_MOTIVATION);
      // But usedThisTurn should be cleared
      expect(resetPlayer.skillCooldowns.usedThisTurn).not.toContain(SKILL_TOVAK_MOTIVATION);
    });

    it("should unlock skill after next turn ends (not used that turn)", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [], // New round, this was cleared
          usedThisTurn: [], // NOT used this turn (next turn)
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_TOVAK_MOTIVATION], // Still locked from previous turn
        },
        hand: [],
        deck: [],
        discard: [],
        playArea: [],
      });

      const cardFlow = {
        playArea: [] as typeof CARD_MARCH[],
        hand: [] as typeof CARD_MARCH[],
        deck: [] as typeof CARD_MARCH[],
        discard: [] as typeof CARD_MARCH[],
      };

      const resetPlayer = createResetPlayer(player, cardFlow);

      // Skill should be cleared from activeUntilNextTurn (lockout expired)
      expect(resetPlayer.skillCooldowns.activeUntilNextTurn).not.toContain(SKILL_TOVAK_MOTIVATION);
    });
  });

  describe("ValidActions integration", () => {
    it("should not show skill in options when on cooldown", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_TOVAK_MOTIVATION],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_TOVAK_MOTIVATION],
        },
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const options = getSkillOptions(state, player, false);

      // Skill should not be in usable skills
      expect(options?.usableSkills.some((s) => s.skillId === SKILL_TOVAK_MOTIVATION)).toBeFalsy();
    });

    it("should show skill in options when available", () => {
      const player = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });

      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      });

      const options = getSkillOptions(state, player, false);

      expect(options?.usableSkills.some((s) => s.skillId === SKILL_TOVAK_MOTIVATION)).toBe(true);
    });
  });
});
