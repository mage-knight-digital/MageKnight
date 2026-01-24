/**
 * @mage-knight/server
 * Server wrapper that connects the game engine to clients
 */

import {
  type GameState,
  type Player,
  type HexState,
  type HexEnemy,
  type TilePlacement,
  type TileSlot,
  type RngState,
  type TileDeck,
  type CombatState,
  type EnemyTokenPiles,
  createInitialGameState,
  MageKnightEngine,
  createEngine,
  Hero,
  HEROES,
  TileId,
  SiteType,
  placeTile,
  hexKey,
  shuffleWithRng,
  createEmptyCombatAccumulator,
  createManaSource,
  describeEffect,
  createTileDeck,
  drawTileFromDeck,
  generateTileSlots,
  getValidActions,
  createEnemyTokenPiles,
  drawEnemiesForHex,
  createUnitDecksAndOffer,
  createSpellDeckAndOffer,
  createAdvancedActionDeckAndOffer,
  serializeGameState,
  deserializeGameState,
  mineColorToBasicManaColor,
  countMonasteries,
  drawMonasteryAdvancedAction,
} from "@mage-knight/core";
import type { HexCoord, CardId } from "@mage-knight/shared";
import { TILE_PLACEMENT_OFFSETS } from "@mage-knight/shared";
import {
  LocalConnection,
  type GameConnection,
  type GameEngine,
  type PlayerAction,
  type ActionResult,
  type GameEvent,
  type ClientGameState,
  type ClientPlayer,
  type ClientPlayerUnit,
  type ClientManaToken,
  type ClientPendingChoice,
  type ClientCombatState,
  type ClientCombatEnemy,
  type ClientHexEnemy,
  type EventCallback,
  GAME_PHASE_ROUND,
  GAME_STARTED,
  ROUND_PHASE_TACTICS_SELECTION,
  ALL_DAY_TACTICS,
  INITIAL_MOVE_POINTS,
  STARTING_ARMOR,
  STARTING_COMMAND_TOKENS,
  STARTING_FAME,
  STARTING_HAND_LIMIT,
  STARTING_LEVEL,
  STARTING_REPUTATION,
} from "@mage-knight/shared";

// ============================================================================
// State conversion - full GameState to filtered ClientGameState
// ============================================================================

/**
 * Convert full GameState to ClientGameState for a specific player.
 * Filters sensitive information (other players' hands, deck contents, etc.)
 */
export function toClientState(
  state: GameState,
  forPlayerId: string
): ClientGameState {
  return {
    phase: state.phase,
    roundPhase: state.roundPhase,
    timeOfDay: state.timeOfDay,
    round: state.round,
    currentPlayerId: state.turnOrder[state.currentPlayerIndex] ?? "",
    turnOrder: state.turnOrder,
    endOfRoundAnnouncedBy: state.endOfRoundAnnouncedBy,

    players: state.players.map((player) =>
      toClientPlayer(player, forPlayerId)
    ),

    map: {
      hexes: Object.fromEntries(
        Object.entries(state.map.hexes).map(([key, hex]) => [
          key,
          {
            coord: hex.coord,
            terrain: hex.terrain,
            tileId: hex.tileId,
            site: hex.site
              ? {
                  type: hex.site.type,
                  owner: hex.site.owner,
                  isConquered: hex.site.isConquered,
                  isBurned: hex.site.isBurned,
                  ...(hex.site.cityColor && { cityColor: hex.site.cityColor }),
                  ...(hex.site.mineColor && { mineColor: hex.site.mineColor }),
                }
              : null,
            enemies: hex.enemies.map((enemy): ClientHexEnemy =>
              toClientHexEnemy(enemy)
            ),
            shieldTokens: [...hex.shieldTokens],
            rampagingEnemies: hex.rampagingEnemies.map(String),
          },
        ])
      ),
      tiles: state.map.tiles.map((tile) => ({
        centerCoord: tile.centerCoord,
        revealed: tile.revealed,
        // Only include tileId for revealed tiles to prevent map hacking
        ...(tile.revealed && { tileId: tile.tileId }),
      })),
      tileSlots: state.map.tileSlots,
    },

    source: {
      dice: state.source.dice.map((die) => {
        // Check if this die is stolen by any player's Mana Steal tactic
        const isStolenByTactic = state.players.some(
          (p) => p.tacticState.storedManaDie?.dieId === die.id
        );
        return {
          ...die,
          isStolenByTactic,
        };
      }),
    },

    offers: {
      units: state.offers.units,
      advancedActions: state.offers.advancedActions,
      spells: state.offers.spells,
      commonSkills: state.offers.commonSkills,
      monasteryAdvancedActions: state.offers.monasteryAdvancedActions ?? [],
    },

    combat: toClientCombatState(state.combat),

    // Only show deck counts, not contents
    deckCounts: {
      spells: state.decks.spells.length,
      advancedActions: state.decks.advancedActions.length,
      artifacts: state.decks.artifacts.length,
      regularUnits: state.decks.regularUnits.length,
      eliteUnits: state.decks.eliteUnits.length,
    },

    woundPileCount: state.woundPileCount,
    scenarioEndTriggered: state.scenarioEndTriggered,

    // Valid actions for this player
    validActions: getValidActions(state, forPlayerId),
  };
}

