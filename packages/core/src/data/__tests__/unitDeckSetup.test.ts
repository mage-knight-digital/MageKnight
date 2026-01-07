/**
 * Unit deck setup tests
 */

import { describe, it, expect } from "vitest";
import {
  createUnitDecksAndOffer,
  refreshUnitOffer,
  removeUnitFromOffer,
} from "../unitDeckSetup.js";
import { createRng } from "../../utils/rng.js";
import { createEmptyDecks } from "../../types/decks.js";
import {
  SCENARIO_FIRST_RECONNAISSANCE,
  SCENARIO_FULL_CONQUEST,
  UNITS,
  UNIT_TYPE_REGULAR,
  UNIT_TYPE_ELITE,
  RECRUIT_SITE_VILLAGE,
} from "@mage-knight/shared";
import { getScenario } from "../scenarios/index.js";

describe("createUnitDecksAndOffer", () => {
  it("should create unit decks and offer for 2 players", () => {
    const config = getScenario(SCENARIO_FIRST_RECONNAISSANCE);
    const rng = createRng(12345);

    const result = createUnitDecksAndOffer(config, 2, rng);

    // Offer size should be playerCount + 2 = 4
    expect(result.unitOffer.length).toBe(4);

    // Regular deck should have remaining units
    expect(result.decks.regularUnits.length).toBeGreaterThan(0);

    // Elite deck should be empty (First Reconnaissance disables elite units)
    expect(result.decks.eliteUnits.length).toBe(0);

    // All units in offer should be valid UnitIds
    for (const unitId of result.unitOffer) {
      expect(UNITS[unitId]).toBeDefined();
    }
  });

  it("should ensure at least one village unit for First Reconnaissance", () => {
    const config = getScenario(SCENARIO_FIRST_RECONNAISSANCE);

    // Test multiple seeds to ensure the village requirement is enforced
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      const result = createUnitDecksAndOffer(config, 2, rng);

      const hasVillageUnit = result.unitOffer.some((unitId) => {
        const unit = UNITS[unitId];
        return unit.recruitSites.includes(RECRUIT_SITE_VILLAGE);
      });

      expect(hasVillageUnit).toBe(true);
    }
  });

  it("should include elite units for Full Conquest", () => {
    const config = getScenario(SCENARIO_FULL_CONQUEST);
    const rng = createRng(12345);

    const result = createUnitDecksAndOffer(config, 2, rng);

    // Elite deck should have units
    expect(result.decks.eliteUnits.length).toBeGreaterThan(0);

    // Verify elite units are in the deck
    for (const unitId of result.decks.eliteUnits) {
      const unit = UNITS[unitId];
      expect(unit.type).toBe(UNIT_TYPE_ELITE);
    }
  });

  it("should return deterministic results with same seed", () => {
    const config = getScenario(SCENARIO_FIRST_RECONNAISSANCE);
    const rng1 = createRng(99999);
    const rng2 = createRng(99999);

    const result1 = createUnitDecksAndOffer(config, 2, rng1);
    const result2 = createUnitDecksAndOffer(config, 2, rng2);

    expect(result1.unitOffer).toEqual(result2.unitOffer);
    expect(result1.decks.regularUnits).toEqual(result2.decks.regularUnits);
  });

  it("should create larger offer for more players", () => {
    const config = getScenario(SCENARIO_FIRST_RECONNAISSANCE);
    const rng = createRng(12345);

    const result2p = createUnitDecksAndOffer(config, 2, rng);
    const result4p = createUnitDecksAndOffer(config, 4, createRng(12345));

    // 2 players = 4 in offer, 4 players = 6 in offer
    expect(result2p.unitOffer.length).toBe(4);
    expect(result4p.unitOffer.length).toBe(6);
  });
});

