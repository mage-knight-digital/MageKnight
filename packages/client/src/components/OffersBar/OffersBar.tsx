/**
 * OffersBar - Top bar with tabs for game offers (units, spells, AAs, level track)
 *
 * Designed to be position-flexible: can be moved to top, left, right, or bottom.
 * Each tab expands a flyout panel with the offer contents.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { getUnitSpriteStyle, isAtlasLoaded } from "../../utils/cardAtlas";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  RECRUIT_UNIT_ACTION,
  CARD_PLAYED,
  COMBAT_STARTED,
  ENEMY_DEFEATED,
  FAME_GAINED,
  INVALID_ACTION,
  LEVEL_UP,
  PLAYER_MOVED,
  TACTIC_SELECTED,
  TILE_EXPLORED,
  TURN_ENDED,
  UNDO_CHECKPOINT_SET,
  WOUND_RECEIVED,
  type UnitId,
  type GameEvent,
} from "@mage-knight/shared";
import "./OffersBar.css";

const DEFAULT_UNIT_CARD_HEIGHT = 140;

/**
 * Hook to get responsive unit card height from CSS custom property
 */
function useUnitCardHeight(gridRef: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(DEFAULT_UNIT_CARD_HEIGHT);

  const updateHeight = useCallback(() => {
    if (gridRef.current) {
      const computed = getComputedStyle(gridRef.current);
      const cssHeight = computed.getPropertyValue("--unit-card-height");
      if (cssHeight) {
        const parsed = parseInt(cssHeight, 10);
        if (!isNaN(parsed) && parsed !== height) {
          setHeight(parsed);
        }
      }
    }
  }, [gridRef, height]);

  useEffect(() => {
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [updateHeight]);

  return height;
}

type TabId = "units" | "spells" | "advancedActions" | "level" | "events";

interface Tab {
  id: TabId;
  label: string;
  shortLabel: string; // For narrow screens / controller
}

const TABS: Tab[] = [
  { id: "units", label: "Unit Offer", shortLabel: "Units" },
  { id: "spells", label: "Spell Offer", shortLabel: "Spells" },
  { id: "advancedActions", label: "Advanced Actions", shortLabel: "AAs" },
  { id: "level", label: "Level Track", shortLabel: "Level" },
  { id: "events", label: "Event Log", shortLabel: "Events" },
];

export function OffersBar() {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  const handleTabClick = (tabId: TabId) => {
    setActiveTab((current) => (current === tabId ? null : tabId));
  };

  const handleClose = () => {
    setActiveTab(null);
  };

  return (
    <div className="offers-bar">
      <div className="offers-bar__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`offers-bar__tab ${activeTab === tab.id ? "offers-bar__tab--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="offers-bar__tab-label">{tab.label}</span>
            <span className="offers-bar__tab-short">{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {activeTab && (
        <div className="offers-bar__flyout">
          <div className="offers-bar__flyout-header">
            <h3>{TABS.find((t) => t.id === activeTab)?.label}</h3>
            <button className="offers-bar__close" onClick={handleClose}>
              &times;
            </button>
          </div>
          <div className="offers-bar__flyout-content">
            {activeTab === "units" && <UnitOfferContent />}
            {activeTab === "spells" && <SpellOfferContent />}
            {activeTab === "advancedActions" && <AdvancedActionsContent />}
            {activeTab === "level" && <LevelTrackContent />}
            {activeTab === "events" && <EventLogContent />}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab Content Components
// ============================================================================

function UnitOfferContent() {
  const { state, sendAction } = useGame();
  const gridRef = useRef<HTMLDivElement>(null);
  const cardHeight = useUnitCardHeight(gridRef);

  if (!state) return <div className="offers-bar__empty">Loading...</div>;

  const unitOffer = state.offers.units;
  const recruitableUnits = state.validActions?.units?.recruitable ?? [];
  const recruitableMap = new Map(recruitableUnits.map((r) => [r.unitId, r]));

  const handleRecruit = (unitId: string, cost: number) => {
    sendAction({
      type: RECRUIT_UNIT_ACTION,
      unitId: unitId as UnitId,
      influenceSpent: cost,
    });
  };

  return (
    <div className="offers-bar__grid" ref={gridRef}>
      {unitOffer.length === 0 ? (
        <div className="offers-bar__empty">No units available</div>
      ) : (
        unitOffer.map((unitId, index) => {
          const unit = UNITS[unitId];
          const recruitInfo = recruitableMap.get(unitId);
          const canRecruit = recruitInfo?.canAfford ?? false;
          const spriteStyle = isAtlasLoaded() ? getUnitSpriteStyle(unitId, cardHeight) : null;
          const isElite = unit?.type === UNIT_TYPE_ELITE;

          if (!unit) return null;

          return (
            <div
              key={`${unitId}-${index}`}
              className={`offers-bar__unit-card ${isElite ? "offers-bar__unit-card--elite" : ""}`}
            >
              {spriteStyle ? (
                <div className="offers-bar__unit-image" style={spriteStyle} />
              ) : (
                <div className="offers-bar__unit-fallback">
                  <div className="offers-bar__unit-name">{unit.name}</div>
                  <div className="offers-bar__unit-stats">
                    Lvl {unit.level} | Armor {unit.armor}
                  </div>
                </div>
              )}
              <div className="offers-bar__unit-cost">
                {recruitInfo ? recruitInfo.cost : unit.influence}
              </div>
              {recruitInfo && (
                <button
                  className={`offers-bar__recruit-btn ${canRecruit ? "" : "offers-bar__recruit-btn--disabled"}`}
                  onClick={() =>
                    canRecruit && handleRecruit(unitId, recruitInfo.cost)
                  }
                  disabled={!canRecruit}
                >
                  {canRecruit ? "Recruit" : `Need ${recruitInfo.cost}`}
                </button>
              )}
            </div>
          );
        })
      )}
      <div className="offers-bar__deck-info">
        Decks: {state.deckCounts.regularUnits} regular,{" "}
        {state.deckCounts.eliteUnits} elite
      </div>
    </div>
  );
}

function SpellOfferContent() {
  const { state } = useGame();

  if (!state) return <div className="offers-bar__empty">Loading...</div>;

  const spellOffer = state.offers.spells;

  return (
    <div className="offers-bar__grid">
      {spellOffer.cards.length === 0 ? (
        <div className="offers-bar__empty">No spells available</div>
      ) : (
        spellOffer.cards.map((spellId, index) => (
          <div key={`${spellId}-${index}`} className="offers-bar__spell-card">
            <span className="offers-bar__spell-name">{spellId}</span>
          </div>
        ))
      )}
      <div className="offers-bar__deck-info">
        Deck: {state.deckCounts.spells} spells remaining
      </div>
    </div>
  );
}

function AdvancedActionsContent() {
  const { state } = useGame();

  if (!state) return <div className="offers-bar__empty">Loading...</div>;

  const aaOffer = state.offers.advancedActions;

  return (
    <div className="offers-bar__grid">
      {aaOffer.cards.length === 0 ? (
        <div className="offers-bar__empty">No advanced actions available</div>
      ) : (
        aaOffer.cards.map((aaId, index) => (
          <div key={`${aaId}-${index}`} className="offers-bar__aa-card">
            <span className="offers-bar__aa-name">{aaId}</span>
          </div>
        ))
      )}
      <div className="offers-bar__deck-info">
        Deck: {state.deckCounts.advancedActions} AAs remaining
      </div>
    </div>
  );
}

function LevelTrackContent() {
  const player = useMyPlayer();

  if (!player) return <div className="offers-bar__empty">Loading...</div>;

  // Level track shows progression and upcoming rewards
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="offers-bar__level-track">
      <div className="offers-bar__level-current">
        Current Level: <strong>{player.level}</strong>
      </div>
      <div className="offers-bar__level-fame">
        Fame: <strong>{player.fame}</strong>
      </div>
      <div className="offers-bar__level-progress">
        {levels.map((level) => (
          <div
            key={level}
            className={`offers-bar__level-pip ${level <= player.level ? "offers-bar__level-pip--achieved" : ""} ${level === player.level ? "offers-bar__level-pip--current" : ""}`}
          >
            {level}
          </div>
        ))}
      </div>
      <div className="offers-bar__level-info">
        Command Tokens: {player.commandTokens} | Armor: {player.armor}
      </div>
    </div>
  );
}

function formatEventDetails(event: GameEvent): string {
  switch (event.type) {
    case PLAYER_MOVED:
      return `(${event.from.q},${event.from.r}) → (${event.to.q},${event.to.r})`;
    case CARD_PLAYED:
      return `${event.cardId}${event.powered ? " [powered]" : ""}${event.sideways ? " [sideways]" : ""} - ${event.effect}`;
    case INVALID_ACTION:
      return `${event.actionType}: ${event.reason}`;
    case TACTIC_SELECTED:
      return `${event.tacticId} (turn order: ${event.turnOrder})`;
    case TURN_ENDED:
      return `discarded ${event.cardsDiscarded}, drew ${event.cardsDrawn}`;
    case FAME_GAINED:
      return `+${event.amount} (now ${event.newTotal}) - ${event.source}`;
    case COMBAT_STARTED:
      return event.enemies.map(e => `${e.name} (${e.attack}/${e.armor})`).join(", ");
    case ENEMY_DEFEATED:
      return `${event.enemyName} (+${event.fameGained} fame)`;
    case WOUND_RECEIVED:
      return `from ${event.source}`;
    case LEVEL_UP:
      return `${event.oldLevel} → ${event.newLevel}`;
    case TILE_EXPLORED:
      return `${event.tileId} at (${event.position.q},${event.position.r})`;
    case UNDO_CHECKPOINT_SET:
      return event.reason;
    default:
      return "";
  }
}

function EventLogContent() {
  const { events } = useGame();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="offers-bar__event-log" ref={scrollRef}>
      {events.length === 0 ? (
        <div className="offers-bar__empty">No events yet</div>
      ) : (
        events.map((event, i) => {
          const details = formatEventDetails(event);
          return (
            <div key={i} className="offers-bar__event">
              <div className={`offers-bar__event-type ${event.type === INVALID_ACTION ? "offers-bar__event-type--error" : ""}`}>
                {event.type}
              </div>
              {details && (
                <div className="offers-bar__event-details">{details}</div>
              )}
              <pre className="offers-bar__event-json">
                {JSON.stringify(event, null, 2)}
              </pre>
            </div>
          );
        })
      )}
    </div>
  );
}
