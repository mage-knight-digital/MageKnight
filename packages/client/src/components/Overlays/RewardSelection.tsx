/**
 * RewardSelection - Displays pending site rewards for selection
 *
 * Shows when player has pendingRewards from conquering a site.
 * For spell/advanced action rewards, displays the offer and lets player select.
 */

import {
  SELECT_REWARD_ACTION,
  SITE_REWARD_SPELL,
  SITE_REWARD_ADVANCED_ACTION,
  SITE_REWARD_ARTIFACT,
  SITE_REWARD_COMPOUND,
  SITE_REWARD_UNIT,
  UNITS,
  type SiteReward,
  type CardId,
  type UnitId,
} from "@mage-knight/shared";
import { useState } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import "./RewardSelection.css";

// Format card ID for display (convert snake_case to Title Case)
function formatCardName(cardId: string): string {
  return cardId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Describe a reward for display
function describeReward(reward: SiteReward): string {
  switch (reward.type) {
    case SITE_REWARD_SPELL:
      return `Select ${reward.count} spell${reward.count > 1 ? "s" : ""} from the offer`;
    case SITE_REWARD_ADVANCED_ACTION:
      return `Select ${reward.count} advanced action${reward.count > 1 ? "s" : ""} from the offer`;
    case SITE_REWARD_ARTIFACT:
      return `Select ${reward.count} artifact${reward.count > 1 ? "s" : ""} from the offer`;
    case SITE_REWARD_COMPOUND:
      return reward.rewards.map(describeReward).join(", then ");
    case SITE_REWARD_UNIT:
      return "Recruit 1 unit from the offer for free";
    default:
      return "Unknown reward";
  }
}

// Get the offer cards for a reward type
function getOfferForReward(
  reward: SiteReward,
  offers: { spells: { cards: readonly CardId[] }; advancedActions: { cards: readonly CardId[] } }
): readonly CardId[] {
  switch (reward.type) {
    case SITE_REWARD_SPELL:
      return offers.spells.cards;
    case SITE_REWARD_ADVANCED_ACTION:
      return offers.advancedActions.cards;
    // TODO: Artifact rewards need artifact offer to be added to ClientGameOffers
    default:
      return [];
  }
}

export function RewardSelection() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const [selectedDisbandUnitId, setSelectedDisbandUnitId] = useState<string | null>(null);

  // Don't show if no pending rewards
  const pendingRewards = player?.pendingRewards ?? [];
  if (!player || pendingRewards.length === 0) {
    return null;
  }

  // Get the first pending reward (we process them one at a time)
  // We've already checked length > 0 above, so this is safe
  const currentReward = pendingRewards[0] as SiteReward;

  // For compound rewards, we need to unwrap to find the first actionable sub-reward
  let actionableReward: SiteReward = currentReward;
  if (currentReward.type === SITE_REWARD_COMPOUND && currentReward.rewards.length > 0) {
    actionableReward = currentReward.rewards[0] as SiteReward;
  }

  // Get the available cards from the appropriate offer
  const offerCards = state
    ? getOfferForReward(actionableReward, state.offers)
    : [];

  const handleSelectCard = (cardId: CardId) => {
    sendAction({
      type: SELECT_REWARD_ACTION,
      cardId,
      rewardIndex: 0, // Always selecting for the first pending reward
    });
  };

  const isUnitReward = actionableReward.type === SITE_REWARD_UNIT;
  const unitOffer = state?.offers.units ?? [];
  const atCommandLimit = player.units.length >= player.commandTokens;
  const disbandableUnits = player.units.filter((unit) => !unit.isBondsUnit);
  const requiresDisband = isUnitReward && atCommandLimit;
  const effectiveDisbandUnitId = (
    requiresDisband &&
    selectedDisbandUnitId &&
    disbandableUnits.some((unit) => unit.instanceId === selectedDisbandUnitId)
  )
    ? selectedDisbandUnitId
    : null;
  const canSelectUnit = !requiresDisband || effectiveDisbandUnitId !== null;

  const handleSelectUnit = (unitId: UnitId) => {
    if (requiresDisband && !effectiveDisbandUnitId) return;

    sendAction({
      type: SELECT_REWARD_ACTION,
      cardId: unitId as unknown as CardId,
      rewardIndex: 0,
      unitId,
      disbandUnitInstanceId: effectiveDisbandUnitId ?? undefined,
    });
  };

  // Determine if this is a selectable card reward
  const isCardReward =
    actionableReward.type === SITE_REWARD_SPELL ||
    actionableReward.type === SITE_REWARD_ADVANCED_ACTION ||
    actionableReward.type === SITE_REWARD_ARTIFACT;

  return (
    <div className="overlay">
      <div className="overlay__content reward-selection">
        <h2 className="reward-selection__title">Select Your Reward</h2>
        <p className="reward-selection__description">
          {describeReward(currentReward)}
        </p>

        {pendingRewards.length > 1 && (
          <p className="reward-selection__remaining">
            {pendingRewards.length - 1} more reward
            {pendingRewards.length > 2 ? "s" : ""} after this
          </p>
        )}

        {isCardReward && offerCards.length > 0 ? (
          <div className="reward-selection__cards">
            {offerCards.map((cardId) => (
              <button
                key={cardId}
                className="reward-selection__card"
                onClick={() => handleSelectCard(cardId)}
                type="button"
              >
                <span className="reward-selection__card-name">
                  {formatCardName(cardId)}
                </span>
              </button>
            ))}
          </div>
        ) : isCardReward ? (
          <p className="reward-selection__empty">
            No cards available in the offer. The reward cannot be claimed.
          </p>
        ) : isUnitReward && unitOffer.length > 0 ? (
          <>
            {requiresDisband && (
              <div className="reward-selection__disband">
                <p className="reward-selection__disband-title">
                  Choose a unit to disband first
                </p>
                <div className="reward-selection__cards">
                  {disbandableUnits.map((unit) => (
                    <button
                      key={unit.instanceId}
                      className={`reward-selection__card ${effectiveDisbandUnitId === unit.instanceId ? "reward-selection__card--selected" : ""}`}
                      onClick={() => setSelectedDisbandUnitId(unit.instanceId)}
                      type="button"
                    >
                      <span className="reward-selection__card-name">
                        {UNITS[unit.unitId]?.name ?? formatCardName(unit.unitId)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="reward-selection__disband">
              <p className="reward-selection__disband-title">
                Select a unit to recruit
              </p>
              <div className="reward-selection__cards">
                {unitOffer.map((unitId) => (
                  <button
                    key={unitId}
                    className="reward-selection__card"
                    onClick={() => handleSelectUnit(unitId as UnitId)}
                    type="button"
                    disabled={!canSelectUnit}
                  >
                    <span className="reward-selection__card-name">
                      {UNITS[unitId as UnitId]?.name ?? formatCardName(unitId)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : isUnitReward ? (
          <p className="reward-selection__empty">
            No units available in the offer. The reward cannot be claimed.
          </p>
        ) : (
          <p className="reward-selection__auto">
            This reward will be processed automatically.
          </p>
        )}
      </div>
    </div>
  );
}
