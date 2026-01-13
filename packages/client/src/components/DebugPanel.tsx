/**
 * DebugPanel - Development tools for testing the game
 *
 * Provides controls to:
 * - Add enemies to current combat
 * - Add cards to hand
 * - Add crystals/mana
 * - Import/export save files
 */

import { useState } from "react";
import { useGame } from "../hooks/useGame";
import type { EnemyId, CardId, BasicManaColor, ManaColor, UnitId } from "@mage-knight/shared";
import { getEnemy, getUnit, UNIT_STATE_READY } from "@mage-knight/shared";

// Enemy options grouped by color
const ENEMIES: { label: string; enemies: { id: EnemyId; name: string }[] }[] = [
  {
    label: "Green (Orcs)",
    enemies: [
      { id: "diggers" as EnemyId, name: "Diggers" },
      { id: "prowlers" as EnemyId, name: "Prowlers" },
      { id: "cursed_hags" as EnemyId, name: "Cursed Hags" },
      { id: "wolf_riders" as EnemyId, name: "Wolf Riders" },
      { id: "ironclads" as EnemyId, name: "Ironclads" },
      { id: "orc_summoners" as EnemyId, name: "Orc Summoners" },
    ],
  },
  {
    label: "Gray (Keep)",
    enemies: [
      { id: "crossbowmen" as EnemyId, name: "Crossbowmen" },
      { id: "guardsmen" as EnemyId, name: "Guardsmen" },
      { id: "swordsmen" as EnemyId, name: "Swordsmen" },
      { id: "golems" as EnemyId, name: "Golems" },
    ],
  },
  {
    label: "Brown (Dungeon)",
    enemies: [
      { id: "minotaur" as EnemyId, name: "Minotaur" },
      { id: "gargoyle" as EnemyId, name: "Gargoyle" },
      { id: "medusa" as EnemyId, name: "Medusa" },
      { id: "crypt_worm" as EnemyId, name: "Crypt Worm" },
      { id: "werewolf" as EnemyId, name: "Werewolf" },
      { id: "shadow" as EnemyId, name: "Shadow" },
    ],
  },
  {
    label: "Violet (Mage Tower)",
    enemies: [
      { id: "monks" as EnemyId, name: "Monks" },
      { id: "illusionists" as EnemyId, name: "Illusionists" },
      { id: "ice_mages" as EnemyId, name: "Ice Mages" },
      { id: "fire_mages" as EnemyId, name: "Fire Mages" },
      { id: "sorcerers" as EnemyId, name: "Sorcerers" },
    ],
  },
  {
    label: "Red (Draconum)",
    enemies: [
      { id: "fire_dragon" as EnemyId, name: "Fire Dragon" },
      { id: "ice_dragon" as EnemyId, name: "Ice Dragon" },
      { id: "swamp_dragon" as EnemyId, name: "Swamp Dragon" },
      { id: "high_dragon" as EnemyId, name: "High Dragon" },
    ],
  },
  {
    label: "White (City)",
    enemies: [
      { id: "thugs" as EnemyId, name: "Thugs" },
      { id: "shocktroops" as EnemyId, name: "Shocktroops" },
      { id: "ice_golems" as EnemyId, name: "Ice Golems" },
      { id: "fire_golems" as EnemyId, name: "Fire Golems" },
      { id: "freezers" as EnemyId, name: "Freezers" },
      { id: "altem_guardsmen" as EnemyId, name: "Altem Guardsmen" },
      { id: "altem_mages" as EnemyId, name: "Altem Mages" },
    ],
  },
];

