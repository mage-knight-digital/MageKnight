import {
  MOVE_ACTION,
  EXPLORE_ACTION,
  HEX_DIRECTIONS,
  hexKey,
  getNeighbor,
  type HexCoord,
  type HexDirection,
  type ClientHexState,
  type ClientMapState,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

const HEX_SIZE = 50; // pixels from center to corner

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

// Exploration cost in move points
const EXPLORE_COST = 2;

/**
 * Check if a hex is on the edge of the revealed map
 * (has at least one adjacent hex that is unrevealed)
 */
function isEdgeHex(map: ClientMapState, coord: HexCoord): boolean {
  for (const dir of HEX_DIRECTIONS) {
    const adjacent = getNeighbor(coord, dir);
    const key = hexKey(adjacent);
    if (!map.hexes[key]) {
      return true;
    }
  }
  return false;
}

/**
 * Get valid explore directions from a position
 * Returns directions that lead to unrevealed areas
 */
function getValidExploreDirections(
  map: ClientMapState,
  coord: HexCoord
): HexDirection[] {
  return HEX_DIRECTIONS.filter((dir) => {
    const adjacent = getNeighbor(coord, dir);
    const key = hexKey(adjacent);
    return !map.hexes[key];
  });
}

interface ExploreTarget {
  coord: HexCoord;
  direction: HexDirection;
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
        y={HEX_SIZE * 0.5}
        textAnchor="middle"
        fill="#4169E1"
        fontSize="10"
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        EXPLORE
      </text>
    </g>
  );
}

interface HexProps {
  hex: ClientHexState;
  isPlayerHere: boolean;
  onClick: () => void;
}

function Hex({ hex, isPlayerHere, onClick }: HexProps) {
  const { x, y } = hexToPixel(hex.coord);
  const terrainColor = TERRAIN_COLORS[hex.terrain] ?? "#666";
  const siteColor = hex.site ? SITE_COLORS[hex.site.type] ?? "#FFF" : null;

  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      data-coord={`${hex.coord.q},${hex.coord.r}`}
    >
      {/* Hex background */}
      <polygon
        points={hexPoints(HEX_SIZE * 0.95)}
        fill={terrainColor}
        stroke="#333"
        strokeWidth="1"
        className="hex-polygon"
      />

      {/* Site marker */}
      {siteColor && (
        <circle r={HEX_SIZE * 0.3} fill={siteColor} stroke="#000" strokeWidth="1" />
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

  // Calculate explore targets when player is on edge hex with enough move points
  const exploreTargets: ExploreTarget[] = [];
  if (
    player?.position &&
    player.movePoints >= EXPLORE_COST &&
    isEdgeHex(state.map, player.position)
  ) {
    const validDirections = getValidExploreDirections(state.map, player.position);
    for (const direction of validDirections) {
      const coord = getNeighbor(player.position, direction);
      exploreTargets.push({ coord, direction });
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
    // Send move action - engine will validate
    sendAction({
      type: MOVE_ACTION,
      target: coord,
    });
  };

  const handleExploreClick = (target: ExploreTarget) => {
    sendAction({
      type: EXPLORE_ACTION,
      direction: target.direction,
    });
  };

  const isPlayerAt = (coord: HexCoord) =>
    player?.position?.q === coord.q && player?.position?.r === coord.r;

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="hex-grid"
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    >
      {/* Render regular hexes */}
      {hexes.map((hex) => (
        <Hex
          key={`${hex.coord.q},${hex.coord.r}`}
          hex={hex}
          isPlayerHere={isPlayerAt(hex.coord)}
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
    </svg>
  );
}
