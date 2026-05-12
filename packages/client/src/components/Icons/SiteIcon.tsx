/**
 * SiteIcon - Renders a site icon from individual PNG files
 *
 * All sites use individual cropped images from the static sites/ folder.
 */

import "./SiteIcon.css";
import { assetUrl } from "../../assets/assetPaths";

export type SiteIconType =
  | "ancient_ruins"
  | "blue_city"
  | "green_city"
  | "red_city"
  | "white_city"
  | "mine"
  | "deep_mine"
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

// Map site types to individual image files
const site = (file: string): string => assetUrl(`sites/${file}`);

const SITE_IMAGE_PATHS: Record<SiteIconType, string> = {
  ancient_ruins: site("ancient_ruins.png"),
  blue_city: site("city_blue.png"),
  green_city: site("city_green.png"),
  red_city: site("city_red.png"),
  white_city: site("city_white.png"),
  mine: site("crystal_mine.png"),
  deep_mine: site("deep_mine.png"),
  draconum: site("draconum.png"),
  keep: site("keep.png"),
  mage_tower: site("mage_tower.png"),
  maze: site("labyrinth.png"),
  labyrinth: site("labyrinth.png"),
  monastery: site("monastery.png"),
  village: site("village.png"),
  spawning_grounds: site("spawning_grounds.png"),
  magical_glade: site("magic_glade.png"),
  camp: site("refugee_camp.png"),
  monster_den: site("orc_marauder.png"),
  tomb: site("tomb.png"),
  dungeon: site("deep_mine.png"), // Dungeon uses mine/cave image
};

export interface SiteIconProps {
  /** The site type to display */
  site: SiteIconType;
  /** Display size in pixels (default: 48) */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

export function SiteIcon({ site, size = 48, className }: SiteIconProps) {
  const imagePath = SITE_IMAGE_PATHS[site];

  if (!imagePath) {
    // Fallback for unknown sites
    return <span className={`site-icon site-icon--fallback ${className ?? ""}`}>?</span>;
  }

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('${imagePath}')`,
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
