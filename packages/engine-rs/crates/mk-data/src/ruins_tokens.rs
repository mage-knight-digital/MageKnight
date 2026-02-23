//! Ancient Ruins token definitions.
//!
//! 15 tokens: 5 altars (pay mana for fame) and 10 enemy encounters.
//! Based on TS `packages/shared/src/ruinsTokens.ts`.

use mk_types::enums::{BasicManaColor, EnemyColor};
use mk_types::ids::RuinsTokenId;
use mk_types::pending::SiteReward;

// =============================================================================
// Token definition types
// =============================================================================

/// Altar token — pay mana to gain fame (no combat).
#[derive(Debug, Clone, Copy)]
pub struct AltarToken {
    pub token_id: &'static str,
    /// Single-color altars: `[(color, 3)]`. All-color altar: one of each basic.
    pub cost: &'static [(BasicManaColor, u8)],
    pub fame: u32,
}

/// Enemy token — fight depicted enemies to gain rewards.
#[derive(Debug, Clone, Copy)]
pub struct EnemyRuinsToken {
    pub token_id: &'static str,
    pub enemy_colors: &'static [EnemyColor],
    pub rewards: &'static [RuinsRewardType],
}

/// Ruins reward type (mapped to SiteReward at runtime).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuinsRewardType {
    Artifact,
    Spell,
    AdvancedAction,
    Unit,
    /// 4 random crystals (one of each basic color).
    Crystals4,
}

/// Discriminated ruins token definition.
pub enum RuinsTokenDef {
    Altar(AltarToken),
    Enemy(EnemyRuinsToken),
}

// =============================================================================
// Static token instances (inside get_ruins_token for locality)
// =============================================================================

// =============================================================================
// Registry
// =============================================================================

/// All 15 ruins token definitions in canonical order.
static ALL_TOKENS: &[&str] = &[
    "altar_blue",
    "altar_green",
    "altar_red",
    "altar_white",
    "altar_all_colors",
    "enemy_green_brown_artifact",
    "enemy_green_violet_artifact",
    "enemy_green_green_crystals",
    "enemy_grey_brown_artifact",
    "enemy_green_red_artifact_unit",
    "enemy_brown_violet_spell_crystals",
    "enemy_brown_red_artifact_artifact",
    "enemy_green_green_green_artifact",
    "enemy_green_grey_artifact_spell",
    "enemy_violet_violet_spell_unit",
];

