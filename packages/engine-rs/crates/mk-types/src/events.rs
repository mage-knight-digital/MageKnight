//! Game events emitted by the engine after each action.
//!
//! Events are used for:
//! - Replay artifact recording (messageLog entries include events)
//! - Activity feed in the client UI
//! - Debugging and tracing
//!
//! Events describe *what happened* — they are output-only and never consumed
//! by the engine. The state is the source of truth; events are a narration layer.

use serde::{Deserialize, Serialize};

use crate::enums::{BasicManaColor, Hero, SidewaysAs, TileId, TimeOfDay};
use crate::hex::{HexCoord, HexDirection};
use crate::ids::{CardId, EnemyId, PlayerId, TacticId};

/// A game event emitted by the engine.
///
/// Serializes with `{ "type": "variantName", ...fields }` using camelCase.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GameEvent {
    /// A new game has started.
    GameStarted {
        seed: u32,
        hero: Hero,
    },

    /// A player's turn has started.
    TurnStarted {
        player_id: PlayerId,
        round: u32,
        time_of_day: TimeOfDay,
    },

    /// A player's turn has ended.
    TurnEnded {
        player_id: PlayerId,
    },

    /// A player selected their tactic for the round.
    TacticSelected {
        player_id: PlayerId,
        tactic_id: TacticId,
    },

    /// A card was played from hand.
    CardPlayed {
        player_id: PlayerId,
        card_id: CardId,
        mode: CardPlayMode,
    },

    /// A player moved to a new hex.
    PlayerMoved {
        player_id: PlayerId,
        from: HexCoord,
        to: HexCoord,
    },

    /// A new map tile was explored and placed.
    TileExplored {
        player_id: PlayerId,
        direction: HexDirection,
        tile_id: TileId,
    },

    /// Combat has started at a site.
    CombatStarted {
        player_id: PlayerId,
        hex: HexCoord,
    },

    /// Combat has ended.
    CombatEnded {
        player_id: PlayerId,
    },

    /// A player entered a site (monastery, village, etc.).
    SiteEntered {
        player_id: PlayerId,
        hex: HexCoord,
    },

    /// A choice was resolved (generic — covers pending choices).
    ChoiceResolved {
        player_id: PlayerId,
        choice_index: usize,
    },

    /// A round has ended (day/night transition).
    RoundEnded {
        round: u32,
    },

    /// An enemy was defeated in combat.
    EnemyDefeated {
        player_id: PlayerId,
        enemy_id: EnemyId,
    },

    /// A player gained fame.
    FameGained {
        player_id: PlayerId,
        amount: u32,
    },

    /// A player took a wound.
    WoundTaken {
        player_id: PlayerId,
    },

    /// A player leveled up.
    LevelUp {
        player_id: PlayerId,
        new_level: u32,
    },

    /// A player gained a crystal.
    CrystalGained {
        player_id: PlayerId,
        color: BasicManaColor,
    },

    /// A player performed an undo.
    Undone {
        player_id: PlayerId,
    },

    /// The game has ended.
    GameEnded {
        reason: String,
    },
}

/// How a card was played.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CardPlayMode {
    Basic,
    Powered,
    Sideways(SidewaysAs),
}
