/**
 * GameplayTab - Debug controls for game state manipulation
 *
 * Provides controls for:
 * - Combat (enter/exit, add enemies)
 * - Cards (search and add to hand)
 * - Mana (crystals and tokens)
 * - Wounds
 * - Units
 * - Level
 * - Move Points
 */

import { useState } from "react";
import type { EnemyId, CardId, BasicManaColor, ManaColor, UnitId } from "@mage-knight/shared";
import { getEnemy, getUnit, UNIT_STATE_READY } from "@mage-knight/shared";
import type { DebugTabProps } from "./types";
import {
  ENEMIES,
  ALL_CARDS,
  MANA_COLORS,
  ALL_TOKEN_COLORS,
  UNITS,
  LEVEL_THRESHOLDS,
  LEVEL_STATS,
} from "./debugPanelData";

export function GameplayTab({ state, saveGame, loadGame }: DebugTabProps) {
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId>("diggers" as EnemyId);
  const [selectedUnit, setSelectedUnit] = useState<UnitId>("peasants" as UnitId);
  const [cardSearch, setCardSearch] = useState("");

  // Filter cards based on search
  const filteredCards = cardSearch.length > 0
    ? ALL_CARDS.filter(
        (c) =>
          c.name.toLowerCase().includes(cardSearch.toLowerCase()) ||
          c.category.toLowerCase().includes(cardSearch.toLowerCase()) ||
          c.id.toLowerCase().includes(cardSearch.toLowerCase())
      )
    : ALL_CARDS;

  const handleAddEnemy = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);

    if (!gameState.combat) {
      alert("Not in combat! Enter combat first, then add enemies.");
      return;
    }

    const newEnemyIndex = gameState.combat.enemies.length;
    const enemyDef = getEnemy(selectedEnemy);
    const newEnemy = {
      instanceId: `enemy_${newEnemyIndex}_debug_${Date.now()}`,
      enemyId: selectedEnemy,
      definition: enemyDef,
      isBlocked: false,
      isDefeated: false,
      damageAssigned: false,
    };

    gameState.combat.enemies.push(newEnemy);
    loadGame(JSON.stringify(gameState));
  };

  const handleAddCard = (cardId: CardId) => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    player.hand.push(cardId);
    loadGame(JSON.stringify(gameState));
  };

  const handleAddAllSpells = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    const allSpells = [
      "fireball",
      "flame_wall",
      "snowstorm",
      "restoration",
      "expose",
    ];
    player.hand.push(...allSpells);
    loadGame(JSON.stringify(gameState));
  };

  const handleAddCrystal = (color: BasicManaColor) => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    if (!player.crystals) {
      player.crystals = { red: 0, blue: 0, green: 0, white: 0 };
    }
    player.crystals[color] = (player.crystals[color] || 0) + 1;
    loadGame(JSON.stringify(gameState));
  };

  const handleAddAllCrystals = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    player.crystals = { red: 3, blue: 3, green: 3, white: 3 };
    loadGame(JSON.stringify(gameState));
  };

  const handleAddManaToken = (color: ManaColor) => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    if (!player.pureMana) {
      player.pureMana = [];
    }
    player.pureMana.push({ color, source: "debug" });
    loadGame(JSON.stringify(gameState));
  };

  const handleAddAllManaTokens = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    if (!player.pureMana) {
      player.pureMana = [];
    }
    player.pureMana.push(
      { color: "red", source: "debug" },
      { color: "blue", source: "debug" },
      { color: "green", source: "debug" },
      { color: "white", source: "debug" },
      { color: "black", source: "debug" },
      { color: "gold", source: "debug" }
    );
    loadGame(JSON.stringify(gameState));
  };

  const handleAddWound = (destination: "hand" | "discard") => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    if (destination === "hand") {
      player.hand.push("wound");
    } else {
      player.discard.push("wound");
    }
    loadGame(JSON.stringify(gameState));
  };

  const handleEnterCombat = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);

    if (gameState.combat) {
      alert("Already in combat!");
      return;
    }

    const enemyDef = getEnemy(selectedEnemy);
    gameState.combat = {
      phase: "ranged_siege",
      enemies: [
        {
          instanceId: "enemy_0_debug",
          enemyId: selectedEnemy,
          definition: enemyDef,
          isBlocked: false,
          isDefeated: false,
          damageAssigned: false,
        },
      ],
      woundsThisCombat: 0,
      attacksThisPhase: 0,
      fameGained: 0,
      isAtFortifiedSite: false,
      unitsAllowed: true,
      nightManaRules: false,
      assaultOrigin: null,
      allDamageBlockedThisPhase: false,
    };

    loadGame(JSON.stringify(gameState));
  };

  const handleExitCombat = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    gameState.combat = null;
    loadGame(JSON.stringify(gameState));
  };

  const handleAddUnit = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    const unitDef = getUnit(selectedUnit);
    const newUnit = {
      instanceId: `unit_${Date.now()}_debug`,
      unitId: selectedUnit,
      state: UNIT_STATE_READY,
      wounded: false,
      usedResistanceThisCombat: false,
    };

    if (!player.units) {
      player.units = [];
    }
    player.units.push(newUnit);
    loadGame(JSON.stringify(gameState));
    alert(`Added ${unitDef.name} to your units!`);
  };

  const handleLevelUp = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    if (player.level >= 10) {
      alert("Already at max level (10)!");
      return;
    }

    const newLevel = player.level + 1;
    const stats = LEVEL_STATS[newLevel];
    const fame = LEVEL_THRESHOLDS[newLevel - 1];
    if (!stats) return;

    player.level = newLevel;
    player.fame = fame;
    player.armor = stats.armor;
    player.handLimit = stats.handLimit;
    player.commandTokens = stats.commandSlots;

    loadGame(JSON.stringify(gameState));
  };

  const handleSetLevel = (targetLevel: number) => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    const stats = LEVEL_STATS[targetLevel];
    const fame = LEVEL_THRESHOLDS[targetLevel - 1];
    if (!stats) return;

    player.level = targetLevel;
    player.fame = fame;
    player.armor = stats.armor;
    player.handLimit = stats.handLimit;
    player.commandTokens = stats.commandSlots;

    loadGame(JSON.stringify(gameState));
  };

  const handleAddMovePoints = (amount: number) => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);
    const player = gameState.players[0];
    if (!player) return;

    player.movePoints = (player.movePoints || 0) + amount;
    loadGame(JSON.stringify(gameState));
  };

  return (
    <>
      {/* Combat Section */}
      <section className="debug-panel__section">
        <h4>Combat</h4>
        <div className="debug-panel__row">
          <span>Status: {state.combat ? "In Combat" : "Not in Combat"}</span>
        </div>
        <div className="debug-panel__row">
          {!state.combat ? (
            <button type="button" onClick={handleEnterCombat}>
              Enter Combat with Selected Enemy
            </button>
          ) : (
            <button type="button" onClick={handleExitCombat}>
              Exit Combat
            </button>
          )}
        </div>
        <div className="debug-panel__row">
          <select
            value={selectedEnemy}
            onChange={(e) => setSelectedEnemy(e.target.value as EnemyId)}
          >
            {ENEMIES.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.enemies.map((enemy) => (
                  <option key={enemy.id} value={enemy.id}>
                    {enemy.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={handleAddEnemy} disabled={!state.combat}>
            Add Enemy
          </button>
        </div>
      </section>

      {/* Cards Section */}
      <section className="debug-panel__section">
        <h4>Cards ({ALL_CARDS.length} total)</h4>
        <div className="debug-panel__row">
          <input
            type="text"
            placeholder="Search cards... (e.g. 'fire', 'spell', 'attack')"
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            className="debug-panel__search"
          />
        </div>
        {cardSearch.length > 0 && (
          <div className="debug-panel__card-list">
            {filteredCards.length === 0 ? (
              <div className="debug-panel__no-results">No cards found</div>
            ) : (
              filteredCards.slice(0, 10).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleAddCard(card.id)}
                  className="debug-panel__card-btn"
                  title={`Add ${card.name} to hand`}
                >
                  <span className="debug-panel__card-name">{card.name}</span>
                  <span className="debug-panel__card-category">{card.category}</span>
                </button>
              ))
            )}
            {filteredCards.length > 10 && (
              <div className="debug-panel__more">
                +{filteredCards.length - 10} more matches...
              </div>
            )}
          </div>
        )}
        <div className="debug-panel__row">
          <button type="button" onClick={handleAddAllSpells}>
            Add All Spells
          </button>
        </div>
      </section>

      {/* Mana Section */}
      <section className="debug-panel__section">
        <h4>Crystals & Mana</h4>
        <div className="debug-panel__row">
          {MANA_COLORS.map((mana) => (
            <button
              key={mana.id}
              type="button"
              onClick={() => handleAddCrystal(mana.id)}
              style={{ backgroundColor: mana.color, color: mana.id === "white" ? "#333" : "#fff" }}
              title={`Add ${mana.name} Crystal`}
            >
              +Crystal
            </button>
          ))}
          <button type="button" onClick={handleAddAllCrystals}>
            +All
          </button>
        </div>
        <div className="debug-panel__row">
          {ALL_TOKEN_COLORS.map((mana) => (
            <button
              key={mana.id}
              type="button"
              onClick={() => handleAddManaToken(mana.id)}
              style={{ backgroundColor: mana.color, color: mana.textColor }}
              title={`Add ${mana.name} Token`}
            >
              +Token
            </button>
          ))}
          <button type="button" onClick={handleAddAllManaTokens}>
            +All
          </button>
        </div>
      </section>

      {/* Wounds Section */}
      <section className="debug-panel__section">
        <h4>Wounds</h4>
        <div className="debug-panel__row">
          <button type="button" onClick={() => handleAddWound("hand")}>
            Add Wound to Hand
          </button>
          <button type="button" onClick={() => handleAddWound("discard")}>
            Add Wound to Discard
          </button>
        </div>
      </section>

      {/* Units Section */}
      <section className="debug-panel__section">
        <h4>Units</h4>
        <div className="debug-panel__row">
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value as UnitId)}
          >
            {UNITS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={handleAddUnit}>
            Add Unit
          </button>
        </div>
        <div className="debug-panel__row">
          <span>Current units: {state.players[0]?.units?.length ?? 0}</span>
        </div>
      </section>

      {/* Level Section */}
      <section className="debug-panel__section">
        <h4>Level ({state.players[0]?.level ?? 1})</h4>
        <div className="debug-panel__row">
          <button type="button" onClick={handleLevelUp} disabled={(state.players[0]?.level ?? 1) >= 10}>
            Level Up (+1)
          </button>
        </div>
        <div className="debug-panel__row debug-panel__level-buttons">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleSetLevel(lvl)}
              className={(state.players[0]?.level ?? 1) === lvl ? "debug-panel__level-active" : ""}
              title={`Set to Level ${lvl} (Fame: ${LEVEL_THRESHOLDS[lvl - 1]})`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <div className="debug-panel__row">
          <span>
            Fame: {state.players[0]?.fame ?? 0} | Armor: {state.players[0]?.armor ?? 2} |
            Hand: {state.players[0]?.handLimit ?? 5} | Commands: {state.players[0]?.commandTokens ?? 1}
          </span>
        </div>
      </section>

      {/* Move Points Section */}
      <section className="debug-panel__section">
        <h4>Move Points ({state.players[0]?.movePoints ?? 0})</h4>
        <div className="debug-panel__row">
          <button type="button" onClick={() => handleAddMovePoints(1)}>
            +1
          </button>
          <button type="button" onClick={() => handleAddMovePoints(5)}>
            +5
          </button>
          <button type="button" onClick={() => handleAddMovePoints(10)}>
            +10
          </button>
          <button type="button" onClick={() => handleAddMovePoints(100)}>
            +100
          </button>
        </div>
      </section>
    </>
  );
}
