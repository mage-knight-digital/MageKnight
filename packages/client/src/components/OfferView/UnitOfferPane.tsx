/**
 * UnitOfferPane - Unit offer display in the OfferView
 *
 * Shows units available for recruitment with recruit buttons
 * when the player has sufficient influence.
 */

import { useState, useEffect, useCallback } from "react";
import { useGame } from "../../hooks/useGame";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  RECRUIT_UNIT_ACTION,
  type UnitId,
} from "@mage-knight/shared";
import { getUnitSpriteStyle, isAtlasLoaded } from "../../utils/cardAtlas";
import { OfferCard } from "./OfferCard";

export function UnitOfferPane() {
  const { state, sendAction } = useGame();
  const [cardHeight, setCardHeight] = useState(280); // Fallback, CSS takes precedence
  const [shouldAnimate, setShouldAnimate] = useState(true);

  // Read card height from CSS custom property (responsive via clamp)
  useEffect(() => {
    const updateHeight = () => {
      // Read from :root CSS variable
      const cssHeight = getComputedStyle(document.documentElement)
        .getPropertyValue("--offer-card-height")
        .trim();
      if (cssHeight) {
        // Parse the computed value (will be in px after clamp resolves)
        const parsed = parseInt(cssHeight, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setCardHeight(parsed);
        }
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Disable animation after initial render
  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(false), 600);
    return () => clearTimeout(timer);
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

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  const unitOffer = state.offers.units;
  const recruitableUnits = state.validActions?.units?.recruitable ?? [];
  const recruitableMap = new Map(recruitableUnits.map((r) => [r.unitId, r]));

  if (unitOffer.length === 0) {
    return (
      <div className="offer-pane">
        <div className="offer-pane__empty">No units available</div>
      </div>
    );
  }

  return (
    <div className="offer-pane">
      {unitOffer.map((unitId, index) => {
        const unit = UNITS[unitId];
        if (!unit) return null;

        const recruitInfo = recruitableMap.get(unitId);
        const canRecruit = recruitInfo?.canAfford ?? false;
        const isElite = unit.type === UNIT_TYPE_ELITE;
        const spriteStyle = isAtlasLoaded() ? getUnitSpriteStyle(unitId, cardHeight) : null;

        const acquireLabel = recruitInfo
          ? canRecruit
            ? `Recruit (${recruitInfo.cost})`
            : `Need ${recruitInfo.cost}`
          : undefined;

        return (
          <OfferCard
            key={`${unitId}-${index}`}
            type="unit"
            index={index}
            cardId={unitId}
            canAcquire={canRecruit}
            acquireLabel={acquireLabel}
            isElite={isElite}
            onAcquire={recruitInfo ? () => handleRecruit(unitId, recruitInfo.cost) : undefined}
            shouldAnimate={shouldAnimate}
          >
            <div className="offer-card__cost">
              {recruitInfo ? recruitInfo.cost : unit.influence}
            </div>
            {spriteStyle ? (
              <div className="offer-card__unit-image" style={spriteStyle} />
            ) : (
              <div className="offer-card__unit-fallback">
                <div className="offer-card__unit-name">{unit.name}</div>
                <div className="offer-card__unit-stats">
                  Lvl {unit.level} | Armor {unit.armor}
                </div>
              </div>
            )}
          </OfferCard>
        );
      })}
      <div className="offer-pane__deck-info">
        {state.deckCounts.regularUnits} regular, {state.deckCounts.eliteUnits} elite remaining
      </div>
    </div>
  );
}
