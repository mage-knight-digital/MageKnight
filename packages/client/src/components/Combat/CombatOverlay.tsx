/**
 * CombatOverlay - Main combat UI container
 *
 * Shows when state.combat is not null.
 * Two-column layout: left has combat info, right has event log.
 * Contains: PhaseIndicator, EnemyList, CombatSummary, CombatActions, PlayerHand
 */

import type { ClientCombatState, CombatOptions } from "@mage-knight/shared";
import { UNDO_ACTION, COMBAT_PHASE_ATTACK, COMBAT_PHASE_BLOCK } from "@mage-knight/shared";
import { PhaseIndicator } from "./PhaseIndicator";
import { EnemyList } from "./EnemyList";
import { CombatSummary } from "./CombatSummary";
import { CombatActions } from "./CombatActions";
import { PlayerHand } from "../Hand/PlayerHand";
import { SaveLoadControls } from "../SaveLoadControls";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";

interface CombatOverlayProps {
  combat: ClientCombatState;
  combatOptions: CombatOptions;
}

function AccumulatorDisplay() {
  const player = useMyPlayer();
  const { state } = useGame();

  if (!player || !state?.combat) return null;

  const phase = state.combat.phase;
  const acc = player.combatAccumulator;

  // Show attack accumulator in attack phase
  if (phase === COMBAT_PHASE_ATTACK) {
    const { attack } = acc;
    const hasAttack = attack.normal > 0 || attack.ranged > 0 || attack.siege > 0;

    if (!hasAttack) {
      return (
        <div className="combat-accumulator">
          <span className="combat-accumulator__label">Attack:</span>
          <span className="combat-accumulator__empty">None yet</span>
        </div>
      );
    }

    return (
      <div className="combat-accumulator">
        <span className="combat-accumulator__label">Attack:</span>
        <div className="combat-accumulator__values">
          {attack.normal > 0 && (
            <span className="combat-accumulator__value combat-accumulator__value--melee">
              {attack.normal} Melee
              {attack.normalElements.physical > 0 && ` (${attack.normalElements.physical} phys)`}
              {attack.normalElements.fire > 0 && ` (${attack.normalElements.fire} fire)`}
              {attack.normalElements.ice > 0 && ` (${attack.normalElements.ice} ice)`}
              {attack.normalElements.coldFire > 0 && ` (${attack.normalElements.coldFire} coldfire)`}
            </span>
          )}
          {attack.ranged > 0 && (
            <span className="combat-accumulator__value combat-accumulator__value--ranged">
              {attack.ranged} Ranged
              {attack.rangedElements.fire > 0 && ` (${attack.rangedElements.fire} fire)`}
              {attack.rangedElements.ice > 0 && ` (${attack.rangedElements.ice} ice)`}
            </span>
          )}
          {attack.siege > 0 && (
            <span className="combat-accumulator__value combat-accumulator__value--siege">
              {attack.siege} Siege
              {attack.siegeElements.fire > 0 && ` (${attack.siegeElements.fire} fire)`}
              {attack.siegeElements.ice > 0 && ` (${attack.siegeElements.ice} ice)`}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Show block accumulator in block phase
  if (phase === COMBAT_PHASE_BLOCK) {
    const hasBlock = acc.block > 0;

    if (!hasBlock) {
      return (
        <div className="combat-accumulator">
          <span className="combat-accumulator__label">Block:</span>
          <span className="combat-accumulator__empty">None yet</span>
        </div>
      );
    }

    return (
      <div className="combat-accumulator">
        <span className="combat-accumulator__label">Block:</span>
        <div className="combat-accumulator__values">
          <span className="combat-accumulator__value combat-accumulator__value--block">
            {acc.block} Block
            {acc.blockElements.physical > 0 && ` (${acc.blockElements.physical} phys)`}
            {acc.blockElements.fire > 0 && ` (${acc.blockElements.fire} fire)`}
            {acc.blockElements.ice > 0 && ` (${acc.blockElements.ice} ice)`}
            {acc.blockElements.coldFire > 0 && ` (${acc.blockElements.coldFire} coldfire)`}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export function CombatOverlay({ combat, combatOptions }: CombatOverlayProps) {
  const { phase, enemies, woundsThisCombat, fameGained, isAtFortifiedSite } = combat;
  const { state, events, sendAction } = useGame();
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  return (
    <div className="combat-overlay" data-testid="combat-overlay">
      <div className="combat-overlay__content">
        <div className="combat-overlay__header" data-testid="combat-overlay-header">
          <h2 className="combat-overlay__title">
            Combat
            {isAtFortifiedSite && (
              <span className="combat-overlay__fortified"> (Fortified Site)</span>
            )}
          </h2>
          <div className="combat-overlay__header-actions">
            <SaveLoadControls compact />
            {canUndo && (
              <button
                className="combat-overlay__undo-btn"
                onClick={() => sendAction({ type: UNDO_ACTION })}
                data-testid="combat-undo-button"
                type="button"
              >
                Undo
              </button>
            )}
            <PhaseIndicator phase={phase} />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="combat-overlay__body">
          {/* Left column: combat content */}
          <div className="combat-overlay__left">
            <div className="combat-overlay__main">
              <EnemyList enemies={enemies} combatOptions={combatOptions} />

              <AccumulatorDisplay />

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

            {/* Player hand inside combat overlay so it's clickable */}
            <div className="combat-overlay__hand">
              <PlayerHand />
            </div>
          </div>

          {/* Right column: event log */}
          <div className="combat-overlay__right">
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
          </div>
        </div>
      </div>
    </div>
  );
}
