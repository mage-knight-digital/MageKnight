/**
 * SpellOfferPane - Spell offer display in the OfferView
 *
 * Shows spells available for purchase at Mage Towers.
 * Also handles spell rewards from site conquest.
 *
 * Uses PixiJS for card rendering to eliminate image decode jank.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  BUY_SPELL_ACTION,
  SELECT_REWARD_ACTION,
  SITE_REWARD_SPELL,
  type CardId,
} from "@mage-knight/shared";
import { PixiOfferCards, type CardInfo } from "./PixiOfferCards";

// Cost to buy a spell at a Mage Tower
const SPELL_PURCHASE_COST = 7;

// Calculate card height based on viewport (matches CSS clamp logic)
function calculateCardHeight(): number {
  const vh = window.innerHeight;
  const preferred = vh * 0.45; // 45vh
  const min = 280;
  const max = 600;
  return Math.min(Math.max(preferred, min), max);
}

interface SpellOfferPaneProps {
  /** Whether this pane is currently visible (for Pixi container visibility) */
  visible?: boolean;
}

/**
 * Check if player is at a conquered Mage Tower
 */
function isAtConqueredMageTower(
  state: { map: { hexes: Record<string, { site: { type: string; isConquered: boolean } | null }> } },
  playerPosition: { q: number; r: number } | null
): boolean {
  if (!playerPosition) return false;

  const hexKey = `${playerPosition.q},${playerPosition.r}`;
  const hex = state.map.hexes[hexKey];
  if (!hex?.site) return false;

  return hex.site.type === "mage_tower" && hex.site.isConquered;
}

export function SpellOfferPane({ visible = true }: SpellOfferPaneProps) {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [cardHeight, setCardHeight] = useState(calculateCardHeight);

  // Update card height on resize
  useEffect(() => {
    const updateHeight = () => setCardHeight(calculateCardHeight());
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Check if player has a pending spell reward
  const pendingSpellReward = useMemo(() => {
    if (!player?.pendingRewards) return null;
    const rewardIndex = player.pendingRewards.findIndex(
      (r) => r.type === SITE_REWARD_SPELL
    );
    return rewardIndex >= 0 ? { index: rewardIndex, reward: player.pendingRewards[rewardIndex] } : null;
  }, [player?.pendingRewards]);

  // Check if player can buy spells (at conquered Mage Tower)
  const canBuySpells = useMemo(() => {
    if (!state || !player) return false;
    return isAtConqueredMageTower(state, player.position);
  }, [state, player]);

  // Get player's current influence
  const playerInfluence = player?.influencePoints ?? 0;

  const handleBuySpell = useCallback(
    (cardId: CardId) => {
      sendAction({
        type: BUY_SPELL_ACTION,
        cardId,
      });
    },
    [sendAction]
  );

  const handleSelectSpellReward = useCallback(
    (cardId: CardId, rewardIndex: number) => {
      sendAction({
        type: SELECT_REWARD_ACTION,
        cardId,
        rewardIndex,
      });
    },
    [sendAction]
  );

  // Extract specific state property for stable dependency
  const spellOfferCards = state?.offers.spells.cards;

  // Convert spell offer to CardInfo array for PixiOfferCards
  const cards: CardInfo[] = useMemo(() => {
    if (!spellOfferCards) return [];

    return spellOfferCards.map((spellId) => {
      // Determine acquire ability for this spell
      let canAcquire = false;
      let acquireLabel: string | undefined;
      let onAcquire: (() => void) | undefined;

      // If pending spell reward, can select for free
      if (pendingSpellReward) {
        canAcquire = true;
        acquireLabel = "Select";
        onAcquire = () => handleSelectSpellReward(spellId, pendingSpellReward.index);
      }
      // If at conquered Mage Tower, can buy with influence
      else if (canBuySpells) {
        const canAfford = playerInfluence >= SPELL_PURCHASE_COST;
        canAcquire = canAfford;
        acquireLabel = canAfford ? `Buy (${SPELL_PURCHASE_COST})` : `Need ${SPELL_PURCHASE_COST}`;
        onAcquire = () => handleBuySpell(spellId);
      }

      return {
        id: spellId,
        canAcquire,
        acquireLabel,
        onAcquire,
      };
    });
  }, [spellOfferCards, pendingSpellReward, canBuySpells, playerInfluence, handleBuySpell, handleSelectSpellReward]);

  if (!state) return <div className="offer-pane__empty">Loading...</div>;

  if (state.offers.spells.cards.length === 0) {
    return (
      <div className="offer-pane">
        <div className="offer-pane__empty">No spells available</div>
      </div>
    );
  }

  return (
    <div className="offer-pane">
      {pendingSpellReward && (
        <div className="offer-pane__notice">
          Select a spell reward!
        </div>
      )}
      <PixiOfferCards cards={cards} cardHeight={cardHeight} type="spell" visible={visible} />
      <div className="offer-pane__deck-info">
        {state.deckCounts.spells} spells remaining in deck
      </div>
    </div>
  );
}
