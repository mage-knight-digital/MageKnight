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
  | "combat"
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
  | "armor"
  | "arcane_immune"
  // Attack elements
  | "fire"
  | "ice"
  | "cold_fire"
  // Resistances
  | "fire_resist"
  | "ice_resist"
  | "physical_resist";

const ICON_PATHS: Record<GameIconType, string> = {
  attack: "/assets/icons/attack.png",
  combat: "/assets/icons/combat.png",
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
  vampiric: "/assets/icons/heal.png", // TODO: Add dedicated vampiric icon
  armor: "/assets/icons/armor.png",
  arcane_immune: "/assets/icons/arcane_immune.png",
  // Attack elements
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  cold_fire: "/assets/icons/cold_fire_attack.png",
  // Resistances
  fire_resist: "/assets/icons/fire_resist.png",
  ice_resist: "/assets/icons/ice_resist.png",
  physical_resist: "/assets/icons/physical_resist.png",
};

/** Preset sizes for responsive icons */
export type GameIconSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface GameIconProps {
  /** The icon type to display */
  type: GameIconType;
  /** Display size - number for pixels, or preset name for responsive em-based sizing */
  size?: number | GameIconSize;
  /** Additional CSS class */
  className?: string;
  /** Title for tooltip */
  title?: string;
}

export function GameIcon({ type, size = "md", className, title }: GameIconProps) {
  const path = ICON_PATHS[type];

  if (!path) {
    return <span className={`game-icon game-icon--fallback ${className ?? ""}`}>?</span>;
  }

  // If size is a number, use pixels; otherwise use CSS class for responsive sizing
  const isPixelSize = typeof size === "number";
  const sizeClass = isPixelSize ? "" : `game-icon--size-${size}`;

  const style: React.CSSProperties = {
    ...(isPixelSize ? { width: size, height: size } : {}),
    backgroundImage: `url('${path}')`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  return (
    <span
      className={`game-icon game-icon--${type} ${sizeClass} ${className ?? ""}`}
      style={style}
      title={title ?? type}
    />
  );
}
