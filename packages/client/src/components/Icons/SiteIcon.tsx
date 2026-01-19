/**
 * SiteIcon - Renders a site icon from individual PNG files
 *
 * All sites use individual cropped images from /assets/sites/
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

// Map site types to individual image files
const SITE_IMAGE_PATHS: Record<SiteIconType, string> = {
  ancient_ruins: "/assets/sites/ancient_ruins.png",
  blue_city: "/assets/sites/city_blue.png",
  green_city: "/assets/sites/city_green.png",
  red_city: "/assets/sites/city_red.png",
  white_city: "/assets/sites/city_white.png",
  mine: "/assets/sites/deep_mine.png",
  draconum: "/assets/sites/draconum.png",
  keep: "/assets/sites/keep.png",
  mage_tower: "/assets/sites/mage_tower.png",
  maze: "/assets/sites/labyrinth.png",
  labyrinth: "/assets/sites/labyrinth.png",
  monastery: "/assets/sites/monastery.png",
  village: "/assets/sites/village.png",
  spawning_grounds: "/assets/sites/spawning_grounds.png",
  magical_glade: "/assets/sites/refugee_camp.png",  // No magical glade image, use camp
  camp: "/assets/sites/refugee_camp.png",
  monster_den: "/assets/sites/orc_marauder.png",
  tomb: "/assets/sites/tomb.png",
  dungeon: "/assets/sites/deep_mine.png",  // Dungeon uses mine/cave image
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
