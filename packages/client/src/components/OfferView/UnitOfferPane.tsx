/**
 * UnitOfferPane - Unit offer display in the OfferView
 *
 * Shows units available for recruitment with recruit buttons
 * when the player has sufficient influence.
 *
 * Uses PixiJS for card rendering to eliminate image decode jank.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  RECRUIT_UNIT_ACTION,
  type UnitId,
} from "@mage-knight/shared";
import { PixiOfferCards, type CardInfo } from "./PixiOfferCards";

// Calculate card height based on viewport (matches CSS clamp logic)
function calculateCardHeight(): number {
  const vh = window.innerHeight;
  const preferred = vh * 0.45; // 45vh
  const min = 280;
  const max = 600;
  return Math.min(Math.max(preferred, min), max);
}

export function UnitOfferPane() {
  const { state, sendAction } = useGame();
  const [cardHeight, setCardHeight] = useState(calculateCardHeight);

  // Update card height on resize (matches CSS clamp: 280px, 45vh, 600px)
  useEffect(() => {
    const updateHeight = () => {
      setCardHeight(calculateCardHeight());
    };

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const handleRecruit = useCallback(
    (unitId: UnitId, cost: number) => {
      sendAction({
        type: RECRUIT_UNIT_ACTION,
        unitId,
        influenceSpent: cost,
      });
    },
    [sendAction]
  );

  const recruitableMap = useMemo(
    () => {
      const recruitableUnits = state?.validActions?.units?.recruitable ?? [];
      return new Map(recruitableUnits.map((r) => [r.unitId, r]));
    },
    [state?.validActions?.units?.recruitable]
  );

  // Convert unit offer to CardInfo array for PixiOfferCards
  const cards: CardInfo[] = useMemo(() => {
    if (!state) return [];

    return state.offers.units.map((unitId) => {
      const unit = UNITS[unitId];
      const recruitInfo = recruitableMap.get(unitId);
      const canRecruit = recruitInfo?.canAfford ?? false;
      const isElite = unit?.type === UNIT_TYPE_ELITE;

      const acquireLabel = recruitInfo
        ? canRecruit
          ? `Recruit (${recruitInfo.cost})`
          : `Need ${recruitInfo.cost}`
        : undefined;

      return {
        id: unitId,
        canAcquire: canRecruit,
        acquireLabel,
        isElite,
        onAcquire: recruitInfo ? () => handleRecruit(unitId, recruitInfo.cost) : undefined,
      };
    });
    // Only re-run when the specific offer property changes, not the entire state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.offers.units, recruitableMap, handleRecruit]);

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  if (state.offers.units.length === 0) {
    return (
      <div className="offer-pane">
        <div className="offer-pane__empty">No units available</div>
      </div>
    );
  }

  return (
    <div className="offer-pane">
      <PixiOfferCards cards={cards} cardHeight={cardHeight} type="unit" />
      <div className="offer-pane__deck-info">
        {state.deckCounts.regularUnits} regular, {state.deckCounts.eliteUnits} elite remaining
      </div>
    </div>
  );
}
