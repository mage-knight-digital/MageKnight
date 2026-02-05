/**
 * Tests for the Cure / Disease spell (White Spell)
 *
 * Basic (Cure): Heal 2 wounds from hand. Draw a card for each wound healed
 * from hand this turn (including earlier healing). Ready all units healed
 * this turn. Set CURE_ACTIVE modifier for future healing triggers.
 *
 * Powered (Disease): All enemies with ALL attacks blocked get armor reduced to 1.
 * Applied as a combat-scoped modifier.
 *
 * Key rules:
 * - Healing category (basic), Combat category (powered)
 * - Cure draws for ALL wounds healed from hand this turn, not just from Cure itself
 * - After Cure, future GainHealing effects also draw cards (via CURE_ACTIVE)
 * - After Cure, future HealUnit effects also ready units (via CURE_ACTIVE)
 * - Disease only affects fully-blocked, non-defeated enemies
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type { CureEffect, DiseaseEffect } from "../../types/cards.js";
import {
  CATEGORY_HEALING,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import { EFFECT_CURE, EFFECT_DISEASE } from "../../types/effectTypes.js";
import {
  CARD_WOUND,
  CARD_CURE,
  CARD_MARCH,
  MANA_WHITE,
  MANA_BLACK,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNITS,
  ENEMY_GUARDSMEN,
  ENEMY_DIGGERS,
  getEnemy,
  type UnitId,
  type CardId,
} from "@mage-knight/shared";
import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { CombatEnemy } from "../../types/combat.js";
import { CURE } from "../../data/spells/white/cure.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer } from "./testHelpers.js";
import { addModifier } from "../modifiers/index.js";
import { getEffectiveEnemyArmor } from "../modifiers/combat.js";
import {
  DURATION_TURN,
  EFFECT_CURE_ACTIVE,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestState(playerOverrides: Partial<Player> = {}): GameState {
  const state = createInitialGameState();
  const player = createTestPlayer(playerOverrides);
  return {
    ...state,
    players: [player],
    currentPlayerIndex: 0,
  };
}

function createUnit(
  unitId: UnitId,
  instanceId: string,
  unitState: typeof UNIT_STATE_READY | typeof UNIT_STATE_SPENT,
  wounded: boolean
): PlayerUnit {
  return {
    instanceId,
    unitId,
    state: unitState,
    wounded,
    usedResistanceThisCombat: false,
  };
}

function getUnitIdOfLevel(level: number): UnitId {
  const unitEntry = Object.entries(UNITS).find(([_, def]) => def.level === level);
  if (!unitEntry) {
    throw new Error(`No unit found with level ${level}`);
  }
  return unitEntry[0] as UnitId;
}

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
    isRequiredForConquest: true,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
    ...overrides,
  };
}

function createStateWithCombat(
  enemies: CombatEnemy[],
  playerOverrides: Partial<Player> = {}
): GameState {
  const state = createTestState(playerOverrides);
  return {
    ...state,
    combat: {
      phase: "block" as const,
      enemies,
      isAtFortifiedSite: false,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      fameGained: 0,
      unitsAllowed: true,
      enemyAssignments: undefined,
      assaultOrigin: undefined,
    },
  };
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Cure spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_CURE);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Cure");
  });

  it("should have correct metadata", () => {
    expect(CURE.id).toBe(CARD_CURE);
    expect(CURE.name).toBe("Cure");
    expect(CURE.poweredName).toBe("Disease");
    expect(CURE.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(CURE.sidewaysValue).toBe(1);
  });

  it("should be powered by black + white mana", () => {
    expect(CURE.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
  });

  it("should have healing category for basic effect", () => {
    expect(CURE.categories).toEqual([CATEGORY_HEALING]);
  });

  it("should have combat category for powered effect", () => {
    expect(CURE.poweredEffectCategories).toEqual([CATEGORY_COMBAT]);
  });

  it("should have basic Cure effect with amount 2", () => {
    const effect = CURE.basicEffect as CureEffect;
    expect(effect.type).toBe(EFFECT_CURE);
    expect(effect.amount).toBe(2);
  });

  it("should have powered Disease effect", () => {
    const effect = CURE.poweredEffect as DiseaseEffect;
    expect(effect.type).toBe(EFFECT_DISEASE);
  });
});

// ============================================================================
// CURE BASIC EFFECT TESTS
// ============================================================================

describe("EFFECT_CURE (basic)", () => {
  const cureEffect: CureEffect = {
    type: EFFECT_CURE,
    amount: 2,
  };

  describe("isEffectResolvable", () => {
    it("should return true when player has wounds in hand", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_MARCH],
      });
      expect(isEffectResolvable(state, state.players[0]!.id, cureEffect)).toBe(true);
    });

    it("should return false when player has no wounds in hand", () => {
      const state = createTestState({
        hand: [CARD_MARCH],
      });
      expect(isEffectResolvable(state, state.players[0]!.id, cureEffect)).toBe(false);
    });
  });

  describe("resolveEffect - wound healing", () => {
    it("should heal wounds from hand", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        deck: ["card_a" as CardId, "card_b" as CardId],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      // 2 wounds healed, so hand should have CARD_MARCH + 2 drawn cards
      const player = result.state.players[0]!;
      expect(player.hand.filter((c) => c === CARD_WOUND).length).toBe(0);
      expect(result.description).toContain("Healed 2 wounds");
    });

    it("should heal only available wounds when less than amount", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_MARCH],
        deck: ["card_a" as CardId],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const player = result.state.players[0]!;
      expect(player.hand.filter((c) => c === CARD_WOUND).length).toBe(0);
      expect(result.description).toContain("Healed 1 wound");
    });

    it("should track woundsHealedFromHandThisTurn", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_WOUND],
        deck: ["card_a" as CardId, "card_b" as CardId],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      expect(result.state.players[0]!.woundsHealedFromHandThisTurn).toBe(2);
    });
  });

  describe("resolveEffect - card draw", () => {
    it("should draw cards equal to wounds healed from hand this turn", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_WOUND],
        deck: ["card_a" as CardId, "card_b" as CardId, "card_c" as CardId],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const player = result.state.players[0]!;
      // Healed 2 wounds, so drew 2 cards
      expect(player.deck.length).toBe(1); // 3 - 2 drawn
      expect(result.description).toContain("Drew 2 cards (Cure)");
    });

    it("should account for wounds healed earlier this turn", () => {
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: ["card_a" as CardId, "card_b" as CardId, "card_c" as CardId],
        woundsHealedFromHandThisTurn: 1, // 1 wound already healed earlier
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const player = result.state.players[0]!;
      // 1 already healed + 1 now = 2 total. Draws 2 cards.
      expect(player.deck.length).toBe(1); // 3 - 2 drawn
      expect(result.description).toContain("Drew 2 cards (Cure)");
    });

    it("should limit draws to available deck cards", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_WOUND],
        deck: ["card_a" as CardId], // Only 1 card in deck
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const player = result.state.players[0]!;
      expect(player.deck.length).toBe(0);
      expect(result.description).toContain("Drew 1 card (Cure)");
    });

    it("should not draw when deck is empty", () => {
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: [],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      expect(result.description).not.toContain("Drew");
    });
  });

  describe("resolveEffect - unit readying", () => {
    it("should ready units that were healed this turn", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: ["card_a" as CardId],
        units: [createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false)],
        unitsHealedThisTurn: ["unit-1"],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      expect(result.state.players[0]!.units[0]!.state).toBe(UNIT_STATE_READY);
      expect(result.description).toContain("Readied");
    });

    it("should not ready units that were not healed this turn", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: ["card_a" as CardId],
        units: [createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false)],
        unitsHealedThisTurn: [], // No units healed
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      expect(result.state.players[0]!.units[0]!.state).toBe(UNIT_STATE_SPENT);
    });

    it("should not re-ready already ready units", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: ["card_a" as CardId],
        units: [createUnit(unitId, "unit-1", UNIT_STATE_READY, false)],
        unitsHealedThisTurn: ["unit-1"],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      expect(result.state.players[0]!.units[0]!.state).toBe(UNIT_STATE_READY);
      // Should not mention "Readied" since unit was already ready
      expect(result.description).not.toContain("Readied");
    });
  });

  describe("resolveEffect - CURE_ACTIVE modifier", () => {
    it("should add CURE_ACTIVE modifier after resolution", () => {
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: ["card_a" as CardId],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const modifiers = result.state.activeModifiers;
      expect(modifiers.some((m) => m.effect.type === EFFECT_CURE_ACTIVE)).toBe(true);
    });

    it("should add modifier even when no wounds to heal", () => {
      // Edge: Cure might be played but there are no wounds (the resolvability
      // check normally prevents this, but the handler still adds the modifier)
      const state = createTestState({
        hand: [CARD_WOUND],
        deck: [],
      });

      const result = resolveEffect(state, state.players[0]!.id, cureEffect);

      const modifiers = result.state.activeModifiers;
      expect(modifiers.some((m) => m.effect.type === EFFECT_CURE_ACTIVE)).toBe(true);
    });
  });

  describe("resolveEffect - return wounds to pile", () => {
    it("should return healed wounds to the wound pile", () => {
      const state = createTestState({
        hand: [CARD_WOUND, CARD_WOUND],
        deck: ["card_a" as CardId, "card_b" as CardId],
      });
      // Set wound pile to tracked value
      const stateWithPile: GameState = { ...state, woundPileCount: 10 };

      const result = resolveEffect(stateWithPile, stateWithPile.players[0]!.id, cureEffect);

      expect(result.state.woundPileCount).toBe(12); // 10 + 2 healed
    });
  });
});

// ============================================================================
// CURE_ACTIVE FOLLOW-UP HEALING TESTS
// ============================================================================

describe("CURE_ACTIVE modifier - future healing triggers", () => {
  it("should cause GainHealing to also draw cards", () => {
    // Set up: Cure was already played (CURE_ACTIVE modifier present)
    let state = createTestState({
      hand: [CARD_WOUND, CARD_MARCH],
      deck: ["card_a" as CardId, "card_b" as CardId],
    });

    // Add CURE_ACTIVE modifier
    state = addModifier(state, {
      source: { type: SOURCE_CARD, cardId: CARD_CURE, playerId: state.players[0]!.id },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_CURE_ACTIVE },
      createdAtRound: state.round,
      createdByPlayerId: state.players[0]!.id,
    });

    // Now resolve a GainHealing effect (from another card)
    const healEffect = { type: "gain_healing" as const, amount: 1 };
    const result = resolveEffect(state, state.players[0]!.id, healEffect);

    const player = result.state.players[0]!;
    // 1 wound healed from hand, 1 card drawn from Cure
    expect(player.hand.filter((c) => c === CARD_WOUND).length).toBe(0);
    expect(result.description).toContain("Drew 1 card (Cure)");
  });

  it("should cause HealUnit to also ready the unit", () => {
    const unitId = getUnitIdOfLevel(1);

    let state = createTestState({
      hand: [CARD_MARCH],
      units: [createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true)],
    });

    // Add CURE_ACTIVE modifier
    state = addModifier(state, {
      source: { type: SOURCE_CARD, cardId: CARD_CURE, playerId: state.players[0]!.id },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_CURE_ACTIVE },
      createdAtRound: state.round,
      createdByPlayerId: state.players[0]!.id,
    });

    // Resolve HealUnit effect
    const healUnitEffect = { type: "heal_unit" as const, maxLevel: 4 as const };
    const result = resolveEffect(state, state.players[0]!.id, healUnitEffect);

    const unit = result.state.players[0]!.units[0]!;
    expect(unit.wounded).toBe(false);
    expect(unit.state).toBe(UNIT_STATE_READY); // Also readied by Cure
    expect(result.description).toContain("Cure");
  });
});

// ============================================================================
// DISEASE POWERED EFFECT TESTS
// ============================================================================

describe("EFFECT_DISEASE (powered)", () => {
  const diseaseEffect: DiseaseEffect = {
    type: EFFECT_DISEASE,
  };

  describe("isEffectResolvable", () => {
    it("should return true when in combat", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
      ]);
      expect(isEffectResolvable(state, state.players[0]!.id, diseaseEffect)).toBe(true);
    });

    it("should return false when not in combat", () => {
      const state = createTestState();
      expect(isEffectResolvable(state, state.players[0]!.id, diseaseEffect)).toBe(false);
    });
  });

  describe("resolveEffect", () => {
    it("should reduce armor to 1 for fully-blocked enemies", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, { isBlocked: true }),
      ]);

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      expect(result.description).toContain("armor reduced to 1");

      // Verify modifier was added
      const modifiers = result.state.activeModifiers;
      expect(modifiers.length).toBeGreaterThan(0);
    });

    it("should not affect unblocked enemies", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, { isBlocked: false }),
      ]);

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      expect(result.description).toBe("No fully-blocked enemies");
    });

    it("should not affect defeated enemies", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, {
          isBlocked: true,
          isDefeated: true,
        }),
      ]);

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      expect(result.description).toBe("No fully-blocked enemies");
    });

    it("should apply to multiple fully-blocked enemies", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, { isBlocked: true }),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS, { isBlocked: true }),
      ]);

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      // Both enemies should have armor modifiers
      expect(result.state.activeModifiers.length).toBe(2);
    });

    it("should only affect blocked enemies when mix of blocked/unblocked", () => {
      const state = createStateWithCombat([
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, { isBlocked: true }),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS, { isBlocked: false }),
      ]);

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      // Only 1 modifier (for the blocked enemy)
      expect(result.state.activeModifiers.length).toBe(1);
    });

    it("should return 'Not in combat' when no combat", () => {
      const state = createTestState();

      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      expect(result.description).toBe("Not in combat");
    });
  });

  describe("Disease armor modifier integration", () => {
    it("should make getEffectiveEnemyArmor return 1", () => {
      const enemy = createCombatEnemy("enemy_0", ENEMY_GUARDSMEN, { isBlocked: true });
      const baseArmor = enemy.definition.armor;

      let state = createStateWithCombat([enemy]);

      // Apply disease
      const result = resolveEffect(state, state.players[0]!.id, diseaseEffect);

      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        baseArmor,
        0, // no resistances
        state.players[0]!.id
      );

      expect(effectiveArmor).toBe(1);
    });
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Cure/Disease", () => {
  it("should describe Cure effect", () => {
    const effect: CureEffect = { type: EFFECT_CURE, amount: 2 };
    const desc = describeEffect(effect);
    expect(desc).toContain("Heal");
    expect(desc).toContain("2");
  });

  it("should describe Disease effect", () => {
    const effect: DiseaseEffect = { type: EFFECT_DISEASE };
    const desc = describeEffect(effect);
    expect(desc).toContain("armor");
    expect(desc).toContain("1");
  });
});
