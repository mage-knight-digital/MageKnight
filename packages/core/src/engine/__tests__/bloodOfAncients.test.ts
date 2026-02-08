/**
 * Tests for Blood of Ancients advanced action card (#172)
 *
 * Basic: Gain a Wound. Pay one mana of any color. Gain a card of that color
 * from the Advanced Actions Offer and put it into your hand.
 *
 * Powered: Gain a Wound to your hand or discard pile. Use the stronger effect
 * of any card from the Advanced Actions Offer without paying its mana cost.
 * The card remains in the offer.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  BloodOfAncientsBasicEffect,
  BloodOfAncientsPoweredEffect,
  ResolveBloodBasicSelectAAEffect,
  ResolveBloodBasicGainAAEffect,
  ResolveBloodPoweredWoundEffect,
  ResolveBloodPoweredUseAAEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  EFFECT_BLOOD_OF_ANCIENTS_BASIC,
  EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA,
  EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
  EFFECT_BLOOD_OF_ANCIENTS_POWERED,
  EFFECT_RESOLVE_BLOOD_POWERED_WOUND,
  EFFECT_RESOLVE_BLOOD_POWERED_USE_AA,
} from "../../types/effectTypes.js";
import {
  CARD_BLOOD_OF_ANCIENTS,
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_AGILITY,
  CARD_WOUND,
  CARD_MARCH,
  CARD_CHILLING_STARE,
  MANA_RED,
  MANA_BLUE,
  MANA_TOKEN_SOURCE_SKILL,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { BLOOD_OF_ANCIENTS } from "../../data/advancedActions/red/blood-of-ancients.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBloodState(
  aaOffer: CardId[] = [],
  aaDeck: CardId[] = [],
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    id: "player1",
    hand: [CARD_BLOOD_OF_ANCIENTS, CARD_MARCH],
    ...playerOverrides,
  });

  return createTestGameState({
    players: [player],
    offers: {
      units: [],
      advancedActions: { cards: aaOffer },
      spells: { cards: [] },
      commonSkills: [],
      monasteryAdvancedActions: [],
      bondsOfLoyaltyBonusUnits: [],
    },
    decks: {
      advancedActions: aaDeck,
      spells: [],
      artifacts: [],
      units: { silver: [], gold: [] },
    },
  });
}

function getPlayer(state: GameState): Player {
  return state.players[0]!;
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Blood of Ancients card definition", () => {
  it("should have correct metadata", () => {
    expect(BLOOD_OF_ANCIENTS.id).toBe(CARD_BLOOD_OF_ANCIENTS);
    expect(BLOOD_OF_ANCIENTS.name).toBe("Blood of Ancients");
    expect(BLOOD_OF_ANCIENTS.cardType).toBe(DEED_CARD_TYPE_ADVANCED_ACTION);
    expect(BLOOD_OF_ANCIENTS.sidewaysValue).toBe(1);
  });

  it("should be powered by red mana", () => {
    expect(BLOOD_OF_ANCIENTS.poweredBy).toEqual([MANA_RED]);
  });

  it("should have special category", () => {
    expect(BLOOD_OF_ANCIENTS.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should have Blood of Ancients basic effect", () => {
    expect(BLOOD_OF_ANCIENTS.basicEffect.type).toBe(EFFECT_BLOOD_OF_ANCIENTS_BASIC);
  });

  it("should have Blood of Ancients powered effect", () => {
    expect(BLOOD_OF_ANCIENTS.poweredEffect.type).toBe(EFFECT_BLOOD_OF_ANCIENTS_POWERED);
  });
});

// ============================================================================
// RESOLVABILITY TESTS - BASIC
// ============================================================================

describe("EFFECT_BLOOD_OF_ANCIENTS_BASIC resolvability", () => {
  const effect: BloodOfAncientsBasicEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_BASIC };

  it("should be resolvable when there are AAs in the offer", () => {
    const state = createBloodState([CARD_FIRE_BOLT]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });

  it("should not be resolvable when AA offer is empty", () => {
    const state = createBloodState([]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });
});

// ============================================================================
// RESOLVABILITY TESTS - POWERED
// ============================================================================

describe("EFFECT_BLOOD_OF_ANCIENTS_POWERED resolvability", () => {
  const effect: BloodOfAncientsPoweredEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_POWERED };

  it("should be resolvable when there are AAs in the offer", () => {
    const state = createBloodState([CARD_FIRE_BOLT]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });

  it("should not be resolvable when AA offer is empty", () => {
    const state = createBloodState([]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });
});

// ============================================================================
// BASIC EFFECT RESOLUTION TESTS
// ============================================================================

describe("Blood of Ancients basic effect", () => {
  const effect: BloodOfAncientsBasicEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_BASIC };

  it("should take wound to hand and present mana color choices", () => {
    const state = createBloodState([CARD_FIRE_BOLT], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const result = resolveEffect(state, "player1", effect);

    // Wound should have been added to hand
    const player = getPlayer(result.state);
    expect(player.hand).toContain(CARD_WOUND);

    // Should require a choice (mana color selection)
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();
    expect(result.dynamicChoiceOptions!.length).toBeGreaterThan(0);

    // Options should be RESOLVE_BLOOD_BASIC_SELECT_AA effects
    const firstOption = result.dynamicChoiceOptions![0] as ResolveBloodBasicSelectAAEffect;
    expect(firstOption.type).toBe(EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA);
    expect(firstOption.paidColor).toBe(MANA_RED);
  });

  it("should only offer colors that have both mana to pay and matching AAs", () => {
    // Player has red mana, but only blue AA in offer — no valid options for red
    const state = createBloodState([CARD_ICE_BOLT], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const result = resolveEffect(state, "player1", effect);

    // Wound is taken regardless
    const player = getPlayer(result.state);
    expect(player.hand).toContain(CARD_WOUND);

    // No valid mana/AA combination — should not require choice
    expect(result.requiresChoice).toBeFalsy();
  });

  it("should gracefully handle no mana available", () => {
    const state = createBloodState([CARD_FIRE_BOLT], [], {
      pureMana: [],
    });

    const result = resolveEffect(state, "player1", effect);

    // Wound taken, but no mana to pay
    const player = getPlayer(result.state);
    expect(player.hand).toContain(CARD_WOUND);
    expect(result.requiresChoice).toBeFalsy();
  });

  it("should resolve mana payment and present matching AAs", () => {
    const state = createBloodState([CARD_FIRE_BOLT, CARD_ICE_BOLT], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    // Step 1: Entry effect - takes wound, presents mana options
    const result1 = resolveEffect(state, "player1", effect);
    expect(result1.requiresChoice).toBe(true);

    // Step 2: Select red mana → should present red AAs
    const selectAAEffect = result1.dynamicChoiceOptions![0] as ResolveBloodBasicSelectAAEffect;
    expect(selectAAEffect.paidColor).toBe(MANA_RED);

    const result2 = resolveEffect(result1.state, "player1", selectAAEffect);

    // Mana should be consumed
    const player2 = getPlayer(result2.state);
    expect(player2.pureMana.length).toBe(0);

    // Fire Bolt is red, should be auto-selected (only 1 red AA)
    // Card should be in hand
    expect(player2.hand).toContain(CARD_FIRE_BOLT);

    // Card should be removed from offer
    expect(result2.state.offers.advancedActions.cards).not.toContain(CARD_FIRE_BOLT);
  });

  it("should replenish offer from deck after gaining AA", () => {
    const state = createBloodState([CARD_FIRE_BOLT], [CARD_AGILITY], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    // Step 1: Entry effect
    const result1 = resolveEffect(state, "player1", effect);

    // Step 2: Select mana and auto-gain the AA
    const selectAAEffect = result1.dynamicChoiceOptions![0] as ResolveBloodBasicSelectAAEffect;
    const result2 = resolveEffect(result1.state, "player1", selectAAEffect);

    // Offer should be replenished from deck
    expect(result2.state.offers.advancedActions.cards).toContain(CARD_AGILITY);
    expect(result2.state.decks.advancedActions).toHaveLength(0);
  });

  it("should present choice when multiple AAs of same color exist", () => {
    // Two red AAs in offer
    const state = createBloodState([CARD_FIRE_BOLT, CARD_BLOOD_OF_ANCIENTS], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    // Step 1: Entry effect
    const result1 = resolveEffect(state, "player1", effect);

    // Step 2: Select mana
    const selectAAEffect = result1.dynamicChoiceOptions![0] as ResolveBloodBasicSelectAAEffect;
    const result2 = resolveEffect(result1.state, "player1", selectAAEffect);

    // Should require choice between the two red AAs
    expect(result2.requiresChoice).toBe(true);
    expect(result2.dynamicChoiceOptions!.length).toBe(2);

    const option1 = result2.dynamicChoiceOptions![0] as ResolveBloodBasicGainAAEffect;
    const option2 = result2.dynamicChoiceOptions![1] as ResolveBloodBasicGainAAEffect;
    expect(option1.type).toBe(EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA);
    expect(option2.type).toBe(EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA);

    // Step 3: Select specific AA
    const result3 = resolveEffect(result2.state, "player1", option1);
    const player3 = getPlayer(result3.state);
    expect(player3.hand).toContain(option1.cardId);
  });

  it("should match dual-color AAs by paid mana color", () => {
    // Chilling Stare is powered by blue OR white
    const state = createBloodState([CARD_CHILLING_STARE], [], {
      pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    // Step 1: Entry effect
    const result1 = resolveEffect(state, "player1", effect);
    expect(result1.requiresChoice).toBe(true);

    // Should offer blue mana payment for Chilling Stare
    const options = result1.dynamicChoiceOptions as ResolveBloodBasicSelectAAEffect[];
    const blueOption = options.find((o) => o.paidColor === MANA_BLUE);
    expect(blueOption).toBeDefined();

    // Step 2: Pay blue mana → auto-select Chilling Stare
    const result2 = resolveEffect(result1.state, "player1", blueOption!);
    const player2 = getPlayer(result2.state);
    expect(player2.hand).toContain(CARD_CHILLING_STARE);
  });

  it("should track wound in woundsReceivedThisTurn.hand", () => {
    const state = createBloodState([CARD_FIRE_BOLT], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const result = resolveEffect(state, "player1", effect);
    const player = getPlayer(result.state);
    expect(player.woundsReceivedThisTurn.hand).toBe(1);
  });
});

// ============================================================================
// POWERED EFFECT RESOLUTION TESTS
// ============================================================================

describe("Blood of Ancients powered effect", () => {
  const effect: BloodOfAncientsPoweredEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_POWERED };

  it("should present wound destination choice", () => {
    const state = createBloodState([CARD_FIRE_BOLT]);

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();
    expect(result.dynamicChoiceOptions!.length).toBe(2);

    const options = result.dynamicChoiceOptions as ResolveBloodPoweredWoundEffect[];
    expect(options[0]!.type).toBe(EFFECT_RESOLVE_BLOOD_POWERED_WOUND);
    expect(options[0]!.destination).toBe("hand");
    expect(options[1]!.destination).toBe("discard");
  });

  it("should not be available when AA offer is empty", () => {
    const state = createBloodState([]);

    const result = resolveEffect(state, "player1", effect);
    expect(result.requiresChoice).toBeFalsy();
  });

  it("should take wound to hand and present AA choices", () => {
    const state = createBloodState([CARD_FIRE_BOLT, CARD_ICE_BOLT]);

    // Step 1: Entry effect - wound destination choice
    const result1 = resolveEffect(state, "player1", effect);

    // Step 2: Choose wound to hand
    const woundToHand = (result1.dynamicChoiceOptions as ResolveBloodPoweredWoundEffect[])
      .find((o) => o.destination === "hand")!;
    const result2 = resolveEffect(result1.state, "player1", woundToHand);

    // Wound should be in hand
    const player2 = getPlayer(result2.state);
    expect(player2.hand).toContain(CARD_WOUND);
    expect(player2.woundsReceivedThisTurn.hand).toBe(1);

    // Should present all AAs in offer as choices
    expect(result2.requiresChoice).toBe(true);
    const aaOptions = result2.dynamicChoiceOptions as ResolveBloodPoweredUseAAEffect[];
    expect(aaOptions.length).toBe(2);
    expect(aaOptions[0]!.type).toBe(EFFECT_RESOLVE_BLOOD_POWERED_USE_AA);
  });

  it("should take wound to discard and present AA choices", () => {
    const state = createBloodState([CARD_FIRE_BOLT]);

    // Step 1: Entry effect
    const result1 = resolveEffect(state, "player1", effect);

    // Step 2: Choose wound to discard
    const woundToDiscard = (result1.dynamicChoiceOptions as ResolveBloodPoweredWoundEffect[])
      .find((o) => o.destination === "discard")!;
    const result2 = resolveEffect(result1.state, "player1", woundToDiscard);

    // Wound should be in discard pile
    const player2 = getPlayer(result2.state);
    expect(player2.discard).toContain(CARD_WOUND);
    expect(player2.hand).not.toContain(CARD_WOUND);
    expect(player2.woundsReceivedThisTurn.discard).toBe(1);
    expect(player2.woundsReceivedThisTurn.hand).toBe(0);
  });

  it("should resolve AA's powered effect and keep card in offer", () => {
    // Fire Bolt powered: Ranged Fire Attack 4
    const state = createBloodState([CARD_FIRE_BOLT]);

    // Step 1: Entry effect
    const result1 = resolveEffect(state, "player1", effect);

    // Step 2: Wound to hand
    const woundToHand = (result1.dynamicChoiceOptions as ResolveBloodPoweredWoundEffect[])
      .find((o) => o.destination === "hand")!;
    const result2 = resolveEffect(result1.state, "player1", woundToHand);

    // Step 3: Select Fire Bolt to use
    const useAA = (result2.dynamicChoiceOptions as ResolveBloodPoweredUseAAEffect[])[0]!;
    expect(useAA.cardId).toBe(CARD_FIRE_BOLT);

    const result3 = resolveEffect(result2.state, "player1", useAA);

    // Fire Bolt should STILL be in the offer
    expect(result3.state.offers.advancedActions.cards).toContain(CARD_FIRE_BOLT);
  });

  it("should let player choose any AA regardless of color", () => {
    // Mix of colors: red Fire Bolt, blue Ice Bolt, white Agility
    const state = createBloodState([CARD_FIRE_BOLT, CARD_ICE_BOLT, CARD_AGILITY]);

    // Step 1 + 2: wound to hand
    const result1 = resolveEffect(state, "player1", effect);
    const woundToHand = (result1.dynamicChoiceOptions as ResolveBloodPoweredWoundEffect[])
      .find((o) => o.destination === "hand")!;
    const result2 = resolveEffect(result1.state, "player1", woundToHand);

    // All 3 AAs should be available regardless of color
    const aaOptions = result2.dynamicChoiceOptions as ResolveBloodPoweredUseAAEffect[];
    expect(aaOptions.length).toBe(3);

    const cardIds = aaOptions.map((o) => o.cardId);
    expect(cardIds).toContain(CARD_FIRE_BOLT);
    expect(cardIds).toContain(CARD_ICE_BOLT);
    expect(cardIds).toContain(CARD_AGILITY);
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("Blood of Ancients describeEffect", () => {
  it("should describe basic effect", () => {
    const effect: BloodOfAncientsBasicEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_BASIC };
    const desc = describeEffect(effect);
    expect(desc).toContain("Wound");
    expect(desc).toContain("AA");
  });

  it("should describe powered effect", () => {
    const effect: BloodOfAncientsPoweredEffect = { type: EFFECT_BLOOD_OF_ANCIENTS_POWERED };
    const desc = describeEffect(effect);
    expect(desc).toContain("Wound");
  });

  it("should describe wound destination choice", () => {
    const effect: ResolveBloodPoweredWoundEffect = {
      type: EFFECT_RESOLVE_BLOOD_POWERED_WOUND,
      destination: "discard",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("discard");
  });

  it("should describe AA selection for powered", () => {
    const effect: ResolveBloodPoweredUseAAEffect = {
      type: EFFECT_RESOLVE_BLOOD_POWERED_USE_AA,
      cardId: CARD_FIRE_BOLT,
      cardName: "Fire Bolt",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Fire Bolt");
  });

  it("should describe mana payment for basic", () => {
    const effect: ResolveBloodBasicSelectAAEffect = {
      type: EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA,
      paidColor: MANA_RED,
      manaSource: { type: "token" as const, color: MANA_RED },
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("red");
  });

  it("should describe AA gain for basic", () => {
    const effect: ResolveBloodBasicGainAAEffect = {
      type: EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
      cardId: CARD_FIRE_BOLT,
      cardName: "Fire Bolt",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Fire Bolt");
  });
});