// All available cards - flat list for search
const ALL_CARDS: { id: CardId; name: string; category: string }[] = [
  // Basic Actions
  { id: "rage" as CardId, name: "Rage", category: "Basic" },
  { id: "determination" as CardId, name: "Determination", category: "Basic" },
  { id: "swiftness" as CardId, name: "Swiftness", category: "Basic" },
  { id: "march" as CardId, name: "March", category: "Basic" },
  { id: "stamina" as CardId, name: "Stamina", category: "Basic" },
  { id: "tranquility" as CardId, name: "Tranquility", category: "Basic" },
  { id: "promise" as CardId, name: "Promise", category: "Basic" },
  { id: "threaten" as CardId, name: "Threaten", category: "Basic" },
  { id: "crystallize" as CardId, name: "Crystallize", category: "Basic" },
  { id: "mana_draw" as CardId, name: "Mana Draw", category: "Basic" },
  { id: "concentration" as CardId, name: "Concentration", category: "Basic" },
  { id: "improvisation" as CardId, name: "Improvisation", category: "Basic" },
  { id: "wound" as CardId, name: "Wound", category: "Basic" },
  // Spells (Red)
  { id: "fireball" as CardId, name: "Fireball", category: "Spell Red" },
  { id: "flame_wall" as CardId, name: "Flame Wall", category: "Spell Red" },
  { id: "tremor" as CardId, name: "Tremor", category: "Spell Red" },
  // Spells (Blue)
  { id: "snowstorm" as CardId, name: "Snowstorm", category: "Spell Blue" },
  { id: "chill" as CardId, name: "Chill", category: "Spell Blue" },
  // Spells (Green)
  { id: "restoration" as CardId, name: "Restoration", category: "Spell Green" },
  { id: "whirlwind" as CardId, name: "Whirlwind", category: "Spell Green" },
  // Spells (White)
  { id: "expose" as CardId, name: "Expose", category: "Spell White" },
  // Advanced Actions - Bolts
  { id: "fire_bolt" as CardId, name: "Fire Bolt", category: "Advanced" },
  { id: "ice_bolt" as CardId, name: "Ice Bolt", category: "Advanced" },
  { id: "swift_bolt" as CardId, name: "Swift Bolt", category: "Advanced" },
  { id: "crushing_bolt" as CardId, name: "Crushing Bolt", category: "Advanced" },
  // Advanced Actions - Red
  { id: "blood_rage" as CardId, name: "Blood Rage", category: "Advanced Red" },
  { id: "intimidate" as CardId, name: "Intimidate", category: "Advanced Red" },
  { id: "blood_ritual" as CardId, name: "Blood Ritual", category: "Advanced Red" },
  { id: "into_the_heat" as CardId, name: "Into the Heat", category: "Advanced Red" },
  { id: "decompose" as CardId, name: "Decompose", category: "Advanced Red" },
  { id: "maximal_effect" as CardId, name: "Maximal Effect", category: "Advanced Red" },
  { id: "counterattack" as CardId, name: "Counterattack", category: "Advanced Red" },
  { id: "ritual_attack" as CardId, name: "Ritual Attack", category: "Advanced Red" },
  { id: "blood_of_ancients" as CardId, name: "Blood of Ancients", category: "Advanced Red" },
  { id: "explosive_bolt" as CardId, name: "Explosive Bolt", category: "Advanced Red" },
  // Advanced Actions - Blue
  { id: "ice_shield" as CardId, name: "Ice Shield", category: "Advanced Blue" },
  { id: "frost_bridge" as CardId, name: "Frost Bridge", category: "Advanced Blue" },
  { id: "pure_magic" as CardId, name: "Pure Magic", category: "Advanced Blue" },
  { id: "steady_tempo" as CardId, name: "Steady Tempo", category: "Advanced Blue" },
  { id: "crystal_mastery" as CardId, name: "Crystal Mastery", category: "Advanced Blue" },
  { id: "magic_talent" as CardId, name: "Magic Talent", category: "Advanced Blue" },
  { id: "shield_bash" as CardId, name: "Shield Bash", category: "Advanced Blue" },
  { id: "temporal_portal" as CardId, name: "Temporal Portal", category: "Advanced Blue" },
  { id: "spell_forge" as CardId, name: "Spell Forge", category: "Advanced Blue" },
  // Advanced Actions - White
  { id: "agility" as CardId, name: "Agility", category: "Advanced White" },
  { id: "song_of_wind" as CardId, name: "Song of Wind", category: "Advanced White" },
  { id: "heroic_tale" as CardId, name: "Heroic Tale", category: "Advanced White" },
  { id: "diplomacy" as CardId, name: "Diplomacy", category: "Advanced White" },
  { id: "mana_storm" as CardId, name: "Mana Storm", category: "Advanced White" },
  { id: "learning" as CardId, name: "Learning", category: "Advanced White" },
  { id: "chivalry" as CardId, name: "Chivalry", category: "Advanced White" },
  { id: "peaceful_moment" as CardId, name: "Peaceful Moment", category: "Advanced White" },
  { id: "dodge_and_weave" as CardId, name: "Dodge and Weave", category: "Advanced White" },
  // Advanced Actions - Green
  { id: "refreshing_walk" as CardId, name: "Refreshing Walk", category: "Advanced Green" },
  { id: "path_finding" as CardId, name: "Path Finding", category: "Advanced Green" },
  { id: "regeneration" as CardId, name: "Regeneration", category: "Advanced Green" },
  { id: "in_need" as CardId, name: "In Need", category: "Advanced Green" },
  { id: "ambush" as CardId, name: "Ambush", category: "Advanced Green" },
  { id: "training" as CardId, name: "Training", category: "Advanced Green" },
  { id: "stout_resolve" as CardId, name: "Stout Resolve", category: "Advanced Green" },
  { id: "force_of_nature" as CardId, name: "Force of Nature", category: "Advanced Green" },
  { id: "mountain_lore" as CardId, name: "Mountain Lore", category: "Advanced Green" },
  { id: "power_of_crystals" as CardId, name: "Power of Crystals", category: "Advanced Green" },
  // Dual-color
  { id: "rush_of_adrenaline" as CardId, name: "Rush of Adrenaline", category: "Advanced Dual" },
  { id: "chilling_stare" as CardId, name: "Chilling Stare", category: "Advanced Dual" },
];

