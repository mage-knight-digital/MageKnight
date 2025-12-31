import { describe, it, expect } from "vitest";
import {
  hexKey,
  getNeighbor,
  getAllNeighbors,
  HEX_DIRECTIONS,
  type HexCoord,
  type HexDirection,
} from "../src/hex.js";

describe("hexKey", () => {
  it("returns correct string key for coordinates", () => {
    expect(hexKey({ q: 0, r: 0 })).toBe("0,0");
    expect(hexKey({ q: 1, r: -1 })).toBe("1,-1");
    expect(hexKey({ q: -3, r: 5 })).toBe("-3,5");
  });
});

describe("getNeighbor", () => {
  const origin: HexCoord = { q: 0, r: 0 };

  it("returns correct neighbor for NE direction", () => {
    expect(getNeighbor(origin, "NE")).toEqual({ q: 1, r: -1 });
  });

  it("returns correct neighbor for E direction", () => {
    expect(getNeighbor(origin, "E")).toEqual({ q: 1, r: 0 });
  });

  it("returns correct neighbor for SE direction", () => {
    expect(getNeighbor(origin, "SE")).toEqual({ q: 0, r: 1 });
  });

  it("returns correct neighbor for SW direction", () => {
    expect(getNeighbor(origin, "SW")).toEqual({ q: -1, r: 1 });
  });

  it("returns correct neighbor for W direction", () => {
    expect(getNeighbor(origin, "W")).toEqual({ q: -1, r: 0 });
  });

  it("returns correct neighbor for NW direction", () => {
    expect(getNeighbor(origin, "NW")).toEqual({ q: 0, r: -1 });
  });

  it("works correctly from non-origin coordinates", () => {
    const coord: HexCoord = { q: 3, r: -2 };
    expect(getNeighbor(coord, "E")).toEqual({ q: 4, r: -2 });
    expect(getNeighbor(coord, "SW")).toEqual({ q: 2, r: -1 });
  });
});

describe("getAllNeighbors", () => {
  it("returns exactly 6 neighbors", () => {
    const neighbors = getAllNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
  });

  it("returns all unique coordinates", () => {
    const neighbors = getAllNeighbors({ q: 0, r: 0 });
    const keys = neighbors.map(hexKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(6);
  });

  it("returns neighbors in direction order", () => {
    const origin: HexCoord = { q: 0, r: 0 };
    const neighbors = getAllNeighbors(origin);

    HEX_DIRECTIONS.forEach((dir: HexDirection, i: number) => {
      expect(neighbors[i]).toEqual(getNeighbor(origin, dir));
    });
  });

  it("returns correct neighbors for non-origin coordinates", () => {
    const coord: HexCoord = { q: 2, r: 3 };
    const neighbors = getAllNeighbors(coord);

    expect(neighbors).toContainEqual({ q: 3, r: 2 }); // NE
    expect(neighbors).toContainEqual({ q: 3, r: 3 }); // E
    expect(neighbors).toContainEqual({ q: 2, r: 4 }); // SE
    expect(neighbors).toContainEqual({ q: 1, r: 4 }); // SW
    expect(neighbors).toContainEqual({ q: 1, r: 3 }); // W
    expect(neighbors).toContainEqual({ q: 2, r: 2 }); // NW
  });
});
