/**
 * Unit tests for rules/unitMaintenance.ts and rules/turnStructure.ts (isActivePlayer).
 */

import { describe, it, expect } from "vitest";
import {
  hasPendingUnitMaintenance,
  isUnitInMaintenanceList,
  getAvailableCrystalColorsForMaintenance,
  hasCrystalAvailable,
} from "../rules/unitMaintenance.js";
import { isActivePlayer } from "../rules/turnStructure.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import {
  UNIT_MAGIC_FAMILIARS,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";

describe("unitMaintenance rules", () => {
  describe("hasPendingUnitMaintenance", () => {
    it("returns false when pendingUnitMaintenance is null", () => {
      const player = createTestPlayer({ pendingUnitMaintenance: null });
      expect(hasPendingUnitMaintenance(player)).toBe(false);
    });

    it("returns false when pendingUnitMaintenance is empty array", () => {
      const player = createTestPlayer({ pendingUnitMaintenance: [] });
      expect(hasPendingUnitMaintenance(player)).toBe(false);
    });

    it("returns true when pendingUnitMaintenance has entries", () => {
      const player = createTestPlayer({
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      expect(hasPendingUnitMaintenance(player)).toBe(true);
    });
  });

  describe("isUnitInMaintenanceList", () => {
    it("returns false when pendingUnitMaintenance is null", () => {
      const player = createTestPlayer({ pendingUnitMaintenance: null });
      expect(isUnitInMaintenanceList(player, "familiars_1")).toBe(false);
    });

    it("returns false when unit is not in list", () => {
      const player = createTestPlayer({
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      expect(isUnitInMaintenanceList(player, "wrong_unit")).toBe(false);
    });

    it("returns true when unit is in list", () => {
      const player = createTestPlayer({
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      expect(isUnitInMaintenanceList(player, "familiars_1")).toBe(true);
    });

    it("works with multiple entries", () => {
      const player = createTestPlayer({
        pendingUnitMaintenance: [
          { unitInstanceId: "familiars_1", unitId: UNIT_MAGIC_FAMILIARS },
          { unitInstanceId: "familiars_2", unitId: UNIT_MAGIC_FAMILIARS },
        ],
      });
      expect(isUnitInMaintenanceList(player, "familiars_2")).toBe(true);
    });
  });

  describe("getAvailableCrystalColorsForMaintenance", () => {
    it("returns empty array when no crystals", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      expect(getAvailableCrystalColorsForMaintenance(player)).toEqual([]);
    });

    it("returns only colors with crystals > 0", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 2, white: 0 },
      });
      const colors = getAvailableCrystalColorsForMaintenance(player);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_GREEN);
      expect(colors).not.toContain(MANA_BLUE);
      expect(colors).not.toContain(MANA_WHITE);
    });

    it("returns all four colors when all available", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 1, green: 1, white: 1 },
      });
      const colors = getAvailableCrystalColorsForMaintenance(player);
      expect(colors).toHaveLength(4);
    });
  });

  describe("hasCrystalAvailable", () => {
    it("returns false when crystal count is 0", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      expect(hasCrystalAvailable(player, MANA_RED)).toBe(false);
    });

    it("returns true when crystal count is > 0", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 2, green: 0, white: 0 },
      });
      expect(hasCrystalAvailable(player, MANA_BLUE)).toBe(true);
    });
  });
});

describe("isActivePlayer", () => {
  it("returns true for currentTacticSelector during tactics_selection", () => {
    const state = createTestGameState({
      roundPhase: "tactics_selection",
      currentTacticSelector: "player1",
      turnOrder: ["player2", "player1"],
      currentPlayerIndex: 0,
    });
    expect(isActivePlayer(state, "player1")).toBe(true);
  });

  it("returns false for non-selector during tactics_selection", () => {
    const state = createTestGameState({
      roundPhase: "tactics_selection",
      currentTacticSelector: "player1",
      turnOrder: ["player2", "player1"],
      currentPlayerIndex: 0,
    });
    expect(isActivePlayer(state, "player2")).toBe(false);
  });

  it("returns true for current turn player during player_turns", () => {
    const state = createTestGameState({
      roundPhase: "player_turns",
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });
    expect(isActivePlayer(state, "player1")).toBe(true);
  });

  it("returns false for non-current player during player_turns", () => {
    const state = createTestGameState({
      roundPhase: "player_turns",
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });
    expect(isActivePlayer(state, "player2")).toBe(false);
  });

  it("distinguishes tactics selector from turn order player", () => {
    // Key scenario: tactics selector is player2, but turnOrder[0] is player1
    const state = createTestGameState({
      roundPhase: "tactics_selection",
      currentTacticSelector: "player2",
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });
    expect(isActivePlayer(state, "player2")).toBe(true);
    expect(isActivePlayer(state, "player1")).toBe(false);
  });
});