function toClientPlayer(player: Player, forPlayerId: string): ClientPlayer {
  const isCurrentPlayer = player.id === forPlayerId;

  return {
    id: player.id,
    heroId: player.hero,
    position: player.position,
    fame: player.fame,
    level: player.level,
    reputation: player.reputation,
    armor: player.armor,
    handLimit: player.handLimit,
    commandTokens: player.commandTokens,

    // Show full hand to self, only count to others
    hand: isCurrentPlayer ? player.hand : player.hand.length,
    deckCount: player.deck.length,
    discardCount: player.discard.length,
    playArea: player.playArea,

    units: player.units.map(
      (unit): ClientPlayerUnit => ({
        unitId: unit.unitId,
        state: unit.state,
        wounded: unit.wounded,
      })
    ),

    skills: player.skills,
    crystals: player.crystals,

    movePoints: player.movePoints,
    influencePoints: player.influencePoints,
    pureMana: player.pureMana.map(
      (token): ClientManaToken => ({
        color: token.color,
        source: token.source,
      })
    ),
    hasMovedThisTurn: player.hasMovedThisTurn,
    hasTakenActionThisTurn: player.hasTakenActionThisTurn,
    usedManaFromSource: player.usedManaFromSource,

    knockedOut: player.knockedOut,
    selectedTacticId: player.selectedTactic,
    tacticFlipped: player.tacticFlipped,

    pendingChoice: player.pendingChoice
      ? toClientPendingChoice(player.pendingChoice)
      : null,

    // Combat accumulator (attack/block values from played cards)
    combatAccumulator: {
      attack: {
        normal: player.combatAccumulator.attack.normal,
        ranged: player.combatAccumulator.attack.ranged,
        siege: player.combatAccumulator.attack.siege,
        normalElements: { ...player.combatAccumulator.attack.normalElements },
        rangedElements: { ...player.combatAccumulator.attack.rangedElements },
        siegeElements: { ...player.combatAccumulator.attack.siegeElements },
      },
      block: player.combatAccumulator.block,
      blockElements: { ...player.combatAccumulator.blockElements },
    },

    // Pending rewards from site conquest
    pendingRewards: player.pendingRewards,

    // Glade wound choice
    pendingGladeWoundChoice: player.pendingGladeWoundChoice,

    // Deep mine crystal choice (convert MineColor[] to BasicManaColor[])
    pendingDeepMineChoice: player.pendingDeepMineChoice
      ? player.pendingDeepMineChoice.map(mineColorToBasicManaColor)
      : null,

    // Healing points accumulated this turn
    healingPoints: player.healingPoints,

    // Stolen mana die from Mana Steal tactic
    stolenManaDie: player.tacticState.storedManaDie
      ? {
          dieId: player.tacticState.storedManaDie.dieId,
          color: player.tacticState.storedManaDie.color,
        }
      : null,
  };
}

