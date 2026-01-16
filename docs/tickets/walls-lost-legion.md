# Ticket: Walls (Lost Legion Expansion)

**Created:** January 2025
**Priority:** Medium
**Complexity:** Medium-High
**Affects:** Data model, Movement system, Combat system, Provocation, UI
**Status:** Not Started

---

## Problem Statement

The Lost Legion expansion introduces walls on certain tiles. Walls exist on hex edges (between two adjacent hexes) and affect movement costs, combat fortification, and enemy provocation. Currently, the game has no concept of walls.

---

## Rules Reference

From the Lost Legion rulebook (Walls):

**Movement:**
> To cross a wall on the map, you have to pay 1 extra Move point. Terrain discounts cannot negate this extra cost. Walls have no effect on movement invoked directly by an effect (Flight etc.)

**Combat:**
> When challenging rampaging enemies across a wall, consider the enemies to be fortified (walls count as site fortifications). When attacking another player or Volkare across a wall, consider the target to be fortified. When assaulting a fortified site across a wall, consider the garrison to be double fortified.

**Provoking:**
> Your move does not provoke rampaging enemies if the target space of that move is separated from the enemy by a wall (i.e. rampaging enemies never attack you across a wall).

---

## Current State

### What Exists

- Tile definitions in `tiles.ts` have **comments** documenting wall positions
- No data model for walls
- No gameplay logic considers walls

### Tiles With Walls

| Tile | Wall Locations (from comments) |
|------|-------------------------------|
| Countryside 12 | CENTER walled to E, SW, W |
| Countryside 13 | CENTER walled to NE; NE walled to E, SE; NW walled to E |
| Countryside 14 | NE walled to SW |
| Core 9 | CENTER walled to W, SW, SE; SE walled to NE, NW; SW walled to NE; W walled to E, NE; NW walled to SW |
| Core 10 | W walled (keep fortified) |
| CoreVolkare | CENTER walled (camp fortified); SE walled (village fortified) |

---

## Proposed Solution

### Key Insight: Walls Are On Edges, Not Hexes

A wall exists *between* two adjacent hexes. For efficient lookup during gameplay, we store which edges of each hex have walls.

### Data Model Changes

#### 1. Add Wall Type (shared or core types)

```typescript
// A wall segment between two adjacent local hex positions
export type WallSegment = readonly [LocalHexPosition, LocalHexPosition];
```

#### 2. Update TileDefinition (tiles.ts)

```typescript
export interface TileDefinition {
  readonly id: TileId;
  readonly type: TileType;
  readonly hexes: readonly LocalHex[];
  readonly hasCity: boolean;
  readonly cityColor?: CityColor;
  readonly walls?: readonly WallSegment[];  // NEW
}
```

#### 3. Update HexState (map.ts)

```typescript
export interface HexState {
  readonly coord: HexCoord;
  readonly terrain: Terrain;
  readonly tileId: TileId;
  readonly site: Site | null;
  readonly rampagingEnemies: readonly RampagingEnemyType[];
  readonly enemies: readonly HexEnemy[];
  readonly shieldTokens: readonly string[];
  readonly walls: readonly HexDirection[];  // NEW - edges with walls
}
```

#### 4. Update placeTile() (tiles.ts)

Expand wall segments into per-hex direction arrays:

```typescript
export function placeTile(tileId: TileId, centerCoord: HexCoord): HexState[] {
  const definition = TILE_DEFINITIONS[tileId];

  // Build wall lookup: for each local hex, which directions have walls
  const wallsByHex = new Map<string, HexDirection[]>();

  if (definition.walls) {
    for (const [hexA, hexB] of definition.walls) {
      // Get direction from A to B and B to A
      const dirAtoB = getDirectionBetween(hexA, hexB);
      const dirBtoA = getDirectionBetween(hexB, hexA);

      // Add to both hexes (bidirectional storage)
      const keyA = `${hexA.q},${hexA.r}`;
      const keyB = `${hexB.q},${hexB.r}`;

      if (!wallsByHex.has(keyA)) wallsByHex.set(keyA, []);
      if (!wallsByHex.has(keyB)) wallsByHex.set(keyB, []);

      wallsByHex.get(keyA)!.push(dirAtoB);
      wallsByHex.get(keyB)!.push(dirBtoA);
    }
  }

  return definition.hexes.map((localHex) => {
    const localKey = `${localHex.localQ},${localHex.localR}`;
    // ... existing hex creation ...
    return {
      // ... existing properties ...
      walls: wallsByHex.get(localKey) ?? [],
    };
  });
}
```

