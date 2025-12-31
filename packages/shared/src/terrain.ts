/**
 * Terrain types and movement costs
 */

export type Terrain =
  | "plains"
  | "hills"
  | "forest"
  | "wasteland"
  | "desert"
  | "swamp"
  | "lake"
  | "mountain"
  | "ocean";

export interface MovementCost {
  readonly day: number;
  readonly night: number;
}

export type MovementCosts = Record<Terrain, MovementCost>;

export const DEFAULT_MOVEMENT_COSTS: MovementCosts = {
  plains: { day: 2, night: 3 },
  hills: { day: 3, night: 4 },
  forest: { day: 3, night: 5 },
  wasteland: { day: 4, night: 5 },
  desert: { day: 5, night: 3 },
  swamp: { day: 5, night: 5 },
  lake: { day: Infinity, night: Infinity },
  mountain: { day: Infinity, night: Infinity },
  ocean: { day: Infinity, night: Infinity },
};
