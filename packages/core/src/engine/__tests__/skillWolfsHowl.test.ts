/**
 * Tests for Wolf's Howl skill (Wolfhawk)
 *
 * Part 1 — Sideways Bonus (owner activation):
 * Once per round, except during interaction/combat: One sideways card gives +4
 * instead of +1. For each command token without assigned unit, gives another +1.
 * Place skill token in center.
 *
 * Part 2 — Return Mechanic (interactive):
 * First player who encounters combat returns the skill face-down to Wolfhawk and:
 * Step 1: Reduce armor of chosen enemy by 1 (min 1) — excludes Arcane Immune (S5)
 * Step 2: Reduce attack of same or another enemy by 1 — NO Arcane Immune exclusion (S5)
 * Can split between summoner and summoned monster (S2).
 *
 * Key rules:
 * - Part of sideways bonus exclusion group (S2)
 * - No competitive penalty while in center (unlike Nature's Vengeance)
 * - Arcane Immune: cannot reduce armor (S5), CAN reduce attack (S5)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  INVALID_ACTION,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMIES,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_WOLFHAWK_WOLFS_HOWL,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
} from "../../data/skills/index.js";
import { getEffectiveEnemyAttack, getEffectiveEnemyArmor } from "../modifiers/combat.js";
import { getEffectiveSidewaysValue } from "../modifiers/index.js";
import {
  SOURCE_SKILL,
  EFFECT_SIDEWAYS_VALUE,
  EFFECT_TERRAIN_COST,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { getValidActions } from "../validActions/index.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

/**
 * Create a CombatEnemy from a known enemy definition.
 */
function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const definition = ENEMIES[enemyId as keyof typeof ENEMIES];
  if (!definition) {
    throw new Error(`Unknown enemy: ${enemyId}`);
  }
  return {
    instanceId,
    enemyId: enemyId as CombatEnemy["enemyId"],
    definition,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    ...overrides,
  };
}

/**
 * Create a combat state with specific enemies.
 */
function createCombatWithEnemies(enemies: CombatEnemy[]): CombatState {
  return {
    enemies,
    phase: COMBAT_PHASE_BLOCK,
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
    pendingSwiftBlock: {},
  };
}

