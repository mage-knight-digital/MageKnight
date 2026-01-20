/**
 * ManaIcon - Renders a mana icon from the mana icons folder
 *
 * Uses individual PNG files from /assets/mana_icons/glossy/ or /flat/
 */

import "./ManaIcon.css";

export type ManaColor = "white" | "green" | "red" | "blue" | "gold" | "black";
export type ManaStyle = "glossy" | "flat";

export interface ManaIconProps {
  /** The mana color to display */
  color: ManaColor;
  /** Icon style (default: glossy) */
  variant?: ManaStyle;
  /** Display size in pixels (default: 24) */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

export function ManaIcon({ color, variant = "glossy", size = 24, className }: ManaIconProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url('/assets/mana_icons/${variant}/${color}.png')`,
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };

  return (
    <span
      className={`mana-icon mana-icon--${color} ${className ?? ""}`}
      style={style}
      title={`${color} mana`}
    />
  );
}
