//! Offer deck setup and replenishment for advanced actions and spells.
//!
//! Manages the card offers (face-up display) and draw decks for AAs and spells.
//! Convention: index 0 = newest (top), last index = oldest (removed at round refresh).

use mk_types::ids::CardId;
use mk_types::rng::RngState;

/// Number of cards in the advanced action offer.
pub const AA_OFFER_SIZE: usize = 3;

/// Number of cards in the spell offer.
pub const SPELL_OFFER_SIZE: usize = 3;

/// All 44 advanced action card IDs in deterministic order.
pub fn all_advanced_action_ids() -> Vec<&'static str> {
    vec![
        // Red (10)
        "blood_rage",
        "intimidate",
        "blood_ritual",
        "counterattack",
        "fire_bolt",
        "into_the_heat",
        "decompose",
        "ritual_attack",
        "maximal_effect",
        "blood_of_ancients",
        // Blue (10)
        "ice_bolt",
        "steady_tempo",
        "frost_bridge",
        "ice_shield",
        "temporal_portal",
        "pure_magic",
        "shield_bash",
        "crystal_mastery",
        "magic_talent",
        "spell_forge",
        // Green (10)
        "refreshing_walk",
        "in_need",
        "crushing_bolt",
        "ambush",
        "path_finding",
        "mountain_lore",
        "force_of_nature",
        "regeneration",
        "stout_resolve",
        "training",
        "power_of_crystals",
        // White (10)
        "swift_bolt",
        "agility",
        "diplomacy",
        "song_of_wind",
        "heroic_tale",
        "learning",
        "chivalry",
        "mana_storm",
        "peaceful_moment",
        "dodge_and_weave",
        // Dual (3)
        "explosive_bolt",
        "rush_of_adrenaline",
        "chilling_stare",
    ]
}

/// All 24 spell card IDs in deterministic order.
pub fn all_spell_ids() -> Vec<&'static str> {
    vec![
        // Red (7)
        "fireball",
        "flame_wall",
        "tremor",
        "mana_meltdown",
        "demolish",
        "burning_shield",
        "offering",
        // Blue (6)
        "snowstorm",
        "chill",
        "mist_form",
        "mana_claim",
        "space_bending",
        "mana_bolt",
        // Green (4)
        "restoration",
        "energy_flow",
        "underground_travel",
        "meditation",
        // White (7)
        "whirlwind",
        "expose",
        "cure",
        "call_to_arms",
        "mind_read",
        "wings_of_wind",
        "charm",
    ]
}

/// Shuffle the AA pool, draw initial offer of 3.
/// Returns `(deck, offer)` where deck has remaining cards and offer has 3.
pub fn create_aa_deck_and_offer(rng: &mut RngState) -> (Vec<CardId>, Vec<CardId>) {
    let mut pool: Vec<CardId> = all_advanced_action_ids()
        .into_iter()
        .map(CardId::from)
        .collect();
    rng.shuffle(&mut pool);

    let offer: Vec<CardId> = pool.drain(..AA_OFFER_SIZE).collect();
    (pool, offer)
}

/// Shuffle the spell pool, draw initial offer of 3.
/// Returns `(deck, offer)` where deck has remaining cards and offer has 3.
pub fn create_spell_deck_and_offer(rng: &mut RngState) -> (Vec<CardId>, Vec<CardId>) {
    let mut pool: Vec<CardId> = all_spell_ids()
        .into_iter()
        .map(CardId::from)
        .collect();
    rng.shuffle(&mut pool);

    let offer: Vec<CardId> = pool.drain(..SPELL_OFFER_SIZE).collect();
    (pool, offer)
}

/// Remove a card from the offer by ID and replenish from the top of the deck.
/// If the card is not in the offer, this is a no-op.
/// If the deck is empty, the offer shrinks by one.
///
/// Replenishment matches TypeScript: the new card is appended at the end of the
/// offer (oldest position, removed first at round refresh), not at index 0.
/// TS: `spells: { cards: [...newCards, newCard] }`.
pub fn take_from_offer(offer: &mut Vec<CardId>, deck: &mut Vec<CardId>, card_id: &str) {
    if let Some(pos) = offer.iter().position(|c| c.as_str() == card_id) {
        offer.remove(pos);
        // Replenish from deck top (index 0); new card goes at end (oldest), matching TS
        if !deck.is_empty() {
            let new_card = deck.remove(0);
            offer.push(new_card);
        }
    }
}

