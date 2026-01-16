/**
 * AAOfferPane - Advanced Action offer display in the OfferView
 *
 * Shows two sections:
 * 1. Regular AAs - available during level-up reward selection
 * 2. Monastery AAs - purchasable at monasteries for 6 influence
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
import { OfferCard } from "./OfferCard";

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

export function AAOfferPane() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [shouldAnimate, setShouldAnimate] = useState(true);

  // Disable animation after initial render
  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(false), 600);
    return () => clearTimeout(timer);
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

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  const aaOffer = state.offers.advancedActions.cards;
  const monasteryAAOffer = state.offers.monasteryAdvancedActions;

  // Determine acquire ability for regular AAs
  const getRegularAAInfo = (cardId: CardId) => {
    // If pending AA reward, can select for free
    if (pendingAAReward) {
      return {
        canAcquire: true,
        label: "Select",
        onAcquire: () => handleSelectAAReward(cardId, pendingAAReward.index),
      };
    }

    // Regular AAs can only be acquired through level-up
    return {
      canAcquire: false,
      label: "Level-up only",
      onAcquire: undefined,
    };
  };

  // Determine acquire ability for monastery AAs
  const getMonasteryAAInfo = (cardId: CardId) => {
    if (canBuyFromMonastery) {
      const canAfford = playerInfluence >= MONASTERY_AA_COST;
      return {
        canAcquire: canAfford,
        label: canAfford ? `Buy (${MONASTERY_AA_COST})` : `Need ${MONASTERY_AA_COST}`,
        onAcquire: () => handleBuyMonasteryAA(cardId),
      };
    }

    return {
      canAcquire: false,
      label: "Monastery only",
      onAcquire: undefined,
    };
  };

  const hasRegularAAs = aaOffer.length > 0;
  const hasMonasteryAAs = monasteryAAOffer.length > 0;

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
          <div className="offer-pane__cards">
            {aaOffer.map((aaId, index) => {
              const acquireInfo = getRegularAAInfo(aaId);

              return (
                <OfferCard
                  key={`aa-${aaId}-${index}`}
                  type="aa"
                  index={index}
                  cardId={aaId}
                  canAcquire={acquireInfo.canAcquire}
                  acquireLabel={acquireInfo.label}
                  onAcquire={acquireInfo.onAcquire}
                  shouldAnimate={shouldAnimate}
                >
                  <div className="offer-card__card-name">
                    <span className="offer-card__aa-name">{aaId}</span>
                  </div>
                </OfferCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Monastery AA Offer */}
      {hasMonasteryAAs && (
        <div className="offer-pane__section">
          <div className="offer-pane__section-title">Monastery Advanced Actions</div>
          <div className="offer-pane__cards">
            {monasteryAAOffer.map((aaId, index) => {
              const acquireInfo = getMonasteryAAInfo(aaId);

              return (
                <OfferCard
                  key={`monastery-${aaId}-${index}`}
                  type="aa"
                  index={index + aaOffer.length}
                  cardId={aaId}
                  canAcquire={acquireInfo.canAcquire}
                  acquireLabel={acquireInfo.label}
                  onAcquire={acquireInfo.onAcquire}
                  shouldAnimate={shouldAnimate}
                >
                  <div className="offer-card__card-name">
                    <span className="offer-card__aa-name">{aaId}</span>
                  </div>
                </OfferCard>
              );
            })}
          </div>
        </div>
      )}

      <div className="offer-pane__deck-info">
        {state.deckCounts.advancedActions} advanced actions remaining in deck
      </div>
    </div>
  );
}