/// Get a ruins token definition by ID.
pub fn get_ruins_token(id: &str) -> Option<&'static RuinsTokenDef> {
    // We use a match table for O(1)-ish lookup.
    static ALTAR_BLUE_DEF: RuinsTokenDef = RuinsTokenDef::Altar(AltarToken {
        token_id: "altar_blue",
        cost: &[(BasicManaColor::Blue, 3)],
        fame: 7,
    });
    static ALTAR_GREEN_DEF: RuinsTokenDef = RuinsTokenDef::Altar(AltarToken {
        token_id: "altar_green",
        cost: &[(BasicManaColor::Green, 3)],
        fame: 7,
    });
    static ALTAR_RED_DEF: RuinsTokenDef = RuinsTokenDef::Altar(AltarToken {
        token_id: "altar_red",
        cost: &[(BasicManaColor::Red, 3)],
        fame: 7,
    });
    static ALTAR_WHITE_DEF: RuinsTokenDef = RuinsTokenDef::Altar(AltarToken {
        token_id: "altar_white",
        cost: &[(BasicManaColor::White, 3)],
        fame: 7,
    });
    static ALTAR_ALL_DEF: RuinsTokenDef = RuinsTokenDef::Altar(AltarToken {
        token_id: "altar_all_colors",
        cost: &[
            (BasicManaColor::Blue, 1),
            (BasicManaColor::Green, 1),
            (BasicManaColor::Red, 1),
            (BasicManaColor::White, 1),
        ],
        fame: 10,
    });
    static E1: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_brown_artifact",
        enemy_colors: &[EnemyColor::Green, EnemyColor::Brown],
        rewards: &[RuinsRewardType::Artifact],
    });
    static E2: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_violet_artifact",
        enemy_colors: &[EnemyColor::Green, EnemyColor::Violet],
        rewards: &[RuinsRewardType::Unit],
    });
    static E3: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_green_crystals",
        enemy_colors: &[EnemyColor::Green, EnemyColor::Green],
        rewards: &[RuinsRewardType::Crystals4],
    });
    static E4: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_grey_brown_artifact",
        enemy_colors: &[EnemyColor::Gray, EnemyColor::Brown],
        rewards: &[RuinsRewardType::Artifact],
    });
    static E5: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_red_artifact_unit",
        enemy_colors: &[EnemyColor::Green, EnemyColor::Red],
        rewards: &[RuinsRewardType::Artifact, RuinsRewardType::AdvancedAction],
    });
    static E6: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_brown_violet_spell_crystals",
        enemy_colors: &[EnemyColor::Brown, EnemyColor::Violet],
        rewards: &[RuinsRewardType::Spell, RuinsRewardType::Crystals4],
    });
    static E7: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_brown_red_artifact_artifact",
        enemy_colors: &[EnemyColor::Brown, EnemyColor::Red],
        rewards: &[RuinsRewardType::Artifact, RuinsRewardType::Artifact],
    });
    static E8: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_green_green_artifact",
        enemy_colors: &[EnemyColor::Green, EnemyColor::Green, EnemyColor::Green],
        rewards: &[RuinsRewardType::Unit],
    });
    static E9: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_green_grey_artifact_spell",
        enemy_colors: &[EnemyColor::Gray, EnemyColor::White],
        rewards: &[RuinsRewardType::Artifact, RuinsRewardType::Spell],
    });
    static E10: RuinsTokenDef = RuinsTokenDef::Enemy(EnemyRuinsToken {
        token_id: "enemy_violet_violet_spell_unit",
        enemy_colors: &[EnemyColor::Violet, EnemyColor::Violet],
        rewards: &[RuinsRewardType::Spell, RuinsRewardType::AdvancedAction],
    });

    match id {
        "altar_blue" => Some(&ALTAR_BLUE_DEF),
        "altar_green" => Some(&ALTAR_GREEN_DEF),
        "altar_red" => Some(&ALTAR_RED_DEF),
        "altar_white" => Some(&ALTAR_WHITE_DEF),
        "altar_all_colors" => Some(&ALTAR_ALL_DEF),
        "enemy_green_brown_artifact" => Some(&E1),
        "enemy_green_violet_artifact" => Some(&E2),
        "enemy_green_green_crystals" => Some(&E3),
        "enemy_grey_brown_artifact" => Some(&E4),
        "enemy_green_red_artifact_unit" => Some(&E5),
        "enemy_brown_violet_spell_crystals" => Some(&E6),
        "enemy_brown_red_artifact_artifact" => Some(&E7),
        "enemy_green_green_green_artifact" => Some(&E8),
        "enemy_green_grey_artifact_spell" => Some(&E9),
        "enemy_violet_violet_spell_unit" => Some(&E10),
        _ => None,
    }
}

/// All 15 ruins token IDs.
pub fn all_ruins_token_ids() -> Vec<RuinsTokenId> {
    ALL_TOKENS.iter().map(|&s| RuinsTokenId::from(s)).collect()
}

/// Convert a ruins reward type to a SiteReward.
pub fn ruins_reward_to_site_reward(reward: RuinsRewardType) -> SiteReward {
    match reward {
        RuinsRewardType::Artifact => SiteReward::Artifact { count: 1 },
        RuinsRewardType::Spell => SiteReward::Spell { count: 1 },
        RuinsRewardType::AdvancedAction => SiteReward::AdvancedAction { count: 1 },
        RuinsRewardType::Unit => SiteReward::Unit,
        RuinsRewardType::Crystals4 => SiteReward::CrystalRoll { count: 4 },
    }
}

/// Get the combined SiteReward for an enemy ruins token.
pub fn get_enemy_token_reward(token: &EnemyRuinsToken) -> SiteReward {
    if token.rewards.len() == 1 {
        ruins_reward_to_site_reward(token.rewards[0])
    } else {
        SiteReward::Compound {
            rewards: token.rewards.iter().map(|&r| ruins_reward_to_site_reward(r)).collect(),
        }
    }
}

/// Check if a token ID is an altar type.
pub fn is_altar_token(id: &str) -> bool {
    matches!(
        get_ruins_token(id),
        Some(RuinsTokenDef::Altar(_))
    )
}

