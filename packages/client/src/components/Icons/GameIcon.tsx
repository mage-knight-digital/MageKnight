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
 */

import "./GameIcon.css";

export type GameIconType =
  | "attack"
  | "block"
  | "fortified"
  | "fame"
  | "heal"
  | "spell"
  | "influence";

const ICON_PATHS: Record<GameIconType, string> = {
  attack: "/assets/icons/attack.png",
  block: "/assets/icons/block.png",
  fortified: "/assets/icons/fortified.png",
  fame: "/assets/icons/fame.png",
  heal: "/assets/icons/heal.png",
  spell: "/assets/icons/spell.png",
  influence: "/assets/icons/influence.png",
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
