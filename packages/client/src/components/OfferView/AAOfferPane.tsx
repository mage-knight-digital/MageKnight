/**
 * AAOfferPane - Advanced Action offer display in the OfferView
 *
 * Shows regular AAs available during level-up reward selection.
 * (Monastery AAs are shown in the Unit offer pane per game rules)
 *
 * Uses PixiJS for card rendering to eliminate image decode jank.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  SELECT_REWARD_ACTION,
  SITE_REWARD_ADVANCED_ACTION,
  type CardId,
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

interface AAOfferPaneProps {
  /** Whether this pane is currently visible (for Pixi container visibility) */
  visible?: boolean;
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

  // Extract specific state properties for stable dependencies
  const regularAAOffer = state?.offers.advancedActions.cards;

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

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  if (regularAACards.length === 0) {
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

      <PixiOfferCards cards={regularAACards} cardHeight={cardHeight} type="aa" visible={visible} />

      <div className="offer-pane__deck-info">
        {state.deckCounts.advancedActions} advanced actions remaining in deck
      </div>
    </div>
  );
}
