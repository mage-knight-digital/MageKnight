import {
  MOVE_ACTION,
  EXPLORE_ACTION,
  type HexCoord,
  type HexDirection,
  type ClientHexState,
  type MoveTarget,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

const HEX_SIZE = 50; // pixels from center to corner

// TODO: Tech debt - this debug feature can be removed once tile alignment is stable.
// Flip to `true` to debug tile corner alignment (shows C/S half-circles at tile vertices).
const SHOW_TILE_CORNER_SYMBOLS = false;

// Terrain to color mapping
const TERRAIN_COLORS: Record<string, string> = {
  plains: "#90EE90",
  hills: "#C4A484",
  forest: "#228B22",
  wasteland: "#808080",
  desert: "#F4A460",
  swamp: "#556B2F",
  lake: "#4169E1",
  mountain: "#A0522D",
  ocean: "#000080",
};

// Site type icons/colors
const SITE_COLORS: Record<string, string> = {
  portal: "#FFD700",
  village: "#DEB887",
  monastery: "#8B4513",
  keep: "#696969",
  mage_tower: "#9370DB",
  dungeon: "#2F4F4F",
  tomb: "#1C1C1C",
  monster_den: "#8B0000",
  spawning_grounds: "#006400",
  ancient_ruins: "#4B0082",
  mine: "#CD853F",
  city: "#FFD700",
};

// Mine crystal colors (matches mana colors)
const MINE_CRYSTAL_COLORS: Record<string, string> = {
  red: "#DC143C",
  blue: "#4169E1",
  green: "#228B22",
  white: "#F5F5F5",
};

function hexToPixel(coord: HexCoord): { x: number; y: number } {
  // Axial to pixel conversion (pointy-top hexes)
  const x = HEX_SIZE * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r);
  const y = HEX_SIZE * ((3 / 2) * coord.r);
  return { x, y };
}

function hexPoints(size: number): string {
  // Generate SVG polygon points for pointy-topped hex
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6; // Start from top
      return `${size * Math.cos(angle)},${size * Math.sin(angle)}`;
    })
    .join(" ");
}

/**
 * TODO: Tech debt - delete getTileCornerPositions and TileCornerSymbols once tile alignment is stable.
 *
 * Get the 6 corner positions for a tile's flower pattern.
 *
 * Starting from the W (left) hex's SW vertex and going clockwise:
 *   Corner 0: W hex, SW vertex -> Star
 *   Corner 1: W hex, NW vertex -> Circle
 *   Corner 2: NW hex, top vertex -> Star
 *   Corner 3: NE hex, top vertex -> Circle
 *   Corner 4: E hex, NE vertex -> Star
 *   Corner 5: E hex, SE vertex -> Circle
 *   (continues to SE hex, SW hex...)
 *
 * Each outer hex contributes its outward-facing vertex to the tile boundary.
 */
