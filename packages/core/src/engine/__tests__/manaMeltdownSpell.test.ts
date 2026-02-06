/**
 * Tests for the Mana Meltdown / Mana Radiance spell (Red Spell #109)
 *
 * Basic (Mana Meltdown): Each other player must randomly choose a crystal
 * in their inventory to be lost. You may gain one crystal lost this way to
 * your inventory. Any player that had no crystal takes a Wound instead.
 *
 * Powered (Mana Radiance): Choose a basic mana color. Each player, including
 * you, takes a Wound for each crystal of that color they own. Gain two
 * crystals of the chosen color.
 *
 * Key rules:
 * - Special category (both effects)
 * - Interactive: removed in friendly game mode
 * - End-of-round: Meltdown does nothing, Radiance only affects caster
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  ManaMeltdownEffect,
  ResolveManaMeltdownChoiceEffect,
  ManaRadianceEffect,
  ResolveManaRadianceColorEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_MANA_MELTDOWN,
  EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
  EFFECT_MANA_RADIANCE,
  EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
} from "../../types/effectTypes.js";
import {
  CARD_MANA_MELTDOWN,
  CARD_WOUND,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { MANA_MELTDOWN } from "../../data/spells/red/manaMeltdown.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMultiplayerState(
  casterCrystals = { red: 0, blue: 0, green: 0, white: 0 },
  opponentCrystals = { red: 0, blue: 0, green: 0, white: 0 }
): GameState {
  const caster = createTestPlayer({
    id: "caster",
    crystals: casterCrystals,
  });
  const opponent = createTestPlayer({
    id: "opponent",
    crystals: opponentCrystals,
    position: { q: 1, r: 0 },
  });

  return createTestGameState({
    players: [caster, opponent],
    turnOrder: ["caster", "opponent"],
  });
}

function createThreePlayerState(
  casterCrystals = { red: 0, blue: 0, green: 0, white: 0 },
  opponent1Crystals = { red: 0, blue: 0, green: 0, white: 0 },
  opponent2Crystals = { red: 0, blue: 0, green: 0, white: 0 }
): GameState {
  const caster = createTestPlayer({
    id: "caster",
    crystals: casterCrystals,
  });
  const opponent1 = createTestPlayer({
    id: "opponent1",
    crystals: opponent1Crystals,
    position: { q: 1, r: 0 },
  });
  const opponent2 = createTestPlayer({
    id: "opponent2",
    crystals: opponent2Crystals,
    position: { q: 2, r: 0 },
  });

  return createTestGameState({
    players: [caster, opponent1, opponent2],
    turnOrder: ["caster", "opponent1", "opponent2"],
  });
}

function getCaster(state: GameState) {
  return state.players.find((p) => p.id === "caster")!;
}

function getOpponent(state: GameState, id = "opponent") {
  return state.players.find((p) => p.id === id)!;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Mana Meltdown spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_MANA_MELTDOWN);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Mana Meltdown");
  });

  it("should have correct metadata", () => {
    expect(MANA_MELTDOWN.id).toBe(CARD_MANA_MELTDOWN);
    expect(MANA_MELTDOWN.name).toBe("Mana Meltdown");
    expect(MANA_MELTDOWN.poweredName).toBe("Mana Radiance");
    expect(MANA_MELTDOWN.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(MANA_MELTDOWN.sidewaysValue).toBe(1);
  });

  it("should be powered by black + red mana", () => {
    expect(MANA_MELTDOWN.poweredBy).toEqual([MANA_BLACK, MANA_RED]);
  });

  it("should have special category", () => {
    expect(MANA_MELTDOWN.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should be marked as interactive", () => {
    expect(MANA_MELTDOWN.interactive).toBe(true);
  });

  it("should have basic effect of type EFFECT_MANA_MELTDOWN", () => {
    const effect = MANA_MELTDOWN.basicEffect as ManaMeltdownEffect;
    expect(effect.type).toBe(EFFECT_MANA_MELTDOWN);
  });

  it("should have powered effect of type EFFECT_MANA_RADIANCE", () => {
    const effect = MANA_MELTDOWN.poweredEffect as ManaRadianceEffect;
    expect(effect.type).toBe(EFFECT_MANA_RADIANCE);
  });
});

// ============================================================================
// BASIC EFFECT (MANA MELTDOWN) TESTS
// ============================================================================

describe("EFFECT_MANA_MELTDOWN (basic)", () => {
  const basicEffect: ManaMeltdownEffect = {
    type: EFFECT_MANA_MELTDOWN,
  };

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createMultiplayerState();
      expect(isEffectResolvable(state, "caster", basicEffect)).toBe(true);
    });
  });

  describe("single-player mode", () => {
    it("should do nothing when no opponents", () => {
      const state = createTestGameState();
      const result = resolveEffect(state, "player1", basicEffect);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.description).toContain("No other players");
    });
  });

  describe("opponent crystal loss", () => {
    it("should remove a crystal from opponent when they have one", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 1, blue: 0, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      const opponent = getOpponent(result.state);
      expect(opponent.crystals.red).toBe(0);
      expect(result.requiresChoice).toBe(true);
    });

    it("should randomly pick crystal weighted by count", () => {
      // With 2 blue + 1 red, opponent should lose one of those colors
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 1, blue: 2, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      const opponent = getOpponent(result.state);
      const totalCrystals = opponent.crystals.red + opponent.crystals.blue;
      // Should have lost exactly one crystal
      expect(totalCrystals).toBe(2); // Was 3, now 2
      expect(result.requiresChoice).toBe(true);
    });

    it("should give wound to opponent with no crystals", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 0, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      const opponent = getOpponent(result.state);
      const woundsInHand = opponent.hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsInHand).toBeGreaterThanOrEqual(1);
      expect(result.requiresChoice).toBeFalsy(); // No crystals to choose from
    });
  });

  describe("multiple opponents", () => {
    it("should affect all opponents", () => {
      const state = createThreePlayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 1, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 0, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      // Opponent1 should lose their red crystal
      const op1 = getOpponent(result.state, "opponent1");
      expect(op1.crystals.red).toBe(0);

      // Opponent2 had no crystals, should have a wound
      const op2 = getOpponent(result.state, "opponent2");
      const woundsInHand = op2.hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsInHand).toBeGreaterThanOrEqual(1);
    });

    it("should offer unique colors from combined losses", () => {
      const state = createThreePlayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 1, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 1, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBe(true);
      // Should have 2 options (red and blue)
      expect(result.dynamicChoiceOptions).toHaveLength(2);
    });
  });

  describe("caster crystal gain choice", () => {
    it("should present color choices from lost crystals", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 1, blue: 0, green: 0, white: 0 }
      );

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      expect(result.dynamicChoiceOptions!.length).toBeGreaterThanOrEqual(1);

      const option = result.dynamicChoiceOptions![0] as ResolveManaMeltdownChoiceEffect;
      expect(option.type).toBe(EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE);
      expect(option.color).toBe(MANA_RED);
    });
  });

  describe("end-of-round restriction", () => {
    it("should do nothing when end of round announced", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 2, blue: 1, green: 0, white: 0 }
      );

      const endOfRoundState: GameState = {
        ...state,
        endOfRoundAnnouncedBy: "opponent",
      };

      const result = resolveEffect(endOfRoundState, "caster", basicEffect);

      // Opponent should still have their crystals
      const opponent = getOpponent(result.state);
      expect(opponent.crystals.red).toBe(2);
      expect(opponent.crystals.blue).toBe(1);
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should do nothing when scenario end triggered", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 2, blue: 1, green: 0, white: 0 }
      );

      const scenarioEndState: GameState = {
        ...state,
        scenarioEndTriggered: true,
      };

      const result = resolveEffect(scenarioEndState, "caster", basicEffect);

      const opponent = getOpponent(result.state);
      expect(opponent.crystals.red).toBe(2);
      expect(result.requiresChoice).toBeFalsy();
    });
  });
});

// ============================================================================
// RESOLVE MANA MELTDOWN CHOICE TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE", () => {
  it("should grant the chosen crystal color to the caster", () => {
    const state = createMultiplayerState();

    const effect: ResolveManaMeltdownChoiceEffect = {
      type: EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
      color: MANA_BLUE,
    };

    const result = resolveEffect(state, "caster", effect);

    const caster = getCaster(result.state);
    expect(caster.crystals.blue).toBe(1);
  });

  it("should add to existing crystal count", () => {
    const state = createMultiplayerState({ red: 0, blue: 1, green: 0, white: 0 });

    const effect: ResolveManaMeltdownChoiceEffect = {
      type: EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
      color: MANA_BLUE,
    };

    const result = resolveEffect(state, "caster", effect);

    const caster = getCaster(result.state);
    expect(caster.crystals.blue).toBe(2);
  });
});

// ============================================================================
// POWERED EFFECT (MANA RADIANCE) TESTS
// ============================================================================

describe("EFFECT_MANA_RADIANCE (powered)", () => {
  const poweredEffect: ManaRadianceEffect = {
    type: EFFECT_MANA_RADIANCE,
  };

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createMultiplayerState();
      expect(isEffectResolvable(state, "caster", poweredEffect)).toBe(true);
    });
  });

  describe("color choice", () => {
    it("should present 4 basic color choices", () => {
      const state = createMultiplayerState();

      const result = resolveEffect(state, "caster", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      const colors = (result.dynamicChoiceOptions as ResolveManaRadianceColorEffect[])
        .map((opt) => opt.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });
  });
});

// ============================================================================
// RESOLVE MANA RADIANCE COLOR TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MANA_RADIANCE_COLOR", () => {
  describe("wounds per crystal", () => {
    it("should wound caster for each crystal of chosen color", () => {
      const state = createMultiplayerState(
        { red: 2, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 0, green: 0, white: 0 }
      );

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      const woundsInHand = caster.hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsInHand).toBe(2); // 2 red crystals = 2 wounds
    });

    it("should wound opponent for each crystal of chosen color", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 3, green: 0, white: 0 }
      );

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_BLUE,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      const woundsInHand = opponent.hand.filter((c) => c === CARD_WOUND).length;
      expect(woundsInHand).toBe(3); // 3 blue crystals = 3 wounds
    });

    it("should wound both caster and opponents", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 1, white: 0 },
        { red: 0, blue: 0, green: 2, white: 0 }
      );

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_GREEN,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      const casterWounds = caster.hand.filter((c) => c === CARD_WOUND).length;
      expect(casterWounds).toBe(1);

      const opponent = getOpponent(result.state);
      const opponentWounds = opponent.hand.filter((c) => c === CARD_WOUND).length;
      expect(opponentWounds).toBe(2);
    });

    it("should not wound players with zero crystals of chosen color", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 0, green: 0, white: 0 }
      );

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      const casterWounds = caster.hand.filter((c) => c === CARD_WOUND).length;
      expect(casterWounds).toBe(0);

      const opponent = getOpponent(result.state);
      const opponentWounds = opponent.hand.filter((c) => c === CARD_WOUND).length;
      expect(opponentWounds).toBe(0);
    });
  });

  describe("crystal gain", () => {
    it("should grant caster 2 crystals of chosen color", () => {
      const state = createMultiplayerState();

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(2);
    });

    it("should add to existing crystal count", () => {
      const state = createMultiplayerState({ red: 1, blue: 0, green: 0, white: 0 });

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(3); // 1 existing + 2 gained
    });

    it("should not grant crystals to opponents", () => {
      const state = createMultiplayerState();

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_GREEN,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      expect(opponent.crystals.green).toBe(0);
    });
  });

  describe("end-of-round restriction", () => {
    it("should only wound caster when end of round announced", () => {
      const state = createMultiplayerState(
        { red: 1, blue: 0, green: 0, white: 0 },
        { red: 2, blue: 0, green: 0, white: 0 }
      );

      const endOfRoundState: GameState = {
        ...state,
        endOfRoundAnnouncedBy: "opponent",
      };

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(endOfRoundState, "caster", effect);

      // Caster should still take wounds (1 red crystal)
      const caster = getCaster(result.state);
      const casterWounds = caster.hand.filter((c) => c === CARD_WOUND).length;
      expect(casterWounds).toBe(1);

      // Opponent should NOT take wounds (end-of-round restriction)
      const opponent = getOpponent(result.state);
      const opponentWounds = opponent.hand.filter((c) => c === CARD_WOUND).length;
      expect(opponentWounds).toBe(0);

      // Caster should still gain 2 crystals
      expect(caster.crystals.red).toBe(3); // 1 existing + 2 gained
    });

    it("should still grant caster crystals after end of round", () => {
      const state = createMultiplayerState();

      const endOfRoundState: GameState = {
        ...state,
        endOfRoundAnnouncedBy: "caster",
      };

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_WHITE,
      };

      const result = resolveEffect(endOfRoundState, "caster", effect);

      const caster = getCaster(result.state);
      expect(caster.crystals.white).toBe(2);
    });
  });

  describe("multiple opponents", () => {
    it("should wound all opponents based on their crystal counts", () => {
      const state = createThreePlayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        { red: 0, blue: 1, green: 0, white: 0 },
        { red: 0, blue: 3, green: 0, white: 0 }
      );

      const effect: ResolveManaRadianceColorEffect = {
        type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
        color: MANA_BLUE,
      };

      const result = resolveEffect(state, "caster", effect);

      const op1 = getOpponent(result.state, "opponent1");
      const op1Wounds = op1.hand.filter((c) => c === CARD_WOUND).length;
      expect(op1Wounds).toBe(1);

      const op2 = getOpponent(result.state, "opponent2");
      const op2Wounds = op2.hand.filter((c) => c === CARD_WOUND).length;
      expect(op2Wounds).toBe(3);
    });
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Mana Meltdown effects", () => {
  it("should describe EFFECT_MANA_MELTDOWN", () => {
    const effect: ManaMeltdownEffect = { type: EFFECT_MANA_MELTDOWN };
    const desc = describeEffect(effect);
    expect(desc).toContain("opponent");
    expect(desc).toContain("crystal");
  });

  it("should describe EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE", () => {
    const effect: ResolveManaMeltdownChoiceEffect = {
      type: EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
      color: MANA_RED,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("red");
    expect(desc).toContain("crystal");
  });

  it("should describe EFFECT_MANA_RADIANCE", () => {
    const effect: ManaRadianceEffect = { type: EFFECT_MANA_RADIANCE };
    const desc = describeEffect(effect);
    expect(desc).toContain("color");
  });

  it("should describe EFFECT_RESOLVE_MANA_RADIANCE_COLOR", () => {
    const effect: ResolveManaRadianceColorEffect = {
      type: EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
      color: MANA_BLUE,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("blue");
  });
});
