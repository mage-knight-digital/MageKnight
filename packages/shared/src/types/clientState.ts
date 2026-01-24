/**
 * Client-visible game state
 *
 * This is what gets sent to clients over the wire.
 * It mirrors GameState but:
 * - Hides secret info (other players' hands, deck contents)
 * - Only contains serializable data
 * - Can be imported by both client and server
 */

import type { CardId, SkillId, ManaColor, BasicManaColor } from "../ids.js";
import type { UnitId } from "../units/index.js";
import type { HexCoord } from "../hex.js";
import type { Terrain } from "../terrain.js";
import type { GamePhase, TimeOfDay, RoundPhase } from "../stateConstants.js";
import type { ManaTokenSource } from "../valueConstants.js";
import type { UnitState } from "../unitState.js";
import type { TacticId } from "../tactics.js";
import type { ValidActions } from "./validActions.js";
import type { EnemyId, EnemyAbilityType, EnemyResistances, Element, EnemyColor } from "../enemies/index.js";
import type { CombatPhase } from "../combatPhases.js";
import type { SiteReward } from "../siteRewards.js";
import type { RuinsTokenId } from "../ruinsTokens.js";

// Pending choice - when a card requires player selection
export interface ClientPendingChoice {
  readonly cardId: CardId;
  readonly options: readonly {
    readonly type: string;
    readonly description: string;
  }[];
}

// Crystals (same as core, but defined here for independence)
export interface ClientCrystals {
  readonly red: number;
  readonly blue: number;
  readonly green: number;
  readonly white: number;
}

// Client-visible unit state
export interface ClientPlayerUnit {
  readonly unitId: UnitId;
  readonly state: UnitState;
  readonly wounded: boolean;
}

// Mana token in play area
export interface ClientManaToken {
  readonly color: ManaColor;
  readonly source: ManaTokenSource;
}

// Stolen mana die from Mana Steal tactic
export interface ClientStolenManaDie {
  readonly dieId: string;
  readonly color: ManaColor;
}

// Elemental attack/block values
export interface ClientElementalValues {
  readonly physical: number;
  readonly fire: number;
  readonly ice: number;
  readonly coldFire: number;
}

// Accumulated attack values by type
export interface ClientAccumulatedAttack {
  readonly normal: number;
  readonly ranged: number;
  readonly siege: number;
  readonly normalElements: ClientElementalValues;
  readonly rangedElements: ClientElementalValues;
  readonly siegeElements: ClientElementalValues;
}

// Combat accumulator - tracks attack/block values from played cards
export interface ClientCombatAccumulator {
  readonly attack: ClientAccumulatedAttack;
  readonly block: number;
  readonly blockElements: ClientElementalValues;
}

// Client-visible player state
export interface ClientPlayer {
  readonly id: string;
  readonly heroId: string;
  readonly position: HexCoord | null;

  // Progression
  readonly fame: number;
  readonly level: number;
  readonly reputation: number; // -7 to +7

  // Combat stats
  readonly armor: number;
  readonly handLimit: number;
  readonly commandTokens: number;

  // Cards - your own hand = full info, other players = just count
  readonly hand: readonly CardId[] | number;
  readonly deckCount: number; // never reveal deck contents
  readonly discardCount: number;
  readonly playArea: readonly CardId[];

  // Units (public)
  readonly units: readonly ClientPlayerUnit[];

  // Crystals (public)
  readonly crystals: ClientCrystals;

  // Skills (public - which skills you have)
  readonly skills: readonly SkillId[];

  // Turn state
  readonly movePoints: number;
  readonly influencePoints: number;
  readonly pureMana: readonly ClientManaToken[];
  readonly hasMovedThisTurn: boolean;
  readonly hasTakenActionThisTurn: boolean;
  readonly usedManaFromSource: boolean;

  // Round state
  readonly knockedOut: boolean;
  readonly selectedTacticId: TacticId | null;
  readonly tacticFlipped: boolean;

  // Pending choice (if card requires player selection)
  readonly pendingChoice: ClientPendingChoice | null;

  // Combat accumulator (accumulated attack/block from played cards)
  readonly combatAccumulator: ClientCombatAccumulator;

  // Pending rewards from site conquest (spell, artifact, etc.)
  readonly pendingRewards: readonly SiteReward[];

  // Magical Glade wound discard choice pending
  readonly pendingGladeWoundChoice: boolean;

  // Deep Mine crystal color choice pending (available colors to choose from)
  readonly pendingDeepMineChoice: readonly BasicManaColor[] | null;

  // Healing points accumulated this turn (cleared on combat entry)
  readonly healingPoints: number;

  // Stolen mana die from Mana Steal tactic (if any)
  readonly stolenManaDie: ClientStolenManaDie | null;
}

// Mana die in the source
export interface ClientSourceDie {
  readonly id: string;
  readonly color: ManaColor;
  readonly isDepleted: boolean;
  readonly takenByPlayerId: string | null; // which player used this die this turn
  readonly isStolenByTactic: boolean; // true if stolen via Mana Steal tactic (vs normal use)
}

// Mana source (public)
export interface ClientManaSource {
  readonly dice: readonly ClientSourceDie[];
}

