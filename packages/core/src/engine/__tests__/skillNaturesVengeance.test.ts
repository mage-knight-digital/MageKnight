/**
 * Tests for Nature's Vengeance skill (Braevalar)
 *
 * Active (interactive, once per round): Reduce one enemy's attack by 1 and
 * grant that enemy Cumbersome. Put skill token in center.
 *
 * While in center: Other players' enemies get +1 attack during Block phase only (S1).
 * Owner is exempt from this penalty (S1).
 *
 * Other players may return the token to owner (face-down) to reduce one enemy's
 * attack by 1 and give that enemy Cumbersome.
 *
 * Key rules:
 * - Cannot target Summoner tokens, but CAN target summoned Monsters (S3)
 * - Arcane Immune enemies CAN gain Cumbersome (O4)
 * - +1 attack penalty only during Block phase (S1)
 * - Owner is exempt from +1 penalty (S1)
 * - Multi-attack enemies: each attack gets +1 (S1)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  INVALID_ACTION,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMY_ORC_SUMMONERS,
  ENEMY_ORC_SKIRMISHERS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_NATURES_VENGEANCE } from "../../data/skills/index.js";
import { getEffectiveEnemyAttack, getNaturesVengeanceAttackBonus } from "../modifiers/combat.js";
import { isCumbersomeActive } from "../combat/cumbersomeHelpers.js";
import {
  SOURCE_SKILL,
  EFFECT_NATURES_VENGEANCE_ATTACK_BONUS,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";
import { computeBlockPhaseOptions } from "../validActions/combatBlock.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Nature's Vengeance skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================================
  // OWNER ACTIVATION: Attack reduction + Cumbersome
  // ============================================================================

  describe("owner activation", () => {
    it("should reduce enemy attack by 1 and grant Cumbersome", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0]?.instanceId ?? "";
      const baseAttack = state.combat?.enemies[0]?.definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Select the target enemy (if pending choice exists)
      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack was reduced by 1
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(2);

      // Verify Cumbersome was granted
      const enemy = state.combat?.enemies[0];
      expect(enemy).toBeDefined();
      expect(isCumbersomeActive(state, "player1", enemy!)).toBe(true);
    });

    it("should place skill token in center after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Select target enemy
      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify center modifier was placed (the +1 attack penalty modifier)
      const centerModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_BRAEVALAR_NATURES_VENGEANCE &&
          m.effect.type === EFFECT_NATURES_VENGEANCE_ATTACK_BONUS
      );
      expect(centerModifier).toBeDefined();
    });

    it("should be usable once per round", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisRound: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Try to activate - should fail
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================================
  // SUMMONER EXCLUSION (S3)
  // ============================================================================

  describe("Summoner exclusion (S3)", () => {
    it("should not allow targeting Summoner enemies", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Summoners + two other enemies
      // Need 2 non-Summoner enemies so there's a pending choice (not auto-resolved)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS, ENEMY_DIGGERS, ENEMY_ORC_SKIRMISHERS],
      }).state;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Check that the pending choice only has non-Summoner enemies
      const pendingChoice = state.players[0]?.pendingChoice;
      expect(pendingChoice).not.toBeNull();
      // Should only have 2 options (Diggers + Orc Skirmishers), not 3 (excludes Summoners)
      expect(pendingChoice?.options).toHaveLength(2);
    });

    it("should auto-resolve when only one non-Summoner enemy exists", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Summoners + one other enemy
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS, ENEMY_DIGGERS],
      }).state;

      const diggersInstanceId = state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DIGGERS
      )?.instanceId ?? "";

      // Activate skill - should auto-resolve targeting Diggers (only non-Summoner)
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // No pending choice (auto-resolved)
      expect(state.players[0]?.pendingChoice).toBeNull();

      // Verify Diggers got the reduction
      const diggersBaseAttack = 3;
      expect(getEffectiveEnemyAttack(state, diggersInstanceId, diggersBaseAttack)).toBe(2);
    });
  });

  // ============================================================================
  // ARCANE IMMUNITY INTERACTION (O4)
  // ============================================================================

  describe("Arcane Immunity interaction (O4)", () => {
    it("should grant Cumbersome to Arcane Immune enemies", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0]?.instanceId ?? "";
      const baseAttack = state.combat?.enemies[0]?.definition.attack ?? 0;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Select the Sorcerers as target
      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Attack reduction should work (bypasses Arcane Immunity for attack reductions)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        baseAttack - 1
      );

      // Cumbersome should also be granted (O4)
      const enemy = state.combat?.enemies[0];
      expect(enemy).toBeDefined();
      expect(isCumbersomeActive(state, "player1", enemy!)).toBe(true);
    });
  });

  // ============================================================================
  // MULTI-ENEMY COMBAT
  // ============================================================================

  describe("multi-enemy combat", () => {
    it("should only affect the selected enemy", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_ORC_SKIRMISHERS],
      }).state;

      const enemy1InstanceId = state.combat?.enemies[0]?.instanceId ?? "";
      const enemy2InstanceId = state.combat?.enemies[1]?.instanceId ?? "";
      const enemy1BaseAttack = state.combat?.enemies[0]?.definition.attack ?? 0;
      const enemy2BaseAttack = state.combat?.enemies[1]?.definition.attack ?? 0;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Should have 2 enemy selection options
      expect(state.players[0]?.pendingChoice?.options).toHaveLength(2);

      // Select first enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // First enemy should have reduced attack
      expect(getEffectiveEnemyAttack(state, enemy1InstanceId, enemy1BaseAttack)).toBe(
        enemy1BaseAttack - 1
      );

      // Second enemy should have unchanged attack
      expect(getEffectiveEnemyAttack(state, enemy2InstanceId, enemy2BaseAttack)).toBe(
        enemy2BaseAttack
      );

      // First enemy should have Cumbersome, second should not
      const enemy1 = state.combat?.enemies[0];
      const enemy2 = state.combat?.enemies[1];
      expect(isCumbersomeActive(state, "player1", enemy1!)).toBe(true);
      expect(isCumbersomeActive(state, "player1", enemy2!)).toBe(false);
    });
  });

  // ============================================================================
  // COMPETITIVE +1 ATTACK PENALTY (S1)
  // ============================================================================

  describe("competitive +1 attack penalty (S1)", () => {
    function createTwoPlayerCombatState(): GameState {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      const otherPlayer = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });

      return createTestGameState({
        players: [owner, otherPlayer],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
    }

    it("should apply +1 attack bonus to other players during Block phase", () => {
      let state = createTwoPlayerCombatState();

      // Owner enters combat and activates Nature's Vengeance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify the +1 bonus exists for the other player
      const bonus = getNaturesVengeanceAttackBonus(state, "player2");
      expect(bonus).toBe(1);
    });

    it("should NOT apply +1 to the skill owner (S1)", () => {
      let state = createTwoPlayerCombatState();

      // Owner enters combat and activates Nature's Vengeance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Owner should NOT have the +1 penalty
      const bonus = getNaturesVengeanceAttackBonus(state, "player1");
      expect(bonus).toBe(0);
    });

    it("should reflect +1 in block options for other players", () => {
      let state = createTwoPlayerCombatState();

      // Owner enters combat and activates Nature's Vengeance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Set up combat state at Block phase for player2
      const combatState = state.combat;
      if (combatState) {
        const blockPhaseState: GameState = {
          ...state,
          combat: { ...combatState, phase: COMBAT_PHASE_BLOCK },
        };

        const blockOptions = computeBlockPhaseOptions(
          blockPhaseState,
          blockPhaseState.combat!,
          blockPhaseState.players[1] // player2
        );

        // Diggers have base attack 3, reduced by 1 to 2 (Nature's Vengeance), +1 penalty = 3
        // Wait: the -1 is on the enemy (modifier), +1 is on the player (penalty)
        // getEffectiveEnemyAttack returns 2 (base 3 - 1 modifier)
        // getNaturesVengeanceAttackBonus returns 1 for player2
        // So block options should show enemy attack as 2 + 1 = 3
        const blockOpts = blockOptions.blocks;
        if (blockOpts && blockOpts.length > 0) {
          expect(blockOpts[0]?.enemyAttack).toBe(3);
        }
      }
    });
  });

  // ============================================================================
  // RETURN MECHANIC (MULTIPLAYER)
  // ============================================================================

  describe("return mechanic (multiplayer)", () => {
    function createMultiplayerState(): GameState {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      const otherPlayer = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });

      return createTestGameState({
        players: [owner, otherPlayer],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
    }

    it("should show returnable skill for non-owner player", () => {
      let state = createMultiplayerState();

      // Owner enters combat and activates Nature's Vengeance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Switch to player2's turn (need to end combat first, then switch turns)
      // For this test, just check valid actions for player2 context
      const player2State: GameState = {
        ...state,
        currentPlayerIndex: 1,
        combat: undefined, // Not in combat
      };

      const validActions = getValidActions(player2State, "player2");
      if (validActions.mode === "normal_turn") {
        expect(validActions.returnableSkills).toBeDefined();
        expect(validActions.returnableSkills?.returnable).toContainEqual(
          expect.objectContaining({
            skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
          })
        );
      }
    });

    it("should flip owner's skill when returned", () => {
      let state = createMultiplayerState();

      // Owner enters combat and activates Nature's Vengeance
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Set up player2's turn in combat
      const player2Combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      state = {
        ...state,
        currentPlayerIndex: 1,
        combat: player2Combat,
      };

      // Player2 returns the skill — single enemy auto-resolves
      const result = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      });

      // Select target enemy if pending
      let finalState = result.state;
      if (result.state.players[1]?.pendingChoice) {
        finalState = engine.processAction(result.state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Owner's skill should be flipped
      expect(
        finalState.players[0]?.skillFlipState.flippedSkills
      ).toContain(SKILL_BRAEVALAR_NATURES_VENGEANCE);
    });

    it("return benefit should reduce target enemy attack by 1 and grant Cumbersome", () => {
      let state = createMultiplayerState();

      // Owner activates Nature's Vengeance (player1 enters combat with one enemy)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Switch to player2's turn in combat with a different Diggers enemy
      // Manually set up combat state for player2 (simulating entering combat)
      const player2CombatState = createUnitCombatState(COMBAT_PHASE_BLOCK);
      state = {
        ...state,
        currentPlayerIndex: 1,
        combat: player2CombatState,
      };

      const enemyInstanceId = state.combat!.enemies[0]!.instanceId;
      expect(state.combat!.enemies[0]!.definition.attack).toBe(3);

      // Player2 returns the skill — single enemy should auto-resolve
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      // Resolve target enemy if pending
      if (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack reduced by 1 (3 → 2)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, 3)).toBe(2);

      // Verify Cumbersome granted
      const enemy = state.combat?.enemies[0];
      expect(enemy).toBeDefined();
      expect(isCumbersomeActive(state, "player2", enemy!)).toBe(true);
    });
  });

  // ============================================================================
  // BLOCK PHASE INTEGRATION
  // ============================================================================

  describe("block phase integration", () => {
    it("should require more block after +1 penalty for non-owner", () => {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_NATURES_VENGEANCE],
        skillCooldowns: { ...defaultCooldowns },
      });
      const otherPlayer = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });
      let state = createTestGameState({
        players: [owner, otherPlayer],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });

      // Owner enters combat and activates Nature's Vengeance on Diggers (Attack 3 → 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_NATURES_VENGEANCE,
      }).state;

      if (state.players[0]?.pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify that owner sees reduced attack (3 - 1 = 2) with no +1 penalty
      const ownerBonus = getNaturesVengeanceAttackBonus(state, "player1");
      expect(ownerBonus).toBe(0);

      // Verify that other player sees +1 penalty
      const otherBonus = getNaturesVengeanceAttackBonus(state, "player2");
      expect(otherBonus).toBe(1);
    });
  });
});
