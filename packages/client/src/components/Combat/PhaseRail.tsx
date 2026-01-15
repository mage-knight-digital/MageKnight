/**
 * PhaseRail - Horizontal phase indicator for combat with integrated action button
 *
 * Shows all 4 combat phases as a connected rail with the active phase highlighted.
 * The action button is integrated into the rail - always visible, always accessible.
 * Inspired by Gloomhaven's initiative tracker and Inscryption's always-visible bell.
 */

import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
} from "@mage-knight/shared";
import "./PhaseRail.css";

interface PhaseRailProps {
  currentPhase: CombatPhase;
  isAtFortifiedSite?: boolean;
  canEndPhase: boolean;
  onEndPhase: () => void;
}

const PHASES: { id: CombatPhase; label: string; shortLabel: string; actionLabel: string }[] = [
  { id: COMBAT_PHASE_RANGED_SIEGE, label: "Ranged & Siege", shortLabel: "Ranged", actionLabel: "Skip" },
  { id: COMBAT_PHASE_BLOCK, label: "Block", shortLabel: "Block", actionLabel: "Skip" },
  { id: COMBAT_PHASE_ASSIGN_DAMAGE, label: "Assign Damage", shortLabel: "Damage", actionLabel: "Continue" },
  { id: COMBAT_PHASE_ATTACK, label: "Attack", shortLabel: "Attack", actionLabel: "End Combat" },
];

export function PhaseRail({ currentPhase, isAtFortifiedSite, canEndPhase, onEndPhase }: PhaseRailProps) {
  const currentIndex = PHASES.findIndex(p => p.id === currentPhase);
  const currentPhaseData = PHASES[currentIndex];

  return (
    <div className="phase-rail" role="navigation" aria-label="Combat phases">
      {isAtFortifiedSite && (
        <div className="phase-rail__badge phase-rail__badge--fortified">
          Fortified
        </div>
      )}

      <div className="phase-rail__track">
        {PHASES.map((phase, index) => {
          const isActive = phase.id === currentPhase;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div
              key={phase.id}
              className={[
                "phase-rail__phase",
                isActive && "phase-rail__phase--active",
                isCompleted && "phase-rail__phase--completed",
                isUpcoming && "phase-rail__phase--upcoming",
              ].filter(Boolean).join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="phase-rail__phase-number">
                {isCompleted ? "✓" : index + 1}
              </div>
              <div className="phase-rail__phase-label">
                <span className="phase-rail__phase-label-full">{phase.label}</span>
                <span className="phase-rail__phase-label-short">{phase.shortLabel}</span>
              </div>
              {/* Connector to next phase */}
              {index < PHASES.length - 1 && (
                <div
                  className={[
                    "phase-rail__connector",
                    isCompleted && "phase-rail__connector--completed",
                  ].filter(Boolean).join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Action button - always visible, integrated into the rail */}
      <button
        className={[
          "phase-rail__action",
          !canEndPhase && "phase-rail__action--disabled",
        ].filter(Boolean).join(" ")}
        onClick={onEndPhase}
        disabled={!canEndPhase}
        type="button"
        data-testid="end-combat-phase-btn"
      >
        <span className="phase-rail__action-label">
          {currentPhaseData?.actionLabel ?? "Continue"}
        </span>
        <span className="phase-rail__action-icon">→</span>
      </button>

      {/* Warning tooltip when can't proceed */}
      {!canEndPhase && currentPhase === COMBAT_PHASE_ASSIGN_DAMAGE && (
        <div className="phase-rail__warning">
          Assign all damage first
        </div>
      )}
    </div>
  );
}
