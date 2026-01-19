/**
 * SiteIcon - Renders a site icon from sprite sheet or individual files
 *
 * Sprite sheet: /assets/sites/sites_sprite_sheet.png
 * Grid: 5 cols × 4 rows, 256×256 px each sprite
 * Total: 1280×1024 px
 *
 * Some sites use individual files for better quality:
 * - mage_tower.png (separate high-res file)
 */

import "./SiteIcon.css";

export type SiteIconType =
  | "ancient_ruins"
  | "blue_city"
  | "green_city"
  | "red_city"
  | "white_city"
  | "mine"
  | "draconum"
  | "keep"
  | "mage_tower"
  | "maze"
  | "labyrinth"
  | "monastery"
  | "village"
  | "spawning_grounds"
  | "magical_glade"
  | "camp"
  | "monster_den"
  | "tomb"
  | "dungeon";

// Sites that use individual image files instead of sprite sheet
const INDIVIDUAL_SITE_IMAGES: Partial<Record<SiteIconType, string>> = {
  mage_tower: "/assets/sites/mage_tower.png",
};

// Sprite positions in the sheet (col, row)
const SITE_SPRITE_POSITIONS: Record<SiteIconType, { col: number; row: number }> = {
  ancient_ruins: { col: 0, row: 0 },
  blue_city: { col: 1, row: 0 },
  green_city: { col: 2, row: 0 },
  red_city: { col: 3, row: 0 },
  white_city: { col: 4, row: 0 },
  mine: { col: 0, row: 1 },
  draconum: { col: 1, row: 1 },
  keep: { col: 2, row: 1 },
  mage_tower: { col: 2, row: 1 }, // Fallback - uses individual file
  maze: { col: 3, row: 1 },
  labyrinth: { col: 4, row: 1 },
  monastery: { col: 0, row: 2 },
  village: { col: 1, row: 2 },
  spawning_grounds: { col: 2, row: 2 },
  magical_glade: { col: 3, row: 2 },
  camp: { col: 0, row: 3 },
  monster_den: { col: 1, row: 3 },
  tomb: { col: 2, row: 3 },
  dungeon: { col: 0, row: 1 }, // Uses mine/cave sprite
};

// Sprite sheet dimensions
const SPRITE_SIZE = 256;
const SHEET_COLS = 5;
const SHEET_ROWS = 4;

export interface SiteIconProps {
  /** The site type to display */
  site: SiteIconType;
  /** Display size in pixels (default: 48) */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

export function SiteIcon({ site, size = 48, className }: SiteIconProps) {
  // Check if this site uses an individual image file
  const individualImage = INDIVIDUAL_SITE_IMAGES[site];
  if (individualImage) {
    const style: React.CSSProperties = {
      width: size,
      height: size,
      backgroundImage: `url('${individualImage}')`,
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };

    return (
      <span
        className={`site-icon site-icon--${site} ${className ?? ""}`}
        style={style}
        title={site.replace(/_/g, " ")}
      />
    );
  }

  // Use sprite sheet
  const position = SITE_SPRITE_POSITIONS[site];

  if (!position) {
    // Fallback for unknown sites
    return <span className={`site-icon site-icon--fallback ${className ?? ""}`}>?</span>;
  }

  const scale = size / SPRITE_SIZE;
  const backgroundWidth = SHEET_COLS * SPRITE_SIZE * scale;
  const backgroundHeight = SHEET_ROWS * SPRITE_SIZE * scale;
  const backgroundX = -position.col * SPRITE_SIZE * scale;
  const backgroundY = -position.row * SPRITE_SIZE * scale;

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('/assets/sites/sites_sprite_sheet.png')`,
    backgroundSize: `${backgroundWidth}px ${backgroundHeight}px`,
    backgroundPosition: `${backgroundX}px ${backgroundY}px`,
    backgroundRepeat: "no-repeat",
  };

  return (
    <span
      className={`site-icon site-icon--${site} ${className ?? ""}`}
      style={style}
      title={site.replace(/_/g, " ")}
    />
  );
}
