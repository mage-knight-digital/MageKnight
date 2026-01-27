/**
 * LevelUpRewardSelection - Displays level up reward selection for even levels
 *
 * Shows when player has pendingLevelUpRewards from reaching an even level (2, 4, 6, 8, 10).
 * Player must select one skill and one advanced action.
 *
 * Skill selection mechanics:
 * - 2 skills drawn from hero's remaining pool (primary options)
 * - Common pool skills available as alternatives
 * - If picking from drawn pair: other skill goes to common pool
 * - If picking from common pool: BOTH drawn skills go to common pool
 */

import { useState } from "react";
import {
  CHOOSE_LEVEL_UP_REWARDS_ACTION,
  type CardId,
  type SkillId,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

// Format skill/card ID for display (convert snake_case to Title Case)
function formatName(id: string): string {
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SkillOptionProps {
  skillId: SkillId;
  isSelected: boolean;
  onSelect: () => void;
  isFromCommonPool: boolean;
}

function SkillOption({ skillId, isSelected, onSelect, isFromCommonPool }: SkillOptionProps) {
  return (
    <button
      type="button"
      className={`level-up__skill ${isSelected ? "level-up__skill--selected" : ""} ${isFromCommonPool ? "level-up__skill--common" : ""}`}
      onClick={onSelect}
    >
      <span className="level-up__skill-name">{formatName(skillId)}</span>
      {isFromCommonPool && (
        <span className="level-up__skill-badge">Common Pool</span>
      )}
    </button>
  );
}

interface AAOptionProps {
  cardId: CardId;
  isSelected: boolean;
  onSelect: () => void;
}

function AAOption({ cardId, isSelected, onSelect }: AAOptionProps) {
  return (
    <button
      type="button"
      className={`level-up__aa ${isSelected ? "level-up__aa--selected" : ""}`}
      onClick={onSelect}
    >
      <span className="level-up__aa-name">{formatName(cardId)}</span>
    </button>
  );
}

export function LevelUpRewardSelection() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  // Track selected skill and AA
  const [selectedSkill, setSelectedSkill] = useState<{
    skillId: SkillId;
    fromCommonPool: boolean;
  } | null>(null);
  const [selectedAA, setSelectedAA] = useState<CardId | null>(null);

  // Check if we have level up rewards to show
  const levelUpRewards = state?.validActions.levelUpRewards;

  // Don't show if no pending level up rewards
  if (!player || !levelUpRewards) {
    return null;
  }

  const { level, drawnSkills, commonPoolSkills, availableAAs } = levelUpRewards;

  const handleSelectDrawnSkill = (skillId: SkillId) => {
    setSelectedSkill({ skillId, fromCommonPool: false });
  };

  const handleSelectCommonPoolSkill = (skillId: SkillId) => {
    setSelectedSkill({ skillId, fromCommonPool: true });
  };

  const handleSelectAA = (cardId: CardId) => {
    setSelectedAA(cardId);
  };

  const handleConfirm = () => {
    if (!selectedSkill || !selectedAA) {
      return;
    }

    sendAction({
      type: CHOOSE_LEVEL_UP_REWARDS_ACTION,
      level,
      skillChoice: {
        skillId: selectedSkill.skillId,
        fromCommonPool: selectedSkill.fromCommonPool,
      },
      advancedActionId: selectedAA,
    });

    // Reset state for next level up if there is one
    setSelectedSkill(null);
    setSelectedAA(null);
  };

  // Count remaining level ups
  const pendingCount = player.pendingLevelUpRewards?.length ?? 0;

  return (
    <div className="overlay">
      <div className="overlay__content level-up">
        <h2 className="level-up__title">Level {level} Rewards</h2>

        {pendingCount > 1 && (
          <p className="level-up__remaining">
            {pendingCount - 1} more level up{pendingCount > 2 ? "s" : ""} after this
          </p>
        )}

        {/* Skill Selection */}
        <section className="level-up__section">
          <h3 className="level-up__section-title">Choose a Skill</h3>

          {/* Drawn Skills (Primary Options) */}
          {drawnSkills.length > 0 && (
            <div className="level-up__group">
              <h4 className="level-up__group-title">Your Drawn Skills</h4>
              <p className="level-up__group-hint">
                Pick one of these, or choose from the common pool below
              </p>
              <div className="level-up__skills">
                {drawnSkills.map((skillId) => (
                  <SkillOption
                    key={skillId}
                    skillId={skillId}
                    isSelected={
                      selectedSkill?.skillId === skillId &&
                      !selectedSkill.fromCommonPool
                    }
                    onSelect={() => handleSelectDrawnSkill(skillId)}
                    isFromCommonPool={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Common Pool (Secondary Options) */}
          {commonPoolSkills.length > 0 && (
            <div className="level-up__group">
              <h4 className="level-up__group-title">Common Pool</h4>
              <p className="level-up__group-hint">
                Choosing from here sends BOTH drawn skills to the common pool
              </p>
              <div className="level-up__skills level-up__skills--common">
                {commonPoolSkills.map((skillId) => (
                  <SkillOption
                    key={skillId}
                    skillId={skillId}
                    isSelected={
                      selectedSkill?.skillId === skillId &&
                      selectedSkill.fromCommonPool
                    }
                    onSelect={() => handleSelectCommonPoolSkill(skillId)}
                    isFromCommonPool={true}
                  />
                ))}
              </div>
            </div>
          )}

          {drawnSkills.length === 0 && commonPoolSkills.length === 0 && (
            <p className="level-up__empty">No skills available to select.</p>
          )}
        </section>

        {/* Advanced Action Selection */}
        <section className="level-up__section">
          <h3 className="level-up__section-title">Choose an Advanced Action</h3>
          <p className="level-up__section-hint">
            This card will be added to the top of your deed deck
          </p>
          {availableAAs.length > 0 ? (
            <div className="level-up__aas">
              {availableAAs.map((cardId) => (
                <AAOption
                  key={cardId}
                  cardId={cardId}
                  isSelected={selectedAA === cardId}
                  onSelect={() => handleSelectAA(cardId)}
                />
              ))}
            </div>
          ) : (
            <p className="level-up__empty">No advanced actions available.</p>
          )}
        </section>

        {/* Confirm Button */}
        <div className="level-up__actions">
          <button
            type="button"
            className="level-up__confirm"
            onClick={handleConfirm}
            disabled={!selectedSkill || !selectedAA}
          >
            Confirm Selections
          </button>
        </div>
      </div>
    </div>
  );
}
