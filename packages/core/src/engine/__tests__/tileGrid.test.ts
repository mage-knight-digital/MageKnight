import { describe, it, expect } from "vitest";
import {
  generateWedgeSlots,
  generateTileSlots,
  generateOpenSlots,
  TILE_PLACEMENT_OFFSETS,
  getExpansionDirections,
  getDirectionFromOffset,
  isSlotAdjacentToFilled,
  getValidExploreDirectionsForShape,
  getColumnRangeForShape,
  getMaxColumnsForShape,
  isColumnValid,
} from "../explore/tileGrid.js";
import {
  MAP_SHAPE_WEDGE,
  MAP_SHAPE_OPEN,
  MAP_SHAPE_OPEN_3,
  MAP_SHAPE_OPEN_4,
  MAP_SHAPE_OPEN_5,
  MAP_SHAPE_CONFIGS,
  hexKey,
} from "@mage-knight/shared";

describe("tileGrid", () => {
  describe("generateWedgeSlots", () => {
    it("should generate correct number of slots per row", () => {
      const slots = generateWedgeSlots(4);

      // Count slots per row
      const rowCounts: Record<number, number> = {};
      for (const slot of slots.values()) {
        rowCounts[slot.row] = (rowCounts[slot.row] || 0) + 1;
      }

      // Wedge pattern: row N has N+1 slots
      expect(rowCounts[0]).toBe(1); // Row 0: 1 slot (starting)
      expect(rowCounts[1]).toBe(2); // Row 1: 2 slots
      expect(rowCounts[2]).toBe(3); // Row 2: 3 slots
      expect(rowCounts[3]).toBe(4); // Row 3: 4 slots
      expect(rowCounts[4]).toBe(5); // Row 4: 5 slots
    });

    it("should place starting slot at origin", () => {
      const slots = generateWedgeSlots(2);
      const originSlot = slots.get(hexKey({ q: 0, r: 0 }));

      expect(originSlot).toBeDefined();
      expect(originSlot?.row).toBe(0);
      expect(originSlot?.coord).toEqual({ q: 0, r: 0 });
      expect(originSlot?.filled).toBe(false);
    });

    it("should generate row 1 slots at correct positions", () => {
      const slots = generateWedgeSlots(2);

      // Row 1 should have slots at NE and E offsets from origin
      const neOffset = TILE_PLACEMENT_OFFSETS["NE"];
      const eOffset = TILE_PLACEMENT_OFFSETS["E"];

      const neSlot = slots.get(hexKey({ q: neOffset.q, r: neOffset.r }));
      const eSlot = slots.get(hexKey({ q: eOffset.q, r: eOffset.r }));

      expect(neSlot).toBeDefined();
      expect(neSlot?.row).toBe(1);
      expect(neSlot?.coord).toEqual({ q: 1, r: -3 });

      expect(eSlot).toBeDefined();
      expect(eSlot?.row).toBe(1);
      expect(eSlot?.coord).toEqual({ q: 3, r: -2 });
    });

    it("should only expand via NE and E directions", () => {
      const slots = generateWedgeSlots(2);

      // NW offset from origin should NOT exist in wedge
      const nwOffset = TILE_PLACEMENT_OFFSETS["NW"];
      const nwSlot = slots.get(hexKey({ q: nwOffset.q, r: nwOffset.r }));

      expect(nwSlot).toBeUndefined();

      // W, SW, SE should also not exist
      const wSlot = slots.get(
        hexKey({ q: TILE_PLACEMENT_OFFSETS["W"].q, r: TILE_PLACEMENT_OFFSETS["W"].r })
      );
      const swSlot = slots.get(
        hexKey({ q: TILE_PLACEMENT_OFFSETS["SW"].q, r: TILE_PLACEMENT_OFFSETS["SW"].r })
      );
      const seSlot = slots.get(
        hexKey({ q: TILE_PLACEMENT_OFFSETS["SE"].q, r: TILE_PLACEMENT_OFFSETS["SE"].r })
      );

      expect(wSlot).toBeUndefined();
      expect(swSlot).toBeUndefined();
      expect(seSlot).toBeUndefined();
    });

    it("should generate total slots matching triangular number formula", () => {
      // For n rows, total slots = 1 + 2 + 3 + ... + (n+1) = (n+1)(n+2)/2
      const slots3 = generateWedgeSlots(3);
      const slots4 = generateWedgeSlots(4);

      // 3 rows: 1+2+3+4 = 10 slots
      expect(slots3.size).toBe(10);

      // 4 rows: 1+2+3+4+5 = 15 slots
      expect(slots4.size).toBe(15);
    });
  });

  describe("generateTileSlots", () => {
    it("should generate wedge slots for MAP_SHAPE_WEDGE", () => {
      // First Reconnaissance: 1 starting + 8 countryside + 2 core + 1 city = 12 tiles
      const slots = generateTileSlots(MAP_SHAPE_WEDGE, 12);

      // Should have enough slots for 12 tiles
      expect(slots.size).toBeGreaterThanOrEqual(12);

      // All slots should be unfilled initially
      for (const slot of slots.values()) {
        expect(slot.filled).toBe(false);
      }
    });

    it("should return empty map for MAP_SHAPE_OPEN", () => {
      const slots = generateTileSlots(MAP_SHAPE_OPEN, 12);

      // Open map has no predefined slots
      expect(slots.size).toBe(0);
    });
  });

  describe("getExpansionDirections", () => {
    it("should return NE and E for wedge shape", () => {
      const dirs = getExpansionDirections(MAP_SHAPE_WEDGE);

      expect(dirs).toContain("NE");
      expect(dirs).toContain("E");
      expect(dirs).toHaveLength(2);
    });

    it("should return all 6 directions for open shape", () => {
      const dirs = getExpansionDirections(MAP_SHAPE_OPEN);

      expect(dirs).toContain("NE");
      expect(dirs).toContain("E");
      expect(dirs).toContain("SE");
      expect(dirs).toContain("SW");
      expect(dirs).toContain("W");
      expect(dirs).toContain("NW");
      expect(dirs).toHaveLength(6);
    });

    it("should return all 6 directions for OPEN_3 shape", () => {
      const dirs = getExpansionDirections(MAP_SHAPE_OPEN_3);
      expect(dirs).toHaveLength(6);
    });

    it("should return all 6 directions for OPEN_4 shape", () => {
      const dirs = getExpansionDirections(MAP_SHAPE_OPEN_4);
      expect(dirs).toHaveLength(6);
    });

    it("should return all 6 directions for OPEN_5 shape", () => {
      const dirs = getExpansionDirections(MAP_SHAPE_OPEN_5);
      expect(dirs).toHaveLength(6);
    });
  });

  describe("MAP_SHAPE_CONFIGS", () => {
    it("should have config for all map shapes", () => {
      expect(MAP_SHAPE_CONFIGS[MAP_SHAPE_WEDGE]).toBeDefined();
      expect(MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN]).toBeDefined();
      expect(MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_3]).toBeDefined();
      expect(MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_4]).toBeDefined();
      expect(MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_5]).toBeDefined();
    });

    it("should have WEDGE config matching original hardcoded values (regression)", () => {
      const config = MAP_SHAPE_CONFIGS[MAP_SHAPE_WEDGE];
      expect(config.startingTile).toBe("starting_a");
      expect(config.initialTilePositions).toEqual(["NE", "E"]);
      expect(config.expansionDirections).toEqual(["NE", "E"]);
    });

    it("should have OPEN_3 config with 3 initial tiles", () => {
      const config = MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_3];
      expect(config.startingTile).toBe("starting_b");
      expect(config.initialTilePositions).toHaveLength(3);
    });

    it("should have OPEN_4 config with 4 initial tiles", () => {
      const config = MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_4];
      expect(config.startingTile).toBe("starting_b");
      expect(config.initialTilePositions).toHaveLength(4);
    });

    it("should have OPEN_5 config with 5 initial tiles", () => {
      const config = MAP_SHAPE_CONFIGS[MAP_SHAPE_OPEN_5];
      expect(config.startingTile).toBe("starting_b");
      expect(config.initialTilePositions).toHaveLength(5);
    });

    it("should only have valid HexDirections in all configs", () => {
      const validDirections = ["NE", "E", "SE", "SW", "W", "NW"];

      for (const config of Object.values(MAP_SHAPE_CONFIGS)) {
        for (const dir of config.initialTilePositions) {
          expect(validDirections).toContain(dir);
        }
        for (const dir of config.expansionDirections) {
          expect(validDirections).toContain(dir);
        }
      }
    });
  });

  describe("getDirectionFromOffset", () => {
    it("should identify direction from offset", () => {
      // Using correct TILE_PLACEMENT_OFFSETS values
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe("E");
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: 1, r: -3 })).toBe("NE");
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: -1, r: -2 })).toBe("NW");
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: -3, r: 1 })).toBe("W");
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: -2, r: 3 })).toBe("SW");
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: 1, r: 2 })).toBe("SE");
    });

    it("should return null for invalid offset", () => {
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: 1, r: 1 })).toBeNull();
      expect(getDirectionFromOffset({ q: 0, r: 0 }, { q: 5, r: 5 })).toBeNull();
    });
  });

  describe("isSlotAdjacentToFilled", () => {
    it("should return true if slot is adjacent to a filled slot", () => {
      const filledSlots = new Set([hexKey({ q: 0, r: 0 })]);

      // NE slot from origin should be adjacent (using correct offset)
      const neCoord = { q: 1, r: -3 };
      expect(isSlotAdjacentToFilled(neCoord, filledSlots)).toBe(true);

      // E slot from origin should be adjacent (using correct offset)
      const eCoord = { q: 3, r: -2 };
      expect(isSlotAdjacentToFilled(eCoord, filledSlots)).toBe(true);
    });

    it("should return false if slot is not adjacent to any filled slot", () => {
      const filledSlots = new Set([hexKey({ q: 0, r: 0 })]);

      // Far away slot should not be adjacent
      const farCoord = { q: 10, r: 10 };
      expect(isSlotAdjacentToFilled(farCoord, filledSlots)).toBe(false);
    });
  });

  describe("getValidExploreDirectionsForShape", () => {
    it("should return valid directions for unfilled wedge slots", () => {
      const slots = generateWedgeSlots(2);

      // From origin, should be able to explore NE and E
      const validDirs = getValidExploreDirectionsForShape(
        { q: 0, r: 0 },
        MAP_SHAPE_WEDGE,
        slots
      );

      expect(validDirs).toContain("NE");
      expect(validDirs).toContain("E");
      expect(validDirs).toHaveLength(2);
    });

    it("should not return directions to filled slots", () => {
      const slots = generateWedgeSlots(2);

      // Mark NE slot as filled (using correct offset)
      const neKey = hexKey({ q: 1, r: -3 });
      const neSlot = slots.get(neKey);
      if (neSlot) {
        slots.set(neKey, { ...neSlot, filled: true });
      }

      const validDirs = getValidExploreDirectionsForShape(
        { q: 0, r: 0 },
        MAP_SHAPE_WEDGE,
        slots
      );

      expect(validDirs).not.toContain("NE");
      expect(validDirs).toContain("E");
      expect(validDirs).toHaveLength(1);
    });

    it("should not return directions that don't have slots (wedge boundary)", () => {
      const slots = generateWedgeSlots(2);

      // From origin, NW is not a valid wedge direction
      const validDirs = getValidExploreDirectionsForShape(
        { q: 0, r: 0 },
        MAP_SHAPE_WEDGE,
        slots
      );

      expect(validDirs).not.toContain("NW");
      expect(validDirs).not.toContain("W");
      expect(validDirs).not.toContain("SW");
      expect(validDirs).not.toContain("SE");
    });
  });

  describe("TILE_PLACEMENT_OFFSETS", () => {
    it("should have offsets for all 6 directions", () => {
      expect(TILE_PLACEMENT_OFFSETS["E"]).toEqual({ q: 3, r: -2 });
      expect(TILE_PLACEMENT_OFFSETS["NE"]).toEqual({ q: 1, r: -3 });
      expect(TILE_PLACEMENT_OFFSETS["NW"]).toEqual({ q: -1, r: -2 });
      expect(TILE_PLACEMENT_OFFSETS["W"]).toEqual({ q: -3, r: 1 });
      expect(TILE_PLACEMENT_OFFSETS["SW"]).toEqual({ q: -2, r: 3 });
      expect(TILE_PLACEMENT_OFFSETS["SE"]).toEqual({ q: 1, r: 2 });
    });

    it("should produce 3 adjacent hex pairs when tiles connect", () => {
      // This test verifies the geometry: two tiles placed using these offsets
      // should have exactly 3 adjacent hex pairs (touching edges, not overlapping)

      // Tile hex offsets (symmetric flower)
      const tileHexes = [
        { q: 0, r: 0 },
        { q: 1, r: -1 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
      ];

      function getHexesForTile(centerQ: number, centerR: number) {
        return tileHexes.map((h) => ({
          q: centerQ + h.q,
          r: centerR + h.r,
          key: hexKey({ q: centerQ + h.q, r: centerR + h.r }),
        }));
      }

      function countAdjacentPairs(
        tile1Hexes: { q: number; r: number; key: string }[],
        tile2Hexes: { q: number; r: number; key: string }[]
      ) {
        const t1Keys = new Set(tile1Hexes.map((h) => h.key));
        const t2Keys = new Set(tile2Hexes.map((h) => h.key));
        const neighborOffsets = [
          [1, -1],
          [1, 0],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [0, -1],
        ];

        let count = 0;
        for (const h1 of tile1Hexes) {
          for (const [dq, dr] of neighborOffsets) {
            const neighborKey = hexKey({ q: h1.q + dq, r: h1.r + dr });
            // Count if neighbor is in tile2 but not in tile1 (no overlap)
            if (t2Keys.has(neighborKey) && !t1Keys.has(neighborKey)) {
              count++;
            }
          }
        }
        return count;
      }

      // Test E direction
      const tile1 = getHexesForTile(0, 0);
      const tileE = getHexesForTile(
        TILE_PLACEMENT_OFFSETS["E"].q,
        TILE_PLACEMENT_OFFSETS["E"].r
      );
      expect(countAdjacentPairs(tile1, tileE)).toBe(3);

      // Test NE direction
      const tileNE = getHexesForTile(
        TILE_PLACEMENT_OFFSETS["NE"].q,
        TILE_PLACEMENT_OFFSETS["NE"].r
      );
      expect(countAdjacentPairs(tile1, tileNE)).toBe(3);
    });
  });

  describe("TileSlot column field", () => {
    it("should have column 0 for origin slot in wedge", () => {
      const slots = generateWedgeSlots(2);
      const originSlot = slots.get(hexKey({ q: 0, r: 0 }));

      expect(originSlot).toBeDefined();
      expect(originSlot?.column).toBe(0);
    });

    it("should assign correct columns to wedge row 1 slots", () => {
      const slots = generateWedgeSlots(2);

      // NE direction from origin (stays same column = 0)
      const neSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["NE"]));
      expect(neSlot?.column).toBe(0);

      // E direction from origin (column + 1 = 1)
      const eSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["E"]));
      expect(eSlot?.column).toBe(1);
    });

    it("should assign correct columns to wedge row 2 slots", () => {
      const slots = generateWedgeSlots(3);

      // Find row 2 slots and check their columns
      const row2Slots = [...slots.values()].filter((s) => s.row === 2);
      const columns = row2Slots.map((s) => s.column).sort((a, b) => a - b);

      // Row 2 should have columns 0, 1, 2
      expect(columns).toEqual([0, 1, 2]);
    });
  });

  describe("generateOpenSlots", () => {
    it("should create origin slot with column 0", () => {
      const slots = generateOpenSlots(12, 3, false);
      const originSlot = slots.get(hexKey({ q: 0, r: 0 }));

      expect(originSlot).toBeDefined();
      expect(originSlot?.row).toBe(0);
      expect(originSlot?.column).toBe(0);
      expect(originSlot?.filled).toBe(false);
    });

    it("should return empty map for maxColumns 0 (generic OPEN)", () => {
      const slots = generateOpenSlots(12, 0, false);

      // Only the origin slot
      expect(slots.size).toBe(1);
    });

    it("should generate slots with E/SE directions having positive column", () => {
      const slots = generateOpenSlots(20, 5, false);

      // Check that E direction leads to column +1
      const eSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["E"]));
      if (eSlot) {
        expect(eSlot.column).toBe(1);
      }

      // Check that SE direction leads to column +1
      const seSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["SE"]));
      if (seSlot) {
        expect(seSlot.column).toBe(1);
      }
    });

    it("should generate slots with W/NW directions having negative column", () => {
      const slots = generateOpenSlots(20, 5, false);

      // Check that W direction leads to column -1
      const wSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["W"]));
      if (wSlot) {
        expect(wSlot.column).toBe(-1);
      }

      // Check that NW direction leads to column -1
      const nwSlot = slots.get(hexKey(TILE_PLACEMENT_OFFSETS["NW"]));
      if (nwSlot) {
        expect(nwSlot.column).toBe(-1);
      }
    });

    it("should enforce column limits for symmetric Open 5 (-2 to +2)", () => {
      const slots = generateOpenSlots(50, 5, false);

      // All slots should have columns within -2 to +2
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-2);
        expect(slot.column).toBeLessThanOrEqual(2);
      }
    });

    it("should enforce column limits for symmetric Open 3 (-1 to +1)", () => {
      const slots = generateOpenSlots(30, 3, false);

      // All slots should have columns within -1 to +1
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-1);
        expect(slot.column).toBeLessThanOrEqual(1);
      }
    });

    it("should enforce asymmetric column limits for Open 4 (-1 to +2)", () => {
      const slots = generateOpenSlots(40, 4, true);

      // All slots should have columns within -1 to +2 (asymmetric, leans right)
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-1);
        expect(slot.column).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("generateTileSlots for Open shapes", () => {
    it("should generate slots for MAP_SHAPE_OPEN_3", () => {
      const slots = generateTileSlots(MAP_SHAPE_OPEN_3, 12);

      // Should have generated slots
      expect(slots.size).toBeGreaterThan(1);

      // All slots should be within column range -1 to +1
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-1);
        expect(slot.column).toBeLessThanOrEqual(1);
      }
    });

    it("should generate slots for MAP_SHAPE_OPEN_4 with asymmetric columns", () => {
      const slots = generateTileSlots(MAP_SHAPE_OPEN_4, 12);

      expect(slots.size).toBeGreaterThan(1);

      // All slots should be within asymmetric column range -1 to +2
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-1);
        expect(slot.column).toBeLessThanOrEqual(2);
      }
    });

    it("should generate slots for MAP_SHAPE_OPEN_5", () => {
      const slots = generateTileSlots(MAP_SHAPE_OPEN_5, 12);

      expect(slots.size).toBeGreaterThan(1);

      // All slots should be within column range -2 to +2
      for (const slot of slots.values()) {
        expect(slot.column).toBeGreaterThanOrEqual(-2);
        expect(slot.column).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("getColumnRangeForShape", () => {
    it("should return null for wedge (no column limits)", () => {
      expect(getColumnRangeForShape(MAP_SHAPE_WEDGE)).toBeNull();
    });

    it("should return null for generic open (no column limits)", () => {
      expect(getColumnRangeForShape(MAP_SHAPE_OPEN)).toBeNull();
    });

    it("should return symmetric range for Open 3", () => {
      const range = getColumnRangeForShape(MAP_SHAPE_OPEN_3);
      expect(range).toEqual({ minColumn: -1, maxColumn: 1 });
    });

    it("should return asymmetric range for Open 4", () => {
      const range = getColumnRangeForShape(MAP_SHAPE_OPEN_4);
      expect(range).toEqual({ minColumn: -1, maxColumn: 2 });
    });

    it("should return symmetric range for Open 5", () => {
      const range = getColumnRangeForShape(MAP_SHAPE_OPEN_5);
      expect(range).toEqual({ minColumn: -2, maxColumn: 2 });
    });
  });

  describe("getMaxColumnsForShape", () => {
    it("should return 0 for wedge (no column limits)", () => {
      const result = getMaxColumnsForShape(MAP_SHAPE_WEDGE);
      expect(result.maxColumns).toBe(0);
      expect(result.asymmetric).toBe(false);
    });

    it("should return 3 columns for Open 3", () => {
      const result = getMaxColumnsForShape(MAP_SHAPE_OPEN_3);
      expect(result.maxColumns).toBe(3);
      expect(result.asymmetric).toBe(false);
    });

    it("should return 4 columns with asymmetric for Open 4", () => {
      const result = getMaxColumnsForShape(MAP_SHAPE_OPEN_4);
      expect(result.maxColumns).toBe(4);
      expect(result.asymmetric).toBe(true);
    });

    it("should return 5 columns for Open 5", () => {
      const result = getMaxColumnsForShape(MAP_SHAPE_OPEN_5);
      expect(result.maxColumns).toBe(5);
      expect(result.asymmetric).toBe(false);
    });
  });

  describe("isColumnValid", () => {
    it("should always return true for wedge (no limits)", () => {
      expect(isColumnValid(-10, MAP_SHAPE_WEDGE)).toBe(true);
      expect(isColumnValid(10, MAP_SHAPE_WEDGE)).toBe(true);
    });

    it("should always return true for generic open (no limits)", () => {
      expect(isColumnValid(-10, MAP_SHAPE_OPEN)).toBe(true);
      expect(isColumnValid(10, MAP_SHAPE_OPEN)).toBe(true);
    });

    it("should validate columns for Open 3 (-1 to +1)", () => {
      expect(isColumnValid(-1, MAP_SHAPE_OPEN_3)).toBe(true);
      expect(isColumnValid(0, MAP_SHAPE_OPEN_3)).toBe(true);
      expect(isColumnValid(1, MAP_SHAPE_OPEN_3)).toBe(true);
      expect(isColumnValid(-2, MAP_SHAPE_OPEN_3)).toBe(false);
      expect(isColumnValid(2, MAP_SHAPE_OPEN_3)).toBe(false);
    });

    it("should validate columns for Open 4 (-1 to +2)", () => {
      expect(isColumnValid(-1, MAP_SHAPE_OPEN_4)).toBe(true);
      expect(isColumnValid(0, MAP_SHAPE_OPEN_4)).toBe(true);
      expect(isColumnValid(1, MAP_SHAPE_OPEN_4)).toBe(true);
      expect(isColumnValid(2, MAP_SHAPE_OPEN_4)).toBe(true);
      expect(isColumnValid(-2, MAP_SHAPE_OPEN_4)).toBe(false);
      expect(isColumnValid(3, MAP_SHAPE_OPEN_4)).toBe(false);
    });

    it("should validate columns for Open 5 (-2 to +2)", () => {
      expect(isColumnValid(-2, MAP_SHAPE_OPEN_5)).toBe(true);
      expect(isColumnValid(-1, MAP_SHAPE_OPEN_5)).toBe(true);
      expect(isColumnValid(0, MAP_SHAPE_OPEN_5)).toBe(true);
      expect(isColumnValid(1, MAP_SHAPE_OPEN_5)).toBe(true);
      expect(isColumnValid(2, MAP_SHAPE_OPEN_5)).toBe(true);
      expect(isColumnValid(-3, MAP_SHAPE_OPEN_5)).toBe(false);
      expect(isColumnValid(3, MAP_SHAPE_OPEN_5)).toBe(false);
    });
  });
});