### Core Helper Function

```typescript
// packages/core/src/engine/helpers/wallHelpers.ts

/**
 * Check if there's a wall between two adjacent hexes.
 */
export function hasWallBetween(
  from: HexCoord,
  to: HexCoord,
  state: GameState
): boolean {
  const hex = state.map.hexes[hexKey(from)];
  if (!hex) return false;

  const direction = getDirectionFromTo(from, to);
  if (!direction) return false; // Not adjacent

  return hex.walls.includes(direction);
}

/**
 * Get the wall crossing cost (0 or 1).
 * Returns 0 if no wall or if using Flight.
 */
export function getWallCost(
  from: HexCoord,
  to: HexCoord,
  state: GameState,
  isFlight: boolean
): number {
  if (isFlight) return 0;
  return hasWallBetween(from, to, state) ? 1 : 0;
}
```

### Game Logic Changes

#### 1. Movement Cost

```typescript
// In movement cost calculation
function getMovementCost(
  from: HexCoord,
  to: HexCoord,
  state: GameState,
  player: Player,
  isFlight: boolean
): number {
  const terrainCost = getEffectiveTerrainCost(to, state, player);
  const wallCost = getWallCost(from, to, state, isFlight);

  // Wall cost cannot be negated by terrain discounts
  // So we apply terrain modifiers only to terrain cost, then add wall
  return terrainCost + wallCost;
}
```

#### 2. Combat Fortification

```typescript
// Need concept of fortification levels
export type FortificationLevel = 0 | 1 | 2;

export function getEffectiveFortification(
  attackerHex: HexCoord,
  targetHex: HexCoord,
  state: GameState
): FortificationLevel {
  const hex = state.map.hexes[hexKey(targetHex)];
  const site = hex?.site;

  // Base fortification from site
  let level: FortificationLevel = 0;
  if (site && isFortified(site.type) && !site.isConquered) {
    level = 1;
  }

  // Wall adds one level
  if (hasWallBetween(attackerHex, targetHex, state)) {
    level = Math.min(2, level + 1) as FortificationLevel;
  }

  return level;
}
```

**Fortification levels:**
- **0**: Normal - any attack damages enemies
- **1**: Fortified - requires Siege attacks
- **2**: Double Fortified - requires Siege attacks, enemies have +X armor (TBD exact rules)

#### 3. Provocation Check

```typescript
// In provocation logic (moveCommand.ts)
function wouldProvokeEnemy(
  destination: HexCoord,
  enemyHex: HexCoord,
  state: GameState
): boolean {
  // Wall blocks provocation
  if (hasWallBetween(destination, enemyHex, state)) {
    return false;
  }

  // ... existing provocation logic ...
}
```

### Tile Definition Updates

Add wall data to Lost Legion tiles:

```typescript
[TileId.Countryside12]: {
  id: TileId.Countryside12,
  type: TILE_TYPE_COUNTRYSIDE,
  hasCity: false,
  hexes: [/* ... */],
  walls: [
    [LOCAL_HEX.CENTER, LOCAL_HEX.E],
    [LOCAL_HEX.CENTER, LOCAL_HEX.SW],
    [LOCAL_HEX.CENTER, LOCAL_HEX.W],
  ],
},

[TileId.Core9]: {
  id: TileId.Core9,
  type: TILE_TYPE_CORE,
  hasCity: false,
  hexes: [/* ... */],
  walls: [
    [LOCAL_HEX.CENTER, LOCAL_HEX.W],
    [LOCAL_HEX.CENTER, LOCAL_HEX.SW],
    [LOCAL_HEX.CENTER, LOCAL_HEX.SE],
    [LOCAL_HEX.SE, LOCAL_HEX.NE],
    [LOCAL_HEX.SE, LOCAL_HEX.NW],
    [LOCAL_HEX.SW, LOCAL_HEX.NE],
    [LOCAL_HEX.W, LOCAL_HEX.E],
    [LOCAL_HEX.W, LOCAL_HEX.NE],
    [LOCAL_HEX.NW, LOCAL_HEX.SW],
  ],
},
// ... etc for other walled tiles
```

### UI Changes

#### Render Walls on Hex Edges

