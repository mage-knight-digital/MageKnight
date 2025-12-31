/**
 * Hex coordinate types using axial coordinates (q, r)
 */

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export type HexDirection =
  | "NE" // q+1, r-1
  | "E" // q+1, r+0
  | "SE" // q+0, r+1
  | "SW" // q-1, r+1
  | "W" // q-1, r+0
  | "NW"; // q+0, r-1

export const HEX_DIRECTIONS: readonly HexDirection[] = [
  "NE",
  "E",
  "SE",
  "SW",
  "W",
  "NW",
] as const;

const DIRECTION_OFFSETS: Record<HexDirection, HexCoord> = {
  NE: { q: 1, r: -1 },
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
};

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function getNeighbor(coord: HexCoord, direction: HexDirection): HexCoord {
  const offset = DIRECTION_OFFSETS[direction];
  return {
    q: coord.q + offset.q,
    r: coord.r + offset.r,
  };
}

export function getAllNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((dir) => getNeighbor(coord, dir));
}
