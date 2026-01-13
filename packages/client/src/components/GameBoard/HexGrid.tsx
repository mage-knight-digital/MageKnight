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
import { getTileImageUrl, getEnemyImageUrl, tokenIdToEnemyId } from "../../assets/assetPaths";

const HEX_SIZE = 50; // pixels from center to corner

// Tile image dimensions in SVG units (calculated from hex geometry)
// A 7-hex flower spans ~3 hex widths and ~2.5 hex heights
// Image is 550x529 pixels, we scale to match our hex coordinate system
const TILE_WIDTH = 3 * Math.sqrt(3) * HEX_SIZE;  // ~259.8 SVG units
const TILE_HEIGHT = TILE_WIDTH * (529 / 550);    // Maintain aspect ratio ~249.9

// TODO: Tech debt - this debug feature can be removed once tile alignment is stable.
// Flip to `true` to debug tile corner alignment (shows C/S half-circles at tile vertices).
const SHOW_TILE_CORNER_SYMBOLS = false;

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

interface TileImageProps {
  tileId: string;
  centerCoord: HexCoord;
}

/**
 * Renders a tile artwork image centered on the tile's center hex.
 */
function TileImage({ tileId, centerCoord }: TileImageProps) {
  const { x, y } = hexToPixel(centerCoord);
  const imageUrl = getTileImageUrl(tileId);

  return (
    <image
      href={imageUrl}
      x={x - TILE_WIDTH / 2}
      y={y - TILE_HEIGHT / 2}
      width={TILE_WIDTH}
      height={TILE_HEIGHT}
      preserveAspectRatio="xMidYMid slice"
      style={{ pointerEvents: "none" }}
    />
  );
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

interface HexOverlayProps {
  hex: ClientHexState;
  isPlayerHere: boolean;
  isValidMoveTarget: boolean;
  onClick: () => void;
}

// Enemy token size relative to hex
const ENEMY_TOKEN_SIZE = HEX_SIZE * 0.8;

/**
 * Renders an enemy token image at the specified position, clipped to a circle.
 */
function EnemyToken({ enemyId, offsetX, offsetY, index }: { enemyId: string; offsetX: number; offsetY: number; index: number }) {
  const imageUrl = getEnemyImageUrl(enemyId);
  const clipId = `enemy-clip-${enemyId}-${index}`;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={offsetX} cy={offsetY} r={ENEMY_TOKEN_SIZE / 2} />
        </clipPath>
      </defs>
      <image
        href={imageUrl}
        x={offsetX - ENEMY_TOKEN_SIZE / 2}
        y={offsetY - ENEMY_TOKEN_SIZE / 2}
        width={ENEMY_TOKEN_SIZE}
        height={ENEMY_TOKEN_SIZE}
        clipPath={`url(#${clipId})`}
        style={{ pointerEvents: "none" }}
      />
      {/* Subtle border around the token */}
      <circle
        cx={offsetX}
        cy={offsetY}
        r={ENEMY_TOKEN_SIZE / 2}
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1"
      />
    </g>
  );
}

/**
 * Transparent hex overlay for interactivity on top of tile artwork.
 * Handles click events, move highlighting, and token display.
 */
function HexOverlay({ hex, isPlayerHere, isValidMoveTarget, onClick }: HexOverlayProps) {
  const { x, y } = hexToPixel(hex.coord);

  // Only render actual enemy tokens, not rampaging type markers
  // rampagingEnemies contains category markers ("orc_marauder", "draconum") - not actual enemies
  // enemies contains the real enemy token IDs (e.g., "diggers_1" -> "diggers")
  const allEnemyIds = hex.enemies.map(tokenIdToEnemyId);

  // Position enemies in a grid pattern within the hex
  const getEnemyOffset = (index: number, total: number) => {
    if (total === 1) return { x: 0, y: 0 };
    if (total === 2) return { x: (index - 0.5) * ENEMY_TOKEN_SIZE * 0.8, y: 0 };
    if (total <= 4) {
      const row = Math.floor(index / 2);
      const col = index % 2;
      return {
        x: (col - 0.5) * ENEMY_TOKEN_SIZE * 0.8,
        y: (row - 0.5) * ENEMY_TOKEN_SIZE * 0.7,
      };
    }
    // For 5+ enemies, arrange in a tighter grid
    const cols = 3;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: (col - 1) * ENEMY_TOKEN_SIZE * 0.6,
      y: (row - 0.5) * ENEMY_TOKEN_SIZE * 0.6,
    };
  };

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: isValidMoveTarget ? "pointer" : "default" }}
      data-coord={`${hex.coord.q},${hex.coord.r}`}
    >
      {/* Transparent hex hitbox with optional highlight for valid moves */}
      <polygon
        points={hexPoints(HEX_SIZE * 0.95)}
        fill={isValidMoveTarget ? "rgba(0, 255, 0, 0.2)" : "transparent"}
        stroke={isValidMoveTarget ? "#00FF00" : "transparent"}
        strokeWidth={isValidMoveTarget ? "3" : "0"}
        className="hex-overlay"
      />

      {/* Enemy tokens */}
      {allEnemyIds.map((enemyId, index) => {
        const offset = getEnemyOffset(index, allEnemyIds.length);
        return (
          <EnemyToken
            key={`${enemyId}-${index}`}
            enemyId={enemyId}
            offsetX={offset.x}
            offsetY={offset.y}
            index={index}
          />
        );
      })}

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
      {/* Layer 1: Tile artwork images (background) */}
      {state.map.tiles.map((tile) => (
        <TileImage
          key={`tile-${tile.tileId}-${tile.centerCoord.q},${tile.centerCoord.r}`}
          tileId={tile.tileId}
          centerCoord={tile.centerCoord}
        />
      ))}

      {/* Layer 2: Hex overlays (transparent, for interactivity) */}
      {hexes.map((hex) => (
        <HexOverlay
          key={`hex-${hex.coord.q},${hex.coord.r}`}
          hex={hex}
          isPlayerHere={isPlayerAt(hex.coord)}
          isValidMoveTarget={isValidMoveTarget(hex.coord)}
          onClick={() => handleHexClick(hex.coord)}
        />
      ))}

      {/* Layer 3: Ghost hexes for valid explore directions */}
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

