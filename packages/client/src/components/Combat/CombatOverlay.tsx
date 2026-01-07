/**
 * CombatOverlay - Main combat UI container
 *
 * Shows when state.combat is not null.
 * Contains: PhaseIndicator, EnemyList, CombatSummary, CombatActions, PlayerHand, EventLog
 */

import type { ClientCombatState, CombatOptions } from "@mage-knight/shared";
import { PhaseIndicator } from "./PhaseIndicator";
import { EnemyList } from "./EnemyList";
import { CombatSummary } from "./CombatSummary";
import { CombatActions } from "./CombatActions";
import { PlayerHand } from "../Hand/PlayerHand";
import { useGame } from "../../hooks/useGame";

interface CombatOverlayProps {
  combat: ClientCombatState;
  combatOptions: CombatOptions;
}

export function CombatOverlay({ combat, combatOptions }: CombatOverlayProps) {
  const { phase, enemies, woundsThisCombat, fameGained, isAtFortifiedSite } = combat;
  const { events } = useGame();

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

        {/* Event log */}
        <div className="combat-events" data-testid="combat-events">
          <h4 className="combat-events__title">Event Log ({events.length})</h4>
          <div className="combat-events__list">
            {events.length === 0 ? (
              <div className="combat-events__empty">No events yet</div>
            ) : (
              events.map((event, i) => (
                <div key={i} className="combat-events__item" data-testid={`event-${i}`}>
                  <span className="combat-events__type">{event.type}</span>
                  <pre className="combat-events__details">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Player hand inside combat overlay so it's clickable */}
        <div className="combat-overlay__hand">
          <PlayerHand />
        </div>
      </div>
    </div>
  );
}