function toClientPendingChoice(
  choice: NonNullable<Player["pendingChoice"]>
): ClientPendingChoice {
  return {
    cardId: choice.cardId,
    options: choice.options.map((effect) => ({
      type: effect.type,
      description: describeEffect(effect),
    })),
  };
}

/**
 * Convert a HexEnemy to ClientHexEnemy.
 * Masks the token ID when the enemy is unrevealed, only showing the color (token back).
 */
function toClientHexEnemy(enemy: HexEnemy): ClientHexEnemy {
  if (enemy.isRevealed) {
    // Revealed: include the token ID so client can display the enemy face
    return {
      color: enemy.color,
      isRevealed: true,
      tokenId: String(enemy.tokenId),
    };
  } else {
    // Unrevealed: only show the color (token back), no token ID
    return {
      color: enemy.color,
      isRevealed: false,
    };
  }
}

/**
 * Convert core CombatState to ClientCombatState.
 * Extracts enemy details from definitions for client display.
 */
function toClientCombatState(
  combat: CombatState | null
): ClientCombatState | null {
  if (!combat) return null;

  return {
    phase: combat.phase,
    enemies: combat.enemies.map(
      (enemy): ClientCombatEnemy => ({
        instanceId: enemy.instanceId,
        enemyId: enemy.enemyId,
        name: enemy.definition.name,
        attack: enemy.definition.attack,
        attackElement: enemy.definition.attackElement,
        armor: enemy.definition.armor,
        fame: enemy.definition.fame,
        abilities: enemy.definition.abilities,
        resistances: enemy.definition.resistances,
        isBlocked: enemy.isBlocked,
        isDefeated: enemy.isDefeated,
        damageAssigned: enemy.damageAssigned,
      })
    ),
    woundsThisCombat: combat.woundsThisCombat,
    fameGained: combat.fameGained,
    isAtFortifiedSite: combat.isAtFortifiedSite,
  };
}

// ============================================================================
// Multiplayer game server
// ============================================================================

/**
 * Manages the game and all connected players for multiplayer.
 * Broadcasts events and filtered state to all connected clients.
 */
export class GameServer {
  private engine: MageKnightEngine;
  private state: GameState;
  private readonly connections: Map<string, EventCallback> = new Map();
  private readonly seed: number | undefined;

  constructor(seed?: number) {
    this.engine = createEngine();
    this.seed = seed;
    this.state = createInitialGameState(seed);
  }

  /**
   * Initialize game with players.
   */
  initializeGame(playerIds: string[]): void {
    this.state = this.createGameWithPlayers(playerIds);

    // Broadcast initial state to all connected players
    this.broadcastState([
      {
        type: GAME_STARTED,
        playerCount: playerIds.length,
        scenario: "conquest", // placeholder
      },
    ]);
  }

  /**
   * Player connects and provides their callback for receiving events/state.
   */
  connect(playerId: string, callback: EventCallback): void {
    this.connections.set(playerId, callback);

    // Send current state to newly connected player
    const clientState = toClientState(this.state, playerId);
    callback([], clientState);
  }

  /**
   * Player disconnects.
   */
  disconnect(playerId: string): void {
    this.connections.delete(playerId);
  }

  /**
   * Player sends an action. Broadcasts result to ALL connected players.
   */
  handleAction(playerId: string, action: PlayerAction): void {
    // Process through engine
    const result = this.engine.processAction(this.state, playerId, action);

    // Update server state
    this.state = result.state;

    // Broadcast to all connected players
    this.broadcastState(result.events);
  }

  /**
   * Get current state (for testing/debugging).
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Get filtered state for a specific player.
   */
  getStateForPlayer(playerId: string): ClientGameState {
    return toClientState(this.state, playerId);
  }

  /**
   * Serialize current game state for saving.
   */
  saveGame(): string {
    return serializeGameState(this.state);
  }

  /**
   * Load a saved game state, replacing current state.
   * Broadcasts updated state to all connected clients.
   */
  loadGame(json: string): void {
    this.state = deserializeGameState(json);
    this.broadcastState([]);
  }

