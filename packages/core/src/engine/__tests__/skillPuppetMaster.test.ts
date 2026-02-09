/**
 * Tests for Puppet Master skill (Krang)
 *
 * Once per turn during combat, either:
 * - Keep one defeated enemy token, OR
 * - Discard a previously kept token for Attack or Block
 *
 * Attack = ceil(enemy_attack / 2) with matching element (melee only)
 * Block = ceil(enemy_armor / 2) with opposite element of resistance
 *
 * Key rules:
 * - Cannot keep AND expend in same turn (once per turn) (S7)
 * - Can accumulate multiple tokens across turns (S7)
 * - Arcane Immunity and Elusive ignored for token values (S1)
 * - Physical resistance has no effect on Block element (S5)
 * - Attacks are NOT ranged/siege (S9)
 * - Usable in Dungeons/Tombs (not a unit) (S6)
 * - Multiple attacks split into compound effect (S3)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENEMY_PROWLERS,
  ENEMY_GUARDSMEN,
  ENEMY_FIRE_MAGES,
  ENEMY_ICE_MAGES,
  ENEMY_DELPHANA_MASTERS,
  ENEMY_ORC_SKIRMISHERS,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import type { EnemyId } from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_PUPPET_MASTER } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_COMPOUND,
  EFFECT_PUPPET_MASTER_KEEP,
  EFFECT_PUPPET_MASTER_EXPEND,
} from "../../types/effectTypes.js";
import {
  getBlockElementFromResistances,
  createKeptTokenFromEnemy,
} from "../commands/skills/puppetMasterEffect.js";
import type { KeptEnemyToken } from "../../types/player.js";
import type { CardEffect } from "../../types/cards.js";
import {
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  RESIST_FIRE,
  RESIST_ICE,
  RESIST_PHYSICAL,
  getEnemy,
} from "@mage-knight/shared";

function createKrangPlayer(overrides: Record<string, unknown> = {}) {
  return createTestPlayer({
    hero: Hero.Krang,
    skills: [SKILL_KRANG_PUPPET_MASTER],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
    ...overrides,
  });
}

/**
 * Create a combat state with one or more defeated enemies.
 */
function createCombatWithDefeated(
  enemyIds: readonly EnemyId[],
  defeatedIndices: readonly number[] = [0],
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_ATTACK = COMBAT_PHASE_ATTACK
) {
  const combat = createCombatState(enemyIds);
  const enemies = combat.enemies.map((e, i) => ({
    ...e,
    isDefeated: defeatedIndices.includes(i),
  }));
  return { ...combat, phase, enemies };
}

/**
 * Create a simple kept enemy token for testing expend mode.
 */
function createTestToken(enemyId: EnemyId): KeptEnemyToken {
  const def = getEnemy(enemyId);
  return {
    enemyId,
    name: def.name,
    attack: def.attack,
    attackElement: def.attackElement,
    attacks: def.attacks,
    armor: def.armor,
    resistances: def.resistances,
  };
}

