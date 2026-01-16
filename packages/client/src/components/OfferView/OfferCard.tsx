/**
 * OfferCard - Individual card in the offer tray
 *
 * Features:
 * - Random rotation (-8° to +8°) for organic "laid out by hand" feel
 * - Straightens on hover
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
 * Range: -8° to +8°
 */
function getCardRotation(cardId: string, index: number): number {
  // Simple hash of card ID + index for consistent rotation
  let hash = 0;
  const str = `${cardId}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Map to -8 to +8 range
  const normalized = ((hash % 160) / 10) - 8;
  return Math.round(normalized * 10) / 10; // Round to 1 decimal
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
  const rotation = useMemo(() => getCardRotation(cardId, index), [cardId, index]);
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
        "--rotation": `${rotation}deg`,
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
