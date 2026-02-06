/**
 * Tests for Heroic Tale card
 *
 * Basic: Influence 3. Reputation +1 for each Unit you recruit this turn.
 * Powered (White): Influence 6. Fame +1 and Reputation +1 for each Unit you recruit this turn.
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import type {
  ApplyRecruitmentBonusEffect,
  CompoundEffect,
} from "../../types/cards.js";
import {
  EFFECT_APPLY_RECRUITMENT_BONUS,
  EFFECT_COMPOUND,
  EFFECT_GAIN_INFLUENCE,
} from "../../types/effectTypes.js";
import {
  EFFECT_RECRUITMENT_BONUS,
} from "../../types/modifierConstants.js";
import type { UnitRecruitmentBonusModifier } from "../../types/modifiers.js";
import {
  UNITS,
  type UnitId,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import {
  createRecruitUnitCommand,
  resetUnitInstanceCounter,
} from "../commands/units/recruitUnitCommand.js";
import { getActiveRecruitmentBonus } from "../rules/unitRecruitment.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { HEROIC_TALE } from "../../data/advancedActions/white/heroic-tale.js";

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

describe("Heroic Tale card definition", () => {
  it("should have correct categories", () => {
    expect(HEROIC_TALE.categories).toContain("influence");
  });

  it("should have basic effect as compound of influence(3) + recruitment bonus", () => {
    const basic = HEROIC_TALE.basicEffect;
    expect(basic.type).toBe(EFFECT_COMPOUND);
    const compound = basic as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_APPLY_RECRUITMENT_BONUS);

    const bonus = compound.effects[1] as ApplyRecruitmentBonusEffect;
    expect(bonus.reputationPerRecruit).toBe(1);
    expect(bonus.famePerRecruit).toBe(0);
  });

  it("should have powered effect as compound of influence(6) + recruitment bonus with fame", () => {
    const powered = HEROIC_TALE.poweredEffect;
    expect(powered.type).toBe(EFFECT_COMPOUND);
    const compound = powered as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_APPLY_RECRUITMENT_BONUS);

    const bonus = compound.effects[1] as ApplyRecruitmentBonusEffect;
    expect(bonus.reputationPerRecruit).toBe(1);
    expect(bonus.famePerRecruit).toBe(1);
  });
});

// ============================================================================
// EFFECT_APPLY_RECRUITMENT_BONUS TESTS
// ============================================================================

describe("EFFECT_APPLY_RECRUITMENT_BONUS", () => {
  const basicEffect: ApplyRecruitmentBonusEffect = {
    type: EFFECT_APPLY_RECRUITMENT_BONUS,
    reputationPerRecruit: 1,
    famePerRecruit: 0,
  };

  const poweredEffect: ApplyRecruitmentBonusEffect = {
    type: EFFECT_APPLY_RECRUITMENT_BONUS,
    reputationPerRecruit: 1,
    famePerRecruit: 1,
  };

  describe("resolveEffect", () => {
    it("should add a recruitment bonus modifier for basic effect", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_RECRUITMENT_BONUS);
      const bonusEffect = modifier.effect as UnitRecruitmentBonusModifier;
      expect(bonusEffect.reputationPerRecruit).toBe(1);
      expect(bonusEffect.famePerRecruit).toBe(0);
    });

    it("should add a recruitment bonus modifier for powered effect", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_RECRUITMENT_BONUS);
      const bonusEffect = modifier.effect as UnitRecruitmentBonusModifier;
      expect(bonusEffect.reputationPerRecruit).toBe(1);
      expect(bonusEffect.famePerRecruit).toBe(1);
    });

    it("should set modifier duration to turn", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.state.activeModifiers[0].duration).toBe("turn");
    });

    it("should include a description", () => {
      const state = createRecruitState();
      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.description).toContain("Reputation");
      expect(result.description).toContain("Fame");
      expect(result.description).toContain("per unit recruited");
    });
  });

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createRecruitState();
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(true);
    });
  });

  describe("describeEffect", () => {
    it("should describe basic effect (reputation only)", () => {
      const desc = describeEffect(basicEffect);
      expect(desc).toContain("Reputation");
      expect(desc).toContain("per unit recruited");
    });

    it("should describe powered effect (reputation + fame)", () => {
      const desc = describeEffect(poweredEffect);
      expect(desc).toContain("Reputation");
      expect(desc).toContain("Fame");
    });
  });
});

// ============================================================================
// INTEGRATION: RECRUITMENT BONUS + RECRUITMENT COMMAND
// ============================================================================

describe("Recruitment bonus integration with recruitUnitCommand", () => {
  const basicBonusEffect: ApplyRecruitmentBonusEffect = {
    type: EFFECT_APPLY_RECRUITMENT_BONUS,
    reputationPerRecruit: 1,
    famePerRecruit: 0,
  };

  const poweredBonusEffect: ApplyRecruitmentBonusEffect = {
    type: EFFECT_APPLY_RECRUITMENT_BONUS,
    reputationPerRecruit: 1,
    famePerRecruit: 1,
  };

  function applyBonusAndRecruit(
    bonusEffect: ApplyRecruitmentBonusEffect,
    numUnits: number = 1,
  ): { initialState: GameState; finalState: GameState } {
    resetUnitInstanceCounter();
    const state = createRecruitState(numUnits);
    const playerId = state.players[0].id;

    // Apply the recruitment bonus modifier
    const bonusResult = resolveEffect(state, playerId, bonusEffect);
    let currentState = bonusResult.state;
    const initialState = currentState;

    // Recruit units
    for (let i = 0; i < numUnits; i++) {
      const unitId = currentState.offers.units[0];
      const unitDef = UNITS[unitId];
      const command = createRecruitUnitCommand({
        playerId,
        unitId,
        influenceSpent: unitDef.influence,
      });
      const result = command.execute(currentState);
      currentState = result.state;
    }

    return { initialState, finalState: currentState };
  }

  describe("basic effect (reputation only)", () => {
    it("should grant +1 reputation on single recruitment", () => {
      const { initialState, finalState } = applyBonusAndRecruit(basicBonusEffect, 1);
      const initialRep = initialState.players[0].reputation;
      expect(finalState.players[0].reputation).toBe(initialRep + 1);
    });

    it("should grant +2 reputation on two recruitments", () => {
      const { initialState, finalState } = applyBonusAndRecruit(basicBonusEffect, 2);
      const initialRep = initialState.players[0].reputation;
      expect(finalState.players[0].reputation).toBe(initialRep + 2);
    });

    it("should not grant fame on basic effect", () => {
      const { initialState, finalState } = applyBonusAndRecruit(basicBonusEffect, 1);
      expect(finalState.players[0].fame).toBe(initialState.players[0].fame);
    });
  });

  describe("powered effect (reputation + fame)", () => {
    it("should grant +1 reputation and +1 fame on single recruitment", () => {
      const { initialState, finalState } = applyBonusAndRecruit(poweredBonusEffect, 1);
      const initialRep = initialState.players[0].reputation;
      const initialFame = initialState.players[0].fame;
      expect(finalState.players[0].reputation).toBe(initialRep + 1);
      expect(finalState.players[0].fame).toBe(initialFame + 1);
    });

    it("should grant +2 reputation and +2 fame on two recruitments", () => {
      const { initialState, finalState } = applyBonusAndRecruit(poweredBonusEffect, 2);
      const initialRep = initialState.players[0].reputation;
      const initialFame = initialState.players[0].fame;
      expect(finalState.players[0].reputation).toBe(initialRep + 2);
      expect(finalState.players[0].fame).toBe(initialFame + 2);
    });

    it("should grant +3 reputation and +3 fame on three recruitments", () => {
      const { initialState, finalState } = applyBonusAndRecruit(poweredBonusEffect, 3);
      const initialRep = initialState.players[0].reputation;
      const initialFame = initialState.players[0].fame;
      expect(finalState.players[0].reputation).toBe(initialRep + 3);
      expect(finalState.players[0].fame).toBe(initialFame + 3);
    });
  });

  describe("modifier persistence", () => {
    it("should NOT consume the modifier after recruitment", () => {
      const state = createRecruitState(2);
      const playerId = state.players[0].id;

      // Apply the bonus modifier
      const bonusResult = resolveEffect(state, playerId, basicBonusEffect);
      let currentState = bonusResult.state;

      // Verify modifier exists
      expect(getActiveRecruitmentBonus(currentState, playerId)).not.toBeNull();

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

      // Modifier should still be active
      expect(getActiveRecruitmentBonus(currentState, playerId)).not.toBeNull();

      // Recruit second unit
      const unitId2 = currentState.offers.units[0];
      const unitDef2 = UNITS[unitId2];
      const command2 = createRecruitUnitCommand({
        playerId,
        unitId: unitId2,
        influenceSpent: unitDef2.influence,
      });
      const result2 = command2.execute(currentState);
      currentState = result2.state;

      // Modifier should still be active
      expect(getActiveRecruitmentBonus(currentState, playerId)).not.toBeNull();
    });
  });

  describe("undo support", () => {
    it("should restore reputation and fame on undo", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;

      // Apply the powered bonus modifier
      const bonusResult = resolveEffect(state, playerId, poweredBonusEffect);
      const stateWithBonus = bonusResult.state;
      const initialRep = stateWithBonus.players[0].reputation;
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

      // Verify bonuses were applied
      expect(executed.state.players[0].reputation).toBe(initialRep + 1);
      expect(executed.state.players[0].fame).toBe(initialFame + 1);

      // Undo the command
      const undone = command.undo(executed.state);

      // Reputation and fame should be restored
      expect(undone.state.players[0].reputation).toBe(initialRep);
      expect(undone.state.players[0].fame).toBe(initialFame);
    });
  });

  describe("no bonus without modifier", () => {
    it("should not change reputation or fame when recruiting without modifier", () => {
      resetUnitInstanceCounter();
      const state = createRecruitState(1);
      const playerId = state.players[0].id;
      const initialRep = state.players[0].reputation;
      const initialFame = state.players[0].fame;

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
      expect(result.state.players[0].reputation).toBe(initialRep);
      expect(result.state.players[0].fame).toBe(initialFame);
    });
  });
});