// Site on a hex (public)
export interface ClientSite {
  readonly type: string;
  readonly owner: string | null;
  readonly isConquered: boolean;
  readonly isBurned: boolean;
  readonly cityColor?: string;
  readonly mineColor?: string;
}

/**
 * Enemy token on a hex as seen by the client.
 * When revealed, full token info is available.
 * When unrevealed, only the color (token back) is visible.
 */
export interface ClientHexEnemy {
  /** The token back color - always visible */
  readonly color: EnemyColor;
  /** Whether the enemy has been revealed */
  readonly isRevealed: boolean;
  /** The enemy token ID - only present when revealed */
  readonly tokenId?: string;
}

/**
 * Ruins token on an Ancient Ruins hex as seen by the client.
 * - Day: token is revealed (face-up, showing contents)
 * - Night: token is unrevealed (face-down, showing yellow back)
 *
 * When unrevealed, tokenId is hidden to prevent cheating (player shouldn't
 * know what's on the token until it's flipped). All unrevealed tokens show
 * the same yellow back.
 */
export interface ClientRuinsToken {
  /** Whether the token has been revealed (face-up) */
  readonly isRevealed: boolean;
  /** The ruins token ID - only present when revealed */
  readonly tokenId?: RuinsTokenId;
}

// Hex state (public)
export interface ClientHexState {
  readonly coord: HexCoord;
  readonly terrain: Terrain;
  readonly tileId: string;
  readonly site: ClientSite | null;
  readonly rampagingEnemies: readonly string[]; // "orc_marauder" | "draconum"
  readonly enemies: readonly ClientHexEnemy[]; // enemy tokens with visibility
  readonly ruinsToken: ClientRuinsToken | null; // Ancient Ruins yellow token
  readonly shieldTokens: readonly string[]; // player IDs
}

// Tile slot for constrained map shapes (wedge, etc.)
export interface ClientTileSlot {
  readonly coord: HexCoord;
  readonly row: number;
  readonly filled: boolean;
}

// Tile placement as seen by the client
// tileId is only present for revealed tiles to prevent "map hacking"
export interface ClientTilePlacement {
  readonly centerCoord: HexCoord;
  readonly revealed: boolean;
  /** Only present when tile is revealed */
  readonly tileId?: string;
}

// Map state (public)
export interface ClientMapState {
  readonly hexes: Record<string, ClientHexState>;
  readonly tiles: readonly ClientTilePlacement[];
  /** Tile slots defining the board shape. Key is hexKey(coord). */
  readonly tileSlots: Record<string, ClientTileSlot>;
}

// Card offer (public)
export interface ClientCardOffer {
  readonly cards: readonly CardId[];
}

// Game offers (public)
export interface ClientGameOffers {
  readonly units: readonly UnitId[];
  readonly advancedActions: ClientCardOffer;
  readonly spells: ClientCardOffer;
  readonly commonSkills: readonly SkillId[];
  readonly monasteryAdvancedActions: readonly CardId[];
}

// The full client-visible game state
export interface ClientGameState {
  readonly phase: GamePhase;
  readonly roundPhase: RoundPhase;
  readonly timeOfDay: TimeOfDay;
  readonly round: number;

  // Turn order
  readonly turnOrder: readonly string[];
  readonly currentPlayerId: string;
  readonly endOfRoundAnnouncedBy: string | null;

  // Players
  readonly players: readonly ClientPlayer[];

  // Map (public)
  readonly map: ClientMapState;

  // Mana source (public)
  readonly source: ClientManaSource;

  // Offers (public)
  readonly offers: ClientGameOffers;

  // Combat (if active)
  readonly combat: ClientCombatState | null;

  // Scenario
  readonly scenarioEndTriggered: boolean;

  // Deck counts (never reveal contents)
  readonly deckCounts: {
    readonly spells: number;
    readonly advancedActions: number;
    readonly artifacts: number;
    readonly regularUnits: number;
    readonly eliteUnits: number;
  };

  /**
   * Wound pile size remaining.
   * `null` means effectively unlimited (rulebook/expansions treat wounds as an unlimited resource).
   */
  readonly woundPileCount: number | null;

  /** Valid actions for the player receiving this state */
  readonly validActions: ValidActions;
}

// ============================================================================
// Combat state (sent to clients when in combat)
// ============================================================================

/**
 * Enemy information visible to the client during combat.
 */
export interface ClientCombatEnemy {
  readonly instanceId: string;
  readonly enemyId: EnemyId;
  readonly name: string;
  readonly attack: number;
  readonly attackElement: Element;
  readonly armor: number;
  readonly fame: number;
  readonly abilities: readonly EnemyAbilityType[];
  readonly resistances: EnemyResistances;
  readonly isBlocked: boolean;
  readonly isDefeated: boolean;
  readonly damageAssigned: boolean;
}

/**
 * Combat state visible to clients.
 */
export interface ClientCombatState {
  readonly phase: CombatPhase;
  readonly enemies: readonly ClientCombatEnemy[];
  readonly woundsThisCombat: number;
  readonly fameGained: number;
  readonly isAtFortifiedSite: boolean;
}
