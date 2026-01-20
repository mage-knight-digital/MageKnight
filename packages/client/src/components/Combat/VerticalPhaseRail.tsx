/**
 * VerticalPhaseRail - Combat phase indicator
 *
 * Game-first design: icons over numbers, dramatic not transactional.
 * Shows combat flow: Ranged → Block → Damage → Attack
 */

import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
} from "@mage-knight/shared";
import "./VerticalPhaseRail.css";

interface VerticalPhaseRailProps {
  currentPhase: CombatPhase;
  canEndPhase: boolean;
  onEndPhase: () => void;
  /** All enemies can be defeated - highlight continue button */
  allEnemiesDefeatable?: boolean;
}

// Combat icons with instructions - thematic, not numbered checkout steps
const PHASES: { id: CombatPhase; label: string; icon: string; instruction: string }[] = [
  {
    id: COMBAT_PHASE_RANGED_SIEGE,
    label: "Ranged",
    icon: "🏹",
    instruction: "Strike from afar before enemies close in"
  },
  {
    id: COMBAT_PHASE_BLOCK,
    label: "Block",
    icon: "🛡️",
    instruction: "Defend against enemy attacks"
  },
  {
    id: COMBAT_PHASE_ASSIGN_DAMAGE,
    label: "Damage",
    icon: "💀",
    instruction: "Unblocked enemies deal damage"
  },
  {
    id: COMBAT_PHASE_ATTACK,
    label: "Attack",
    icon: "⚔️",
    instruction: "Finish off remaining enemies"
  },
];

export function VerticalPhaseRail({
  currentPhase,
  canEndPhase,
  onEndPhase,
  allEnemiesDefeatable = false,
}: VerticalPhaseRailProps) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);
  const isLastPhase = currentPhase === COMBAT_PHASE_ATTACK;
  const activePhase = PHASES.find((p) => p.id === currentPhase);
  const showReadyPulse = allEnemiesDefeatable && canEndPhase;

  return (
    <div className="vertical-phase-rail" role="navigation" aria-label="Combat phases">
      {/* Phase instruction - explains what to do */}
      {activePhase && (
        <div className="vertical-phase-rail__instruction">
          {activePhase.instruction}
        </div>
      )}

      {/* Phase markers - icons, not checkout steps */}
      <div className="vertical-phase-rail__track">
        {PHASES.map((phase, index) => {
          const isActive = phase.id === currentPhase;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div
              key={phase.id}
              className={[
                "vertical-phase-rail__phase",
                isActive && "vertical-phase-rail__phase--active",
                isCompleted && "vertical-phase-rail__phase--completed",
                isUpcoming && "vertical-phase-rail__phase--upcoming",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="vertical-phase-rail__phase-icon">
                {isCompleted ? "✓" : phase.icon}
              </div>
              <div className="vertical-phase-rail__phase-label">{phase.label}</div>
            </div>
          );
        })}
      </div>

      {/* Action - dramatic, not transactional */}
      <button
        className={[
          "vertical-phase-rail__action",
          isLastPhase && "vertical-phase-rail__action--finish",
          !canEndPhase && "vertical-phase-rail__action--disabled",
          showReadyPulse && "vertical-phase-rail__action--ready",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onEndPhase}
        disabled={!canEndPhase}
        type="button"
        data-testid="end-combat-phase-btn"
      >
        {isLastPhase ? "End Combat" : "→"}
      </button>

      {/* Warning - only when blocked */}
      {!canEndPhase && currentPhase === COMBAT_PHASE_ASSIGN_DAMAGE && (
        <div className="vertical-phase-rail__warning">Resolve damage</div>
      )}
    </div>
  );
}
