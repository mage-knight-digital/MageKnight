/**
 * OfferCard - Individual card in the offer tray
 *
 * Features:
 * - Cards are straight by default
 * - Slight random rotation (-3° to +3°) on hover for organic feel
 * - Staggered entrance animation
 * - Acquire button appears on hover when valid
 */

import type { ReactNode } from "react";
import { useMemo } from "react";

export type OfferCardType = "unit" | "spell" | "aa";

export interface OfferCardProps {
  type: OfferCardType;
  index: number;
  cardId: string;
  canAcquire: boolean;
  acquireLabel?: string;
  isElite?: boolean;
  onAcquire?: () => void;
  shouldAnimate?: boolean;
  children: ReactNode;
}

/**
 * Generate a pseudo-random rotation based on card ID and index.
 * Range: -2° to +2° (subtle tilt on hover), never exactly 0
 */
function getHoverRotation(cardId: string, index: number): number {
  // Simple hash of card ID + index for consistent rotation
  let hash = 0;
  const str = `${cardId}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Map to rotation values, ensuring we never get exactly 0
  const positive = Math.abs(hash);
  const sign = hash >= 0 ? 1 : -1;
  // Range 0.5 to 2.0 degrees, then apply sign
  const magnitude = 0.5 + (positive % 16) / 10; // 0.5 to 2.0
  return Math.round(sign * magnitude * 10) / 10;
}

export function OfferCard({
  type,
  index,
  cardId,
  canAcquire,
  acquireLabel = "Acquire",
  isElite = false,
  onAcquire,
  shouldAnimate = false,
  children,
}: OfferCardProps) {
  // Rotation is applied on hover only (cards are straight by default)
  const hoverRotation = useMemo(() => getHoverRotation(cardId, index), [cardId, index]);
  const animationDelay = index * 50; // 50ms stagger between cards

  const cardClassName = [
    "offer-card",
    `offer-card--${type}`,
    isElite && "offer-card--elite",
    !canAcquire && "offer-card--not-acquirable",
    shouldAnimate && "offer-card--animate-enter",
  ]
    .filter(Boolean)
    .join(" ");

  const btnClassName = [
    "offer-card__acquire-btn",
    !canAcquire && "offer-card__acquire-btn--disabled",
  ]
    .filter(Boolean)
    .join(" ");

  const handleAcquireClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canAcquire && onAcquire) {
      onAcquire();
    }
  };

  return (
    <div
      className={cardClassName}
      style={{
        "--hover-rotation": `${hoverRotation}deg`,
        animationDelay: shouldAnimate ? `${animationDelay}ms` : undefined,
      } as React.CSSProperties}
    >
      <div className="offer-card__content">
        {children}
      </div>
      {onAcquire && (
        <button
          className={btnClassName}
          onClick={handleAcquireClick}
          disabled={!canAcquire}
        >
          {acquireLabel}
        </button>
      )}
    </div>
  );
}