function getTileCornerPositions(tileCenter: HexCoord): { x: number; y: number; symbol: string }[] {
  const corners: { x: number; y: number; symbol: string }[] = [];

  // Define each corner by: which outer hex it's on, and which vertex of that hex
  // Outer hex offsets: W(-1,0), NW(0,-1), NE(1,-1), E(1,0), SE(0,1), SW(-1,1)
  // Vertex angles for pointy-top hex (from hex center):
  //   top=-90°, top-right=-30°, bottom-right=30°, bottom=90°, bottom-left=150°, top-left=-150°(210°)

  // 6 tile corners, each defined by which outer hex and which vertex
  // Going clockwise from W hex's SW corner (per second agent's analysis):
  //   W hex: 150° (bottom-left) -> Star - SW corner of tile
  //   NW hex: -90°/270° (top) -> Circle - North corner of tile
  //   NE hex: -30°/330° (top-right) -> Star - NE corner of tile
  //   E hex: 30° (bottom-right) -> Circle - SE corner of tile
  //   SE hex: 90° (bottom) -> Star - South corner of tile
  //   SW hex: 210° (top-left) -> Circle - NW corner of tile

  // Verified vertex angles for our pointy-top hexes:
  //   North (top): 270°
  //   NE (top-right): -30°
  //   SE (bottom-right): 30°
  //   South (bottom): 90°
  //   SW (bottom-left): 150°
  //   NW (top-left): 210°

  // Corner 1: W hex's SW vertex (150°) - Star
  const wHexCenter = hexToPixel({
    q: tileCenter.q + (-1),  // W hex
    r: tileCenter.r + 0
  });
  corners.push({
    x: wHexCenter.x + HEX_SIZE * Math.cos((150 * Math.PI) / 180),
    y: wHexCenter.y + HEX_SIZE * Math.sin((150 * Math.PI) / 180),
    symbol: "S",
  });

  // Corner 2: NW hex's NW vertex (210°) - Circle
  const nwHexCenter = hexToPixel({
    q: tileCenter.q + 0,   // NW hex
    r: tileCenter.r + (-1)
  });
  corners.push({
    x: nwHexCenter.x + HEX_SIZE * Math.cos((210 * Math.PI) / 180),
    y: nwHexCenter.y + HEX_SIZE * Math.sin((210 * Math.PI) / 180),
    symbol: "C",
  });

  // Corner 3: NE hex's North vertex (270°) - Star
  const neHexCenter = hexToPixel({
    q: tileCenter.q + 1,   // NE hex
    r: tileCenter.r + (-1)
  });
  corners.push({
    x: neHexCenter.x + HEX_SIZE * Math.cos((270 * Math.PI) / 180),
    y: neHexCenter.y + HEX_SIZE * Math.sin((270 * Math.PI) / 180),
    symbol: "S",
  });

  // Corner 4: E hex's NE vertex (-30°) - Circle
  const eHexCenter = hexToPixel({
    q: tileCenter.q + 1,   // E hex
    r: tileCenter.r + 0
  });
  corners.push({
    x: eHexCenter.x + HEX_SIZE * Math.cos((-30 * Math.PI) / 180),
    y: eHexCenter.y + HEX_SIZE * Math.sin((-30 * Math.PI) / 180),
    symbol: "C",
  });

  // Corner 5: SE hex's SE vertex (30°) - Star
  const seHexCenter = hexToPixel({
    q: tileCenter.q + 0,   // SE hex
    r: tileCenter.r + 1
  });
  corners.push({
    x: seHexCenter.x + HEX_SIZE * Math.cos((30 * Math.PI) / 180),
    y: seHexCenter.y + HEX_SIZE * Math.sin((30 * Math.PI) / 180),
    symbol: "S",
  });

  // Corner 6: SW hex's South vertex (90°) - Circle
  const swHexCenter = hexToPixel({
    q: tileCenter.q + (-1),   // SW hex
    r: tileCenter.r + 1
  });
  corners.push({
    x: swHexCenter.x + HEX_SIZE * Math.cos((90 * Math.PI) / 180),
    y: swHexCenter.y + HEX_SIZE * Math.sin((90 * Math.PI) / 180),
    symbol: "C",
  });

  return corners;
}

interface TileCornerSymbolsProps {
  tileCenter: HexCoord;
  tileId: string;
}

/**
 * Debug overlay showing C/S corner symbols for a tile.
 * Shows smaller half-circles to simulate the half-symbols on physical tiles.
 * When tiles are correctly aligned, adjacent halves should overlap.
 */
