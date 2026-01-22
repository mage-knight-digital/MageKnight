/**
 * AAOfferPane - Advanced Action offer display in the OfferView
 *
 * Shows two sections:
 * 1. Regular AAs - available during level-up reward selection
 * 2. Monastery AAs - purchasable at monasteries for 6 influence
 *
 * Uses PixiJS for card rendering to eliminate image decode jank.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  LEARN_ADVANCED_ACTION_ACTION,
  SELECT_REWARD_ACTION,
  SITE_REWARD_ADVANCED_ACTION,
  type CardId,
} from "@mage-knight/shared";
import { PixiOfferCards, type CardInfo } from "./PixiOfferCards";

// Cost to buy an AA at a Monastery
const MONASTERY_AA_COST = 6;

// Calculate card height based on viewport (matches CSS clamp logic)
function calculateCardHeight(): number {
  const vh = window.innerHeight;
  const preferred = vh * 0.45; // 45vh
  const min = 280;
  const max = 600;
  return Math.min(Math.max(preferred, min), max);
}

interface AAOfferPaneProps {
  /** Whether this pane is currently visible (for Pixi container visibility) */
  visible?: boolean;
}

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

export function AAOfferPane({ visible = true }: AAOfferPaneProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [cardHeight, setCardHeight] = useState(calculateCardHeight);

  // Update card height on resize
  useEffect(() => {
    const updateHeight = () => setCardHeight(calculateCardHeight());
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Check if player has a pending AA reward (from level-up)
  const pendingAAReward = useMemo(() => {
    if (!player?.pendingRewards) return null;
    const rewardIndex = player.pendingRewards.findIndex(
      (r) => r.type === SITE_REWARD_ADVANCED_ACTION
    );
    return rewardIndex >= 0 ? { index: rewardIndex, reward: player.pendingRewards[rewardIndex] } : null;
  }, [player?.pendingRewards]);

  // Check if player can buy AAs at monastery
  const canBuyFromMonastery = useMemo(() => {
    if (!state || !player) return false;
    return isAtMonastery(state, player.position);
  }, [state, player]);

  // Get player's current influence
  const playerInfluence = player?.influencePoints ?? 0;

  // Select AA as reward
  const handleSelectAAReward = useCallback(
    (cardId: CardId, rewardIndex: number) => {
      sendAction({
        type: SELECT_REWARD_ACTION,
        cardId,
        rewardIndex,
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

  // Extract specific state properties for stable dependencies
  const regularAAOffer = state?.offers.advancedActions.cards;
  const monasteryAAOffer = state?.offers.monasteryAdvancedActions;

  // Convert regular AA offer to CardInfo array
  const regularAACards: CardInfo[] = useMemo(() => {
    if (!regularAAOffer) return [];

    return regularAAOffer.map((aaId) => {
      let canAcquire = false;
      let acquireLabel: string | undefined = "Level-up only";
      let onAcquire: (() => void) | undefined;

      // If pending AA reward, can select for free
      if (pendingAAReward) {
        canAcquire = true;
        acquireLabel = "Select";
        onAcquire = () => handleSelectAAReward(aaId, pendingAAReward.index);
      }

      return {
        id: aaId,
        canAcquire,
        acquireLabel,
        onAcquire,
      };
    });
  }, [regularAAOffer, pendingAAReward, handleSelectAAReward]);

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

  const hasRegularAAs = regularAACards.length > 0;
  const hasMonasteryAAs = monasteryAACards.length > 0;

  if (!hasRegularAAs && !hasMonasteryAAs) {
    return (
      <div className="offer-pane">
        <div className="offer-pane__empty">No advanced actions available</div>
      </div>
    );
  }

  return (
    <div className="offer-pane offer-pane--aa">
      {pendingAAReward && (
        <div className="offer-pane__notice">
          Select an advanced action reward!
        </div>
      )}

      {/* Regular AA Offer */}
      {hasRegularAAs && (
        <div className="offer-pane__section">
          <div className="offer-pane__section-title">Advanced Actions</div>
          <PixiOfferCards cards={regularAACards} cardHeight={cardHeight} type="aa" visible={visible} />
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
        {state.deckCounts.advancedActions} advanced actions remaining in deck
      </div>
    </div>
  );
}
