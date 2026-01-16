/**
 * CrystalIcon - Renders a crystal icon from the sprite sheet
 */

import { getCrystalSpriteStyle, type CrystalColor } from "../../utils/cardAtlas";
import "./CrystalIcon.css";

export interface CrystalIconProps {
  color: CrystalColor;
  /** Display height in pixels (default: 24) */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

export function CrystalIcon({ color, size = 28, className }: CrystalIconProps) {
  const style = getCrystalSpriteStyle(color, size);

  if (!style) {
    // Fallback to text if atlas not loaded
    return <span className={`crystal-icon crystal-icon--fallback ${className ?? ""}`}>{color}</span>;
  }

  return (
    <span
      className={`crystal-icon crystal-icon--${color} ${className ?? ""}`}
      style={style}
      title={`${color} crystal`}
    />
  );
}