const MANA_COLORS: { id: BasicManaColor; name: string; color: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c" },
  { id: "blue", name: "Blue", color: "#3498db" },
  { id: "green", name: "Green", color: "#27ae60" },
  { id: "white", name: "White", color: "#ecf0f1" },
];

// All mana colors including special ones (for tokens)
const ALL_TOKEN_COLORS: { id: ManaColor; name: string; color: string; textColor: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c", textColor: "#fff" },
  { id: "blue", name: "Blue", color: "#3498db", textColor: "#fff" },
  { id: "green", name: "Green", color: "#27ae60", textColor: "#fff" },
  { id: "white", name: "White", color: "#ecf0f1", textColor: "#333" },
  { id: "black", name: "Black", color: "#2c3e50", textColor: "#fff" },
  { id: "gold", name: "Gold", color: "#f1c40f", textColor: "#333" },
];

// Units grouped by type and level
const UNITS: { label: string; units: { id: UnitId; name: string }[] }[] = [
  {
    label: "Regular (Level 1)",
    units: [
      { id: "peasants" as UnitId, name: "Peasants" },
      { id: "foresters" as UnitId, name: "Foresters" },
      { id: "herbalist" as UnitId, name: "Herbalist" },
      { id: "scouts" as UnitId, name: "Scouts" },
      { id: "thugs" as UnitId, name: "Thugs" },
    ],
  },
  {
    label: "Regular (Level 2)",
    units: [
      { id: "utem_crossbowmen" as UnitId, name: "Utem Crossbowmen" },
      { id: "utem_guardsmen" as UnitId, name: "Utem Guardsmen" },
      { id: "utem_swordsmen" as UnitId, name: "Utem Swordsmen" },
      { id: "guardian_golems" as UnitId, name: "Guardian Golems" },
      { id: "illusionists" as UnitId, name: "Illusionists" },
      { id: "shocktroops" as UnitId, name: "Shocktroops" },
      { id: "red_cape_monks" as UnitId, name: "Red Cape Monks" },
      { id: "northern_monks" as UnitId, name: "Northern Monks" },
      { id: "savage_monks" as UnitId, name: "Savage Monks" },
      { id: "magic_familiars" as UnitId, name: "Magic Familiars" },
    ],
  },
  {
    label: "Elite (Level 3)",
    units: [
      { id: "fire_mages" as UnitId, name: "Fire Mages" },
      { id: "ice_mages" as UnitId, name: "Ice Mages" },
      { id: "fire_golems" as UnitId, name: "Fire Golems" },
      { id: "ice_golems" as UnitId, name: "Ice Golems" },
      { id: "sorcerers" as UnitId, name: "Sorcerers" },
      { id: "catapults" as UnitId, name: "Catapults" },
      { id: "amotep_gunners" as UnitId, name: "Amotep Gunners" },
      { id: "amotep_freezers" as UnitId, name: "Amotep Freezers" },
      { id: "heroes" as UnitId, name: "Heroes" },
    ],
  },
  {
    label: "Elite (Level 4)",
    units: [
      { id: "altem_mages" as UnitId, name: "Altem Mages" },
      { id: "altem_guardians" as UnitId, name: "Altem Guardians" },
      { id: "delphana_masters" as UnitId, name: "Delphana Masters" },
    ],
  },
];

