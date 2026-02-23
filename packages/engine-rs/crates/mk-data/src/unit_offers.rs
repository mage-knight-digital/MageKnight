//! Unit offer deck setup and management.
//!
//! Manages the unit offer (face-up display) and draw decks.
//! Separate regular/elite decks with alternation when Core tiles are revealed.

use mk_types::ids::UnitId;
use mk_types::rng::RngState;

use crate::units::{all_elite_unit_ids, all_regular_unit_ids, get_unit, is_elite_unit};

/// Create the unit decks (regular + elite) and initial offer.
///
/// Pool: `copies` instances of each unit type, shuffled.
/// Initial offer: drawn from regular deck only (no Core tiles at game start).
/// Returns `(regular_deck, elite_deck, offer)`.
pub fn create_unit_deck_and_offer(
    rng: &mut RngState,
    player_count: usize,
    elite_units_enabled: bool,
) -> (Vec<UnitId>, Vec<UnitId>, Vec<UnitId>) {
    // Build regular pool
    let mut regular_pool: Vec<UnitId> = Vec::new();
    for &id in all_regular_unit_ids() {
        let copies = get_unit(id).map(|u| u.copies).unwrap_or(1);
        for _ in 0..copies {
            regular_pool.push(UnitId::from(id));
        }
    }
    rng.shuffle(&mut regular_pool);

    // Build elite pool (only if enabled)
    let mut elite_pool: Vec<UnitId> = Vec::new();
    if elite_units_enabled {
        for &id in all_elite_unit_ids() {
            let copies = get_unit(id).map(|u| u.copies).unwrap_or(1);
            for _ in 0..copies {
                elite_pool.push(UnitId::from(id));
            }
        }
        rng.shuffle(&mut elite_pool);
    }

    // Initial offer from regular deck only
    let offer_size = (player_count + 2).min(regular_pool.len());
    let offer: Vec<UnitId> = regular_pool.drain(..offer_size).collect();
    (regular_pool, elite_pool, offer)
}

/// Remove a unit from the offer by ID.
/// Returns true if found and removed, false otherwise.
/// No replenishment — the offer shrinks by one.
pub fn take_from_unit_offer(offer: &mut Vec<UnitId>, unit_id: &str) -> bool {
    if let Some(pos) = offer.iter().position(|u| u.as_str() == unit_id) {
        offer.remove(pos);
        true
    } else {
        false
    }
}

