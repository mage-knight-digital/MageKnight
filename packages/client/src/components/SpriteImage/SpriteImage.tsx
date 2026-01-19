/**
 * SpriteImage - Renders a sprite from an atlas using <img decoding="async">
 *
 * Uses an <img> element instead of CSS background-image to enable
 * off-main-thread image decoding, preventing animation jank.
 *
 * The component wraps the full sprite sheet image in a clipping container
 * and positions it to show just the desired sprite.
 */

import { memo } from "react";
import "./SpriteImage.css";

export interface SpriteImageProps {
  /** URL to the sprite sheet image */
  src: string;
  /** Width of the individual sprite in the sheet (pixels) */
  spriteWidth: number;
  /** Height of the individual sprite in the sheet (pixels) */
  spriteHeight: number;
  /** Column position in the sprite sheet (0-indexed) */
  col: number;
  /** Row position in the sprite sheet (0-indexed) */
  row: number;
  /** Total width of the sprite sheet (pixels) */
  sheetWidth: number;
  /** Total height of the sprite sheet (pixels) */
  sheetHeight: number;
  /** Display width (defaults to spriteWidth) */
  displayWidth?: number;
  /** Display height (defaults to spriteHeight) */
  displayHeight?: number;
  /** Alt text for accessibility */
  alt?: string;
  /** Additional CSS class for the wrapper */
  className?: string;
}

/**
 * Renders a single sprite from a sprite sheet using an img element.
 * The img has decoding="async" to decode off the main thread.
 */
export const SpriteImage = memo(function SpriteImage({
  src,
  spriteWidth,
  spriteHeight,
  col,
  row,
  sheetWidth,
  sheetHeight,
  displayWidth,
  displayHeight,
  alt = "",
  className = "",
}: SpriteImageProps) {
  // Calculate display dimensions (default to sprite size)
  const width = displayWidth ?? spriteWidth;
  const height = displayHeight ?? spriteHeight;

  // Calculate scale factor
  const scaleX = width / spriteWidth;
  const scaleY = height / spriteHeight;

  // Scale the full sheet dimensions
  const scaledSheetWidth = sheetWidth * scaleX;
  const scaledSheetHeight = sheetHeight * scaleY;

  // Calculate position offset (negative to shift the image)
  const offsetX = col * spriteWidth * scaleX;
  const offsetY = row * spriteHeight * scaleY;

  const wrapperStyle: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
  };

  const imgStyle: React.CSSProperties = {
    width: `${scaledSheetWidth}px`,
    height: `${scaledSheetHeight}px`,
    transform: `translate(-${offsetX}px, -${offsetY}px)`,
  };

  return (
    <div
      className={`sprite-image ${className}`}
      style={wrapperStyle}
    >
      <img
        src={src}
        alt={alt}
        style={imgStyle}
        decoding="async"
        // Prevent dragging the underlying image
        draggable={false}
      />
    </div>
  );
});