function TileCornerSymbols({ tileCenter, tileId }: TileCornerSymbolsProps) {
  const corners = getTileCornerPositions(tileCenter);
  const centerPixel = hexToPixel(tileCenter);

  return (
    <g className="tile-corner-symbols">
      {/* Tile ID label at center */}
      <text
        x={centerPixel.x}
        y={centerPixel.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFF"
        fontSize="10"
        fontWeight="bold"
        stroke="#000"
        strokeWidth="0.5"
        style={{ pointerEvents: "none" }}
      >
        {tileId}
      </text>
      {corners.map((corner, i) => {
        // Calculate angle from tile center to this corner (for half-circle orientation)
        const dx = corner.x - centerPixel.x;
        const dy = corner.y - centerPixel.y;
        const angleToCenter = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <g key={i} transform={`translate(${corner.x},${corner.y})`}>
            {/* Half-circle facing inward toward tile center (where adjacent tile connects) */}
            <g transform={`rotate(${angleToCenter - 90})`}>
              <path
                d="M -8 0 A 8 8 0 0 1 8 0 Z"
                fill={corner.symbol === "C" ? "#8B4513" : "#FFD700"}
                stroke="#000"
                strokeWidth="1"
                opacity="0.9"
              />
            </g>
            {/* Symbol letter */}
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill={corner.symbol === "C" ? "#FFF" : "#000"}
              fontSize="8"
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {corner.symbol}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface ExploreTarget {
  coord: HexCoord;
  direction: HexDirection;
  fromTileCoord: HexCoord;
}

interface GhostHexProps {
  coord: HexCoord;
  onClick: () => void;
}

/**
 * Ghost hex rendered beyond the map edge to show explore options
 */
function GhostHex({ coord, onClick }: GhostHexProps) {
  const { x, y } = hexToPixel(coord);

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      data-coord={`${coord.q},${coord.r}`}
      data-type="explore"
    >
      {/* Dashed border hex background */}
      <polygon
        points={hexPoints(HEX_SIZE * 0.95)}
        fill="rgba(100, 149, 237, 0.2)"
        stroke="#4169E1"
        strokeWidth="2"
        strokeDasharray="8,4"
        className="ghost-hex-polygon"
      />

      {/* Question mark icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#4169E1"
        fontSize="24"
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        ?
      </text>

      {/* "Explore" label */}
      <text
        y={HEX_SIZE * 0.4}
        textAnchor="middle"
        fill="#4169E1"
        fontSize="10"
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        EXPLORE
      </text>

      {/* Coordinates for debugging */}
      <text
        y={HEX_SIZE * 0.7}
        textAnchor="middle"
        fill="#4169E1"
        fontSize="8"
        style={{ pointerEvents: "none" }}
      >
        ({coord.q},{coord.r})
      </text>
    </g>
  );
}

interface HexProps {
  hex: ClientHexState;
  isPlayerHere: boolean;
  isValidMoveTarget: boolean;
  onClick: () => void;
}

function Hex({ hex, isPlayerHere, isValidMoveTarget, onClick }: HexProps) {
  const { x, y } = hexToPixel(hex.coord);
  const terrainColor = TERRAIN_COLORS[hex.terrain] ?? "#666";
  const siteColor = hex.site ? SITE_COLORS[hex.site.type] ?? "#FFF" : null;

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: isValidMoveTarget ? "pointer" : "default" }}
      data-coord={`${hex.coord.q},${hex.coord.r}`}
    >
      {/* Hex background */}
      <polygon
        points={hexPoints(HEX_SIZE * 0.95)}
        fill={terrainColor}
        stroke={isValidMoveTarget ? "#00FF00" : "#333"}
        strokeWidth={isValidMoveTarget ? "3" : "1"}
        className="hex-polygon"
      />

      {/* Site marker */}
      {siteColor && (
        <circle r={HEX_SIZE * 0.3} fill={siteColor} stroke="#000" strokeWidth="1" />
      )}

      {/* Mine crystal color indicator */}
      {hex.site?.type === "mine" && hex.site.mineColor && (
        <g>
          {/* Crystal shape (hexagon) */}
          <polygon
            points={hexPoints(HEX_SIZE * 0.15)}
            fill={MINE_CRYSTAL_COLORS[hex.site.mineColor] ?? "#888"}
            stroke="#000"
            strokeWidth="1"
            transform={`translate(0, ${HEX_SIZE * 0.25})`}
          />
        </g>
      )}

      {/* Player token */}
      {isPlayerHere && (
        <circle
          r={HEX_SIZE * 0.25}
          fill="#FF4444"
          stroke="#FFF"
          strokeWidth="2"
          className="hero-token"
        />
      )}

      {/* Enemy indicators */}
      {hex.enemies.length > 0 && (
        <text
          y={HEX_SIZE * 0.5}
          textAnchor="middle"
          fill="#FF0000"
          fontSize="12"
          fontWeight="bold"
        >
          {hex.enemies.length}E
        </text>
      )}

      {/* Terrain label */}
      <text
        y={-HEX_SIZE * 0.5}
        textAnchor="middle"
        fill="#000"
        fontSize="8"
        opacity="0.7"
      >
        {hex.terrain.slice(0, 3)}
      </text>

      {/* Site label */}
      {hex.site && (
        <text y={HEX_SIZE * 0.1} textAnchor="middle" fill="#000" fontSize="8">
          {hex.site.type.slice(0, 4)}
        </text>
      )}
    </g>
  );
}

export function HexGrid() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  if (!state) return null;

  const hexes = Object.values(state.map.hexes);

  // Get valid move targets from server-computed validActions
  const validMoveTargets: readonly MoveTarget[] = state.validActions.move?.targets ?? [];

  // Get valid explore directions from server-computed validActions
  // Server now provides exact target coordinates and fromTileCoord for each explore direction
  const exploreTargets: ExploreTarget[] = [];
  if (state.validActions.explore) {
    for (const exploreDir of state.validActions.explore.directions) {
      // Use the server-provided target coordinate and fromTileCoord
      exploreTargets.push({
        coord: exploreDir.targetCoord,
        direction: exploreDir.direction,
        fromTileCoord: exploreDir.fromTileCoord,
      });
    }
  }

  // Calculate viewBox based on hex positions (including ghost hexes for explore)
  const allPositions = [
    ...hexes.map((h) => hexToPixel(h.coord)),
    ...exploreTargets.map((t) => hexToPixel(t.coord)),
  ];
  const minX = Math.min(...allPositions.map((p) => p.x)) - HEX_SIZE * 2;
  const maxX = Math.max(...allPositions.map((p) => p.x)) + HEX_SIZE * 2;
  const minY = Math.min(...allPositions.map((p) => p.y)) - HEX_SIZE * 2;
  const maxY = Math.max(...allPositions.map((p) => p.y)) + HEX_SIZE * 2;

  const handleHexClick = (coord: HexCoord) => {
    // Only send move action if it's a valid target
    const isValidTarget = validMoveTargets.some(
      (t) => t.hex.q === coord.q && t.hex.r === coord.r
    );
    if (isValidTarget) {
      sendAction({
        type: MOVE_ACTION,
        target: coord,
      });
    }
  };

  const handleExploreClick = (target: ExploreTarget) => {
    console.log(`[EXPLORE] Clicking ghost at (${target.coord.q},${target.coord.r}), sending direction: ${target.direction}, fromTile: (${target.fromTileCoord.q},${target.fromTileCoord.r})`);
    sendAction({
      type: EXPLORE_ACTION,
      direction: target.direction,
      fromTileCoord: target.fromTileCoord,
    });
  };

  const isPlayerAt = (coord: HexCoord) =>
    player?.position?.q === coord.q && player?.position?.r === coord.r;

  // Check if a hex is a valid move target
  const isValidMoveTarget = (coord: HexCoord) =>
    validMoveTargets.some((t) => t.hex.q === coord.q && t.hex.r === coord.r);

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="hex-grid"
      style={{ width: "100%", height: "100%" }}
      data-testid="hex-grid"
    >
      {/* Render regular hexes */}
      {hexes.map((hex) => (
        <Hex
          key={`${hex.coord.q},${hex.coord.r}`}
          hex={hex}
          isPlayerHere={isPlayerAt(hex.coord)}
          isValidMoveTarget={isValidMoveTarget(hex.coord)}
          onClick={() => handleHexClick(hex.coord)}
        />
      ))}

      {/* Render ghost hexes for valid explore directions */}
      {exploreTargets.map((target) => (
        <GhostHex
          key={`explore-${target.coord.q},${target.coord.r}`}
          coord={target.coord}
          onClick={() => handleExploreClick(target)}
        />
      ))}

      {/* Debug: Render tile corner symbols (C/S) and tile IDs */}
      {SHOW_TILE_CORNER_SYMBOLS &&
        state.map.tiles.map((tile) => (
          <TileCornerSymbols
            key={`corners-${tile.centerCoord.q},${tile.centerCoord.r}`}
            tileCenter={tile.centerCoord}
            tileId={tile.tileId}
          />
        ))}
    </svg>
  );
}