/// End-of-round offer refresh with separate regular/elite decks.
///
/// Returns old offer units to correct deck (elite→elite_deck, regular→regular_deck).
/// If `core_tile_revealed && elite_units_enabled`: alternate Elite, Regular, Elite, Regular...
/// Otherwise: regular only. Falls back to other deck if preferred is empty.
pub fn refresh_unit_offer(
    offer: &mut Vec<UnitId>,
    regular_deck: &mut Vec<UnitId>,
    elite_deck: &mut Vec<UnitId>,
    count: usize,
    core_tile_revealed: bool,
    elite_units_enabled: bool,
) {
    // Return old offer to correct deck (bottom)
    while let Some(old) = offer.pop() {
        if is_elite_unit(old.as_str()) {
            elite_deck.push(old);
        } else {
            regular_deck.push(old);
        }
    }

    // Draw new offer
    let use_alternation = core_tile_revealed && elite_units_enabled;
    let mut drawn = 0;
    let mut next_is_elite = use_alternation; // Start with Elite if alternating

    while drawn < count {
        if use_alternation {
            if next_is_elite {
                if !elite_deck.is_empty() {
                    offer.push(elite_deck.remove(0));
                } else if !regular_deck.is_empty() {
                    offer.push(regular_deck.remove(0));
                } else {
                    break;
                }
            } else if !regular_deck.is_empty() {
                offer.push(regular_deck.remove(0));
            } else if !elite_deck.is_empty() {
                offer.push(elite_deck.remove(0));
            } else {
                break;
            }
            next_is_elite = !next_is_elite;
        } else {
            // Regular only
            if !regular_deck.is_empty() {
                offer.push(regular_deck.remove(0));
            } else {
                break;
            }
        }
        drawn += 1;
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::rng::RngState;

    #[test]
    fn create_unit_deck_offer_sizes() {
        let mut rng = RngState::new(42);
        let (deck, elite_deck, offer) = create_unit_deck_and_offer(&mut rng, 1, false);
        // Solo: offer = 1 + 2 = 3
        assert_eq!(offer.len(), 3);
        // Elite deck empty when disabled
        assert!(elite_deck.is_empty());
        // Total copies across 15 regular units
        let total_copies: u32 = all_regular_unit_ids()
            .iter()
            .map(|id| get_unit(id).unwrap().copies)
            .sum();
        assert_eq!(deck.len() + offer.len(), total_copies as usize);
    }

    #[test]
    fn create_with_elite_enabled() {
        let mut rng = RngState::new(42);
        let (regular_deck, elite_deck, offer) = create_unit_deck_and_offer(&mut rng, 1, true);
        // Offer still drawn from regular only
        assert_eq!(offer.len(), 3);
        for unit in &offer {
            assert!(!is_elite_unit(unit.as_str()), "Initial offer should be regular-only");
        }
        // Elite deck populated
        let elite_copies: u32 = all_elite_unit_ids()
            .iter()
            .map(|id| get_unit(id).unwrap().copies)
            .sum();
        assert_eq!(elite_deck.len(), elite_copies as usize);
        // Regular deck = total regular - offer
        let regular_copies: u32 = all_regular_unit_ids()
            .iter()
            .map(|id| get_unit(id).unwrap().copies)
            .sum();
        assert_eq!(regular_deck.len() + offer.len(), regular_copies as usize);
    }

    #[test]
    fn create_deterministic() {
        let mut rng1 = RngState::new(99);
        let (deck1, elite1, offer1) = create_unit_deck_and_offer(&mut rng1, 1, true);
        let mut rng2 = RngState::new(99);
        let (deck2, elite2, offer2) = create_unit_deck_and_offer(&mut rng2, 1, true);
        assert_eq!(offer1, offer2);
        assert_eq!(deck1, deck2);
        assert_eq!(elite1, elite2);
    }

    #[test]
    fn take_removes_from_offer() {
        let mut offer = vec![
            UnitId::from("peasants"),
            UnitId::from("foresters"),
            UnitId::from("thugs"),
        ];
        assert!(take_from_unit_offer(&mut offer, "foresters"));
        assert_eq!(offer.len(), 2);
        assert_eq!(offer[0].as_str(), "peasants");
        assert_eq!(offer[1].as_str(), "thugs");
    }

    #[test]
    fn take_nonexistent_returns_false() {
        let mut offer = vec![UnitId::from("peasants")];
        assert!(!take_from_unit_offer(&mut offer, "nonexistent"));
        assert_eq!(offer.len(), 1);
    }

    #[test]
    fn refresh_regular_only() {
        let mut offer = vec![
            UnitId::from("peasants"),
            UnitId::from("foresters"),
        ];
        let mut regular_deck = vec![
            UnitId::from("thugs"),
            UnitId::from("scouts"),
            UnitId::from("herbalist"),
        ];
        let mut elite_deck = Vec::new();

        refresh_unit_offer(&mut offer, &mut regular_deck, &mut elite_deck, 3, false, false);

        // Old offer returned to regular deck bottom, new 3 drawn from top
        assert_eq!(offer.len(), 3);
        assert_eq!(offer[0].as_str(), "thugs");
        assert_eq!(offer[1].as_str(), "scouts");
        assert_eq!(offer[2].as_str(), "herbalist");
        // Deck should have old offer cards
        assert_eq!(regular_deck.len(), 2);
    }

    #[test]
    fn refresh_alternation_elite_regular() {
        let mut offer = vec![UnitId::from("peasants")];
        let mut regular_deck = vec![
            UnitId::from("foresters"),
            UnitId::from("thugs"),
        ];
        let mut elite_deck = vec![
            UnitId::from("fire_mages"),
            UnitId::from("ice_mages"),
        ];

        refresh_unit_offer(&mut offer, &mut regular_deck, &mut elite_deck, 4, true, true);

        // Should alternate: E, R, E, R
        assert_eq!(offer.len(), 4);
        assert_eq!(offer[0].as_str(), "fire_mages");  // Elite
        assert_eq!(offer[1].as_str(), "foresters");    // Regular
        assert_eq!(offer[2].as_str(), "ice_mages");    // Elite
        assert_eq!(offer[3].as_str(), "thugs");        // Regular
    }

    #[test]
    fn refresh_alternation_fallback_when_elite_empty() {
        let mut offer = Vec::new();
        let mut regular_deck = vec![
            UnitId::from("peasants"),
            UnitId::from("foresters"),
            UnitId::from("thugs"),
        ];
        let mut elite_deck = vec![
            UnitId::from("fire_mages"),
        ];

        // Request 4 with alternation: E, R, (no elite → R fallback), R
        refresh_unit_offer(&mut offer, &mut regular_deck, &mut elite_deck, 4, true, true);

        assert_eq!(offer.len(), 4);
        assert_eq!(offer[0].as_str(), "fire_mages");  // Elite
        assert_eq!(offer[1].as_str(), "peasants");    // Regular
        assert_eq!(offer[2].as_str(), "foresters");    // Regular (fallback — no elite left)
        assert_eq!(offer[3].as_str(), "thugs");        // Regular
    }

    #[test]
    fn refresh_returns_elite_to_correct_deck() {
        let mut offer = vec![
            UnitId::from("peasants"),    // regular
            UnitId::from("fire_mages"),  // elite
        ];
        let mut regular_deck = vec![UnitId::from("thugs")];
        let mut elite_deck = vec![UnitId::from("ice_mages")];

        refresh_unit_offer(&mut offer, &mut regular_deck, &mut elite_deck, 2, true, true);

        // Old regular returned to regular deck, old elite to elite deck
        // After return: regular=[thugs, peasants], elite=[ice_mages, fire_mages]
        // Draw alternation E,R: ice_mages, thugs
        assert_eq!(offer.len(), 2);
        assert_eq!(offer[0].as_str(), "ice_mages");  // Elite
        assert_eq!(offer[1].as_str(), "thugs");       // Regular
        // Check decks got returns
        assert!(regular_deck.iter().any(|u| u.as_str() == "peasants"));
        assert!(elite_deck.iter().any(|u| u.as_str() == "fire_mages"));
    }
}