  /**
   * Broadcast events and filtered state to all connections.
   */
  private broadcastState(events: readonly GameEvent[]): void {
    for (const [playerId, callback] of this.connections) {
      const clientState = toClientState(this.state, playerId);
      callback(events, clientState);
    }
  }

  /**
   * Create initial game state with players.
   * Places starting tile + 2 initial countryside tiles and positions all players on the portal hex.
   * Uses seeded RNG for reproducible initial deck shuffles.
   */
  private createGameWithPlayers(playerIds: string[]): GameState {
    const baseState = createInitialGameState(this.seed);

    // Initialize tile deck based on scenario configuration
    const { tileDeck: initialDeck, rng: rngAfterDeck } = createTileDeck(
      baseState.scenarioConfig,
      baseState.rng
    );

    // Initialize enemy token piles FIRST so we can draw enemies as tiles are placed
    const { piles: initialEnemyPiles, rng: rngAfterEnemyInit } = createEnemyTokenPiles(rngAfterDeck);
    let currentEnemyPiles: EnemyTokenPiles = initialEnemyPiles;
    let currentRng: RngState = rngAfterEnemyInit;

    // Calculate total tiles for scenario
    const totalTiles =
      1 + // starting tile
      baseState.scenarioConfig.countrysideTileCount +
      baseState.scenarioConfig.coreTileCount +
      baseState.scenarioConfig.cityTileCount;

    // Generate tile slots based on map shape
    const slotsMap = generateTileSlots(
      baseState.scenarioConfig.mapShape,
      totalTiles
    );

    // Convert to Record and mark starting position as filled
    const tileSlots: Record<string, TileSlot> = {};
    for (const [key, slot] of slotsMap) {
      tileSlots[key] = slot;
    }

    // Place starting tile at origin
    const tileOrigin: HexCoord = { q: 0, r: 0 };
    const startingTileHexes = placeTile(TileId.StartingTileA, tileOrigin);

    // Mark starting slot as filled
    const originKey = hexKey(tileOrigin);
    if (tileSlots[originKey]) {
      tileSlots[originKey] = { ...tileSlots[originKey], filled: true };
    }

    // Build hex map starting with the starting tile (no enemies on starting tile)
    const hexes: Record<string, HexState> = {};
    for (const hex of startingTileHexes) {
      const key = hexKey(hex.coord);
      hexes[key] = hex;
    }

    // Track tile placements
    const tiles: TilePlacement[] = [
      {
        tileId: TileId.StartingTileA,
        centerCoord: tileOrigin,
        revealed: true,
      },
    ];

    // Place 2 initial countryside tiles adjacent to the starting tile
    // Per rulebook: Starting tile A has land edges at NE, E, NW
    // Tiles connect with 3 adjacent hex pairs (not overlapping)
    // Offsets match TILE_PLACEMENT_OFFSETS in explore/index.ts
    const initialTilePositions: HexCoord[] = [
      TILE_PLACEMENT_OFFSETS.NE, // NE direction: tiles touch along 3 edges
      TILE_PLACEMENT_OFFSETS.E,  // E direction: tiles touch along 3 edges
    ];

    // Track all hexes from initial tiles to count monasteries later
    const initialTileHexes: HexState[] = [];

    let currentDeck: TileDeck = initialDeck;
    for (const position of initialTilePositions) {
      const drawResult = drawTileFromDeck(currentDeck);
      if (drawResult) {
        const { tileId, updatedDeck } = drawResult;
        currentDeck = updatedDeck;

        // Place the tile and add its hexes to the map
        const tileHexes = placeTile(tileId, position);
        initialTileHexes.push(...tileHexes);
        for (const hex of tileHexes) {
          const key = hexKey(hex.coord);

          // Draw enemies for hexes that need them (sites with defenders, rampaging enemies)
          const rampagingTypes = [...hex.rampagingEnemies];

          const siteType = hex.site?.type ?? null;

          const { enemies, piles, rng } = drawEnemiesForHex(
            rampagingTypes,
            siteType,
            currentEnemyPiles,
            currentRng,
            baseState.timeOfDay
          );

          currentEnemyPiles = piles;
          currentRng = rng;

          // Update hex with drawn enemies
          // NOTE: Preserve rampagingEnemies marker - it's needed for movement validation
          // (validateNotBlockedByRampaging checks BOTH rampagingEnemies.length > 0 AND enemies.length > 0)
          hexes[key] = {
            ...hex,
            enemies: enemies,
          };
        }

        tiles.push({
          tileId,
          centerCoord: position,
          revealed: true,
        });

        // Mark slot as filled
        const posKey = hexKey(position);
        if (tileSlots[posKey]) {
          tileSlots[posKey] = { ...tileSlots[posKey], filled: true };
        }
      }
    }

    // Find portal hex for player starting position
    const portalHex = startingTileHexes.find((h) => h.site?.type === SiteType.Portal);
    const startPosition = portalHex?.coord ?? { q: 0, r: 0 };

    // Create players on the portal with seeded RNG for deck shuffles
    const players: Player[] = [];

    for (let index = 0; index < playerIds.length; index++) {
      const id = playerIds[index];
      if (id !== undefined) {
        const { player, rng } = this.createPlayer(id, index, startPosition, currentRng);
        players.push(player);
        currentRng = rng;
      }
    }

    // Set up tactics selection phase
    // In solo play, the single player selects first
    // In multiplayer, selection order is reverse fame (lowest fame picks first)
    // Since all players start at 0 fame, use player order
    const tacticsSelectionOrder = [...playerIds];

    // Initialize mana source with dice (playerCount + 2 dice)
    const { source, rng: rngAfterMana } = createManaSource(
      playerIds.length,
      baseState.timeOfDay,
      currentRng
    );

    // Initialize unit decks and populate initial unit offer
    const {
      decks: unitDecks,
      unitOffer,
      rng: rngAfterUnits,
    } = createUnitDecksAndOffer(
      baseState.scenarioConfig,
      playerIds.length,
      rngAfterMana
    );

    // Initialize spell deck and populate initial spell offer
    const {
      spellDeck,
      spellOffer,
      rng: rngAfterSpells,
    } = createSpellDeckAndOffer(rngAfterUnits);

    // Initialize advanced action deck and populate initial AA offer
    const {
      advancedActionDeck,
      advancedActionOffer,
      rng: rngAfterAA,
    } = createAdvancedActionDeckAndOffer(rngAfterSpells);

    // Draw Advanced Actions for any monasteries on initial tiles
    const monasteryCount = countMonasteries(initialTileHexes);
    let currentAADeck = advancedActionDeck;
    let monasteryAAs: readonly CardId[] = [];

    for (let i = 0; i < monasteryCount; i++) {
      const result = drawMonasteryAdvancedAction(
        { ...baseState.offers, monasteryAdvancedActions: monasteryAAs },
        { ...baseState.decks, advancedActions: currentAADeck }
      );
      currentAADeck = result.decks.advancedActions;
      monasteryAAs = result.offers.monasteryAdvancedActions;
    }

    return {
      ...baseState,
      phase: GAME_PHASE_ROUND,
      roundPhase: ROUND_PHASE_TACTICS_SELECTION,
      availableTactics: [...ALL_DAY_TACTICS],
      tacticsSelectionOrder,
      currentTacticSelector: tacticsSelectionOrder[0] ?? null,
      turnOrder: playerIds,
      currentPlayerIndex: 0,
      players,
      source,
      enemyTokens: currentEnemyPiles, // Enemy piles after drawing for initial tiles
      rng: rngAfterAA, // Updated RNG state after all shuffles
      decks: {
        ...baseState.decks,
        regularUnits: unitDecks.regularUnits,
        eliteUnits: unitDecks.eliteUnits,
        spells: spellDeck,
        advancedActions: currentAADeck,
      },
      offers: {
        ...baseState.offers,
        units: unitOffer,
        spells: { cards: [...spellOffer] },
        advancedActions: { cards: [...advancedActionOffer] },
        monasteryAdvancedActions: monasteryAAs,
      },
      map: {
        ...baseState.map,
        hexes,
        tiles,
        tileDeck: currentDeck, // Remaining tiles after initial placement
        tileSlots, // Tile slot grid for map shape constraints
      },
    };
  }

