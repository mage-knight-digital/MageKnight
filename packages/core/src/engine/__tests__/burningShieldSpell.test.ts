/**
 * Burning Shield / Exploding Shield Spell Tests
 *
 * Tests for:
 * - Card definition and registration
 * - Basic (Burning Shield): Fire Block 4 + on successful block → Fire Attack 4
 * - Powered (Exploding Shield): Fire Block 4 + on successful block → destroy enemy
 * - Fire Resistance blocking powered destruction
 * - Arcane Immunity blocking powered destruction
 * - Modifier consumed after first successful block
 * - Fame awarded / not awarded for summoned enemies
 * - Integration with declareBlockCommand
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import {
  CARD_BURNING_SHIELD,
  ENEMY_DIGGERS,
  ENEMY_FIRE_MAGES,
  ENEMY_SORCERERS,
  ENEMY_WOLF_RIDERS,
  ENEMY_BLOCKED,
  getEnemy,
} from "@mage-knight/shared";
import { BURNING_SHIELD } from "../../data/spells/red/burningShield.js";
import { getSpellCard } from "../../data/spells/index.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  MANA_RED,
  MANA_BLACK,
} from "@mage-knight/shared";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import {
  addModifier,
} from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_BURNING_SHIELD_ACTIVE,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_CONTEXT_STANDARD,
} from "../../types/combat.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { applyBurningShieldOnBlock } from "../combat/burningShieldHelpers.js";
import { createDeclareBlockCommand } from "../commands/combat/declareBlockCommand.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isDefeated: false,
    isBlocked: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
    ...overrides,
  };
}

function createStateWithCombat(
  enemies: CombatEnemy[],
  pendingBlock: Record<string, { physical: number; fire: number; ice: number; coldFire: number }> = {}
): GameState {
  const player = createTestPlayer({ id: "player1" });
  const state = createTestGameState({ players: [player] });
  return {
    ...state,
    combat: {
      phase: COMBAT_PHASE_BLOCK,
      enemies,
      isAtFortifiedSite: false,
      pendingDamage: {},
      pendingBlock,
      pendingSwiftBlock: {},
      fameGained: 0,
      woundsThisCombat: 0,
      attacksThisPhase: 0,
      unitsAllowed: true,
      nightManaRules: false,
      assaultOrigin: null,
      combatHexCoord: null,
      allDamageBlockedThisPhase: false,
      discardEnemiesOnFailure: false,
      combatContext: COMBAT_CONTEXT_STANDARD,
      cumbersomeReductions: {},
      usedDefend: {},
      defendBonuses: {},
      paidHeroesAssaultInfluence: false,
      vampiricArmorBonus: {},
      paidThugsDamageInfluence: {},
      damageRedirects: {},
    },
    activeModifiers: [],
  };
}

/**
 * Add a Burning Shield modifier (basic mode) to the state
 */
