/**
 * GameIcon - Renders game icons from individual PNG files
 *
 * These are the core game icons used throughout the UI:
 * - attack (fist)
 * - block (shield)
 * - fortified (tower)
 * - fame (red banner)
 * - heal (heart)
 * - spell (scroll)
 * - influence (speech bubble)
 * - Enemy abilities: swift, brutal, poison, paralyze, summon, cumbersome, unfortified
 * - Resistances: fire_resist, ice_resist, physical_resist
 */

import "./GameIcon.css";

export type GameIconType =
  | "attack"
  | "block"
  | "fortified"
  | "fame"
  | "heal"
  | "spell"
  | "influence"
  // Enemy abilities
  | "swift"
  | "brutal"
  | "poison"
  | "paralyze"
  | "summon"
  | "cumbersome"
  | "unfortified"
  | "vampiric"
  | "fire"
  | "ice"
  | "armor"
  | "arcane_immune"
  // Resistances
  | "fire_resist"
  | "ice_resist"
  | "physical_resist";

const ICON_PATHS: Record<GameIconType, string> = {
  attack: "/assets/icons/attack.png",
  block: "/assets/icons/block.png",
  fortified: "/assets/icons/fortified.png",
  fame: "/assets/icons/fame.png",
  heal: "/assets/icons/heal.png",
  spell: "/assets/icons/spell.png",
  influence: "/assets/icons/influence.png",
  // Enemy abilities
  swift: "/assets/icons/swift.png",
  brutal: "/assets/icons/brutal.png",
  poison: "/assets/icons/poison.png",
  paralyze: "/assets/icons/paralyze.png",
  summon: "/assets/icons/summon.png",
  cumbersome: "/assets/icons/cumbersome.png",
  unfortified: "/assets/icons/unfortified.png",
  vampiric: "/assets/icons/vampiric.png", // TODO: Add icon asset
  fire: "/assets/icons/fire_resist.png", // Reuse fire resist icon
  ice: "/assets/icons/ice_resist.png", // Reuse ice resist icon
  armor: "/assets/icons/block.png", // Use block icon for armor
  arcane_immune: "/assets/icons/arcane_immune.png", // TODO: Add icon asset
  // Resistances
  fire_resist: "/assets/icons/fire_resist.png",
  ice_resist: "/assets/icons/ice_resist.png",
  physical_resist: "/assets/icons/block.png", // Use block icon for physical resist
};

export interface GameIconProps {
  /** The icon type to display */
  type: GameIconType;
  /** Display size in pixels (default: 20) */
  size?: number;
  /** Additional CSS class */
  className?: string;
  /** Title for tooltip */
  title?: string;
}

export function GameIcon({ type, size = 20, className, title }: GameIconProps) {
  const path = ICON_PATHS[type];

  if (!path) {
    return <span className={`game-icon game-icon--fallback ${className ?? ""}`}>?</span>;
  }

  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('${path}')`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  return (
    <span
      className={`game-icon game-icon--${type} ${className ?? ""}`}
      style={style}
      title={title ?? type}
    />
  );
}