```typescript
// In HexGrid.tsx or separate WallRenderer component

function renderWalls(hex: ClientHexState): React.ReactNode {
  if (!hex.walls || hex.walls.length === 0) return null;

  return hex.walls.map(direction => (
    <WallSegment
      key={direction}
      hexCoord={hex.coord}
      direction={direction}
    />
  ));
}

// WallSegment draws a thick line or wall graphic on the hex edge
function WallSegment({ hexCoord, direction }: WallSegmentProps) {
  const [startPoint, endPoint] = getEdgeCoordinates(hexCoord, direction);

  return (
    <line
      x1={startPoint.x}
      y1={startPoint.y}
      x2={endPoint.x}
      y2={endPoint.y}
      stroke="#8B4513"
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}
```

---

## Testing Plan

### Unit Tests: `walls.test.ts`

```typescript
describe("Walls", () => {
  describe("hasWallBetween", () => {
    it("should return true when wall exists between hexes");
    it("should return false when no wall between hexes");
    it("should work bidirectionally (A→B same as B→A)");
    it("should return false for non-adjacent hexes");
  });

  describe("movement cost with walls", () => {
    it("should add +1 cost when crossing wall");
    it("should NOT add cost when using Flight");
    it("should NOT allow terrain discounts to negate wall cost");
    it("should stack wall cost with terrain cost");
  });

  describe("combat fortification with walls", () => {
    it("should treat enemies as fortified when wall between attacker and target");
    it("should treat fortified site as double fortified when wall present");
    it("should not affect fortification when no wall");
  });

  describe("provocation with walls", () => {
    it("should NOT provoke enemies across a wall");
    it("should still provoke enemies not separated by wall");
  });

  describe("placeTile with walls", () => {
    it("should populate walls array on HexState from tile definition");
    it("should store walls bidirectionally on both hexes");
    it("should handle tiles without walls (empty array)");
  });
});
```

### Integration Tests

```typescript
describe("Wall scenarios", () => {
  it("Core 9: player can shelter from Draconum behind walls");
  it("Volkare Camp: requires extra movement to reach camp");
  it("Countryside 12: orcs behind walls don't provoke on adjacent move");
});
```

---

## Implementation Order

1. **Add types** - `WallSegment`, update `TileDefinition`, update `HexState`
2. **Update placeTile()** - Process walls into per-hex arrays
3. **Add helper functions** - `hasWallBetween()`, `getWallCost()`
4. **Add wall data to tiles** - Update Lost Legion tile definitions
5. **Update movement cost** - Integrate wall cost
6. **Update provocation** - Check for walls
7. **Update combat fortification** - Add fortification levels
8. **Update UI** - Render wall segments
9. **Write tests** - Unit and integration tests
10. **Manual testing** - Verify on actual Lost Legion tiles

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Flight movement across wall | No extra cost |
| Pathfinding through walls | Include wall cost in calculations |
| Wall on tile edge (connecting to another tile) | Walls only exist within tiles, not between tiles |
| Double fortified combat | Need to define exact mechanics (extra armor? two Siege needed?) |
| Ranged attack across wall | Wall still applies (attacker position matters) |
| Underground movement across wall | TBD - probably bypasses like Flight |

---

## Open Questions

1. **Double Fortified Mechanics**: What exactly does "double fortified" mean mechanically?
   - Two Siege attacks needed to damage?
   - Extra armor on enemies?
   - Need to check Lost Legion rulebook for specifics

2. **Wall Rendering**: What visual style for walls?
   - Simple thick lines?
   - Actual wall graphics/sprites?
   - Tower icons at intersections?

3. **Wall Data Verification**: Need to verify wall positions against actual tile images
   - Current comments may have errors
   - Should audit against physical tiles or tile images

---

## Acceptance Criteria

- [ ] `WallSegment` type defined
- [ ] `TileDefinition` includes optional `walls` array
- [ ] `HexState` includes `walls: HexDirection[]`
- [ ] `placeTile()` processes wall segments into per-hex arrays
- [ ] `hasWallBetween()` helper function works correctly
- [ ] Movement cost adds +1 for wall crossing (not negatable by terrain discounts)
- [ ] Flight bypasses wall cost
- [ ] Provocation blocked by walls
- [ ] Combat fortification accounts for walls (fortified / double fortified)
- [ ] Lost Legion tiles have wall data defined
- [ ] UI renders wall segments on hex edges
- [ ] All unit tests pass
- [ ] Manual testing confirms correct behavior on Lost Legion tiles

---

## Related Issues

- `challenge-rampaging-enemies.md` - Wall affects whether rampaging enemies are fortified
- `volkare-architecture-considerations.md` - Volkare's Camp has walls
- Combat fortification system - May need refactoring for fortification levels
