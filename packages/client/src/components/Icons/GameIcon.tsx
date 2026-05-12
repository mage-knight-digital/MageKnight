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

import { assetUrl } from "../../assets/assetPaths";
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
  | "end_turn"
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

const icon = (file: string): string => assetUrl(`icons/${file}`);

const ICON_PATHS: Record<GameIconType, string> = {
  attack: icon("attack.png"),
  combat: icon("combat.png"),
  block: icon("block.png"),
  fortified: icon("fortified.png"),
  fame: icon("fame.png"),
  heal: icon("heal.png"),
  spell: icon("spell.png"),
  influence: icon("influence.png"),
  end_turn: icon("end_turn.png"),
  // Enemy abilities
  swift: icon("swift.png"),
  brutal: icon("brutal.png"),
  poison: icon("poison.png"),
  paralyze: icon("paralyze.png"),
  summon: icon("summon.png"),
  cumbersome: icon("cumbersome.png"),
  unfortified: icon("unfortified.png"),
  vampiric: icon("heal.png"), // TODO: Add dedicated vampiric icon
  armor: icon("armor.png"),
  arcane_immune: icon("arcane_immune.png"),
  // Attack elements
  fire: icon("fire_attack.png"),
  ice: icon("ice_attack.png"),
  cold_fire: icon("cold_fire_attack.png"),
  // Resistances
  fire_resist: icon("fire_resist.png"),
  ice_resist: icon("ice_resist.png"),
  physical_resist: icon("physical_resist.png"),
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