function addBurningShieldModifier(state: GameState, mode: "attack" | "destroy"): GameState {
  return addModifier(state, {
    source: { type: SOURCE_CARD, cardId: CARD_BURNING_SHIELD, playerId: "player1" },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_BURNING_SHIELD_ACTIVE,
      mode,
      blockValue: 4,
      attackValue: mode === "attack" ? 4 : 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Burning Shield / Exploding Shield Spell", () => {
  describe("card definition", () => {
    it("should be registered in spell cards", () => {
      const card = getSpellCard(CARD_BURNING_SHIELD);
      expect(card).toBeDefined();
      expect(card?.name).toBe("Burning Shield");
    });

    it("should have correct metadata", () => {
      expect(BURNING_SHIELD.id).toBe(CARD_BURNING_SHIELD);
      expect(BURNING_SHIELD.name).toBe("Burning Shield");
      expect(BURNING_SHIELD.poweredName).toBe("Exploding Shield");
      expect(BURNING_SHIELD.cardType).toBe(DEED_CARD_TYPE_SPELL);
      expect(BURNING_SHIELD.sidewaysValue).toBe(1);
    });

    it("should be powered by black + red mana", () => {
      expect(BURNING_SHIELD.poweredBy).toEqual([MANA_BLACK, MANA_RED]);
    });

    it("should have combat category", () => {
      expect(BURNING_SHIELD.categories).toEqual([CATEGORY_COMBAT]);
    });
  });

  // ============================================================================
  // BASIC EFFECT: BURNING SHIELD
  // ============================================================================

  describe("basic effect (Burning Shield)", () => {
    const basicEffect = BURNING_SHIELD.basicEffect;

    it("should grant Fire Block 4", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", basicEffect);

      // Should have Fire Block 4 in accumulator
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.block).toBe(4);
      expect(player?.combatAccumulator.blockElements.fire).toBe(4);
    });

    it("should apply Burning Shield modifier for combat duration", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", basicEffect);

      // Should have active Burning Shield modifier
      const modifiers = getModifiersForPlayer(result.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeDefined();
      expect(shieldMod?.effect).toMatchObject({
        type: EFFECT_BURNING_SHIELD_ACTIVE,
        mode: "attack",
        blockValue: 4,
        attackValue: 4,
      });
      expect(shieldMod?.duration).toBe(DURATION_COMBAT);
    });

    it("should be resolvable in combat", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });
  });

  // ============================================================================
  // POWERED EFFECT: EXPLODING SHIELD
  // ============================================================================

  describe("powered effect (Exploding Shield)", () => {
    const poweredEffect = BURNING_SHIELD.poweredEffect;

    it("should grant Fire Block 4", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.block).toBe(4);
      expect(player?.combatAccumulator.blockElements.fire).toBe(4);
    });

    it("should apply Exploding Shield modifier with destroy mode", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      const modifiers = getModifiersForPlayer(result.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeDefined();
      expect(shieldMod?.effect).toMatchObject({
        type: EFFECT_BURNING_SHIELD_ACTIVE,
        mode: "destroy",
        blockValue: 4,
        attackValue: 0,
      });
    });
  });

  // ============================================================================
  // ON-BLOCK-SUCCESS: BASIC (Fire Attack 4)
  // ============================================================================

  describe("on successful block - basic (Fire Attack 4)", () => {
    it("should grant Fire Attack 4 to combat accumulator", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);
      state = addBurningShieldModifier(state, "attack");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      expect(result).not.toBeNull();
      const player = result!.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(4);
      expect(player?.combatAccumulator.attack.normalElements.fire).toBe(4);
    });

    it("should consume the modifier after triggering", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);
      state = addBurningShieldModifier(state, "attack");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      // Modifier should be removed
      const modifiers = getModifiersForPlayer(result!.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeUndefined();
    });

    it("should not trigger on second block (modifier consumed)", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
        createCombatEnemy("enemy_1", ENEMY_WOLF_RIDERS),
      ]);
      state = addBurningShieldModifier(state, "attack");

      // First block triggers
      const enemy0 = state.combat!.enemies[0]!;
      const result1 = applyBurningShieldOnBlock(state, "player1", enemy0);
      expect(result1).not.toBeNull();

      // Second block should not trigger (modifier consumed)
      const enemy1 = result1!.state.combat!.enemies[1]!;
      const result2 = applyBurningShieldOnBlock(result1!.state, "player1", enemy1);
      expect(result2).toBeNull();
    });

    it("should return null when no modifier is active", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // ON-BLOCK-SUCCESS: POWERED (Destroy enemy)
  // ============================================================================

  describe("on successful block - powered (Destroy enemy)", () => {
    it("should destroy the blocked enemy", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS),
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      expect(result).not.toBeNull();
      expect(result!.state.combat?.enemies[0]?.isDefeated).toBe(true);
    });

    it("should award fame for destroyed enemy", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS), // 3 fame
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      const player = result!.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(3);
      expect(result!.state.combat?.fameGained).toBe(3);
    });

    it("should NOT destroy Fire Resistant enemies", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES), // Fire Resistant
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      // Enemy should NOT be defeated
      expect(result).not.toBeNull();
      expect(result!.state.combat?.enemies[0]?.isDefeated).toBe(false);
    });

    it("should NOT destroy Arcane Immune enemies", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // Arcane Immune
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      // Enemy should NOT be defeated
      expect(result).not.toBeNull();
      expect(result!.state.combat?.enemies[0]?.isDefeated).toBe(false);
    });

    it("should consume modifier even when enemy is Fire Resistant", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES),
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      // Modifier should still be consumed
      const modifiers = getModifiersForPlayer(result!.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeUndefined();
    });

    it("should NOT award fame for summoned enemies", () => {
      let state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS, {
          summonedByInstanceId: "summoner_1",
        }),
      ]);
      state = addBurningShieldModifier(state, "destroy");

      const enemy = state.combat!.enemies[0]!;
      const result = applyBurningShieldOnBlock(state, "player1", enemy);

      // Enemy should be destroyed but no fame awarded
      expect(result!.state.combat?.enemies[0]?.isDefeated).toBe(true);
      const player = result!.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(0);
      expect(result!.state.combat?.fameGained).toBe(0);
    });
  });

  // ============================================================================
  // INTEGRATION: declareBlockCommand with Burning Shield
  // ============================================================================

  describe("integration with declareBlockCommand", () => {
    it("should trigger basic Burning Shield on successful block", () => {
      const enemy = createCombatEnemy("enemy_0", ENEMY_DIGGERS); // attack 3
      let state = createStateWithCombat(
        [enemy],
        // Provide enough fire block to meet attack of 3
        { enemy_0: { physical: 0, fire: 3, ice: 0, coldFire: 0 } }
      );
      state = addBurningShieldModifier(state, "attack");

      const command = createDeclareBlockCommand({
        playerId: "player1",
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      const result = command.execute(state);

      // Block should succeed
      expect(result.events.some((e) => e.type === ENEMY_BLOCKED)).toBe(true);

      // Burning Shield should have triggered - Fire Attack 4 added
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(4);
      expect(player?.combatAccumulator.attack.normalElements.fire).toBe(4);

      // Modifier should be consumed
      const modifiers = getModifiersForPlayer(result.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeUndefined();
    });

    it("should trigger powered Exploding Shield - destroy enemy on successful block", () => {
      const enemy = createCombatEnemy("enemy_0", ENEMY_DIGGERS); // attack 3, fame 2
      let state = createStateWithCombat(
        [enemy],
        { enemy_0: { physical: 0, fire: 3, ice: 0, coldFire: 0 } }
      );
      state = addBurningShieldModifier(state, "destroy");

      const command = createDeclareBlockCommand({
        playerId: "player1",
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      const result = command.execute(state);

      // Block should succeed
      expect(result.events.some((e) => e.type === ENEMY_BLOCKED)).toBe(true);

      // Enemy should be destroyed
      expect(result.state.combat?.enemies[0]?.isDefeated).toBe(true);

      // Fame should be awarded
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(2); // Diggers = 2 fame
      expect(result.state.combat?.fameGained).toBe(2);
    });

    it("should NOT trigger Burning Shield on failed block", () => {
      const enemy = createCombatEnemy("enemy_0", ENEMY_WOLF_RIDERS); // attack 4
      let state = createStateWithCombat(
        [enemy],
        // Only 2 fire block - not enough for attack 4
        { enemy_0: { physical: 0, fire: 2, ice: 0, coldFire: 0 } }
      );
      state = addBurningShieldModifier(state, "attack");

      const command = createDeclareBlockCommand({
        playerId: "player1",
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      const result = command.execute(state);

      // Block should fail
      expect(result.events.some((e) => e.type === ENEMY_BLOCKED)).toBe(false);

      // Fire Attack should NOT be granted (block failed)
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(0);

      // Modifier should still be active (not consumed on failed block)
      const modifiers = getModifiersForPlayer(result.state, "player1");
      const shieldMod = modifiers.find(
        (m) => m.effect.type === EFFECT_BURNING_SHIELD_ACTIVE
      );
      expect(shieldMod).toBeDefined();
    });

    it("should NOT destroy Fire Resistant enemy via Exploding Shield", () => {
      const enemy = createCombatEnemy("enemy_0", ENEMY_FIRE_MAGES); // Fire Resistant, attack 6
      let state = createStateWithCombat(
        [enemy],
        // Enough fire block to meet the attack (fire vs fire = inefficient, need double)
        { enemy_0: { physical: 0, fire: 12, ice: 0, coldFire: 0 } }
      );
      state = addBurningShieldModifier(state, "destroy");

      const command = createDeclareBlockCommand({
        playerId: "player1",
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      const result = command.execute(state);

      // Block should succeed (fire block vs fire attack needs 2x, 12 >= 6*2)
      expect(result.state.combat?.enemies[0]?.isBlocked).toBe(true);

      // Enemy should NOT be destroyed (Fire Resistant)
      expect(result.state.combat?.enemies[0]?.isDefeated).toBe(false);
    });
  });
});