describe("Puppet Master skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ======================================================================
  // ACTIVATION
  // ======================================================================

  describe("activation", () => {
    it("should activate during combat with defeated enemies (keep mode)", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_PUPPET_MASTER,
        })
      );
    });

    it("should activate during combat with stored tokens (expend mode)", () => {
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      // Combat with alive enemy (no defeated ones) — but has stored tokens
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_PUPPET_MASTER,
        })
      );
    });

    it("should reject when not in combat", () => {
      const player = createKrangPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject when in combat but no defeated enemies and no stored tokens", () => {
      const player = createKrangPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });

    it("should reject when on cooldown (once per turn)", () => {
      const player = createKrangPlayer({
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_KRANG_PUPPET_MASTER],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ======================================================================
  // KEEP MODE
  // ======================================================================

  describe("keep mode", () => {
    it("should present keep options for defeated enemies", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice;
      expect(pending).toBeDefined();
      expect(pending!.skillId).toBe(SKILL_KRANG_PUPPET_MASTER);

      // Should have at least one keep option
      const keepOptions = pending!.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );
      expect(keepOptions.length).toBeGreaterThan(0);
    });

    it("should add token to player storage when keeping defeated enemy", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      // Find the keep option index
      const pending = activateResult.state.players[0]!.pendingChoice!;
      const keepIndex = pending.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );
      expect(keepIndex).toBeGreaterThanOrEqual(0);

      // Resolve the choice
      const resolveResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: keepIndex,
        }
      );

      // Token should be stored
      expect(resolveResult.state.players[0]!.keptEnemyTokens).toHaveLength(1);
      const token = resolveResult.state.players[0]!.keptEnemyTokens[0]!;
      expect(token.enemyId).toBe(ENEMY_PROWLERS);
      expect(token.name).toBe("Prowlers");
      expect(token.attack).toBe(4);
      expect(token.attackElement).toBe(ELEMENT_PHYSICAL);
      expect(token.armor).toBe(3);
    });

    it("should present multiple keep options when multiple enemies defeated", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated(
        [ENEMY_PROWLERS, ENEMY_FIRE_MAGES],
        [0, 1]
      );
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice!;
      const keepOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );
      expect(keepOptions).toHaveLength(2);
    });

    it("should not show keep options for alive enemies", () => {
      const player = createKrangPlayer();
      // Only first enemy is defeated
      const combat = createCombatWithDefeated(
        [ENEMY_PROWLERS, ENEMY_GUARDSMEN],
        [0]
      );
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice!;
      const keepOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );
      // Only the defeated one
      expect(keepOptions).toHaveLength(1);
    });
  });

  // ======================================================================
  // EXPEND MODE
  // ======================================================================

  describe("expend mode", () => {
    it("should present expend options for stored tokens", () => {
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      // Combat with alive enemy only — forces expend mode
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice!;
      const expendOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      expect(expendOptions).toHaveLength(1);
    });

    it("should show both keep and expend when defeated enemies AND stored tokens exist", () => {
      const token = createTestToken(ENEMY_GUARDSMEN);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice!;
      const keepOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );
      const expendOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      expect(keepOptions.length).toBeGreaterThan(0);
      expect(expendOptions.length).toBeGreaterThan(0);
    });

    it("should remove token from storage and create attack/block sub-choice", () => {
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      // Find expend option
      const pending = activateResult.state.players[0]!.pendingChoice!;
      const expendIndex = pending.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );

      // Resolve expend choice
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: expendIndex,
        }
      );

      // Token should be removed
      expect(expendResult.state.players[0]!.keptEnemyTokens).toHaveLength(0);

      // Should have a new sub-choice: attack vs block
      const subChoice = expendResult.state.players[0]!.pendingChoice;
      expect(subChoice).toBeDefined();
      expect(subChoice!.options).toHaveLength(2);
    });

    it("should grant melee attack when choosing attack option", () => {
      const token = createTestToken(ENEMY_PROWLERS); // Attack 4 Physical
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate → Expend → Choose Attack
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      // Verify sub-choice exists
      const subPending = expendResult.state.players[0]!.pendingChoice;
      expect(subPending).toBeDefined();
      expect(subPending!.options.length).toBe(2);

      // Find the attack option
      const subOptions = subPending!.options;
      const attackIndex = subOptions.findIndex(
        (o) => o.type === EFFECT_GAIN_ATTACK
      );
      expect(attackIndex).toBeGreaterThanOrEqual(0);

      // Check events for INVALID_ACTION from sub-choice resolve
      const attackResult = engine.processAction(
        expendResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: attackIndex }
      );

      // Prowlers: attack 4 → ceil(4/2) = 2 Physical melee attack
      const accumulator = attackResult.state.players[0]!.combatAccumulator;
      expect(accumulator.attack.normal).toBe(2);
    });

    it("should grant block when choosing block option", () => {
      const token = createTestToken(ENEMY_PROWLERS); // Armor 3, no resistances
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate → Expend → Choose Block
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      // Find the block option
      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const blockIndex = subOptions.findIndex(
        (o) => o.type === EFFECT_GAIN_BLOCK
      );

      const blockResult = engine.processAction(
        expendResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: blockIndex }
      );

      // Prowlers: armor 3 → ceil(3/2) = 2 Physical block
      const accumulator = blockResult.state.players[0]!.combatAccumulator;
      expect(accumulator.block).toBe(2);
      expect(accumulator.blockElements.physical).toBe(2);
    });
  });

  // ======================================================================
  // ATTACK CALCULATIONS
  // ======================================================================

  describe("attack calculations", () => {
    it("should calculate ceil(attack/2) for odd attack values", () => {
      // Prowlers: attack 4, ceil(4/2) = 2
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const attackOption = subOptions.find((o) => o.type === EFFECT_GAIN_ATTACK) as CardEffect & { amount: number };
      expect(attackOption).toBeDefined();
      expect(attackOption.amount).toBe(2); // ceil(4/2) = 2
    });

    it("should preserve fire element on attack", () => {
      // Fire Mages: attack 6 Fire
      const token = createTestToken(ENEMY_FIRE_MAGES);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const attackOption = subOptions.find((o) => o.type === EFFECT_GAIN_ATTACK) as CardEffect & { amount: number; element: string };
      expect(attackOption.amount).toBe(3); // ceil(6/2) = 3
      expect(attackOption.element).toBe(ELEMENT_FIRE);
    });

    it("should preserve ice element on attack", () => {
      // Ice Mages: attack 5 Ice
      const token = createTestToken(ENEMY_ICE_MAGES);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const attackOption = subOptions.find((o) => o.type === EFFECT_GAIN_ATTACK) as CardEffect & { amount: number; element: string };
      expect(attackOption.amount).toBe(3); // ceil(5/2) = 3
      expect(attackOption.element).toBe(ELEMENT_ICE);
    });

    it("should create compound effect for multi-attack enemies", () => {
      // Orc Skirmishers: 2 attacks of 1 Physical each
      const token = createTestToken(ENEMY_ORC_SKIRMISHERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      // Attack option should be a compound effect with 2 sub-attacks
      const attackOption = subOptions.find(
        (o) => o.type === EFFECT_COMPOUND || o.type === EFFECT_GAIN_ATTACK
      );
      expect(attackOption).toBeDefined();

      if (attackOption!.type === EFFECT_COMPOUND) {
        const compound = attackOption as CardEffect & { effects: readonly CardEffect[] };
        expect(compound.effects).toHaveLength(2);
        // Each attack: ceil(1/2) = 1
        for (const sub of compound.effects) {
          expect(sub.type).toBe(EFFECT_GAIN_ATTACK);
          expect((sub as CardEffect & { amount: number }).amount).toBe(1);
        }
      }
    });

    it("should set combat type to melee (not ranged/siege) per S9", () => {
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const attackOption = subOptions.find(
        (o) => o.type === EFFECT_GAIN_ATTACK
      ) as CardEffect & { combatType: string };
      expect(attackOption.combatType).toBe("melee");
    });
  });

  // ======================================================================
  // BLOCK CALCULATIONS (ELEMENT CONVERSION)
  // ======================================================================

  describe("block element conversion", () => {
    it("should convert fire resistance to ice block", () => {
      // Fire Mages: resist fire → Ice block
      const token = createTestToken(ENEMY_FIRE_MAGES);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const blockOption = subOptions.find(
        (o) => o.type === EFFECT_GAIN_BLOCK
      ) as CardEffect & { amount: number; element: string };
      expect(blockOption.amount).toBe(3); // ceil(5/2) = 3
      expect(blockOption.element).toBe(ELEMENT_ICE);
    });

    it("should convert ice resistance to fire block", () => {
      // Ice Mages: resist ice → Fire block
      const token = createTestToken(ENEMY_ICE_MAGES);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const blockOption = subOptions.find(
        (o) => o.type === EFFECT_GAIN_BLOCK
      ) as CardEffect & { amount: number; element: string };
      expect(blockOption.amount).toBe(3); // ceil(6/2) = 3
      expect(blockOption.element).toBe(ELEMENT_FIRE);
    });

    it("should convert both fire+ice resistance to cold fire block", () => {
      // Delphana Masters: resist fire + ice → ColdFire block
      const token = createTestToken(ENEMY_DELPHANA_MASTERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const blockOption = subOptions.find(
        (o) => o.type === EFFECT_GAIN_BLOCK
      ) as CardEffect & { amount: number; element: string };
      expect(blockOption.amount).toBe(4); // ceil(8/2) = 4
      expect(blockOption.element).toBe(ELEMENT_COLD_FIRE);
    });

    it("should give physical block when enemy has no elemental resistances", () => {
      // Prowlers: no resistances → Physical block
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });
      const expendIndex = activateResult.state.players[0]!.pendingChoice!.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      const expendResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: expendIndex }
      );

      const subOptions = expendResult.state.players[0]!.pendingChoice!.options;
      const blockOption = subOptions.find(
        (o) => o.type === EFFECT_GAIN_BLOCK
      ) as CardEffect & { amount: number; element: string | undefined };
      expect(blockOption.amount).toBe(2); // ceil(3/2) = 2
      // Physical block uses undefined element (engine convention)
      expect(blockOption.element).toBeUndefined();
    });
  });

  // ======================================================================
  // getBlockElementFromResistances (UNIT TESTS)
  // ======================================================================

  describe("getBlockElementFromResistances", () => {
    it("should return ice for fire resistance", () => {
      expect(getBlockElementFromResistances([RESIST_FIRE])).toBe(ELEMENT_ICE);
    });

    it("should return fire for ice resistance", () => {
      expect(getBlockElementFromResistances([RESIST_ICE])).toBe(ELEMENT_FIRE);
    });

    it("should return cold fire for both fire and ice resistance", () => {
      expect(getBlockElementFromResistances([RESIST_FIRE, RESIST_ICE])).toBe(
        ELEMENT_COLD_FIRE
      );
    });

    it("should return physical for physical-only resistance (S5)", () => {
      expect(getBlockElementFromResistances([RESIST_PHYSICAL])).toBe(
        ELEMENT_PHYSICAL
      );
    });

    it("should return physical for no resistances", () => {
      expect(getBlockElementFromResistances([])).toBe(ELEMENT_PHYSICAL);
    });
  });

  // ======================================================================
  // createKeptTokenFromEnemy (UNIT TESTS)
  // ======================================================================

  describe("createKeptTokenFromEnemy", () => {
    it("should capture enemy combat data", () => {
      const combat = createCombatState([ENEMY_FIRE_MAGES]);
      const enemy = combat.enemies[0]!;
      const token = createKeptTokenFromEnemy(enemy);

      expect(token.enemyId).toBe(ENEMY_FIRE_MAGES);
      expect(token.name).toBe("Fire Mages");
      expect(token.attack).toBe(6);
      expect(token.attackElement).toBe(ELEMENT_FIRE);
      expect(token.armor).toBe(5);
      expect(token.resistances).toEqual([RESIST_FIRE]);
    });

    it("should capture multi-attack data", () => {
      const combat = createCombatState([ENEMY_ORC_SKIRMISHERS]);
      const enemy = combat.enemies[0]!;
      const token = createKeptTokenFromEnemy(enemy);

      expect(token.attacks).toHaveLength(2);
      expect(token.attacks![0]!.damage).toBe(1);
      expect(token.attacks![1]!.damage).toBe(1);
    });
  });

  // ======================================================================
  // VALID ACTIONS
  // ======================================================================

  describe("valid actions", () => {
    it("should show Puppet Master in valid actions during combat with defeated enemies", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_PUPPET_MASTER,
        })
      );
    });

    it("should show Puppet Master in valid actions during combat with stored tokens", () => {
      const token = createTestToken(ENEMY_PROWLERS);
      const player = createKrangPlayer({ keptEnemyTokens: [token] });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_PUPPET_MASTER,
        })
      );
    });

    it("should not show Puppet Master outside combat", () => {
      const player = createKrangPlayer();
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_KRANG_PUPPET_MASTER,
          })
        );
      }
    });

    it("should not show Puppet Master when on cooldown", () => {
      const player = createKrangPlayer({
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_KRANG_PUPPET_MASTER],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_KRANG_PUPPET_MASTER,
          })
        );
      }
    });

    it("should not show Puppet Master when no defeated enemies and no tokens", () => {
      const player = createKrangPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_KRANG_PUPPET_MASTER,
          })
        );
      }
    });
  });

  // ======================================================================
  // UNDO
  // ======================================================================

  describe("undo", () => {
    it("should clear pending choice on undo", () => {
      const player = createKrangPlayer();
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      // Should have pending choice
      expect(result.state.players[0]!.pendingChoice).toBeDefined();

      // Check undo is available
      const validActions = getValidActions(result.state, "player1");
      expect(validActions.turn.canUndo).toBe(true);
    });
  });

  // ======================================================================
  // TOKEN ACCUMULATION
  // ======================================================================

  describe("token accumulation", () => {
    it("should allow accumulating multiple tokens across activations", () => {
      // Start with one token already stored, keep another
      const existingToken = createTestToken(ENEMY_GUARDSMEN);
      const player = createKrangPlayer({ keptEnemyTokens: [existingToken] });
      const combat = createCombatWithDefeated([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      // Activate skill
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      // Choose to keep the defeated enemy (not expend stored)
      const pending = activateResult.state.players[0]!.pendingChoice!;
      const keepIndex = pending.options.findIndex(
        (o) => o.type === EFFECT_PUPPET_MASTER_KEEP
      );

      const resolveResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: keepIndex }
      );

      // Should now have 2 tokens
      expect(resolveResult.state.players[0]!.keptEnemyTokens).toHaveLength(2);
    });

    it("should present multiple expend options when multiple tokens stored", () => {
      const token1 = createTestToken(ENEMY_PROWLERS);
      const token2 = createTestToken(ENEMY_FIRE_MAGES);
      const player = createKrangPlayer({
        keptEnemyTokens: [token1, token2],
      });
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_PUPPET_MASTER,
      });

      const pending = result.state.players[0]!.pendingChoice!;
      const expendOptions = pending.options.filter(
        (o) => o.type === EFFECT_PUPPET_MASTER_EXPEND
      );
      expect(expendOptions).toHaveLength(2);
    });
  });
});
