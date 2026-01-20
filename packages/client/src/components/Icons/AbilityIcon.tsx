/**
 * AbilityIcon - Renders icons from the enemy abilities sprite sheet
 *
 * Sprite sheet: /assets/icons/enemy_abilities_sprite_sheet.png
 * Grid: 5 cols × 3 rows
 *
 * These icons are used for:
 * - Enemy abilities (fortified, swift, brutal, etc.)
 * - Combat-related UI (attack, block)
 * - Site interaction icons (services, rewards)
 */

import "./AbilityIcon.css";

export type AbilityIconType =
  // Row 0
  | "summoner"      // Purple star - summons enemies
  | "poison"        // Chalice - poison attack
  | "attack"        // Crossed swords - combat/attack
  | "brutal"        // Boulder - brutal attack
  | "armor"         // Shield with number - armor value
  // Row 1
  | "fire"          // Fire emblem - fire attack/resistance
  | "fortified"     // Tower - fortified (requires siege)
  | "paralyze"      // Hand - paralyze ability
  | "ice"           // Ice ball - ice/cold attack
  | "arcane_immune" // Statue - immune to arcane
  // Row 2
  | "poison_effect" // Green skull drop - poisoned status
  | "swift"         // Purple card - swift enemy
  | "cumbersome"    // Arrow down - cumbersome
  | "summoned";     // Red skull - summoned enemy

// Sprite positions in the sheet (col, row)
const ABILITY_SPRITE_POSITIONS: Record<AbilityIconType, { col: number; row: number }> = {
  // Row 0
  summoner: { col: 0, row: 0 },
  poison: { col: 1, row: 0 },
  attack: { col: 2, row: 0 },
  brutal: { col: 3, row: 0 },
  armor: { col: 4, row: 0 },
  // Row 1
  fire: { col: 0, row: 1 },
  fortified: { col: 1, row: 1 },
  paralyze: { col: 2, row: 1 },
  ice: { col: 3, row: 1 },
  arcane_immune: { col: 4, row: 1 },
  // Row 2
  poison_effect: { col: 0, row: 2 },
  swift: { col: 1, row: 2 },
  cumbersome: { col: 2, row: 2 },
  summoned: { col: 3, row: 2 },
};

// Sprite sheet dimensions (estimated from image - need to verify exact dimensions)
// Image appears to be ~970x582 with 5x3 grid
const SPRITE_WIDTH = 194;  // ~970/5
const SPRITE_HEIGHT = 194; // ~582/3
const SHEET_COLS = 5;
const SHEET_ROWS = 3;

export interface AbilityIconProps {
  /** The ability/icon type to display */
  type: AbilityIconType;
  /** Display size in pixels (default: 24) */
  size?: number;
  /** Additional CSS class */
  className?: string;
  /** Title for tooltip */
  title?: string;
}

export function AbilityIcon({ type, size = 24, className, title }: AbilityIconProps) {
  const position = ABILITY_SPRITE_POSITIONS[type];

  if (!position) {
    // Fallback for unknown types
    return <span className={`ability-icon ability-icon--fallback ${className ?? ""}`}>?</span>;
  }

  const scale = size / SPRITE_WIDTH;
  const backgroundWidth = SHEET_COLS * SPRITE_WIDTH * scale;
  const backgroundHeight = SHEET_ROWS * SPRITE_HEIGHT * scale;
  const backgroundX = -position.col * SPRITE_WIDTH * scale;
  const backgroundY = -position.row * SPRITE_HEIGHT * scale;

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('/assets/icons/enemy_abilities_sprite_sheet.png')`,
    backgroundSize: `${backgroundWidth}px ${backgroundHeight}px`,
    backgroundPosition: `${backgroundX}px ${backgroundY}px`,
    backgroundRepeat: "no-repeat",
  };

  return (
    <span
      className={`ability-icon ability-icon--${type} ${className ?? ""}`}
      style={style}
      title={title ?? type.replace(/_/g, " ")}
    />
  );
}