// Level thresholds and stats from shared/levels.ts
const LEVEL_THRESHOLDS = [0, 3, 8, 14, 21, 29, 38, 48, 59, 71];
const LEVEL_STATS: Record<number, { armor: number; handLimit: number; commandSlots: number }> = {
  1: { armor: 2, handLimit: 5, commandSlots: 1 },
  2: { armor: 2, handLimit: 5, commandSlots: 1 },
  3: { armor: 3, handLimit: 5, commandSlots: 2 },
  4: { armor: 3, handLimit: 5, commandSlots: 2 },
  5: { armor: 3, handLimit: 6, commandSlots: 3 },
  6: { armor: 3, handLimit: 6, commandSlots: 3 },
  7: { armor: 4, handLimit: 6, commandSlots: 4 },
  8: { armor: 4, handLimit: 6, commandSlots: 4 },
  9: { armor: 4, handLimit: 7, commandSlots: 5 },
  10: { armor: 4, handLimit: 7, commandSlots: 5 },
};

export function DebugPanel() {
  const { state, saveGame, loadGame } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyId>("diggers" as EnemyId);
  const [selectedUnit, setSelectedUnit] = useState<UnitId>("peasants" as UnitId);
  const [cardSearch, setCardSearch] = useState("");

  if (!state) return null;

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

    // Add new enemy to combat with full definition
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
    // Add one of each color
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

  const handleExportState = () => {
    const json = saveGame();
    if (!json) return;

    const formatted = JSON.stringify(JSON.parse(json), null, 2);
    const blob = new Blob([formatted], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mage-knight-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportState = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      try {
        JSON.parse(json); // Validate JSON
        loadGame(json);
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleEnterCombat = () => {
    const json = saveGame();
    if (!json) return;

    const gameState = JSON.parse(json);

    if (gameState.combat) {
      alert("Already in combat!");
      return;
    }

    // Create a test combat with the selected enemy (including full definition)
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

    // Create a new unit instance
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

  if (!isOpen) {
    return (
      <button
        className="debug-panel__toggle"
        onClick={() => setIsOpen(true)}
        title="Open Debug Panel"
        type="button"
      >
        🛠️
      </button>
    );
  }

  return (
    <div className="debug-panel">
      <div className="debug-panel__header">
        <h3>Debug Panel</h3>
        <button type="button" onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="debug-panel__content">
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
                +💎
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
                +🔮
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

        {/* Import/Export Section */}
        <section className="debug-panel__section">
          <h4>Save/Load</h4>
          <div className="debug-panel__row">
            <span className="debug-panel__label">Quick Slots:</span>
            {[0, 1, 2].map((slotIndex) => {
              const slotKey = `mageKnight_save_${slotIndex}`;
              const hasSave = localStorage.getItem(slotKey) !== null;
              return (
                <div key={slotIndex} className="debug-panel__save-slot">
                  <button
                    type="button"
                    onClick={() => {
                      const json = saveGame();
                      if (json) {
                        localStorage.setItem(slotKey, json);
                        alert(`Saved to slot ${slotIndex + 1}`);
                      }
                    }}
                    title={`Save to slot ${slotIndex + 1}`}
                  >
                    S{slotIndex + 1}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const json = localStorage.getItem(slotKey);
                      if (json) loadGame(json);
                    }}
                    disabled={!hasSave}
                    title={hasSave ? `Load slot ${slotIndex + 1}` : "Empty slot"}
                  >
                    L{slotIndex + 1}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="debug-panel__row">
            <button type="button" onClick={handleExportState}>
              Export State
            </button>
            <label className="debug-panel__file-input">
              Import State
              <input
                type="file"
                accept=".json"
                onChange={handleImportState}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
