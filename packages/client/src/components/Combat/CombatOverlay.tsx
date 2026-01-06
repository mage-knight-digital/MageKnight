/**
 * CombatOverlay - Main combat UI container
 *
 * Shows when state.combat is not null.
 * Contains: PhaseIndicator, EnemyList, CombatSummary, CombatActions
 */

import type { ClientCombatState, CombatOptions } from "@mage-knight/shared";
import { PhaseIndicator } from "./PhaseIndicator";
import { EnemyList } from "./EnemyList";
import { CombatSummary } from "./CombatSummary";
import { CombatActions } from "./CombatActions";

interface CombatOverlayProps {
  combat: ClientCombatState;
  combatOptions: CombatOptions;
}

export function CombatOverlay({ combat, combatOptions }: CombatOverlayProps) {
  const { phase, enemies, woundsThisCombat, fameGained, isAtFortifiedSite } = combat;

  return (
    <div className="combat-overlay">
      <div className="combat-overlay__content">
        <div className="combat-overlay__header">
          <h2 className="combat-overlay__title">
            Combat
            {isAtFortifiedSite && (
              <span className="combat-overlay__fortified"> (Fortified Site)</span>
            )}
          </h2>
          <PhaseIndicator phase={phase} />
        </div>

        <div className="combat-overlay__main">
          <EnemyList enemies={enemies} combatOptions={combatOptions} />

          <CombatSummary
            phase={phase}
            enemies={enemies}
            combatOptions={combatOptions}
            woundsThisCombat={woundsThisCombat}
            fameGained={fameGained}
          />
        </div>

        <div className="combat-overlay__footer">
          <CombatActions combatOptions={combatOptions} />
        </div>
      </div>
    </div>
  );
}