/// End-of-round offer refresh: remove the oldest card (last index),
/// push it to the bottom of the deck, then draw a new card from the
/// top of the deck to the top of the offer (index 0).
///
/// If the offer is empty or deck is empty, this is a partial no-op.
pub fn refresh_offer(offer: &mut Vec<CardId>, deck: &mut Vec<CardId>) {
    // Remove oldest (last element)
    if let Some(oldest) = offer.pop() {
        // Push to bottom of deck
        deck.push(oldest);
    }

    // Draw new from deck top → offer top
    if !deck.is_empty() {
        let new_card = deck.remove(0);
        offer.insert(0, new_card);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_aa_ids_has_44_entries() {
        let ids = all_advanced_action_ids();
        assert_eq!(ids.len(), 44, "Expected 44 advanced action IDs, got {}", ids.len());
        // No duplicates
        let mut sorted = ids.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), 44, "Duplicate AA IDs found");
    }

    #[test]
    fn all_spell_ids_has_24_entries() {
        let ids = all_spell_ids();
        assert_eq!(ids.len(), 24, "Expected 24 spell IDs, got {}", ids.len());
        // No duplicates
        let mut sorted = ids.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), 24, "Duplicate spell IDs found");
    }

    #[test]
    fn create_aa_deck_and_offer_sizes() {
        let mut rng = RngState::new(42);
        let (deck, offer) = create_aa_deck_and_offer(&mut rng);
        assert_eq!(offer.len(), AA_OFFER_SIZE);
        assert_eq!(deck.len(), 44 - AA_OFFER_SIZE);
        assert_eq!(deck.len() + offer.len(), 44);
    }

    #[test]
    fn create_spell_deck_and_offer_sizes() {
        let mut rng = RngState::new(42);
        let (deck, offer) = create_spell_deck_and_offer(&mut rng);
        assert_eq!(offer.len(), SPELL_OFFER_SIZE);
        assert_eq!(deck.len(), 24 - SPELL_OFFER_SIZE);
        assert_eq!(deck.len() + offer.len(), 24);
    }

    #[test]
    fn create_aa_deterministic() {
        let mut rng1 = RngState::new(99);
        let (deck1, offer1) = create_aa_deck_and_offer(&mut rng1);
        let mut rng2 = RngState::new(99);
        let (deck2, offer2) = create_aa_deck_and_offer(&mut rng2);
        assert_eq!(offer1, offer2);
        assert_eq!(deck1, deck2);
    }

    #[test]
    fn take_from_offer_removes_and_replenishes() {
        let mut offer = vec![
            CardId::from("a"),
            CardId::from("b"),
            CardId::from("c"),
        ];
        let mut deck = vec![
            CardId::from("d"),
            CardId::from("e"),
        ];

        take_from_offer(&mut offer, &mut deck, "b");

        // Offer should still have 3 cards; replenishment at end (oldest), matching TS
        assert_eq!(offer.len(), 3);
        assert_eq!(offer[0].as_str(), "a");
        assert_eq!(offer[1].as_str(), "c");
        assert_eq!(offer[2].as_str(), "d"); // new card at end (oldest)
        assert_eq!(deck.len(), 1);
        assert_eq!(deck[0].as_str(), "e");
    }

    #[test]
    fn take_from_offer_no_deck_shrinks() {
        let mut offer = vec![
            CardId::from("a"),
            CardId::from("b"),
        ];
        let mut deck: Vec<CardId> = vec![];

        take_from_offer(&mut offer, &mut deck, "a");

        assert_eq!(offer.len(), 1);
        assert_eq!(offer[0].as_str(), "b");
    }

    #[test]
    fn take_from_offer_nonexistent_is_noop() {
        let mut offer = vec![CardId::from("a")];
        let mut deck = vec![CardId::from("b")];

        take_from_offer(&mut offer, &mut deck, "z");

        assert_eq!(offer.len(), 1);
        assert_eq!(deck.len(), 1);
    }

    /// Regression: match TypeScript behavior. When you take from the offer, the
    /// replacement from the deck goes at the END of the offer (oldest position),
    /// not at the start. TS: [...newCards, newCard]; index 0 = newest, last = oldest.
    #[test]
    fn take_from_offer_replenished_card_at_oldest_position_matches_ts() {
        let mut offer = vec![
            CardId::from("newest"),
            CardId::from("middle"),
            CardId::from("oldest"),
        ];
        let mut deck = vec![CardId::from("from_deck")];

        take_from_offer(&mut offer, &mut deck, "middle");

        // Offer must still have 3 cards. Replacement must be at end (oldest), not at 0.
        assert_eq!(offer.len(), 3, "offer should stay size 3 when deck replenishes");
        assert_eq!(
            offer[0].as_str(),
            "newest",
            "newest stays at index 0 (top)"
        );
        assert_eq!(
            offer[1].as_str(),
            "oldest",
            "oldest slides to index 1"
        );
        assert_eq!(
            offer[2].as_str(),
            "from_deck",
            "replenishment from deck must be at end (oldest position), matching TS"
        );
        assert!(deck.is_empty());
    }

    #[test]
    fn refresh_offer_cycles_oldest() {
        let mut offer = vec![
            CardId::from("newest"),
            CardId::from("middle"),
            CardId::from("oldest"),
        ];
        let mut deck = vec![
            CardId::from("d1"),
            CardId::from("d2"),
        ];

        refresh_offer(&mut offer, &mut deck);

        // "oldest" moved to deck bottom, "d1" drawn to offer top
        assert_eq!(offer.len(), 3);
        assert_eq!(offer[0].as_str(), "d1");
        assert_eq!(offer[1].as_str(), "newest");
        assert_eq!(offer[2].as_str(), "middle");
        assert_eq!(deck.len(), 2);
        assert_eq!(deck[0].as_str(), "d2");
        assert_eq!(deck[1].as_str(), "oldest");
    }

    #[test]
    fn refresh_offer_empty_deck() {
        let mut offer = vec![
            CardId::from("a"),
            CardId::from("b"),
        ];
        let mut deck: Vec<CardId> = vec![];

        refresh_offer(&mut offer, &mut deck);

        // "b" popped from offer → pushed to deck (deck = ["b"]),
        // then "b" drawn from deck top → inserted at offer[0].
        // Result: offer = ["b", "a"], deck = []
        assert_eq!(offer.len(), 2);
        assert_eq!(offer[0].as_str(), "b");
        assert_eq!(offer[1].as_str(), "a");
        assert!(deck.is_empty());
    }

    #[test]
    fn all_aa_ids_resolve_via_get_card() {
        for id in all_advanced_action_ids() {
            assert!(
                crate::cards::get_card(id).is_some(),
                "AA '{}' not found in get_card()",
                id
            );
        }
    }

    #[test]
    fn all_spell_ids_resolve_via_get_card() {
        for id in all_spell_ids() {
            assert!(
                crate::cards::get_card(id).is_some(),
                "Spell '{}' not found in get_card()",
                id
            );
        }
    }
}
