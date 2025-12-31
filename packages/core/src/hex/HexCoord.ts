/**
 * Hex coordinate types and helpers
 * Re-exports from @mage-knight/shared for internal use
 */

export type {
  HexCoord,
  HexDirection,
} from "@mage-knight/shared";

export {
  HEX_DIRECTIONS,
  hexKey,
  getNeighbor,
  getAllNeighbors,
} from "@mage-knight/shared";