  /**
   * Create a player with default values.
   * Shuffles the hero's starting deck using seeded RNG and draws an initial hand.
   * Returns both the player and the updated RNG state.
   */
  private createPlayer(
    id: string,
    index: number,
    position: { q: number; r: number },
    rng: RngState
  ): { player: Player; rng: RngState } {
    const heroes: readonly Hero[] = [
      Hero.Arythea,
      Hero.Tovak,
      Hero.Goldyx,
      Hero.Norowas,
    ];
    const heroIndex = index % heroes.length;
    const hero = heroes[heroIndex] ?? Hero.Arythea;
    const heroDefinition = HEROES[hero];

    // Create and shuffle starting deck with seeded RNG
    const allCards = [...heroDefinition.startingCards];
    const { result: shuffledDeck, rng: newRng } = shuffleWithRng(allCards, rng);

    // Draw starting hand
    const handLimit = STARTING_HAND_LIMIT;
    const startingHand = shuffledDeck.slice(0, handLimit);
    const remainingDeck = shuffledDeck.slice(handLimit);

    const player: Player = {
      id,
      hero,
      position, // Start on the portal
      fame: STARTING_FAME,
      level: STARTING_LEVEL,
      reputation: STARTING_REPUTATION,
      armor: STARTING_ARMOR,
      handLimit,
      commandTokens: STARTING_COMMAND_TOKENS,
      hand: startingHand,
      deck: remainingDeck,
      discard: [],
      units: [],
      skills: [],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
      selectedTactic: null,
      tacticFlipped: false,
      tacticState: {},
      pendingTacticDecision: null,
      beforeTurnTacticPending: false,
      knockedOut: false,
      movePoints: INITIAL_MOVE_POINTS,
      influencePoints: 0,
      playArea: [],
      pureMana: [],
      usedManaFromSource: false,
      usedDieIds: [],
      manaDrawDieIds: [],
      hasMovedThisTurn: false,
      hasTakenActionThisTurn: false,
      hasCombattedThisTurn: false,
      manaUsedThisTurn: [],
      combatAccumulator: createEmptyCombatAccumulator(),
      pendingChoice: null,
      pendingLevelUps: [],
      pendingRewards: [],
      pendingGladeWoundChoice: false,
      pendingDeepMineChoice: null,
      healingPoints: 0,
    };

    return { player, rng: newRng };
  }
}

