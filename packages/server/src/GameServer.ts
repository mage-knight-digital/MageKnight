/**
 * GameServer Module
 *
 * Manages multiplayer game state and player connections.
 * Broadcasts events and filtered state to all connected clients.
 */

import {
  type GameState,
  type Player,
  type HexState,
  type RngState,
  type TileDeck,
  type EnemyTokenPiles,
  type RuinsTokenPiles,
  type TilePlacement,
  type TileSlot,
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
  createTileDeck,
  drawTileFromDeck,
  generateTileSlots,
  createEnemyTokenPiles,
  drawEnemiesForHex,
  createRuinsTokenPiles,
  drawRuinsToken,
  createUnitDecksAndOffer,
  createSpellDeckAndOffer,
  createAdvancedActionDeckAndOffer,
  createArtifactDeck,
  serializeGameState,
  deserializeGameState,
  countMonasteries,
  drawMonasteryAdvancedAction,
} from "@mage-knight/core";
import type { HexCoord, CardId, HeroId, ScenarioId } from "@mage-knight/shared";
import {
  TILE_PLACEMENT_OFFSETS,
  MAP_SHAPE_CONFIGS,
  SCENARIO_FIRST_RECONNAISSANCE,
} from "@mage-knight/shared";
import type {
  PlayerAction,
  GameEvent,
  ClientGameState,
  EventCallback,
} from "@mage-knight/shared";
import {
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
import { toClientState } from "./stateFilters.js";

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
   * @param playerIds - Array of player IDs (e.g., ["player1", "player2"])
   * @param heroIds - Optional array of hero IDs corresponding to each player.
   *                  If not provided, heroes are assigned in default order (Arythea, Tovak, Goldyx, Norowas).
   * @param scenarioId - Optional scenario to play. Defaults to First Reconnaissance.
   */
  initializeGame(
    playerIds: readonly string[],
    heroIds?: readonly HeroId[],
    scenarioId: ScenarioId = SCENARIO_FIRST_RECONNAISSANCE
  ): void {
    this.state = this.createGameWithPlayers(playerIds, heroIds, scenarioId);

    // Broadcast initial state to all connected players
    this.broadcastState([
      {
        type: GAME_STARTED,
        playerCount: playerIds.length,
        scenario: scenarioId,
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
   * @param playerIds - Array of player IDs
   * @param heroIds - Optional array of hero IDs for each player. Falls back to default order.
   * @param scenarioId - Scenario to play
   */
  private createGameWithPlayers(
    playerIds: readonly string[],
    heroIds?: readonly HeroId[],
    scenarioId: ScenarioId = SCENARIO_FIRST_RECONNAISSANCE
  ): GameState {
    const baseState = createInitialGameState(this.seed, scenarioId);

    // Initialize tile deck based on scenario configuration
    const { tileDeck: initialDeck, rng: rngAfterDeck } = createTileDeck(
      baseState.scenarioConfig,
      baseState.rng
    );

    // Initialize enemy token piles FIRST so we can draw enemies as tiles are placed
    const { piles: initialEnemyPiles, rng: rngAfterEnemyInit } =
      createEnemyTokenPiles(rngAfterDeck);
    let currentEnemyPiles: EnemyTokenPiles = initialEnemyPiles;

    // Initialize ruins token piles for Ancient Ruins yellow tokens
    const { piles: initialRuinsPiles, rng: rngAfterRuinsInit } =
      createRuinsTokenPiles(rngAfterEnemyInit);
    let currentRuinsPiles: RuinsTokenPiles = initialRuinsPiles;
    let currentRng: RngState = rngAfterRuinsInit;

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

    // Get map shape configuration
    const mapShapeConfig = MAP_SHAPE_CONFIGS[baseState.scenarioConfig.mapShape];

    // Convert to Record and mark starting position as filled
    const tileSlots: Record<string, TileSlot> = {};
    for (const [key, slot] of slotsMap) {
      tileSlots[key] = slot;
    }

    // Place starting tile at origin (tile type from map shape config)
    const tileOrigin: HexCoord = { q: 0, r: 0 };
    const startingTileId =
      mapShapeConfig.startingTile === "starting_a"
        ? TileId.StartingTileA
        : TileId.StartingTileB;
    const startingTileHexes = placeTile(startingTileId, tileOrigin);

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
        tileId: startingTileId,
        centerCoord: tileOrigin,
        revealed: true,
      },
    ];

    // Place initial countryside tiles adjacent to the starting tile
    // Number and positions determined by map shape configuration
    const initialTilePositions: HexCoord[] =
      mapShapeConfig.initialTilePositions.map(
        (dir) => TILE_PLACEMENT_OFFSETS[dir]
      );

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

          const {
            enemies,
            piles: enemyPiles,
            rng: rngAfterEnemies,
          } = drawEnemiesForHex(
            rampagingTypes,
            siteType,
            currentEnemyPiles,
            currentRng,
            baseState.timeOfDay
          );

          currentEnemyPiles = enemyPiles;
          currentRng = rngAfterEnemies;

          // Draw ruins token for Ancient Ruins sites
          let ruinsToken = hex.ruinsToken;
          if (siteType === SiteType.AncientRuins) {
            const ruinsResult = drawRuinsToken(
              currentRuinsPiles,
              currentRng,
              baseState.timeOfDay
            );
            ruinsToken = ruinsResult.token;
            currentRuinsPiles = ruinsResult.piles;
            currentRng = ruinsResult.rng;
          }

          // Update hex with drawn enemies and ruins token
          // NOTE: Preserve rampagingEnemies marker - it's needed for movement validation
          // (validateNotBlockedByRampaging checks BOTH rampagingEnemies.length > 0 AND enemies.length > 0)
          hexes[key] = {
            ...hex,
            enemies: enemies,
            ruinsToken,
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
    const portalHex = startingTileHexes.find(
      (h) => h.site?.type === SiteType.Portal
    );
    const startPosition = portalHex?.coord ?? { q: 0, r: 0 };

    // Create players on the portal with seeded RNG for deck shuffles
    const players: Player[] = [];

    for (let index = 0; index < playerIds.length; index++) {
      const id = playerIds[index];
      const heroId = heroIds?.[index];
      if (id !== undefined) {
        const { player, rng } = this.createPlayer(
          id,
          index,
          heroId,
          startPosition,
          currentRng
        );
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

    // Initialize artifact deck
    const { artifactDeck, rng: rngAfterArtifacts } =
      createArtifactDeck(rngAfterAA);

    // Draw Advanced Actions for any monasteries on initial tiles
    const monasteryCount = countMonasteries(initialTileHexes);
    let currentAADeck = advancedActionDeck;
    let monasteryAAs: readonly CardId[] = [];
    const rngAfterMonasteries = rngAfterArtifacts;

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
      ruinsTokens: currentRuinsPiles, // Ruins piles after drawing for initial tiles
      rng: rngAfterMonasteries, // Updated RNG state after all shuffles
      decks: {
        ...baseState.decks,
        regularUnits: unitDecks.regularUnits,
        eliteUnits: unitDecks.eliteUnits,
        spells: spellDeck,
        advancedActions: currentAADeck,
        artifacts: artifactDeck,
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
   * @param id - Player ID
   * @param index - Player index (0-based)
   * @param heroId - Optional hero ID. If not provided, falls back to default order.
   * @param position - Starting position on the map
   * @param rng - Current RNG state
   */
  private createPlayer(
    id: string,
    index: number,
    heroId: HeroId | undefined,
    position: { q: number; r: number },
    rng: RngState
  ): { player: Player; rng: RngState } {
    // Default hero assignment (fallback for legacy/test code)
    const defaultHeroes: readonly Hero[] = [
      Hero.Arythea,
      Hero.Tovak,
      Hero.Goldyx,
      Hero.Norowas,
    ];

    // Use provided heroId, or fall back to default by index
    const hero = heroId
      ? (heroId as Hero) // HeroId strings match Hero enum values
      : (defaultHeroes[index % defaultHeroes.length] ?? Hero.Arythea);
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
      skillFlipState: {
        flippedSkills: [],
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
      playedCardFromHandThisTurn: false,
      hasPlunderedThisTurn: false,
      hasRecruitedUnitThisTurn: false,
      manaUsedThisTurn: [],
      combatAccumulator: createEmptyCombatAccumulator(),
      pendingChoice: null,
      pendingLevelUps: [],
      pendingLevelUpRewards: [],
      remainingHeroSkills: [...heroDefinition.skills],
      pendingRewards: [],
      pendingGladeWoundChoice: false,
      pendingDeepMineChoice: null,
      healingPoints: 0,
      removedCards: [],
      isResting: false,
      roundOrderTokenFlipped: false,
    };

    return { player, rng: newRng };
  }
}

/**
 * Create a multiplayer game server.
 * @param seed - Optional seed for reproducible RNG
 */
export function createGameServer(seed?: number): GameServer {
  return new GameServer(seed);
}
