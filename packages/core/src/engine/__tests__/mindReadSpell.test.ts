/**
 * Tests for the Mind Read / Mind Steal spell (White Spell #111)
 *
 * Basic (Mind Read): Choose a color. Gain a crystal of the chosen color.
 * Each other player must discard a Spell or Action card of that color from
 * their hand, or reveal their hand to show they have none.
 *
 * Powered (Mind Steal): Same as basic. In addition, you may permanently
 * steal one of the Action cards (NOT Spells) discarded this way.
 *
 * Key rules:
 * - Special category (both effects)
 * - Interactive: removed in friendly game mode
 * - End-of-round: opponents not affected
 * - Steal: Only Action cards (not Spells)
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  MindReadEffect,
  ResolveMindReadColorEffect,
  MindStealEffect,
  ResolveMindStealColorEffect,
  ResolveMindStealSelectionEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_MIND_READ,
  EFFECT_RESOLVE_MIND_READ_COLOR,
  EFFECT_MIND_STEAL,
  EFFECT_RESOLVE_MIND_STEAL_COLOR,
  EFFECT_RESOLVE_MIND_STEAL_SELECTION,
} from "../../types/effectTypes.js";
import {
  CARD_MIND_READ,
  CARD_WOUND,
  CARD_RAGE,
  CARD_MARCH,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { MIND_READ } from "../../data/spells/white/mindRead.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMultiplayerState(
  casterCrystals = { red: 0, blue: 0, green: 0, white: 0 },
  opponentHand: CardId[] = [],
  opponentCrystals = { red: 0, blue: 0, green: 0, white: 0 }
): GameState {
  const caster = createTestPlayer({
    id: "caster",
    crystals: casterCrystals,
  });
  const opponent = createTestPlayer({
    id: "opponent",
    hand: opponentHand,
    crystals: opponentCrystals,
    position: { q: 1, r: 0 },
  });

  return createTestGameState({
    players: [caster, opponent],
    turnOrder: ["caster", "opponent"],
  });
}

function createThreePlayerState(
  opponent1Hand: CardId[] = [],
  opponent2Hand: CardId[] = []
): GameState {
  const caster = createTestPlayer({
    id: "caster",
  });
  const opponent1 = createTestPlayer({
    id: "opponent1",
    hand: opponent1Hand,
    position: { q: 1, r: 0 },
  });
  const opponent2 = createTestPlayer({
    id: "opponent2",
    hand: opponent2Hand,
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

describe("Mind Read spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_MIND_READ);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Mind Read");
  });

  it("should have correct metadata", () => {
    expect(MIND_READ.id).toBe(CARD_MIND_READ);
    expect(MIND_READ.name).toBe("Mind Read");
    expect(MIND_READ.poweredName).toBe("Mind Steal");
    expect(MIND_READ.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(MIND_READ.sidewaysValue).toBe(1);
  });

  it("should be powered by black + white mana", () => {
    expect(MIND_READ.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
  });

  it("should have special category", () => {
    expect(MIND_READ.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should be marked as interactive", () => {
    expect(MIND_READ.interactive).toBe(true);
  });

  it("should have basic effect of type EFFECT_MIND_READ", () => {
    const effect = MIND_READ.basicEffect as MindReadEffect;
    expect(effect.type).toBe(EFFECT_MIND_READ);
  });

  it("should have powered effect of type EFFECT_MIND_STEAL", () => {
    const effect = MIND_READ.poweredEffect as MindStealEffect;
    expect(effect.type).toBe(EFFECT_MIND_STEAL);
  });
});

// ============================================================================
// BASIC EFFECT (MIND READ) TESTS
// ============================================================================

describe("EFFECT_MIND_READ (basic)", () => {
  const basicEffect: MindReadEffect = {
    type: EFFECT_MIND_READ,
  };

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createMultiplayerState();
      expect(isEffectResolvable(state, "caster", basicEffect)).toBe(true);
    });
  });

  describe("color choice", () => {
    it("should present 4 basic color choices", () => {
      const state = createMultiplayerState();

      const result = resolveEffect(state, "caster", basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      const colors = (
        result.dynamicChoiceOptions as ResolveMindReadColorEffect[]
      ).map((opt) => opt.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });
  });
});

// ============================================================================
// RESOLVE MIND READ COLOR TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MIND_READ_COLOR", () => {
  describe("crystal gain", () => {
    it("should grant caster a crystal of chosen color", () => {
      const state = createMultiplayerState();

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(1);
    });

    it("should add to existing crystal count", () => {
      const state = createMultiplayerState({ red: 1, blue: 0, green: 0, white: 0 });

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(2);
    });
  });

  describe("forced discard from opponents", () => {
    it("should force opponent to discard a matching Action card", () => {
      // CARD_RAGE is a red basic action
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE, CARD_MARCH]
      );

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      // Rage is red, March is green — only Rage should be discarded
      expect(opponent.hand).not.toContain(CARD_RAGE);
      expect(opponent.hand).toContain(CARD_MARCH);
      expect(opponent.discard).toContain(CARD_RAGE);
    });

    it("should force opponent to discard a matching Spell card", () => {
      // CARD_FIREBALL is a red spell
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_FIREBALL, CARD_SNOWSTORM]
      );

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      expect(opponent.hand).not.toContain(CARD_FIREBALL);
      expect(opponent.hand).toContain(CARD_SNOWSTORM);
      expect(opponent.discard).toContain(CARD_FIREBALL);
    });

    it("should reveal hand when no matching cards", () => {
      // Only green cards in hand, choosing red
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_MARCH, CARD_TRANQUILITY]
      );

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      // Hand should be unchanged (no matching cards)
      expect(opponent.hand).toHaveLength(2);
      expect(opponent.discard).toHaveLength(0);
      expect(result.description).toContain("revealed hand");
    });

    it("should handle wound cards in hand (not matching any color)", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_WOUND, CARD_WOUND]
      );

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      const opponent = getOpponent(result.state);
      expect(opponent.hand).toHaveLength(2); // Wounds still in hand
      expect(result.description).toContain("revealed hand");
    });
  });

  describe("single-player mode", () => {
    it("should still gain crystal with no opponents", () => {
      const state = createTestGameState();

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_BLUE,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = result.state.players[0]!;
      expect(player.crystals.blue).toBe(1);
    });
  });

  describe("multiple opponents", () => {
    it("should affect all opponents", () => {
      const state = createThreePlayerState(
        [CARD_RAGE], // opponent1 has red
        [CARD_MARCH] // opponent2 has green
      );

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      // Opponent1 should discard Rage (red)
      const op1 = getOpponent(result.state, "opponent1");
      expect(op1.hand).not.toContain(CARD_RAGE);
      expect(op1.discard).toContain(CARD_RAGE);

      // Opponent2 has no red cards — revealed hand
      const op2 = getOpponent(result.state, "opponent2");
      expect(op2.hand).toContain(CARD_MARCH);
      expect(op2.discard).toHaveLength(0);
    });
  });

  describe("end-of-round restriction", () => {
    it("should not affect opponents when end of round announced", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE]
      );

      const endOfRoundState: GameState = {
        ...state,
        endOfRoundAnnouncedBy: "opponent",
      };

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(endOfRoundState, "caster", effect);

      // Caster should still gain crystal
      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(1);

      // Opponent should NOT be forced to discard
      const opponent = getOpponent(result.state);
      expect(opponent.hand).toContain(CARD_RAGE);
    });

    it("should not affect opponents when scenario end triggered", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE]
      );

      const scenarioEndState: GameState = {
        ...state,
        scenarioEndTriggered: true,
      };

      const effect: ResolveMindReadColorEffect = {
        type: EFFECT_RESOLVE_MIND_READ_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(scenarioEndState, "caster", effect);

      const opponent = getOpponent(result.state);
      expect(opponent.hand).toContain(CARD_RAGE);
    });
  });
});

// ============================================================================
// POWERED EFFECT (MIND STEAL) TESTS
// ============================================================================

describe("EFFECT_MIND_STEAL (powered)", () => {
  const poweredEffect: MindStealEffect = {
    type: EFFECT_MIND_STEAL,
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

      const colors = (
        result.dynamicChoiceOptions as ResolveMindStealColorEffect[]
      ).map((opt) => opt.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).toContain(MANA_WHITE);
    });
  });
});

// ============================================================================
// RESOLVE MIND STEAL COLOR TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MIND_STEAL_COLOR", () => {
  describe("crystal gain + discard", () => {
    it("should gain crystal and force discard like Mind Read", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE]
      );

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      // Caster gains crystal
      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(1);

      // Opponent discards matching card
      const opponent = getOpponent(result.state);
      expect(opponent.hand).not.toContain(CARD_RAGE);
    });
  });

  describe("steal option", () => {
    it("should offer steal choice when Action card is discarded", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE]
      );

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      // Should offer steal choice since Rage is an Action card
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      expect(result.dynamicChoiceOptions!.length).toBeGreaterThanOrEqual(1);

      const option = result
        .dynamicChoiceOptions![0] as ResolveMindStealSelectionEffect;
      expect(option.type).toBe(EFFECT_RESOLVE_MIND_STEAL_SELECTION);
      expect(option.cardId).toBe(CARD_RAGE);
    });

    it("should NOT offer steal when only Spells are discarded", () => {
      // Fireball is a spell, not an Action card — cannot be stolen
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_FIREBALL]
      );

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      // No steal choice since Fireball is a Spell, not Action
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should NOT offer steal when opponent reveals hand (no matching cards)", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_MARCH] // green, not red
      );

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      expect(result.requiresChoice).toBeFalsy();
    });
  });

  describe("end-of-round restriction", () => {
    it("should not offer steal when end of round announced", () => {
      const state = createMultiplayerState(
        { red: 0, blue: 0, green: 0, white: 0 },
        [CARD_RAGE]
      );

      const endOfRoundState: GameState = {
        ...state,
        endOfRoundAnnouncedBy: "opponent",
      };

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(endOfRoundState, "caster", effect);

      // Caster still gains crystal
      const caster = getCaster(result.state);
      expect(caster.crystals.red).toBe(1);

      // No discard, no steal
      const opponent = getOpponent(result.state);
      expect(opponent.hand).toContain(CARD_RAGE);
      expect(result.requiresChoice).toBeFalsy();
    });
  });

  describe("multiple opponents with steal", () => {
    it("should offer steal from multiple discarded Action cards", () => {
      const state = createThreePlayerState(
        [CARD_RAGE], // opponent1 has red action
        [CARD_RAGE] // opponent2 also has red action
      );

      const effect: ResolveMindStealColorEffect = {
        type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
        color: MANA_RED,
      };

      const result = resolveEffect(state, "caster", effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions!.length).toBe(2);
    });
  });
});

// ============================================================================
// RESOLVE MIND STEAL SELECTION TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MIND_STEAL_SELECTION", () => {
  it("should move the card from opponent's discard to caster's hand", () => {
    // Set up: opponent has Rage in discard (already discarded by Mind Steal)
    const caster = createTestPlayer({ id: "caster" });
    const opponent = createTestPlayer({
      id: "opponent",
      discard: [CARD_RAGE],
      position: { q: 1, r: 0 },
    });

    const state = createTestGameState({
      players: [caster, opponent],
      turnOrder: ["caster", "opponent"],
    });

    const effect: ResolveMindStealSelectionEffect = {
      type: EFFECT_RESOLVE_MIND_STEAL_SELECTION,
      cardId: CARD_RAGE,
      cardName: "Rage",
      fromPlayerId: "opponent",
    };

    const result = resolveEffect(state, "caster", effect);

    // Caster should have the card in hand
    const updatedCaster = getCaster(result.state);
    expect(updatedCaster.hand).toContain(CARD_RAGE);

    // Opponent should no longer have the card in discard
    const updatedOpponent = getOpponent(result.state);
    expect(updatedOpponent.discard).not.toContain(CARD_RAGE);
  });

  it("should add stolen card to existing hand", () => {
    const caster = createTestPlayer({
      id: "caster",
      hand: [CARD_MARCH, CARD_PROMISE],
    });
    const opponent = createTestPlayer({
      id: "opponent",
      discard: [CARD_RAGE],
      position: { q: 1, r: 0 },
    });

    const state = createTestGameState({
      players: [caster, opponent],
      turnOrder: ["caster", "opponent"],
    });

    const effect: ResolveMindStealSelectionEffect = {
      type: EFFECT_RESOLVE_MIND_STEAL_SELECTION,
      cardId: CARD_RAGE,
      cardName: "Rage",
      fromPlayerId: "opponent",
    };

    const result = resolveEffect(state, "caster", effect);

    const updatedCaster = getCaster(result.state);
    expect(updatedCaster.hand).toHaveLength(3);
    expect(updatedCaster.hand).toContain(CARD_RAGE);
    expect(updatedCaster.hand).toContain(CARD_MARCH);
    expect(updatedCaster.hand).toContain(CARD_PROMISE);
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Mind Read effects", () => {
  it("should describe EFFECT_MIND_READ", () => {
    const effect: MindReadEffect = { type: EFFECT_MIND_READ };
    const desc = describeEffect(effect);
    expect(desc).toContain("crystal");
    expect(desc).toContain("discard");
  });

  it("should describe EFFECT_RESOLVE_MIND_READ_COLOR", () => {
    const effect: ResolveMindReadColorEffect = {
      type: EFFECT_RESOLVE_MIND_READ_COLOR,
      color: MANA_RED,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("red");
    expect(desc).toContain("crystal");
  });

  it("should describe EFFECT_MIND_STEAL", () => {
    const effect: MindStealEffect = { type: EFFECT_MIND_STEAL };
    const desc = describeEffect(effect);
    expect(desc).toContain("steal");
  });

  it("should describe EFFECT_RESOLVE_MIND_STEAL_COLOR", () => {
    const effect: ResolveMindStealColorEffect = {
      type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
      color: MANA_BLUE,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("blue");
  });

  it("should describe EFFECT_RESOLVE_MIND_STEAL_SELECTION", () => {
    const effect: ResolveMindStealSelectionEffect = {
      type: EFFECT_RESOLVE_MIND_STEAL_SELECTION,
      cardId: CARD_RAGE,
      cardName: "Rage",
      fromPlayerId: "opponent",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Rage");
    expect(desc).toContain("opponent");
  });
});
