/**
 * PhaseIndicator - Shows the current combat phase
 */

const PHASE_LABELS: Record<string, string> = {
  ranged_siege: "Ranged & Siege Phase",
  block: "Block Phase",
  assign_damage: "Assign Damage Phase",
  attack: "Attack Phase",
};

const PHASE_ORDER = ["ranged_siege", "block", "assign_damage", "attack"];

interface PhaseIndicatorProps {
  phase: string;
}

export function PhaseIndicator({ phase }: PhaseIndicatorProps) {
  return (
    <div className="combat-phase-indicator">
      <div className="combat-phase-indicator__label">Combat Phase</div>
      <div className="combat-phase-indicator__steps">
        {PHASE_ORDER.map((p) => (
          <div
            key={p}
            className={`combat-phase-indicator__step ${p === phase ? "combat-phase-indicator__step--active" : ""}`}
          >
            {PHASE_LABELS[p]}
          </div>
        ))}
      </div>
    </div>
  );
}