describe("Wolf's Howl skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================================
  // PART 1: SIDEWAYS BONUS (OWNER ACTIVATION)
  // ============================================================================

  describe("sideways bonus (Part 1)", () => {
    it("should create sideways value modifier with +4 base + empty command tokens", () => {
      // Default player has commandTokens: 1, units: [] → 1 empty → +5
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const sidewaysModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_SIDEWAYS_VALUE
      );
      expect(sidewaysModifier).toBeDefined();
      if (sidewaysModifier && sidewaysModifier.effect.type === EFFECT_SIDEWAYS_VALUE) {
        expect(sidewaysModifier.effect.newValue).toBe(5);
      }
    });

    it("should give +4 with no empty command tokens", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
        commandTokens: 0,
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const sidewaysModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_SIDEWAYS_VALUE
      );
      expect(sidewaysModifier).toBeDefined();
      if (sidewaysModifier && sidewaysModifier.effect.type === EFFECT_SIDEWAYS_VALUE) {
        expect(sidewaysModifier.effect.newValue).toBe(4);
      }
    });

    it("should scale with multiple empty command tokens", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
        commandTokens: 3,
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const sidewaysModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_SIDEWAYS_VALUE
      );
      expect(sidewaysModifier).toBeDefined();
      if (sidewaysModifier && sidewaysModifier.effect.type === EFFECT_SIDEWAYS_VALUE) {
        expect(sidewaysModifier.effect.newValue).toBe(7); // 4 + 3
      }
    });

    it("should place skill token in center after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const centerModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_TERRAIN_COST
      );
      expect(centerModifier).toBeDefined();
    });

    it("should be usable once per round", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisRound: [SKILL_WOLFHAWK_WOLFS_HOWL],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not be usable during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should not be usable when conflicting sideways skill is active", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL, SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Activate I Don't Give a Damn first
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      }).state;

      // Wolf's Howl should not appear in valid actions
      const validActions = getValidActions(state, "player1");
      if (validActions.mode === "normal_turn" && validActions.skills) {
        const wolfsHowl = validActions.skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_WOLFS_HOWL
        );
        expect(wolfsHowl).toBeUndefined();
      }
    });

    it("should affect effective sideways value", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
        skillCooldowns: { ...defaultCooldowns },
        commandTokens: 0,
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const value = getEffectiveSidewaysValue(state, "player1", false, false);
      expect(value).toBe(4);
    });
  });

  // ============================================================================
  // PART 2: RETURN MECHANIC
  // ============================================================================

  describe("return mechanic", () => {
    function createMultiplayerState(): GameState {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
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

    function activateAndSwitchToPlayer2(state: GameState, combat: CombatState): GameState {
      // Owner activates Wolf's Howl
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Switch to player2's turn in combat
      return {
        ...state,
        currentPlayerIndex: 1,
        combat,
      };
    }

    it("should show returnable skill for non-owner player", () => {
      let state = createMultiplayerState();

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const player2State: GameState = {
        ...state,
        currentPlayerIndex: 1,
        combat: undefined,
      };

      const validActions = getValidActions(player2State, "player2");
      if (validActions.mode === "normal_turn") {
        expect(validActions.returnableSkills).toBeDefined();
        expect(validActions.returnableSkills?.returnable).toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
          })
        );
      }
    });

    it("should flip owner's skill face-down when returned", () => {
      let state = createMultiplayerState();
      const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      state = activateAndSwitchToPlayer2(state, combat);

      // Player2 returns the skill
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Resolve all pending choices
      while (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      expect(
        state.players[0]?.skillFlipState.flippedSkills
      ).toContain(SKILL_WOLFHAWK_WOLFS_HOWL);
    });

    it("should remove center modifier when returned", () => {
      let state = createMultiplayerState();

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Verify center modifier exists
      let centerModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_TERRAIN_COST
      );
      expect(centerModifier).toBeDefined();

      const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      state = {
        ...state,
        currentPlayerIndex: 1,
        combat,
      };

      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      while (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      centerModifier = state.activeModifiers.find(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL &&
          m.effect.type === EFFECT_TERRAIN_COST
      );
      expect(centerModifier).toBeUndefined();
    });

    it("return benefit should reduce enemy armor by 1 and attack by 1 (single enemy)", () => {
      let state = createMultiplayerState();
      const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      state = activateAndSwitchToPlayer2(state, combat);

      const enemyInstanceId = state.combat!.enemies[0]!.instanceId;
      const baseArmor = state.combat!.enemies[0]!.definition.armor; // 3
      const baseAttack = state.combat!.enemies[0]!.definition.attack; // 3

      // Player2 returns the skill — single enemy auto-resolves both steps
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      while (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Armor reduced by 1 (3 → 2)
      expect(getEffectiveEnemyArmor(state, enemyInstanceId, baseArmor, 0, "player2")).toBe(2);

      // Attack reduced by 1 (3 → 2)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(2);
    });

    it("should present enemy choices with two enemies", () => {
      let state = createMultiplayerState();
      const combat = createCombatWithEnemies([
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ]);
      state = activateAndSwitchToPlayer2(state, combat);

      // Player2 returns the skill
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Should have pending choice for armor target (2 enemies)
      const pendingChoice = state.players[1]?.pendingChoice;
      expect(pendingChoice).not.toBeNull();
      expect(pendingChoice?.options).toHaveLength(2);
    });

    it("should allow splitting armor and attack reductions between different enemies (S2)", () => {
      let state = createMultiplayerState();
      const combat = createCombatWithEnemies([
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ]);
      state = activateAndSwitchToPlayer2(state, combat);

      const baseArmor = 3;
      const baseAttack = 3;

      // Player2 returns the skill
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Step 1: Choose enemy_1 for armor reduction
      expect(state.players[1]?.pendingChoice).not.toBeNull();
      state = engine.processAction(state, "player2", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Step 2: Choose enemy_2 for attack reduction
      if (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1, // Second enemy
        }).state;
      }

      // Enemy 1: armor reduced, attack unchanged
      expect(getEffectiveEnemyArmor(state, "enemy_1", baseArmor, 0, "player2")).toBe(2);
      expect(getEffectiveEnemyAttack(state, "enemy_1", baseAttack)).toBe(3);

      // Enemy 2: armor unchanged, attack reduced
      expect(getEffectiveEnemyArmor(state, "enemy_2", baseArmor, 0, "player2")).toBe(3);
      expect(getEffectiveEnemyAttack(state, "enemy_2", baseAttack)).toBe(2);
    });
  });

  // ============================================================================
  // ARCANE IMMUNITY (S5)
  // ============================================================================

  describe("Arcane Immunity interaction (S5)", () => {
    function createMultiplayerState(): GameState {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
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

    it("should exclude Arcane Immune enemies from armor selection", () => {
      let state = createMultiplayerState();

      // Owner activates Wolf's Howl
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Combat with Sorcerers (Arcane Immune) + Diggers
      const combat = createCombatWithEnemies([
        createCombatEnemy("enemy_sorcerers", ENEMY_SORCERERS),
        createCombatEnemy("enemy_diggers", ENEMY_DIGGERS),
      ]);
      state = {
        ...state,
        currentPlayerIndex: 1,
        combat,
      };

      // Player2 returns the skill
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // The first pending choice is for armor selection.
      // Only Diggers should be eligible (Sorcerers are Arcane Immune → excluded).
      const armorChoice = state.players[1]?.pendingChoice;
      expect(armorChoice).not.toBeNull();
      expect(armorChoice?.options).toHaveLength(1); // Only Diggers

      // Resolve armor selection (Diggers)
      state = engine.processAction(state, "player2", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // After armor, the attack step should present BOTH enemies
      // (Arcane Immune NOT excluded from attack reduction)
      const attackChoice = state.players[1]?.pendingChoice;
      if (attackChoice) {
        expect(attackChoice.options).toHaveLength(2);
      }

      // Resolve any remaining choices
      while (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify Diggers got armor reduced
      expect(getEffectiveEnemyArmor(state, "enemy_diggers", 3, 0, "player2")).toBe(2);
    });

    it("should allow attack reduction on Arcane Immune enemies", () => {
      let state = createMultiplayerState();

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Combat with only Sorcerers (Arcane Immune)
      const combat = createCombatWithEnemies([
        createCombatEnemy("enemy_sorcerers", ENEMY_SORCERERS),
      ]);
      state = {
        ...state,
        currentPlayerIndex: 1,
        combat,
      };

      const baseAttack = 6; // Sorcerers attack

      // Player2 returns the skill
      state = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      // Resolve remaining choices
      while (state.players[1]?.pendingChoice) {
        state = engine.processAction(state, "player2", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Armor should NOT be reduced (no valid targets — Arcane Immune excluded)
      // Sorcerers armor stays at 6
      expect(getEffectiveEnemyArmor(state, "enemy_sorcerers", 6, 0, "player2")).toBe(6);

      // Attack SHOULD be reduced by 1 (Arcane Immunity does NOT block attack reduction)
      expect(getEffectiveEnemyAttack(state, "enemy_sorcerers", baseAttack)).toBe(5);
    });
  });

  // ============================================================================
  // NO COMPETITIVE PENALTY
  // ============================================================================

  describe("no competitive penalty", () => {
    it("should not have attack bonus modifier for other players while in center", () => {
      const owner = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_WOLFS_HOWL],
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

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_WOLFS_HOWL,
      }).state;

      const wolfsHowlModifiers = state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_WOLFS_HOWL
      );

      // Should have sideways value modifier and center marker only (no attack bonus penalty)
      const effectTypes = wolfsHowlModifiers.map((m) => m.effect.type);
      expect(effectTypes).toContain(EFFECT_SIDEWAYS_VALUE);
      expect(effectTypes).toContain(EFFECT_TERRAIN_COST);
      expect(effectTypes.length).toBe(2);
    });
  });
});
