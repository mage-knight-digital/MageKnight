import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  MOVE_ACTION,
  EXPLORE_ACTION,
  type HexCoord,
  type HexDirection,
  type ClientHexState,
  type ClientHexEnemy,
  type MoveTarget,
  type ReachableHex,
  hexKey,
  getAllNeighbors,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro } from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import { getTileImageUrl, getEnemyImageUrl, getEnemyTokenBackUrl, tokenIdToEnemyId, type EnemyTokenColor } from "../../assets/assetPaths";

const HEX_SIZE = 50; // pixels from center to corner

// Tile image dimensions in SVG units (calculated from hex geometry)
// A 7-hex flower spans ~3 hex widths and ~2.5 hex heights
// Image is 550x529 pixels, we scale to match our hex coordinate system
const TILE_WIDTH = 3 * Math.sqrt(3) * HEX_SIZE;  // ~259.8 SVG units
const TILE_HEIGHT = TILE_WIDTH * (529 / 550);    // Maintain aspect ratio ~249.9

// TODO: Tech debt - this debug feature can be removed once tile alignment is stable.
// Flip to `true` to debug tile corner alignment (shows C/S half-circles at tile vertices).
const SHOW_TILE_CORNER_SYMBOLS = false;

// Animation timing constants
const TILE_REVEAL_DURATION_MS = 600;
const GHOST_ANTICIPATION_DURATION_MS = 300;
const ENEMY_REVEAL_BASE_DELAY_MS = 400;
const ENEMY_REVEAL_STAGGER_MS = 80;

// CSS animation names - must match keyframe names in HexGrid.css
const TILE_CASCADE_ANIMATION = "tile-cascade";
const ENEMY_FLIP_ANIMATION = "enemy-token-flip";

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
 * Simple A* pathfinding for path preview visualization.
 * Uses the reachable hexes data from the server to find optimal path.
 *
 * Terminal hexes (combat triggers, including rampaging skirt) are treated as
 * "can path TO but not THROUGH" - they're valid destinations but not waypoints.
 */
function findPath(
  start: HexCoord,
  end: HexCoord,
  reachableHexes: readonly ReachableHex[],
  adjacentTargets: readonly MoveTarget[]
): HexCoord[] {
  // Build lookup maps for costs and terminal status
  const reachableMap = new Map<string, { cost: number; isTerminal: boolean }>();
  for (const r of reachableHexes) {
    reachableMap.set(hexKey(r.hex), { cost: r.totalCost, isTerminal: r.isTerminal });
  }
  // Adjacent targets now include isTerminal flag from server
  for (const t of adjacentTargets) {
    reachableMap.set(hexKey(t.hex), { cost: t.cost, isTerminal: t.isTerminal ?? false });
  }

  const endKey = hexKey(end);
  if (!reachableMap.has(endKey)) {
    return []; // Not reachable
  }

  // A* search from start to end
  type Node = { f: number; g: number; coord: HexCoord; path: HexCoord[] };

  const heuristic = (a: HexCoord, b: HexCoord): number => {
    // Hex distance heuristic
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  };

  const startKey = hexKey(start);
  const openSet: Node[] = [{ f: heuristic(start, end), g: 0, coord: start, path: [start] }];
  const visited = new Set<string>();

  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    if (!current) break;

    const currentKey = hexKey(current.coord);

    // Found the goal
    if (currentKey === endKey) {
      return current.path;
    }

    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    // Don't expand from terminal hexes (can't path THROUGH them, only TO them)
    // Exception: we can always expand from start position
    if (currentKey !== startKey) {
      const currentData = reachableMap.get(currentKey);
      if (currentData?.isTerminal) {
        continue; // Terminal hex - don't explore neighbors
      }
    }

    // Explore neighbors
    const neighbors = getAllNeighbors(current.coord);
    for (const neighbor of neighbors) {
      const neighborKey = hexKey(neighbor);
      if (visited.has(neighborKey)) continue;

      // Check if neighbor is reachable (either in reachableMap or is the start)
      const neighborData = reachableMap.get(neighborKey);
      if (neighborKey !== startKey && !neighborData) continue;

      // Get the cost to reach this neighbor
      const neighborTotalCost = neighborData?.cost ?? 0;
      const currentTotalCost = currentKey === startKey ? 0 : (reachableMap.get(currentKey)?.cost ?? 0);

      // Edge cost is approximately the difference (this is a simplification)
      const edgeCost = Math.max(1, neighborTotalCost - currentTotalCost);
      const gScore = current.g + edgeCost;
      const fScore = gScore + heuristic(neighbor, end);

      openSet.push({
        f: fScore,
        g: gScore,
        coord: neighbor,
        path: [...current.path, neighbor],
      });
    }
  }

  return []; // No path found
}

/**
 * Renders a path line between hexes for movement preview.
 */
