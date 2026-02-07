/**
 * Tests for Noble Manners card deferred interaction bonus
 *
 * Noble Manners grants a modifier when played. The bonus (Fame/Reputation)
 * triggers only when the player performs an actual interaction (recruit, heal,
 * buy spell), not just for being at an inhabited site.
 *
 * Basic: Influence 2. Fame +1 on next interaction this turn.
 * Powered (White): Influence 4. Fame +1 and Reputation +1 on next interaction this turn.
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import { NOROWAS_NOBLE_MANNERS } from "../../data/basicActions/white/norowas-noble-manners.js";
import type {
  ApplyInteractionBonusEffect,
  CompoundEffect,
} from "../../types/cards.js";
import {
  EFFECT_APPLY_INTERACTION_BONUS,
  EFFECT_COMPOUND,
  EFFECT_GAIN_INFLUENCE,
} from "../../types/effectTypes.js";
import {
  EFFECT_INTERACTION_BONUS,
} from "../../types/modifierConstants.js";
import type { InteractionBonusModifier } from "../../types/modifiers.js";
import {
  UNITS,
  type UnitId,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import {
  createRecruitUnitCommand,
  resetUnitInstanceCounter,
} from "../commands/units/recruitUnitCommand.js";
import {
  getActiveInteractionBonus,
  getActiveInteractionBonusModifierIds,
} from "../rules/unitRecruitment.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

// Get a level-1 unit ID for testing
function getUnitIdOfLevel(level: number): UnitId {
  const unitEntry = Object.entries(UNITS).find(([_, def]) => def.level === level);
  if (!unitEntry) {
    throw new Error(`No unit found with level ${level}`);
  }
  return unitEntry[0] as UnitId;
}

// Helper to create a state with units in the offer
function createRecruitState(
  numUnitsInOffer: number = 1,
  influencePoints: number = 20,
): GameState {
  resetUnitInstanceCounter();
  const unitId = getUnitIdOfLevel(1);
  const unitIds = Array.from({ length: numUnitsInOffer }, () => unitId);
  const player = createTestPlayer({ influencePoints });
  return createTestGameState({
    players: [player],
    offers: {
      units: unitIds,
      advancedActions: [],
      spells: [],
    } as GameState["offers"],
  });
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Noble Manners card definition", () => {
  it("should have basic effect as compound of influence(2) + interaction bonus", () => {
    const basic = NOROWAS_NOBLE_MANNERS.basicEffect;
    expect(basic.type).toBe(EFFECT_COMPOUND);
    const compound = basic as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_APPLY_INTERACTION_BONUS);

    const bonus = compound.effects[1] as ApplyInteractionBonusEffect;
    expect(bonus.fame).toBe(1);
    expect(bonus.reputation).toBe(0);
  });

  it("should have powered effect as compound of influence(4) + interaction bonus with rep", () => {
    const powered = NOROWAS_NOBLE_MANNERS.poweredEffect;
    expect(powered.type).toBe(EFFECT_COMPOUND);
    const compound = powered as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_APPLY_INTERACTION_BONUS);

    const bonus = compound.effects[1] as ApplyInteractionBonusEffect;
    expect(bonus.fame).toBe(1);
    expect(bonus.reputation).toBe(1);
  });
});

// ============================================================================
// EFFECT_APPLY_INTERACTION_BONUS TESTS
// ============================================================================

describe("EFFECT_APPLY_INTERACTION_BONUS", () => {
  const basicEffect: ApplyInteractionBonusEffect = {
    type: EFFECT_APPLY_INTERACTION_BONUS,
    fame: 1,
    reputation: 0,
  };

  const poweredEffect: ApplyInteractionBonusEffect = {
    type: EFFECT_APPLY_INTERACTION_BONUS,
    fame: 1,
    reputation: 1,
  };

  describe("resolveEffect", () => {
    it("should add an interaction bonus modifier for basic effect", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_INTERACTION_BONUS);
      const bonusEffect = modifier.effect as InteractionBonusModifier;
      expect(bonusEffect.fame).toBe(1);
      expect(bonusEffect.reputation).toBe(0);
    });

    it("should add an interaction bonus modifier for powered effect", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_INTERACTION_BONUS);
      const bonusEffect = modifier.effect as InteractionBonusModifier;
      expect(bonusEffect.fame).toBe(1);
      expect(bonusEffect.reputation).toBe(1);
    });

    it("should NOT immediately grant fame or reputation", () => {
      const state = createRecruitState();
      const initialFame = state.players[0].fame;
      const initialRep = state.players[0].reputation;

      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      // No immediate fame or reputation change
      expect(result.state.players[0].fame).toBe(initialFame);
      expect(result.state.players[0].reputation).toBe(initialRep);
    });

    it("should set modifier duration to turn", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.state.activeModifiers[0].duration).toBe("turn");
    });

    it("should include a description", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.description).toContain("Fame");
      expect(result.description).toContain("Reputation");
      expect(result.description).toContain("interaction");
    });
  });

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createRecruitState();
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(true);
    });
  });

  describe("describeEffect", () => {
    it("should describe basic effect (fame only)", () => {
      const desc = describeEffect(basicEffect);
      expect(desc).toContain("Fame");
      expect(desc).toContain("interaction");
    });

    it("should describe powered effect (fame + reputation)", () => {
      const desc = describeEffect(poweredEffect);
      expect(desc).toContain("Fame");
      expect(desc).toContain("Reputation");
    });
  });
});

// ============================================================================
// INTEGRATION: INTERACTION BONUS + RECRUIT COMMAND
// ============================================================================

describe("Noble Manners interaction bonus + recruitment", () => {
  const basicBonusEffect: ApplyInteractionBonusEffect = {
    type: EFFECT_APPLY_INTERACTION_BONUS,
    fame: 1,
    reputation: 0,
  };

  const poweredBonusEffect: ApplyInteractionBonusEffect = {
    type: EFFECT_APPLY_INTERACTION_BONUS,
    fame: 1,
    reputation: 1,
  };

  describe("basic effect (fame only)", () => {
    it("should grant +1 fame when recruiting after playing Noble Manners", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;

      // Apply the interaction bonus modifier
      const bonusResult = resolveEffect(state, playerId, basicBonusEffect);
      const stateWithBonus = bonusResult.state;
      const initialFame = stateWithBonus.players[0].fame;
      const initialRep = stateWithBonus.players[0].reputation;

      // Recruit a unit
      const unitId = stateWithBonus.offers.units[0];
      const unitDef = UNITS[unitId];
      const command = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const result = command.execute(stateWithBonus);

      // Fame should be +1, reputation unchanged
      expect(result.state.players[0].fame).toBe(initialFame + 1);
      expect(result.state.players[0].reputation).toBe(initialRep);
    });
  });

  describe("powered effect (fame + reputation)", () => {
    it("should grant +1 fame and +1 reputation when recruiting after playing Noble Manners", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;

      // Apply the powered interaction bonus modifier
      const bonusResult = resolveEffect(state, playerId, poweredBonusEffect);
      const stateWithBonus = bonusResult.state;
      const initialFame = stateWithBonus.players[0].fame;
      const initialRep = stateWithBonus.players[0].reputation;

      // Recruit a unit
      const unitId = stateWithBonus.offers.units[0];
      const unitDef = UNITS[unitId];
      const command = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const result = command.execute(stateWithBonus);

      // Fame +1 and reputation +1
      expect(result.state.players[0].fame).toBe(initialFame + 1);
      expect(result.state.players[0].reputation).toBe(initialRep + 1);
    });
  });

  describe("modifier consumption", () => {
    it("should consume the modifier after first recruitment", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(2);
      const playerId = state.players[0].id;

      // Apply the interaction bonus modifier
      const bonusResult = resolveEffect(state, playerId, basicBonusEffect);
      let currentState = bonusResult.state;

      // Verify modifier exists
      expect(getActiveInteractionBonus(currentState, playerId)).not.toBeNull();

      // Recruit first unit
      const unitId = currentState.offers.units[0];
      const unitDef = UNITS[unitId];
      const command1 = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const result1 = command1.execute(currentState);
      currentState = result1.state;

      // Modifier should be consumed (removed)
      expect(getActiveInteractionBonus(currentState, playerId)).toBeNull();
      expect(getActiveInteractionBonusModifierIds(currentState, playerId)).toHaveLength(0);
    });

    it("should only grant bonus on first recruitment, not second", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(2);
      const playerId = state.players[0].id;

      // Apply the interaction bonus modifier
      const bonusResult = resolveEffect(state, playerId, basicBonusEffect);
      let currentState = bonusResult.state;
      const initialFame = currentState.players[0].fame;

      // Recruit first unit — bonus fires
      const unitId1 = currentState.offers.units[0];
      const unitDef1 = UNITS[unitId1];
      const command1 = createRecruitUnitCommand({
        playerId,
        unitId: unitId1,
        influenceSpent: unitDef1.influence,
      });
      const result1 = command1.execute(currentState);
      currentState = result1.state;
      expect(currentState.players[0].fame).toBe(initialFame + 1);

      // Recruit second unit — no bonus (modifier was consumed)
      const unitId2 = currentState.offers.units[0];
      const unitDef2 = UNITS[unitId2];
      const command2 = createRecruitUnitCommand({
        playerId,
        unitId: unitId2,
        influenceSpent: unitDef2.influence,
      });
      const result2 = command2.execute(currentState);
      currentState = result2.state;

      // Fame should still be +1 total (not +2)
      expect(currentState.players[0].fame).toBe(initialFame + 1);
    });
  });

  describe("undo support", () => {
    it("should restore fame and modifiers on undo of recruitment", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;

      // Apply the interaction bonus modifier
      const bonusResult = resolveEffect(state, playerId, basicBonusEffect);
      const stateWithBonus = bonusResult.state;
      const initialFame = stateWithBonus.players[0].fame;

      // Recruit a unit
      const unitId = stateWithBonus.offers.units[0];
      const unitDef = UNITS[unitId];
      const command = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const executed = command.execute(stateWithBonus);

      // Verify bonus was applied
      expect(executed.state.players[0].fame).toBe(initialFame + 1);
      expect(getActiveInteractionBonus(executed.state, playerId)).toBeNull();

      // Undo the command
      const undone = command.undo(executed.state);

      // Fame should be restored
      expect(undone.state.players[0].fame).toBe(initialFame);

      // Modifier should be restored
      expect(getActiveInteractionBonus(undone.state, playerId)).not.toBeNull();
    });
  });

  describe("no bonus without modifier", () => {
    it("should not change fame or reputation when recruiting without modifier", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;
      const initialFame = state.players[0].fame;
      const initialRep = state.players[0].reputation;

      // Recruit without any bonus modifier
      const unitId = state.offers.units[0];
      const unitDef = UNITS[unitId];
      const command = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const result = command.execute(state);

      // No bonuses applied
      expect(result.state.players[0].fame).toBe(initialFame);
      expect(result.state.players[0].reputation).toBe(initialRep);
    });
  });
});

// ============================================================================
// FULL CARD INTEGRATION: RESOLVE BASIC/POWERED EFFECT
// ============================================================================

describe("Noble Manners full card effect", () => {
  it("basic effect should grant influence 2 + add interaction bonus modifier", () => {
    const state = createRecruitState();
    const playerId = state.players[0].id;

    const result = resolveEffect(
      state,
      playerId,
      NOROWAS_NOBLE_MANNERS.basicEffect,
      NOROWAS_NOBLE_MANNERS.id,
    );

    // Influence granted (20 base + 2 from card)
    expect(result.state.players[0].influencePoints).toBe(22);

    // Modifier added but NO immediate fame/rep
    expect(result.state.players[0].fame).toBe(0);
    expect(result.state.activeModifiers).toHaveLength(1);
    expect(result.state.activeModifiers[0].effect.type).toBe(EFFECT_INTERACTION_BONUS);
  });

  it("powered effect should grant influence 4 + add interaction bonus modifier with rep", () => {
    const state = createRecruitState();
    const playerId = state.players[0].id;

    const result = resolveEffect(
      state,
      playerId,
      NOROWAS_NOBLE_MANNERS.poweredEffect,
      NOROWAS_NOBLE_MANNERS.id,
    );

    // Influence granted (20 base + 4 from card)
    expect(result.state.players[0].influencePoints).toBe(24);

    // Modifier added but NO immediate fame/rep
    expect(result.state.players[0].fame).toBe(0);
    expect(result.state.players[0].reputation).toBe(0);
    expect(result.state.activeModifiers).toHaveLength(1);
    const bonusEffect = result.state.activeModifiers[0].effect as InteractionBonusModifier;
    expect(bonusEffect.fame).toBe(1);
    expect(bonusEffect.reputation).toBe(1);
  });

  it("full flow: play card → recruit → verify bonus triggers", () => {
    resetUnitInstanceCounter();
    const state = createRecruitState(1);
    const playerId = state.players[0].id;

    // Resolve the full card effect
    const cardResult = resolveEffect(
      state,
      playerId,
      NOROWAS_NOBLE_MANNERS.basicEffect,
      NOROWAS_NOBLE_MANNERS.id,
    );
    let currentState = cardResult.state;

    // No immediate fame
    expect(currentState.players[0].fame).toBe(0);

    // Now recruit
    const unitId = currentState.offers.units[0];
    const unitDef = UNITS[unitId];
    const command = createRecruitUnitCommand({
      playerId,
      unitId,
      influenceSpent: unitDef.influence,
    });
    const result = command.execute(currentState);
    currentState = result.state;

    // Fame +1 from interaction bonus
    expect(currentState.players[0].fame).toBe(1);

    // Modifier consumed
    expect(getActiveInteractionBonus(currentState, playerId)).toBeNull();
  });
});
