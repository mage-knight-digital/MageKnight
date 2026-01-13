# Plan: Replace Hex Grid with Actual Tile Artwork

## Summary

Replace the current SVG polygon-based hex grid (solid colors per terrain) with the actual Mage Knight tile artwork images you already have.

**Difficulty: Medium** - The infrastructure exists (tile images, tileId tracking), but requires some coordinate math work.

## Current State

### What We Have Now
- **HexGrid.tsx**: Renders individual hexes as SVG `<polygon>` elements with solid terrain colors
- **Tile images**: 27 high-quality PNG files in `/assets/tiles/` (core_01 through countryside_14, portal tiles)
- **Tile tracking**: Each hex already has a `tileId` property, and `ClientMapState.tiles` tracks tile centers
- **Card atlas pattern**: Working sprite system in `cardAtlas.ts` that could be extended

### The Tile Images
Looking at `core_01.png`, these are complete 7-hex "flower" tiles with:
- Beautiful terrain artwork (mountains, deserts, villages, etc.)
- Site artwork already embedded in the tiles
- Proper hex boundaries that match the game

## Proposed Approach: Whole-Tile Images with Overlay

**Render complete tile images as backgrounds, then overlay interactive elements on top.**

### Why This Approach
1. **Simpler math** - Position one image per tile, not 7 image regions per hex
2. **Preserves artwork** - No cutting/masking individual hexes from the flower
3. **Already tracked** - `state.map.tiles` gives us tileId + centerCoord
4. **Rotation handled** - Tiles in MK are placed at fixed orientations, your images match

### Architecture

```
<svg>
  {/* Layer 1: Tile artwork (background images) */}
  {tiles.map(tile => <TileImage tileId={tile.tileId} center={tile.centerCoord} />)}

  {/* Layer 2: Interactive overlays per hex */}
  {hexes.map(hex => <HexOverlay hex={hex} ... />)}

  {/* Layer 3: Tokens (players, enemies) */}
  {/* Layer 4: Ghost hexes for exploration */}
</svg>
```

## Implementation Steps

### Step 1: Calculate Tile Image Dimensions
- Measure actual pixel dimensions of a tile PNG
- Calculate the bounding box size in SVG units relative to HEX_SIZE
- A 7-hex flower spans approximately 3 hexes wide × 3 hexes tall

### Step 2: Create TileImage Component
```typescript
function TileImage({ tileId, centerCoord }: { tileId: string; centerCoord: HexCoord }) {
  const { x, y } = hexToPixel(centerCoord);
  const imageUrl = getTileImageUrl(tileId); // Already exists in assetPaths.ts

  return (
    <image
      href={imageUrl}
      x={x - TILE_WIDTH/2}
      y={y - TILE_HEIGHT/2}
      width={TILE_WIDTH}
      height={TILE_HEIGHT}
    />
  );
}
```

### Step 3: Simplify Hex Component to Overlay-Only
Remove terrain polygon fill, keep:
- Click handler for movement
- Highlight border when valid move target
- Site markers (optional - may be redundant with artwork)
- Enemy count badges
- Player token

### Step 4: Handle Edge Cases
- **Ghost hexes**: Keep current dashed-border style for unexplored areas
- **Move highlighting**: Add semi-transparent overlay or glow border for valid targets
- **Player/enemy tokens**: Keep as SVG elements on top layer

### Step 5: CSS/Styling Cleanup
- Remove `TERRAIN_COLORS` and `SITE_COLORS` constants (no longer needed)
- Adjust hex polygon to be transparent or very low opacity for interactivity
- Add CSS for image rendering quality

## Files to Modify

1. **`packages/client/src/components/GameBoard/HexGrid.tsx`**
   - Add `TileImage` component
   - Modify `Hex` to be an overlay (transparent fill)
   - Update render order (tiles first, then overlays)
   - Add tile dimension constants

2. **`packages/client/src/assets/assetPaths.ts`** (minimal changes)
   - Already has `getTileImageUrl()` - may need minor adjustments

## Estimated Complexity

| Task | Effort |
|------|--------|
| Measure tile dimensions & calculate scaling | Small |
| Create TileImage component | Small |
| Refactor Hex to overlay mode | Small |
| Update render layering in HexGrid | Small |
| Test with various tile types | Small |
| Handle edge cases (exploration, selection) | Medium |

**Total: ~1-2 hours of work**

## Questions / Alternatives

### Alternative: Individual Hex Clipping
Could mask/clip regions from tile images for each hex individually. This would:
- Allow per-hex effects (fog of war, etc.)
- Be more complex (calculate 7 clip regions per tile)
- Potentially have rendering artifacts at hex edges

**Recommendation**: Start with whole-tile approach. Individual hex clipping can be added later if needed.

### Do we need tile rotation?
The tile PNGs appear to be at a fixed orientation. If tiles can be placed rotated in game logic, we'd need CSS transforms.

**Current assumption**: Tiles are placed at their default orientation.

## Ready to Implement

This is a straightforward enhancement that leverages existing infrastructure:
- Tile images ✓
- Tile ID tracking ✓
- Asset path helper ✓
- SVG layering pattern ✓

The main work is calculating the correct dimensions and positioning for tile images to align with the existing hex coordinate system.