function PathLine({ path, isTerminal, wouldRevealEnemies }: { path: HexCoord[]; isTerminal: boolean; wouldRevealEnemies?: boolean }) {
  if (path.length < 2) return null;

  const points = path.map((coord) => {
    const { x, y } = hexToPixel(coord);
    return `${x},${y}`;
  }).join(" ");

  // Path line color based on destination state
  let color = "#00FF00"; // Default: safe (green)
  if (wouldRevealEnemies) {
    color = "#FF0096"; // Info-revealing (red/purple)
  } else if (isTerminal) {
    color = "#FFA500"; // Unsafe but reversible (orange)
  }

  return (
    <g className="path-line" style={{ pointerEvents: "none" }}>
      {/* Outer glow/stroke for visibility */}
      <polyline
        points={points}
        fill="none"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main path line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Animated dashes for direction */}
      <polyline
        points={points}
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8,12"
        style={{
          animation: "pathFlow 1s linear infinite",
        }}
      />
      {/* Arrow at the end */}
      {path.length >= 2 && <PathArrow path={path} color={color} />}
    </g>
  );
}

/**
 * Renders an arrow at the end of the path.
 */
function PathArrow({ path, color }: { path: HexCoord[]; color: string }) {
  if (path.length < 2) return null;

  const lastIdx = path.length - 1;
  const endCoord = path[lastIdx];
  const prevCoord = path[lastIdx - 1];
  if (!endCoord || !prevCoord) return null;

  const end = hexToPixel(endCoord);
  const prev = hexToPixel(prevCoord);

  // Calculate angle from prev to end
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x) * (180 / Math.PI);

  // Arrow size
  const size = 12;

  return (
    <g transform={`translate(${end.x},${end.y}) rotate(${angle})`}>
      <polygon
        points={`0,0 ${-size},${ size / 2} ${-size},${-size / 2}`}
        fill={color}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="1"
      />
    </g>
  );
}

interface TileImageProps {
  tileId: string;
  centerCoord: HexCoord;
  isRevealing?: boolean;
  /** For intro sequence: staggered delay in seconds */
  introDelay?: number;
  /** Callback when intro animation ends */
  onIntroAnimationEnd?: () => void;
}

/**
 * Renders a tile artwork image centered on the tile's center hex.
 * Supports reveal animation when isRevealing is true.
 * Supports intro cascade animation with introDelay.
 */
function TileImage({ tileId, centerCoord, isRevealing, introDelay, onIntroAnimationEnd }: TileImageProps) {
  const { x, y } = hexToPixel(centerCoord);
  const imageUrl = getTileImageUrl(tileId);

  // Determine which animation class to use
  let className = "";
  if (isRevealing) {
    className = "tile-image--revealing";
  } else if (introDelay !== undefined) {
    className = "tile-image--intro";
  }

  // Handle animation end - only fire for intro animations
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    // Only handle the tile-cascade animation (not other animations that might bubble)
    if (e.animationName === TILE_CASCADE_ANIMATION && onIntroAnimationEnd) {
      onIntroAnimationEnd();
    }
  }, [onIntroAnimationEnd]);

  return (
    <g
      className={className}
      style={{
        transformOrigin: `${x}px ${y}px`,
        "--intro-delay": introDelay !== undefined ? `${introDelay}s` : undefined,
      } as React.CSSProperties}
      onAnimationEnd={introDelay !== undefined ? handleAnimationEnd : undefined}
    >
      <image
        href={imageUrl}
        x={x - TILE_WIDTH / 2}
        y={y - TILE_HEIGHT / 2}
        width={TILE_WIDTH}
        height={TILE_HEIGHT}
        preserveAspectRatio="xMidYMid slice"
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}

/**
 * Particle burst effect for tile reveals.
 * Creates sparkles emanating from the center of a newly revealed tile.
 */