describe("refreshUnitOffer", () => {
  it("should deal only regular units when no core tile revealed", () => {
    const config = getScenario(SCENARIO_FULL_CONQUEST);
    const rng = createRng(12345);

    // Create initial decks
    const initial = createUnitDecksAndOffer(config, 2, rng);
    const decks = {
      ...createEmptyDecks(),
      regularUnits: initial.decks.regularUnits,
      eliteUnits: initial.decks.eliteUnits,
    };

    // Refresh with no core tile revealed
    const result = refreshUnitOffer(
      initial.unitOffer,
      decks,
      2,
      false, // coreTileRevealed = false
      true, // eliteUnitsEnabled
      initial.rng
    );

    // All units in new offer should be regular
    for (const unitId of result.unitOffer) {
      const unit = UNITS[unitId];
      expect(unit.type).toBe(UNIT_TYPE_REGULAR);
    }
  });

  it("should alternate elite/regular when core tile revealed", () => {
    const config = getScenario(SCENARIO_FULL_CONQUEST);
    const rng = createRng(12345);

    // Create initial decks
    const initial = createUnitDecksAndOffer(config, 2, rng);
    const decks = {
      ...createEmptyDecks(),
      regularUnits: initial.decks.regularUnits,
      eliteUnits: initial.decks.eliteUnits,
    };

    // Refresh with core tile revealed
    const result = refreshUnitOffer(
      initial.unitOffer,
      decks,
      2,
      true, // coreTileRevealed = true
      true, // eliteUnitsEnabled
      initial.rng
    );

    // Should have 4 units (2 players + 2)
    expect(result.unitOffer.length).toBe(4);

    // Pattern should be: Elite, Regular, Elite, Regular
    // (or fewer if decks run out)
    const types = result.unitOffer.map((id) => UNITS[id].type);
    expect(types[0]).toBe(UNIT_TYPE_ELITE);
    expect(types[1]).toBe(UNIT_TYPE_REGULAR);
    expect(types[2]).toBe(UNIT_TYPE_ELITE);
    expect(types[3]).toBe(UNIT_TYPE_REGULAR);
  });

  it("should return old offer cards to bottom of decks", () => {
    const config = getScenario(SCENARIO_FULL_CONQUEST);
    const rng = createRng(12345);

    const initial = createUnitDecksAndOffer(config, 2, rng);
    const initialRegularCount = initial.decks.regularUnits.length;

    const decks = {
      ...createEmptyDecks(),
      regularUnits: initial.decks.regularUnits,
      eliteUnits: initial.decks.eliteUnits,
    };

    const result = refreshUnitOffer(
      initial.unitOffer,
      decks,
      2,
      false,
      true,
      initial.rng
    );

    // Regular deck should have cards returned (minus new offer)
    // Original offer had 4 regular units, they go back, then we deal 4 new
    expect(result.decks.regularUnits.length).toBe(initialRegularCount);
  });
});

describe("removeUnitFromOffer", () => {
  it("should remove unit from offer", () => {
    const config = getScenario(SCENARIO_FIRST_RECONNAISSANCE);
    const rng = createRng(12345);

    const { unitOffer } = createUnitDecksAndOffer(config, 2, rng);
    const unitToRemove = unitOffer[1];
    expect(unitToRemove).toBeDefined();

    const newOffer = removeUnitFromOffer(unitToRemove, unitOffer);

    expect(newOffer.length).toBe(unitOffer.length - 1);
    expect(newOffer).not.toContain(unitToRemove);
  });

  it("should only remove first occurrence of duplicate unit", () => {
    // Manually create offer with duplicates
    const offer = ["peasants", "peasants", "thugs"] as const;

    const newOffer = removeUnitFromOffer("peasants", offer);

    expect(newOffer.length).toBe(2);
    expect(newOffer[0]).toBe("peasants");
    expect(newOffer[1]).toBe("thugs");
  });

  it("should return unchanged offer if unit not found", () => {
    const offer = ["peasants", "thugs"] as const;

    const newOffer = removeUnitFromOffer("foresters", offer);

    expect(newOffer).toEqual(offer);
  });
});
