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
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  RECRUIT_UNIT_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  type UnitId,
  type CardId,
} from "@mage-knight/shared";
import { PixiOfferCards, type CardInfo } from "./PixiOfferCards";

// Cost to buy an AA at a Monastery
const MONASTERY_AA_COST = 6;

/**
 * Check if player is at a non-burned Monastery
 */
function isAtMonastery(
  state: { map: { hexes: Record<string, { site: { type: string; isBurned?: boolean } | null }> } },
  playerPosition: { q: number; r: number } | null
): boolean {
  if (!playerPosition) return false;

  const hexKey = `${playerPosition.q},${playerPosition.r}`;
  const hex = state.map.hexes[hexKey];
  if (!hex?.site) return false;

  return hex.site.type === "monastery" && !hex.site.isBurned;
}

// Calculate card height based on viewport (matches CSS clamp logic)
function calculateCardHeight(): number {
  const vh = window.innerHeight;
  const preferred = vh * 0.45; // 45vh
  const min = 280;
  const max = 600;
  return Math.min(Math.max(preferred, min), max);
}

interface UnitOfferPaneProps {
  /** Whether this pane is currently visible (for Pixi container visibility) */
  visible?: boolean;
}

export function UnitOfferPane({ visible = true }: UnitOfferPaneProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
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

  // Buy AA from monastery
  const handleBuyMonasteryAA = useCallback(
    (cardId: CardId) => {
      sendAction({
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId,
        fromMonastery: true,
      });
    },
    [sendAction]
  );

  // Check if player can buy AAs at monastery
  const canBuyFromMonastery = useMemo(() => {
    if (!state || !player) return false;
    return isAtMonastery(state, player.position);
  }, [state, player]);

  // Get player's current influence
  const playerInfluence = player?.influencePoints ?? 0;

  // Extract specific state properties for stable dependencies
  const recruitableUnits = state?.validActions?.units?.recruitable;
  const unitOffer = state?.offers.units;
  const monasteryAAOffer = state?.offers.monasteryAdvancedActions;

  const recruitableMap = useMemo(
    () => {
      const units = recruitableUnits ?? [];
      return new Map(units.map((r) => [r.unitId, r]));
    },
    [recruitableUnits]
  );

  // Convert unit offer to CardInfo array for PixiOfferCards
  const unitCards: CardInfo[] = useMemo(() => {
    if (!unitOffer) return [];

    return unitOffer.map((unitId) => {
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
  }, [unitOffer, recruitableMap, handleRecruit]);

  // Convert monastery AA offer to CardInfo array
  const monasteryAACards: CardInfo[] = useMemo(() => {
    if (!monasteryAAOffer) return [];

    return monasteryAAOffer.map((aaId) => {
      let canAcquire = false;
      let acquireLabel: string | undefined = "Monastery only";
      let onAcquire: (() => void) | undefined;

      if (canBuyFromMonastery) {
        const canAfford = playerInfluence >= MONASTERY_AA_COST;
        canAcquire = canAfford;
        acquireLabel = canAfford ? `Buy (${MONASTERY_AA_COST})` : `Need ${MONASTERY_AA_COST}`;
        onAcquire = () => handleBuyMonasteryAA(aaId);
      }

      return {
        id: aaId,
        canAcquire,
        acquireLabel,
        onAcquire,
      };
    });
  }, [monasteryAAOffer, canBuyFromMonastery, playerInfluence, handleBuyMonasteryAA]);

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  const hasUnits = state.offers.units.length > 0;
  const hasMonasteryAAs = monasteryAACards.length > 0;

  if (!hasUnits && !hasMonasteryAAs) {
    return (
      <div className="offer-pane">
        <div className="offer-pane__empty">No units available</div>
      </div>
    );
  }

  return (
    <div className="offer-pane offer-pane--units">
      {/* Unit Offer */}
      {hasUnits && (
        <div className="offer-pane__section">
          <div className="offer-pane__section-title">Units</div>
          <PixiOfferCards cards={unitCards} cardHeight={cardHeight} type="unit" visible={visible} />
        </div>
      )}

      {/* Monastery AA Offer */}
      {hasMonasteryAAs && (
        <div className="offer-pane__section">
          <div className="offer-pane__section-title">Monastery Advanced Actions</div>
          <PixiOfferCards cards={monasteryAACards} cardHeight={cardHeight} type="aa" visible={visible} />
        </div>
      )}

      <div className="offer-pane__deck-info">
        {state.deckCounts.regularUnits} regular, {state.deckCounts.eliteUnits} elite remaining
      </div>
    </div>
  );
}