/// Check if a token ID is an enemy type.
pub fn is_enemy_token(id: &str) -> bool {
    matches!(
        get_ruins_token(id),
        Some(RuinsTokenDef::Enemy(_))
    )
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_ruins_tokens_returns_15() {
        assert_eq!(all_ruins_token_ids().len(), 15);
    }

    #[test]
    fn altar_tokens_have_correct_costs() {
        // Single-color altars cost 3 of one color
        for id in &["altar_blue", "altar_green", "altar_red", "altar_white"] {
            match get_ruins_token(id).unwrap() {
                RuinsTokenDef::Altar(a) => {
                    assert_eq!(a.cost.len(), 1);
                    assert_eq!(a.cost[0].1, 3);
                }
                _ => panic!("Expected altar token for {}", id),
            }
        }

        // All-colors altar costs 1 of each (4 total)
        match get_ruins_token("altar_all_colors").unwrap() {
            RuinsTokenDef::Altar(a) => {
                assert_eq!(a.cost.len(), 4);
                let total: u8 = a.cost.iter().map(|(_, n)| n).sum();
                assert_eq!(total, 4);
            }
            _ => panic!("Expected altar token"),
        }
    }

    #[test]
    fn altar_tokens_have_correct_fame() {
        for id in &["altar_blue", "altar_green", "altar_red", "altar_white"] {
            match get_ruins_token(id).unwrap() {
                RuinsTokenDef::Altar(a) => assert_eq!(a.fame, 7),
                _ => panic!("Expected altar token"),
            }
        }
        match get_ruins_token("altar_all_colors").unwrap() {
            RuinsTokenDef::Altar(a) => assert_eq!(a.fame, 10),
            _ => panic!("Expected altar token"),
        }
    }

    #[test]
    fn enemy_tokens_have_correct_enemy_counts() {
        // Most enemy tokens have 2 enemies
        match get_ruins_token("enemy_green_brown_artifact").unwrap() {
            RuinsTokenDef::Enemy(e) => assert_eq!(e.enemy_colors.len(), 2),
            _ => panic!("Expected enemy token"),
        }
        // Triple green has 3
        match get_ruins_token("enemy_green_green_green_artifact").unwrap() {
            RuinsTokenDef::Enemy(e) => assert_eq!(e.enemy_colors.len(), 3),
            _ => panic!("Expected enemy token"),
        }
    }

    #[test]
    fn enemy_tokens_have_correct_rewards() {
        // Single reward
        match get_ruins_token("enemy_green_brown_artifact").unwrap() {
            RuinsTokenDef::Enemy(e) => {
                assert_eq!(e.rewards.len(), 1);
                assert_eq!(e.rewards[0], RuinsRewardType::Artifact);
            }
            _ => panic!("Expected enemy token"),
        }
        // Compound reward
        match get_ruins_token("enemy_green_red_artifact_unit").unwrap() {
            RuinsTokenDef::Enemy(e) => {
                assert_eq!(e.rewards.len(), 2);
                assert_eq!(e.rewards[0], RuinsRewardType::Artifact);
                assert_eq!(e.rewards[1], RuinsRewardType::AdvancedAction);
            }
            _ => panic!("Expected enemy token"),
        }
    }

    #[test]
    fn get_ruins_token_returns_none_for_invalid() {
        assert!(get_ruins_token("nonexistent").is_none());
    }

    #[test]
    fn is_altar_and_enemy_checks() {
        assert!(is_altar_token("altar_blue"));
        assert!(is_altar_token("altar_all_colors"));
        assert!(!is_altar_token("enemy_green_brown_artifact"));

        assert!(is_enemy_token("enemy_green_brown_artifact"));
        assert!(!is_enemy_token("altar_blue"));
    }

    #[test]
    fn enemy_token_reward_single() {
        match get_ruins_token("enemy_green_brown_artifact").unwrap() {
            RuinsTokenDef::Enemy(e) => {
                let reward = get_enemy_token_reward(e);
                assert_eq!(reward, SiteReward::Artifact { count: 1 });
            }
            _ => panic!("Expected enemy token"),
        }
    }

    #[test]
    fn enemy_token_reward_compound() {
        match get_ruins_token("enemy_brown_violet_spell_crystals").unwrap() {
            RuinsTokenDef::Enemy(e) => {
                let reward = get_enemy_token_reward(e);
                match reward {
                    SiteReward::Compound { rewards } => {
                        assert_eq!(rewards.len(), 2);
                        assert_eq!(rewards[0], SiteReward::Spell { count: 1 });
                        assert_eq!(rewards[1], SiteReward::CrystalRoll { count: 4 });
                    }
                    _ => panic!("Expected compound reward"),
                }
            }
            _ => panic!("Expected enemy token"),
        }
    }

    #[test]
    fn all_token_ids_are_retrievable() {
        for id in all_ruins_token_ids() {
            assert!(
                get_ruins_token(id.as_str()).is_some(),
                "Token {} not found in registry",
                id
            );
        }
    }
}
