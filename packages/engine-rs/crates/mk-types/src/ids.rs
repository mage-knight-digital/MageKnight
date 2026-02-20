//! Branded/newtype ID types for type safety.
//!
//! Each ID wraps a `Box<str>` for cheap cloning and small struct size.
//! In the future, these may become interned indices for zero-allocation lookups.

use serde::{Deserialize, Serialize};

macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(Box<str>);

        impl $name {
            pub fn new(s: impl Into<Box<str>>) -> Self {
                Self(s.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl From<&str> for $name {
            fn from(s: &str) -> Self {
                Self(s.into())
            }
        }

        impl From<String> for $name {
            fn from(s: String) -> Self {
                Self(s.into_boxed_str())
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(&self.0)
            }
        }

        impl AsRef<str> for $name {
            fn as_ref(&self) -> &str {
                &self.0
            }
        }
    };
}

define_id!(
    /// Card identifier (action cards, artifacts, spells, wounds).
    CardId
);

define_id!(
    /// Skill identifier.
    SkillId
);

define_id!(
    /// Unit type identifier (e.g., "peasants", "utem_guardsmen").
    UnitId
);

define_id!(
    /// Enemy definition identifier (e.g., "orc_prowlers", "fire_dragon").
    EnemyId
);

define_id!(
    /// Enemy token instance identifier (unique per token in a pile).
    EnemyTokenId
);

define_id!(
    /// Source die identifier (unique per die in the mana source).
    SourceDieId
);

define_id!(
    /// Tactic card identifier.
    TacticId
);

define_id!(
    /// Scenario identifier.
    ScenarioId
);

define_id!(
    /// Ruins token identifier.
    RuinsTokenId
);

define_id!(
    /// Player identifier.
    PlayerId
);

define_id!(
    /// Combat enemy instance identifier (unique within a combat).
    CombatInstanceId
);

define_id!(
    /// Unit instance identifier (unique within a player's roster).
    UnitInstanceId
);

define_id!(
    /// Modifier instance identifier.
    ModifierId
);
