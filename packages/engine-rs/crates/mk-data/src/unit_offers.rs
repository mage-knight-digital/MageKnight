//! Unit offer deck setup and management.
//!
//! Manages the unit offer (face-up display) and draw deck.
//! Regular units only — elite units are added to the offer after cities are conquered.

use mk_types::ids::UnitId;
use mk_types::rng::RngState;

use crate::units::{all_regular_unit_ids, get_unit};

/// Create the regular unit deck and initial offer.
///
/// Pool: `copies` instances of each regular unit, shuffled.
/// Offer: draw `player_count + 2` units from the top.
/// Returns `(deck, offer)`.
pub fn create_unit_deck_and_offer(
    rng: &mut RngState,
    player_count: usize,
) -> (Vec<UnitId>, Vec<UnitId>) {
    let mut pool: Vec<UnitId> = Vec::new();
    for &id in all_regular_unit_ids() {
        let copies = get_unit(id).map(|u| u.copies).unwrap_or(1);
        for _ in 0..copies {
            pool.push(UnitId::from(id));
        }
    }
    rng.shuffle(&mut pool);

    let offer_size = (player_count + 2).min(pool.len());
    let offer: Vec<UnitId> = pool.drain(..offer_size).collect();
    (pool, offer)
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

/// End-of-round offer refresh: clear old offer, draw `count` new from deck.
pub fn refresh_unit_offer(
    offer: &mut Vec<UnitId>,
    deck: &mut Vec<UnitId>,
    count: usize,
) {
    // Return old offer to bottom of deck
    while let Some(old) = offer.pop() {
        deck.push(old);
    }
    // Draw new offer from top of deck
    let draw = count.min(deck.len());
    for _ in 0..draw {
        offer.push(deck.remove(0));
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
        let (deck, offer) = create_unit_deck_and_offer(&mut rng, 1);
        // Solo: offer = 1 + 2 = 3
        assert_eq!(offer.len(), 3);
        // Total copies across 15 regular units
        let total_copies: u32 = all_regular_unit_ids()
            .iter()
            .map(|id| get_unit(id).unwrap().copies)
            .sum();
        assert_eq!(deck.len() + offer.len(), total_copies as usize);
    }

    #[test]
    fn create_deterministic() {
        let mut rng1 = RngState::new(99);
        let (deck1, offer1) = create_unit_deck_and_offer(&mut rng1, 1);
        let mut rng2 = RngState::new(99);
        let (deck2, offer2) = create_unit_deck_and_offer(&mut rng2, 1);
        assert_eq!(offer1, offer2);
        assert_eq!(deck1, deck2);
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
    fn refresh_cycles_offer() {
        let mut offer = vec![
            UnitId::from("peasants"),
            UnitId::from("foresters"),
        ];
        let mut deck = vec![
            UnitId::from("thugs"),
            UnitId::from("scouts"),
            UnitId::from("herbalist"),
        ];

        refresh_unit_offer(&mut offer, &mut deck, 3);

        // Old offer returned to deck bottom, new 3 drawn from top
        assert_eq!(offer.len(), 3);
        assert_eq!(offer[0].as_str(), "thugs");
        assert_eq!(offer[1].as_str(), "scouts");
        assert_eq!(offer[2].as_str(), "herbalist");
        // Deck should have old offer cards
        assert_eq!(deck.len(), 2);
    }
}
