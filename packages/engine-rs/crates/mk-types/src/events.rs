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

use crate::enums::{BasicManaColor, CombatPhase, Hero, SidewaysAs, SiteType, TileId, TimeOfDay};
use crate::hex::{HexCoord, HexDirection};
use crate::ids::{CardId, EnemyId, PlayerId, SkillId, TacticId, UnitId};

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
        /// Source card that created this choice, if any.
        #[serde(skip_serializing_if = "Option::is_none")]
        card_id: Option<CardId>,
        /// Source skill that created this choice, if any.
        #[serde(skip_serializing_if = "Option::is_none")]
        skill_id: Option<SkillId>,
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

    /// A unit was recruited.
    UnitRecruited {
        player_id: PlayerId,
        unit_id: UnitId,
    },

    /// A unit was activated in combat.
    UnitActivated {
        player_id: PlayerId,
        unit_id: UnitId,
    },

    /// A unit was wounded.
    UnitWounded {
        player_id: PlayerId,
        unit_id: UnitId,
    },

    /// A unit was destroyed.
    UnitDestroyed {
        player_id: PlayerId,
        unit_id: UnitId,
    },

    /// A skill was gained (from level up).
    SkillGained {
        player_id: PlayerId,
        skill_id: SkillId,
    },

    /// Reputation changed.
    ReputationChanged {
        player_id: PlayerId,
        old_value: i8,
        new_value: i8,
    },

    /// Combat phase changed.
    CombatPhaseChanged {
        phase: CombatPhase,
    },

    /// A site was conquered.
    SiteConquered {
        player_id: PlayerId,
        site_type: SiteType,
    },

    /// A reward was selected (spell, artifact, advanced action).
    RewardSelected {
        player_id: PlayerId,
        card_id: CardId,
    },

    /// A card was gained (from offer, reward, etc.).
    CardGained {
        player_id: PlayerId,
        card_id: CardId,
    },

    /// A player declared rest.
    Rested {
        player_id: PlayerId,
    },

    /// A player completed rest (discarding a wound or non-wound card).
    RestCompleted {
        player_id: PlayerId,
    },

    /// A player used a skill.
    SkillUsed {
        player_id: PlayerId,
        skill_id: SkillId,
    },

    /// A player returned an interactive skill to its owner.
    InteractiveSkillReturned {
        player_id: PlayerId,
        skill_id: SkillId,
    },

    /// A subset selection was started (Rethink, rest wound discard, mana search, etc.).
    SubsetSelectionStarted {
        player_id: PlayerId,
        kind: String,
    },

    /// A subset selection was confirmed.
    SubsetSelectionConfirmed {
        player_id: PlayerId,
        kind: String,
        count: usize,
    },

    /// Generic action event for actions without a specific event type.
    ActionTaken {
        player_id: PlayerId,
        action_type: String,
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
