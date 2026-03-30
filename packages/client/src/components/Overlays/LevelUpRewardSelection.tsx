/**
 * LevelUpRewardSelection - Displays level up reward selection for even levels
 *
 * Two-step flow:
 * 1. Choose a skill (from drawn pair or common pool)
 * 2. Choose an AA from the offer (only if skill was from drawn pair;
 *    common pool auto-resolves the AA to the lowest position)
 */

import type { CardId, SkillId } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  extractLevelUpSkillOptions,
  extractLevelUpAAOptions,
} from "../../rust/legalActionUtils";
import type { LegalAction } from "../../rust/types";
import { getCardSpriteStyle } from "../../utils/cardAtlas";
import "./LevelUpRewardSelection.css";

// Display height for AA card sprites in the level-up modal
const AA_DISPLAY_HEIGHT = 220;

// Format skill/card ID for display (convert snake_case to Title Case)
function formatName(id: string): string {
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Skill images live at /assets/skills/{skillId}.jpg
function skillImagePath(skillId: SkillId): string {
  return `/assets/skills/${skillId}.jpg`;
}

interface SkillOptionProps {
  skillId: SkillId;
  onSelect: () => void;
  isFromCommonPool: boolean;
}

function SkillOption({ skillId, onSelect, isFromCommonPool }: SkillOptionProps) {
  return (
    <button
      type="button"
      className={`level-up__skill ${isFromCommonPool ? "level-up__skill--common" : ""}`}
      onClick={onSelect}
    >
      <img
        className="level-up__skill-image"
        src={skillImagePath(skillId)}
        alt={formatName(skillId)}
      />
      <span className="level-up__skill-name">{formatName(skillId)}</span>
      {isFromCommonPool && (
        <span className="level-up__skill-badge">Common Pool</span>
      )}
    </button>
  );
}

interface AAOptionProps {
  cardId: string;
  onSelect: () => void;
}

function AAOption({ cardId, onSelect }: AAOptionProps) {
  const spriteStyle = getCardSpriteStyle(cardId as CardId, AA_DISPLAY_HEIGHT);

  return (
    <button
      type="button"
      className="level-up__aa"
      onClick={onSelect}
    >
      {spriteStyle ? (
        <div className="level-up__aa-sprite" style={spriteStyle} />
      ) : (
        <span className="level-up__aa-name">{formatName(cardId)}</span>
      )}
      <span className="level-up__aa-label">{formatName(cardId)}</span>
    </button>
  );
}

export function LevelUpRewardSelection() {
  const { legalActions, sendAction } = useGame();
  const player = useMyPlayer();

  // Get level-up data from pending state
  const levelUpData = player?.pending?.kind === "level_up_reward"
    ? player.pending.levelUpData
    : undefined;

  if (!player || !levelUpData) {
    return null;
  }

  const { level, drawnSkills, commonPoolSkills } = levelUpData;

  // Detect which phase we're in based on available legal actions
  const skillOptions = extractLevelUpSkillOptions(legalActions);
  const aaOptions = extractLevelUpAAOptions(legalActions);
  const isAAPhase = aaOptions.length > 0;

  const handleSelectSkill = (index: number, fromCommonPool: boolean) => {
    const match = skillOptions.find(
      o => o.skillIndex === index && o.fromCommonPool === fromCommonPool
    );
    if (match) {
      sendAction(match.action as LegalAction);
    }
  };

  const handleSelectAA = (cardId: string) => {
    const match = aaOptions.find(o => o.advancedActionId === cardId);
    if (match) {
      sendAction(match.action as LegalAction);
    }
  };

  return (
    <div className="overlay">
      <div className="level-up">
        <h2 className="level-up__title">Level {level} Rewards</h2>

        {!isAAPhase ? (
          /* Step 1: Skill Selection */
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
                      onSelect={() => handleSelectSkill(index, false)}
                      isFromCommonPool={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Common Pool (Secondary Options) */}
            {commonPoolSkills.length > 0 && (
              <>
                <div className="level-up__divider">or</div>
                <div className="level-up__group">
                  <h4 className="level-up__group-title">Common Pool</h4>
                  <p className="level-up__group-hint">
                    Choosing from here sends both drawn skills to the common pool and takes the lowest AA
                  </p>
                  <div className="level-up__skills level-up__skills--common">
                    {commonPoolSkills.map((skillId, index) => (
                      <SkillOption
                        key={skillId}
                        skillId={skillId}
                        onSelect={() => handleSelectSkill(index, true)}
                        isFromCommonPool={true}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {drawnSkills.length === 0 && commonPoolSkills.length === 0 && (
              <p className="level-up__empty">No skills available to select.</p>
            )}
          </section>
        ) : (
          /* Step 2: AA Selection */
          <section className="level-up__section">
            <h3 className="level-up__section-title">Choose an Advanced Action</h3>
            <p className="level-up__section-hint">
              This card will be added to the top of your deed deck
            </p>
            <div className="level-up__aas">
              {aaOptions.map((opt) => (
                <AAOption
                  key={opt.advancedActionId}
                  cardId={opt.advancedActionId}
                  onSelect={() => handleSelectAA(opt.advancedActionId)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
