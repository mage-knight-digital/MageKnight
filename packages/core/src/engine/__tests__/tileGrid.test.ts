import { describe, it, expect } from "vitest";
import {
  generateWedgeSlots,
  generateTileSlots,
  TILE_PLACEMENT_OFFSETS,
  getExpansionDirections,
  getDirectionFromOffset,
  isSlotAdjacentToFilled,
  getValidExploreDirectionsForShape,
} from "../explore/tileGrid.js";
import { MAP_SHAPE_WEDGE, MAP_SHAPE_OPEN, hexKey } from "@mage-knight/shared";

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
});
