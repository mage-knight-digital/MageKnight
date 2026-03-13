/**
 * LevelUpRewardSelection - Displays level up reward selection for even levels
 *
 * Shows when player has pending level_up_reward state.
 * Player must select one skill and one advanced action.
 *
 * Skill selection mechanics:
 * - 2 skills drawn from hero's remaining pool (primary options)
 * - Common pool skills available as alternatives
 * - If picking from drawn pair: other skill goes to common pool
 * - If picking from common pool: BOTH drawn skills go to common pool
 *
 * AA selection mechanics:
 * - Drawn skills: free choice of any AA from offer
 * - Common pool skills: forced to take lowest-position AA only
 */

import { useState } from "react";
import type { SkillId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { extractLevelUpRewardOptions } from "../../rust/legalActionUtils";
import type { LegalAction } from "../../rust/types";

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
  cardId: string;
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
  const { legalActions, sendAction } = useGame();
  const player = useMyPlayer();

  // Track selected skill and AA
  const [selectedSkill, setSelectedSkill] = useState<{
    index: number;
    fromCommonPool: boolean;
  } | null>(null);
  const [selectedAA, setSelectedAA] = useState<string | null>(null);

  // Get level-up data from pending state
  const levelUpData = player?.pending?.kind === "level_up_reward"
    ? player.pending.levelUpData
    : undefined;

  if (!player || !levelUpData) {
    return null;
  }

  const { level, drawnSkills, commonPoolSkills } = levelUpData;
  const rewardOptions = extractLevelUpRewardOptions(legalActions);

  // Derive available AAs for the selected skill
  const availableAAs = selectedSkill
    ? [...new Set(
        rewardOptions
          .filter(o => o.skillIndex === selectedSkill.index && o.fromCommonPool === selectedSkill.fromCommonPool)
          .map(o => o.advancedActionId)
      )]
    : [...new Set(rewardOptions.map(o => o.advancedActionId))];

  const handleSelectDrawnSkill = (index: number) => {
    setSelectedSkill({ index, fromCommonPool: false });
    setSelectedAA(null); // Reset AA since available options may change
  };

  const handleSelectCommonPoolSkill = (index: number) => {
    setSelectedSkill({ index, fromCommonPool: true });
    setSelectedAA(null);
  };

  const handleSelectAA = (cardId: string) => {
    setSelectedAA(cardId);
  };

  const handleConfirm = () => {
    if (!selectedSkill || !selectedAA) return;

    // Find the matching legal action
    const matchingAction = rewardOptions.find(
      o => o.skillIndex === selectedSkill.index
        && o.fromCommonPool === selectedSkill.fromCommonPool
        && o.advancedActionId === selectedAA
    );

    if (matchingAction) {
      sendAction(matchingAction.action as LegalAction);
      setSelectedSkill(null);
      setSelectedAA(null);
    }
  };

  return (
    <div className="overlay">
      <div className="overlay__content level-up">
        <h2 className="level-up__title">Level {level} Rewards</h2>

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
                {drawnSkills.map((skillId, index) => (
                  <SkillOption
                    key={skillId}
                    skillId={skillId}
                    isSelected={
                      selectedSkill?.index === index &&
                      !selectedSkill.fromCommonPool
                    }
                    onSelect={() => handleSelectDrawnSkill(index)}
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
                {commonPoolSkills.map((skillId, index) => (
                  <SkillOption
                    key={skillId}
                    skillId={skillId}
                    isSelected={
                      selectedSkill?.index === index &&
                      selectedSkill.fromCommonPool
                    }
                    onSelect={() => handleSelectCommonPoolSkill(index)}
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
            <p className="level-up__empty">
              {selectedSkill ? "No advanced actions available for this skill." : "Select a skill first to see available advanced actions."}
            </p>
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
