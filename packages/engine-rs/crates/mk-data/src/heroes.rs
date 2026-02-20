//! Hero definitions — starting decks and per-hero card replacements.
//!
//! Matches `packages/core/src/types/hero.ts`.

use mk_types::enums::Hero;
use mk_types::ids::CardId;

/// Standard 16-card starting deck (before hero-specific replacements).
pub const STANDARD_DECK: &[&str] = &[
    // Combat (3)
    "rage",
    "rage",
    "determination",
    // Movement (6)
    "swiftness",
    "swiftness",
    "march",
    "march",
    "stamina",
    "stamina",
    // Influence (3)
    "tranquility",
    "promise",
    "threaten",
    // Mana/Special (4)
    "crystallize",
    "mana_draw",
    "concentration",
    "improvisation",
];

/// Card replacement: replace first occurrence of `from` with `to`.
struct Replacement {
    from: &'static str,
    to: &'static str,
}

/// Get hero-specific card replacements.
fn hero_replacements(hero: Hero) -> &'static [Replacement] {
    match hero {
        Hero::Arythea => &[Replacement {
            from: "rage",
            to: "arythea_battle_versatility",
        }],
        Hero::Tovak => &[Replacement {
            from: "determination",
            to: "tovak_cold_toughness",
        }],
        Hero::Goldyx => &[Replacement {
            from: "concentration",
            to: "goldyx_will_focus",
        }],
        Hero::Norowas => &[Replacement {
            from: "promise",
            to: "norowas_noble_manners",
        }],
        Hero::Wolfhawk => &[
            Replacement {
                from: "swiftness",
                to: "wolfhawk_swift_reflexes",
            },
            Replacement {
                from: "stamina",
                to: "wolfhawk_tirelessness",
            },
        ],
        Hero::Krang => &[
            Replacement {
                from: "march",
                to: "krang_savage_harvesting",
            },
            Replacement {
                from: "threaten",
                to: "krang_ruthless_coercion",
            },
            Replacement {
                from: "rage",
                to: "krang_battle_rage",
            },
        ],
        Hero::Braevalar => &[
            Replacement {
                from: "march",
                to: "braevalar_one_with_the_land",
            },
            Replacement {
                from: "stamina",
                to: "braevalar_druidic_paths",
            },
        ],
    }
}

/// Build the starting deck for a hero (16 cards, unshuffled).
pub fn build_starting_deck(hero: Hero) -> Vec<CardId> {
    let mut deck: Vec<CardId> = STANDARD_DECK.iter().map(|&s| CardId::from(s)).collect();

    for replacement in hero_replacements(hero) {
        if let Some(pos) = deck.iter().position(|c| c.as_str() == replacement.from) {
            deck[pos] = CardId::from(replacement.to);
        }
    }

    deck
}

/// Starting hand size.
pub const STARTING_HAND_SIZE: usize = 5;

/// Level 1 stats.
pub const LEVEL_1_ARMOR: u32 = 2;
pub const LEVEL_1_HAND_LIMIT: u32 = 5;
pub const LEVEL_1_COMMAND_TOKENS: u32 = 1;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_deck_has_16_cards() {
        assert_eq!(STANDARD_DECK.len(), 16);
    }

    #[test]
    fn arythea_deck_replaces_one_rage() {
        let deck = build_starting_deck(Hero::Arythea);
        assert_eq!(deck.len(), 16);
        // Should have 1 rage (was 2, one replaced)
        let rage_count = deck.iter().filter(|c| c.as_str() == "rage").count();
        assert_eq!(rage_count, 1);
        // Should have battle_versatility
        assert!(deck
            .iter()
            .any(|c| c.as_str() == "arythea_battle_versatility"));
    }

    #[test]
    fn krang_deck_replaces_three_cards() {
        let deck = build_starting_deck(Hero::Krang);
        assert_eq!(deck.len(), 16);
        // One rage replaced with battle_rage, one march replaced with savage_harvesting
        let rage_count = deck.iter().filter(|c| c.as_str() == "rage").count();
        assert_eq!(rage_count, 1); // was 2, one replaced
        assert!(deck.iter().any(|c| c.as_str() == "krang_battle_rage"));
        assert!(deck.iter().any(|c| c.as_str() == "krang_savage_harvesting"));
        assert!(deck.iter().any(|c| c.as_str() == "krang_ruthless_coercion"));
    }

    #[test]
    fn all_heroes_have_16_cards() {
        for hero in [
            Hero::Arythea,
            Hero::Tovak,
            Hero::Goldyx,
            Hero::Norowas,
            Hero::Wolfhawk,
            Hero::Krang,
            Hero::Braevalar,
        ] {
            let deck = build_starting_deck(hero);
            assert_eq!(deck.len(), 16, "Hero {:?} should have 16 cards", hero);
        }
    }
}