function RevealParticles({ centerCoord }: { centerCoord: HexCoord }) {
  const { x, y } = hexToPixel(centerCoord);

  // Generate 12 particles in a radial pattern
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const particleX = Math.cos(angle) * distance;
      const particleY = Math.sin(angle) * distance;
      const delay = Math.random() * 0.15;
      const size = 3 + Math.random() * 4;

      return { id: i, x: particleX, y: particleY, delay, size };
    });
  }, []);

  return (
    <g style={{ pointerEvents: "none" }}>
      {particles.map((p) => (
        <circle
          key={p.id}
          cx={x}
          cy={y}
          r={p.size}
          fill="rgba(255, 220, 150, 0.9)"
          className="reveal-particle"
          style={{
            "--particle-x": `${p.x}px`,
            "--particle-y": `${p.y}px`,
            "--particle-delay": `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

/**
 * Light bloom effect - a radial glow that expands from tile center.
 */
function TileBloom({ centerCoord }: { centerCoord: HexCoord }) {
  const { x, y } = hexToPixel(centerCoord);

  return (
    <circle
      cx={x}
      cy={y}
      r={TILE_WIDTH / 3}
      fill="url(#bloomGradient)"
      className="tile-bloom"
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
  isClicking?: boolean;
}

/**
 * Ghost hex rendered beyond the map edge to show explore options.
 * Includes anticipation animation when clicked.
 */
function GhostHex({ coord, onClick, isClicking }: GhostHexProps) {
  const { x, y } = hexToPixel(coord);

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: isClicking ? "wait" : "pointer" }}
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
        className={`ghost-hex-polygon ${isClicking ? "ghost-hex-polygon--clicking" : ""}`}
      />

      {/* Question mark icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#4169E1"
        fontSize="24"
        fontWeight="bold"
        style={{
          pointerEvents: "none",
          opacity: isClicking ? 0 : 1,
          transition: "opacity 0.15s ease-out",
        }}
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
        style={{
          pointerEvents: "none",
          opacity: isClicking ? 0 : 1,
          transition: "opacity 0.15s ease-out",
        }}
      >
        EXPLORE
      </text>

      {/* Coordinates for debugging */}
      <text
        y={HEX_SIZE * 0.7}
        textAnchor="middle"
        fill="#4169E1"
        fontSize="8"
        style={{
          pointerEvents: "none",
          opacity: isClicking ? 0 : 1,
          transition: "opacity 0.15s ease-out",
        }}
      >
        ({coord.q},{coord.r})
      </text>
    </g>
  );
}

type MoveHighlight =
  | { type: "none" }
  | { type: "adjacent"; cost: number }      // Can move here in one step
  | { type: "reachable"; cost: number }     // Can reach via multi-hop
  | { type: "terminal"; cost: number };     // Reachable but triggers combat

interface HexOverlayProps {
  hex: ClientHexState;
  moveHighlight: MoveHighlight;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isRevealing?: boolean;
  /** For intro sequence: get intro delay for enemy at global index */
  getEnemyIntroDelay?: (globalIndex: number) => number;
  /** For intro sequence: starting index for enemies on this hex */
  enemyStartIndex?: number;
  /** Hide enemies during intro (before enemies phase) */
  hideEnemiesDuringIntro?: boolean;
  /** Callback when an enemy intro animation ends */
  onEnemyIntroAnimationEnd?: () => void;
}

// Enemy token size relative to hex
const ENEMY_TOKEN_SIZE = HEX_SIZE * 0.8;

interface EnemyTokenProps {
  enemy: ClientHexEnemy;
  offsetX: number;
  offsetY: number;
  index: number;
  isRevealing?: boolean;
  revealDelay?: number;
  /** For intro sequence: staggered delay in seconds */
  introDelay?: number;
  /** Hide during intro (before enemies phase) */
  hiddenDuringIntro?: boolean;
  /** Callback when intro animation ends */
  onIntroAnimationEnd?: () => void;
}

/**
 * Renders an enemy token image at the specified position, clipped to a circle.
 * Shows the enemy face when revealed, or the token back (by color) when unrevealed.
 * Supports staggered reveal animation when tiles are explored.
 * Supports intro flip animation with introDelay.
 */
function EnemyToken({ enemy, offsetX, offsetY, index, isRevealing, revealDelay = 0, introDelay, hiddenDuringIntro, onIntroAnimationEnd }: EnemyTokenProps) {
  // Get the appropriate image URL based on reveal status
  let imageUrl: string;
  let tokenKey: string;

  if (enemy.isRevealed && enemy.tokenId) {
    // Revealed: show the enemy face
    const enemyId = tokenIdToEnemyId(enemy.tokenId);
    imageUrl = getEnemyImageUrl(enemyId);
    tokenKey = enemy.tokenId;
  } else {
    // Unrevealed: show the token back based on color
    // Map shared EnemyColor to client EnemyTokenColor (handle "gray" vs "grey" spelling)
    const tokenColor = (enemy.color === "gray" ? "grey" : enemy.color) as EnemyTokenColor;
    imageUrl = getEnemyTokenBackUrl(tokenColor);
    tokenKey = `unrevealed-${enemy.color}-${index}`;
  }

  const clipId = `enemy-clip-${tokenKey}-${index}`;

  // Determine which animation class to use
  let className = "";
  if (hiddenDuringIntro) {
    className = "enemy-token--hidden";
  } else if (isRevealing) {
    className = "enemy-token--revealing";
  } else if (introDelay !== undefined) {
    className = "enemy-token--intro";
  }

  // Handle animation end - only fire for intro animations
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    // Only handle the enemy-token-flip animation (not other animations that might bubble)
    if (e.animationName === ENEMY_FLIP_ANIMATION && onIntroAnimationEnd) {
      onIntroAnimationEnd();
    }
  }, [onIntroAnimationEnd]);

  return (
    <g
      className={className}
      style={{
        "--enemy-reveal-delay": `${revealDelay}s`,
        "--intro-delay": introDelay !== undefined ? `${introDelay}s` : undefined,
        transformOrigin: `${offsetX}px ${offsetY}px`,
      } as React.CSSProperties}
      onAnimationEnd={introDelay !== undefined ? handleAnimationEnd : undefined}
    >
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
 * Get visual styles for movement highlight based on type.
 */
function getMoveHighlightStyles(highlight: MoveHighlight): {
  fill: string;
  stroke: string;
  strokeWidth: string;
  strokeDasharray?: string;
} {
  switch (highlight.type) {
    case "adjacent":
      // Solid green - can move here immediately (safe)
      return {
        fill: "rgba(0, 255, 0, 0.25)",
        stroke: "#00FF00",
        strokeWidth: "3",
      };
    case "reachable":
      // Dashed green - can reach via multi-hop (safe)
      return {
        fill: "rgba(0, 255, 0, 0.12)",
        stroke: "#00CC00",
        strokeWidth: "2",
        strokeDasharray: "6,3",
      };
    case "terminal":
      // Amber/orange - reachable but triggers combat (unsafe but reversible)
      return {
        fill: "rgba(255, 165, 0, 0.2)",
        stroke: "#FFA500",
        strokeWidth: "2",
        strokeDasharray: "6,3",
      };
    case "none":
    default:
      return {
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: "0",
      };
  }
}

/**
 * Transparent hex overlay for interactivity on top of tile artwork.
 * Handles click events, move highlighting, and token display.
 * Supports reveal animation when the parent tile is being revealed.
 */
function HexOverlay({ hex, moveHighlight, onClick, onMouseEnter, onMouseLeave, isRevealing, getEnemyIntroDelay, enemyStartIndex = 0, hideEnemiesDuringIntro, onEnemyIntroAnimationEnd }: HexOverlayProps) {
  const { x, y } = hexToPixel(hex.coord);

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

  const isClickable = moveHighlight.type !== "none";
  const styles = getMoveHighlightStyles(moveHighlight);
  const showCost = moveHighlight.type !== "none";

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: isClickable ? "pointer" : "default" }}
      data-coord={`${hex.coord.q},${hex.coord.r}`}
      className={isRevealing ? "hex-overlay--revealing" : ""}
    >
      {/* Transparent hex hitbox with movement highlight */}
      <polygon
        points={hexPoints(HEX_SIZE * 0.95)}
        fill={styles.fill}
        stroke={styles.stroke}
        strokeWidth={styles.strokeWidth}
        strokeDasharray={styles.strokeDasharray}
        className="hex-overlay"
      />

      {/* Movement cost badge */}
      {showCost && (
        <g transform={`translate(${HEX_SIZE * 0.55}, ${-HEX_SIZE * 0.55})`}>
          <circle
            r={12}
            fill={moveHighlight.type === "terminal" ? "#FFA500" : "#00AA00"}
            stroke="#FFF"
            strokeWidth="1.5"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFF"
            fontSize="11"
            fontWeight="bold"
            style={{ pointerEvents: "none" }}
          >
            {moveHighlight.cost}
          </text>
        </g>
      )}

      {/* Enemy tokens - now with visibility support and reveal animation */}
      {hex.enemies.map((enemy, index) => {
        const offset = getEnemyOffset(index, hex.enemies.length);
        // Create a unique key - use tokenId if revealed, otherwise color+index
        const key = enemy.isRevealed && enemy.tokenId
          ? `${enemy.tokenId}-${index}`
          : `${enemy.color}-unrevealed-${index}`;

        // Stagger enemy reveals when tile is revealing
        const enemyRevealDelay = isRevealing
          ? (ENEMY_REVEAL_BASE_DELAY_MS + index * ENEMY_REVEAL_STAGGER_MS) / 1000
          : 0;

        // Get intro delay for this enemy (global index = starting index + local index)
        const introDelay = getEnemyIntroDelay
          ? getEnemyIntroDelay(enemyStartIndex + index) / 1000
          : undefined;

        return (
          <EnemyToken
            key={key}
            enemy={enemy}
            offsetX={offset.x}
            offsetY={offset.y}
            index={index}
            isRevealing={isRevealing}
            revealDelay={enemyRevealDelay}
            introDelay={introDelay}
            hiddenDuringIntro={hideEnemiesDuringIntro}
            onIntroAnimationEnd={onEnemyIntroAnimationEnd}
          />
        );
      })}

    </g>
  );
}

// Animation constants
const HOP_DURATION_MS = 200; // Time per hex hop
const HOP_SCALE_PEAK = 1.15; // Scale at peak of hop

/**
 * Animated hero token that hops between hexes.
 * Uses CSS transitions for smooth movement with a slight scale "bounce" effect.
 */
function AnimatedHeroToken({
  startPosition,
  targetPosition,
  restPosition,
  onAnimationComplete,
}: {
  startPosition: { x: number; y: number } | null; // Where we're animating FROM
  targetPosition: { x: number; y: number } | null; // Where we're animating TO
  restPosition: { x: number; y: number }; // Where to be when not animating (player's actual position)
  onAnimationComplete: () => void;
}) {
  const [currentPos, setCurrentPos] = useState(restPosition);
  const [scale, setScale] = useState(1);
  const animatingRef = useRef(false);

  // When target changes, animate to it
  useEffect(() => {
    if (!targetPosition || !startPosition || animatingRef.current) return;

    // Start from the start position
    setCurrentPos(startPosition);
    animatingRef.current = true;

    // Start hop - scale up
    setScale(HOP_SCALE_PEAK);

    // Move to target after brief delay (anticipation)
    const moveTimeout = setTimeout(() => {
      setCurrentPos(targetPosition);
    }, 30);

    // Scale back down at end of hop
    const scaleTimeout = setTimeout(() => {
      setScale(1);
    }, HOP_DURATION_MS * 0.6);

    // Signal completion
    const completeTimeout = setTimeout(() => {
      animatingRef.current = false;
      onAnimationComplete();
    }, HOP_DURATION_MS);

    return () => {
      clearTimeout(moveTimeout);
      clearTimeout(scaleTimeout);
      clearTimeout(completeTimeout);
    };
  }, [targetPosition, startPosition, onAnimationComplete]);

  // Sync to rest position when not animating
  useEffect(() => {
    if (!animatingRef.current && !targetPosition) {
      setCurrentPos(restPosition);
    }
  }, [restPosition, targetPosition]);

  return (
    <g
      transform={`translate(${currentPos.x},${currentPos.y})`}
      style={{
        transition: `transform ${HOP_DURATION_MS}ms ease-in-out`,
      }}
    >
      <circle
        r={HEX_SIZE * 0.25}
        fill="#FF4444"
        stroke="#FFF"
        strokeWidth="2"
        className="hero-token"
        style={{
          transform: `scale(${scale})`,
          transition: `transform ${HOP_DURATION_MS * 0.4}ms ease-out`,
        }}
      />
    </g>
  );
}

export function HexGrid() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { phase: introPhase, startIntro, getTileDelay, getEnemyDelay } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();

  // Track which hex is being hovered for path preview
  const [hoveredHex, setHoveredHex] = useState<HexCoord | null>(null);

  // Animation state for hero movement
  // Queue of hex coordinates we're animating through (the full path)
  const animationPath = useRef<HexCoord[]>([]);
  // Current index in the animation path (which hex we're moving TO)
  const animationIndex = useRef<number>(0);
  // Whether we're currently animating
  const [isAnimating, setIsAnimating] = useState(false);
  // The position we're currently animating FROM (pixel coords)
  const [animationStart, setAnimationStart] = useState<{ x: number; y: number } | null>(null);
  // The position we're currently animating TO (pixel coords)
  const [animationTarget, setAnimationTarget] = useState<{ x: number; y: number } | null>(null);

  // ============================================
  // Tile Reveal Animation State
  // ============================================
  // Track known tile keys to detect newly revealed tiles
  const knownTileKeys = useRef<Set<string>>(new Set());
  // Whether we've done the initial tile population (to skip animation on first load)
  const hasInitializedTiles = useRef(false);
  // Tiles currently animating their reveal
  const [revealingTiles, setRevealingTiles] = useState<Set<string>>(new Set());
  // Track which ghost hex is being clicked (for anticipation animation)
  const [clickingExploreCoord, setClickingExploreCoord] = useState<string | null>(null);

  // ============================================
  // Intro Animation Completion Tracking
  // ============================================
  // Consolidated tracking for intro animation completion
  const introTrackingRef = useRef({
    tileCount: 0,
    tileCompleted: 0,
    enemyCount: 0,
    enemyCompleted: 0,
    tilesEmitted: false,
    enemiesEmitted: false,
  });

  // Callback when a tile's intro animation completes
  const handleTileIntroAnimationEnd = useCallback(() => {
    const tracking = introTrackingRef.current;
    tracking.tileCompleted += 1;
    if (
      tracking.tileCompleted >= tracking.tileCount &&
      tracking.tileCount > 0 &&
      !tracking.tilesEmitted
    ) {
      tracking.tilesEmitted = true;
      emitAnimationEvent("tiles-complete");
    }
  }, [emitAnimationEvent]);

  // Callback when an enemy's intro animation completes
  const handleEnemyIntroAnimationEnd = useCallback(() => {
    const tracking = introTrackingRef.current;
    tracking.enemyCompleted += 1;
    if (
      tracking.enemyCompleted >= tracking.enemyCount &&
      tracking.enemyCount > 0 &&
      !tracking.enemiesEmitted
    ) {
      tracking.enemiesEmitted = true;
      emitAnimationEvent("enemies-complete");
    }
  }, [emitAnimationEvent]);

  // Memoize tiles to a stable reference for the effect dependency
  const tiles = state?.map.tiles;

  // ============================================
  // Game Intro Sequence
  // ============================================
  // Start the intro sequence when the game first loads
  useEffect(() => {
    if (!tiles || introPhase !== "idle") return;

    // Count tiles and enemies for timing calculation
    const tileCount = tiles.length;
    const enemyCount = Object.values(state?.map.hexes ?? {}).reduce(
      (sum, hex) => sum + hex.enemies.length,
      0
    );

    // Store counts for animation completion tracking
    introTrackingRef.current.tileCount = tileCount;
    introTrackingRef.current.enemyCount = enemyCount;

    // Initialize tiles as known (skip normal reveal animation during intro)
    tiles.forEach((t) => {
      const key = `${t.tileId}-${t.centerCoord.q},${t.centerCoord.r}`;
      knownTileKeys.current.add(key);
    });
    hasInitializedTiles.current = true;

    // Emit intro-start and start the intro sequence
    emitAnimationEvent("intro-start");
    startIntro(tileCount, enemyCount);
  }, [tiles, introPhase, startIntro, state?.map.hexes, emitAnimationEvent]);

  // Detect newly revealed tiles and trigger animations
  useEffect(() => {
    if (!tiles) return;

    const currentTileKeys = new Set(
      tiles.map((t) => `${t.tileId}-${t.centerCoord.q},${t.centerCoord.r}`)
    );

    // On first load, just populate knownTileKeys without triggering animations
    // This prevents the starting tile(s) from animating on page load
    if (!hasInitializedTiles.current) {
      hasInitializedTiles.current = true;
      currentTileKeys.forEach((key) => knownTileKeys.current.add(key));
      return;
    }

    // Find tiles that are new (not in our known set)
    const newTiles: string[] = [];
    currentTileKeys.forEach((key) => {
      if (!knownTileKeys.current.has(key)) {
        newTiles.push(key);
      }
    });

    // If we found new tiles, trigger reveal animations
    if (newTiles.length > 0) {
      // Clear the clicking state since tile has arrived
      setClickingExploreCoord(null);

      // Add new tiles to revealing set
      setRevealingTiles((prev) => {
        const next = new Set(prev);
        newTiles.forEach((key) => next.add(key));
        return next;
      });

      // Update known tiles
      newTiles.forEach((key) => knownTileKeys.current.add(key));

      // Schedule removal of revealing state after animation completes
      const totalAnimationTime = TILE_REVEAL_DURATION_MS + ENEMY_REVEAL_BASE_DELAY_MS + 400;
      setTimeout(() => {
        setRevealingTiles((prev) => {
          const next = new Set(prev);
          newTiles.forEach((key) => next.delete(key));
          return next;
        });
      }, totalAnimationTime);
    }
  }, [tiles]);

  // Get valid move targets from server-computed validActions
  // Memoize to avoid recreating arrays on every render
  const validMoveTargets = useMemo<readonly MoveTarget[]>(
    () => state?.validActions.move?.targets ?? [],
    [state?.validActions.move?.targets]
  );

  // Get reachable hexes (multi-hop) from server if available
  // Falls back to just using adjacent targets if server doesn't provide reachable data
  const reachableHexes = useMemo<readonly ReachableHex[]>(
    () => state?.validActions.move?.reachable ?? [],
    [state?.validActions.move?.reachable]
  );

  // Compute path to hovered hex (only if it's reachable)
  // Must be called before any early returns to follow hooks rules
  const pathToHovered = useMemo(() => {
    if (!hoveredHex || !player?.position) return [];

    // Check if hovered hex is reachable
    const isAdjacent = validMoveTargets.some(
      t => t.hex.q === hoveredHex.q && t.hex.r === hoveredHex.r
    );
    const isReachable = reachableHexes.some(
      r => r.hex.q === hoveredHex.q && r.hex.r === hoveredHex.r
    );

    if (!isAdjacent && !isReachable) return [];

    return findPath(player.position, hoveredHex, reachableHexes, validMoveTargets);
  }, [hoveredHex, player?.position, reachableHexes, validMoveTargets]);

  // Handle animation completion - move to next hop or finish
  const handleAnimationComplete = useCallback(() => {
    const path = animationPath.current;
    const currentIndex = animationIndex.current;

    // Move to next step in path
    const nextIndex = currentIndex + 1;

    if (nextIndex >= path.length) {
      // Animation complete - no more hops
      setIsAnimating(false);
      setAnimationStart(null);
      setAnimationTarget(null);
      animationPath.current = [];
      animationIndex.current = 0;
      return;
    }

    // Set up next hop
    const fromHex = path[currentIndex];
    const toHex = path[nextIndex];

    if (fromHex && toHex) {
      animationIndex.current = nextIndex;
      setAnimationStart(hexToPixel(fromHex));
      setAnimationTarget(hexToPixel(toHex));

      // Send the move action for this hop
      sendAction({
        type: MOVE_ACTION,
        target: toHex,
      });
    }
  }, [sendAction]);

  // Start a multi-hop animation sequence
  const startPathAnimation = useCallback((path: HexCoord[]) => {
    if (path.length < 2) return;

    // Store the full path
    animationPath.current = path;
    animationIndex.current = 1; // Start at index 1 (moving TO first destination)

    const fromHex = path[0];
    const toHex = path[1];

    if (fromHex && toHex) {
      setIsAnimating(true);
      setAnimationStart(hexToPixel(fromHex));
      setAnimationTarget(hexToPixel(toHex));

      // Send the first move action
      sendAction({
        type: MOVE_ACTION,
        target: toHex,
      });
    }
  }, [sendAction]);

  // Calculate hero's display position (for animated token)
  // Must be before early return to follow hooks rules
  const heroDisplayPosition = useMemo(() => {
    if (!player?.position) return null;
    return hexToPixel(player.position);
  }, [player?.position]);

  if (!state) return null;

  const hexes = Object.values(state.map.hexes);

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
    console.log("[HexClick] Clicked:", coord, "isAnimating:", isAnimating, "validMoveTargets:", validMoveTargets.length, "reachableHexes:", reachableHexes.length);

    // Don't allow clicks while animating
    if (isAnimating) return;

    // Check if it's an adjacent target (single move)
    const isAdjacentTarget = validMoveTargets.some(
      (t) => t.hex.q === coord.q && t.hex.r === coord.r
    );

    if (isAdjacentTarget && player?.position) {
      // Single-hex move - still animate it
      startPathAnimation([player.position, coord]);
      return;
    }

    // Check if it's a reachable (multi-hop) target
    const isReachableTarget = reachableHexes.some(
      (r) => r.hex.q === coord.q && r.hex.r === coord.r
    );

    if (isReachableTarget && player?.position) {
      // Compute path and start animated movement
      const path = findPath(player.position, coord, reachableHexes, validMoveTargets);

      if (path.length > 1) {
        startPathAnimation(path);
      }
    }
  };

  const handleExploreClick = (target: ExploreTarget) => {
    // Prevent double-clicks while animating
    if (clickingExploreCoord) return;

    // Start anticipation animation on the ghost hex
    const coordKey = `${target.coord.q},${target.coord.r}`;
    setClickingExploreCoord(coordKey);

    // Delay the actual action to let anticipation animation play
    setTimeout(() => {
      sendAction({
        type: EXPLORE_ACTION,
        direction: target.direction,
        fromTileCoord: target.fromTileCoord,
      });
    }, GHOST_ANTICIPATION_DURATION_MS * 0.7); // Fire action slightly before animation ends
  };

  /**
   * Get movement highlight state for a hex.
   * Priority: info-revealing > terminal > adjacent > reachable
   * Shows three distinct states:
   * - Safe (green): no combat, can undo
   * - Unsafe but reversible (orange): triggers combat but enemies already visible, can undo
   * - Info-revealing (red/purple): will reveal enemies, can't undo after
   */
  const getMoveHighlight = (coord: HexCoord): MoveHighlight => {
    // Hide movement highlights while animating - avoids flickering costs
    if (isAnimating) {
      return { type: "none" };
    }

    // Check adjacent targets first
    const adjacentTarget = validMoveTargets.find(
      (t) => t.hex.q === coord.q && t.hex.r === coord.r
    );
    if (adjacentTarget) {
      // Adjacent but terminal (would trigger combat) - show as terminal
      if (adjacentTarget.isTerminal) {
        return { type: "terminal", cost: adjacentTarget.cost };
      }
      return { type: "adjacent", cost: adjacentTarget.cost };
    }

    // Check reachable hexes
    const reachable = reachableHexes.find(
      (r) => r.hex.q === coord.q && r.hex.r === coord.r
    );
    if (reachable) {
      if (reachable.isTerminal) {
        return { type: "terminal", cost: reachable.totalCost };
      }
      return { type: "reachable", cost: reachable.totalCost };
    }

    return { type: "none" };
  };

  // Determine hovered hex state (for path line color)
  const hoveredHighlight = hoveredHex ? getMoveHighlight(hoveredHex) : { type: "none" as const };
  const isHoveredTerminal = hoveredHighlight.type === "terminal";

  // Check if moving to hovered hex would reveal enemies (from server-computed data)
  const getWouldRevealEnemies = (coord: HexCoord | null): boolean => {
    if (!coord) return false;
    // Check adjacent targets
    const adjacentTarget = validMoveTargets.find(
      (t) => t.hex.q === coord.q && t.hex.r === coord.r
    );
    if (adjacentTarget?.wouldRevealEnemies) return true;
    // Check reachable hexes
    const reachable = reachableHexes.find(
      (r) => r.hex.q === coord.q && r.hex.r === coord.r
    );
    if (reachable?.wouldRevealEnemies) return true;
    return false;
  };
  const wouldReveal = getWouldRevealEnemies(hoveredHex);

  // Helper to check if a tile is currently revealing
  const isTileRevealing = (tile: { tileId: string; centerCoord: HexCoord }) => {
    const key = `${tile.tileId}-${tile.centerCoord.q},${tile.centerCoord.r}`;
    return revealingTiles.has(key);
  };

  // Get the center coord for revealing tiles (for particles/bloom)
  const revealingTileCenters = state.map.tiles
    .filter(isTileRevealing)
    .map((t) => t.centerCoord);

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="hex-grid"
      style={{ width: "100%", height: "100%" }}
      data-testid="hex-grid"
    >
      {/* SVG Definitions for effects */}
      <defs>
        {/* Radial gradient for bloom effect */}
        <radialGradient id="bloomGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 240, 200, 0.8)" />
          <stop offset="40%" stopColor="rgba(255, 220, 150, 0.4)" />
          <stop offset="100%" stopColor="rgba(255, 200, 100, 0)" />
        </radialGradient>
      </defs>

      {/* Layer 1: Tile artwork images (background) */}
      {state.map.tiles.map((tile, tileIndex) => {
        const tileKey = `${tile.tileId}-${tile.centerCoord.q},${tile.centerCoord.r}`;
        const isRevealing = revealingTiles.has(tileKey);

        // During intro phase, use staggered cascade animation
        const isInIntro = introPhase === "tiles" || introPhase === "idle";
        const introDelay = isInIntro && !isRevealing ? getTileDelay(tileIndex) / 1000 : undefined;

        return (
          <TileImage
            key={`tile-${tileKey}`}
            tileId={tile.tileId}
            centerCoord={tile.centerCoord}
            isRevealing={isRevealing}
            introDelay={introDelay}
            onIntroAnimationEnd={introDelay !== undefined ? handleTileIntroAnimationEnd : undefined}
          />
        );
      })}

      {/* Layer 1.5: Reveal effects (bloom and particles) for revealing tiles */}
      {revealingTileCenters.map((coord) => (
        <g key={`reveal-fx-${coord.q},${coord.r}`}>
          <TileBloom centerCoord={coord} />
          <RevealParticles centerCoord={coord} />
        </g>
      ))}

      {/* Layer 2: Path line preview (rendered before hex overlays so it's underneath) */}
      {/* Hide while animating to avoid visual clutter */}
      {!isAnimating && pathToHovered.length > 1 && (
        <PathLine
          path={pathToHovered}
          isTerminal={isHoveredTerminal}
          wouldRevealEnemies={wouldReveal}
        />
      )}

      {/* Layer 3: Hex overlays (transparent, for interactivity) */}
      {(() => {
        // Track global enemy index for intro staggering
        let globalEnemyIndex = 0;

        return hexes.map((hex) => {
          // Check if this hex is on a revealing tile
          const hexTile = state.map.tiles.find(
            (t) => t.tileId === hex.tileId
          );
          const isOnRevealingTile = hexTile ? isTileRevealing(hexTile) : false;

          // Capture current starting index for this hex's enemies
          const enemyStartIndex = globalEnemyIndex;
          globalEnemyIndex += hex.enemies.length;

          // Only pass intro delay during "enemies" phase
          const shouldAnimateEnemyIntro = introPhase === "enemies";
          // Hide enemies during tiles phase (before enemies animate in)
          const shouldHideEnemies = introPhase === "tiles" || introPhase === "idle";

          return (
            <HexOverlay
              key={hexKey(hex.coord)}
              hex={hex}
              moveHighlight={getMoveHighlight(hex.coord)}
              onClick={() => handleHexClick(hex.coord)}
              onMouseEnter={() => setHoveredHex(hex.coord)}
              onMouseLeave={() => setHoveredHex(null)}
              isRevealing={isOnRevealingTile}
              getEnemyIntroDelay={shouldAnimateEnemyIntro ? getEnemyDelay : undefined}
              enemyStartIndex={enemyStartIndex}
              hideEnemiesDuringIntro={shouldHideEnemies}
              onEnemyIntroAnimationEnd={shouldAnimateEnemyIntro ? handleEnemyIntroAnimationEnd : undefined}
            />
          );
        });
      })()}

      {/* Layer 4: Ghost hexes for valid explore directions */}
      {exploreTargets.map((target) => {
        const coordKey = `${target.coord.q},${target.coord.r}`;
        const isClicking = clickingExploreCoord === coordKey;

        return (
          <GhostHex
            key={`explore-${coordKey}`}
            coord={target.coord}
            onClick={() => handleExploreClick(target)}
            isClicking={isClicking}
          />
        );
      })}

      {/* Debug: Render tile corner symbols (C/S) and tile IDs */}
      {SHOW_TILE_CORNER_SYMBOLS &&
        state.map.tiles.map((tile) => (
          <TileCornerSymbols
            key={`corners-${tile.centerCoord.q},${tile.centerCoord.r}`}
            tileCenter={tile.centerCoord}
            tileId={tile.tileId}
          />
        ))}

      {/* Layer 5: Animated hero token (rendered on top) */}
      {heroDisplayPosition && (
        <AnimatedHeroToken
          startPosition={animationStart}
          targetPosition={animationTarget}
          restPosition={heroDisplayPosition}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </svg>
  );
}