// ============================================================================
// Single-player game instance (uses LocalConnection)
// ============================================================================

export interface GameInstance {
  readonly engine: GameEngine;
  readonly connection: GameConnection;
}

/**
 * Adapter to make MageKnightEngine compatible with GameEngine interface.
 * Used for LocalConnection which expects GameEngine.
 */
class EngineAdapter implements GameEngine {
  private state: GameState;
  private readonly mageKnightEngine: MageKnightEngine;

  constructor(
    private readonly playerId: string,
    seed?: number
  ) {
    this.mageKnightEngine = createEngine();
    this.state = createInitialGameState(seed);
  }

  processAction(playerId: string, action: PlayerAction): ActionResult {
    const result = this.mageKnightEngine.processAction(
      this.state,
      playerId,
      action
    );
    this.state = result.state;
    return {
      events: result.events,
      state: toClientState(result.state, this.playerId),
    };
  }
}

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create a single-player game instance with LocalConnection.
 * @param playerId - The player's ID
 * @param seed - Optional seed for reproducible RNG
 */
export function createGame(playerId: string, seed?: number): GameInstance {
  const engineAdapter = new EngineAdapter(playerId, seed);
  const connection = new LocalConnection(engineAdapter, playerId);

  return {
    engine: engineAdapter,
    connection,
  };
}

/**
 * Create a multiplayer game server.
 * @param seed - Optional seed for reproducible RNG
 */
export function createGameServer(seed?: number): GameServer {
  return new GameServer(seed);
}

// Re-export types
export type { EventCallback } from "@mage-knight/shared";
