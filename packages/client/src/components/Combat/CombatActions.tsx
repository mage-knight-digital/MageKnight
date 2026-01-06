/**
 * CombatActions - Phase-specific action buttons
 */

import { END_COMBAT_PHASE_ACTION } from "@mage-knight/shared";
import type { CombatOptions } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";

interface CombatActionsProps {
  combatOptions: CombatOptions;
}

const PHASE_ACTION_LABELS: Record<string, string> = {
  ranged_siege: "Skip Ranged/Siege",
  block: "Skip Blocking",
  assign_damage: "Continue",
  attack: "Skip Attack",
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  ranged_siege: "Use Ranged or Siege attacks to defeat enemies before they attack.",
  block: "Block enemy attacks or take damage. Blocked enemies don't deal damage.",
  assign_damage: "Assign damage from unblocked enemies. Take wounds or assign to units.",
  attack: "Use Melee attacks to defeat remaining enemies.",
};

export function CombatActions({ combatOptions }: CombatActionsProps) {
  const { sendAction } = useGame();
  const { phase, canEndPhase } = combatOptions;

  const handleEndPhase = () => {
    sendAction({ type: END_COMBAT_PHASE_ACTION });
  };

  return (
    <div className="combat-actions">
      <div className="combat-actions__description">
        {PHASE_DESCRIPTIONS[phase] || ""}
      </div>
      <div className="combat-actions__buttons">
        <button
          className="combat-actions__btn combat-actions__btn--end-phase"
          onClick={handleEndPhase}
          disabled={!canEndPhase}
          type="button"
        >
          {PHASE_ACTION_LABELS[phase] || "End Phase"}
        </button>
      </div>
      {!canEndPhase && phase === "assign_damage" && (
        <div className="combat-actions__warning">
          You must assign all damage before continuing.
        </div>
      )}
    </div>
  );
}
