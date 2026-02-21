//! Dummy player logic for solo mode.
//!
//! The dummy player flips cards from its deck each turn (3+ cards/turn),
//! competing with the human for turn order and offers. When the dummy's
//! deck runs out, it announces end of round.
//!
//! Matches TS:
//! - `packages/core/src/engine/helpers/dummyPlayerHelpers.ts`
//! - `packages/core/src/engine/commands/dummyTurnCommand.ts`
//! - `packages/core/src/engine/commands/endRound/dummyOfferGains.ts`

use mk_data::cards::{get_card_color, get_spell_color};
use mk_data::heroes::{build_starting_deck, hero_starting_crystals};
use mk_types::enums::{BasicManaColor, Hero};
use mk_types::ids::CardId;
use mk_types::rng::RngState;
use mk_types::state::{DummyPlayer, PrecomputedDummyTurn};

/// The dummy player's ID in turn_order.
pub const DUMMY_PLAYER_ID: &str = "__dummy__";

/// Base number of cards flipped per dummy turn.
const DUMMY_CARDS_PER_TURN: usize = 3;

/// Check if a player ID refers to the dummy player.
pub fn is_dummy_player(id: &str) -> bool {
    id == DUMMY_PLAYER_ID
}

/// Select a random hero not already in use.
pub fn select_dummy_hero(used_heroes: &[Hero], rng: &mut RngState) -> Hero {
    let all = [
        Hero::Arythea,
        Hero::Tovak,
        Hero::Goldyx,
        Hero::Norowas,
        Hero::Wolfhawk,
        Hero::Krang,
        Hero::Braevalar,
    ];
    let available: Vec<Hero> = all.iter().copied().filter(|h| !used_heroes.contains(h)).collect();
    let idx = rng.random_index(available.len()).expect("No available heroes for dummy player");
    available[idx]
}

/// Create a fresh dummy player from a hero.
///
/// Builds the starting deck, shuffles it, sets initial crystals from hero data,
/// and pre-computes turns for the first round.
pub fn create_dummy_player(hero: Hero, rng: &mut RngState) -> DummyPlayer {
    let mut deck = build_starting_deck(hero);
    rng.shuffle(&mut deck);

    let crystals = hero_starting_crystals(hero);

    let mut dummy = DummyPlayer {
        hero,
        deck,
        discard: Vec::new(),
        crystals,
        precomputed_turns: Vec::new(),
        current_turn_index: 0,
    };

    dummy.precomputed_turns = precompute_dummy_turns(&dummy);
    dummy
}

/// Simulate all dummy turns for a round (deterministic once deck is shuffled).
///
/// Each turn the dummy flips up to 3 cards. If the last card's color matches
/// one of its crystals, bonus cards equal to that crystal count are also flipped.
pub fn precompute_dummy_turns(dummy: &DummyPlayer) -> Vec<PrecomputedDummyTurn> {
    let mut turns = Vec::new();
    let mut remaining: Vec<CardId> = dummy.deck.clone();

    while !remaining.is_empty() {
        let base_flip = DUMMY_CARDS_PER_TURN.min(remaining.len());
        let last_card = remaining[base_flip - 1].clone();

        // Remove base cards
        remaining.drain(..base_flip);

        // Check last card color for crystal match
        let mut bonus_flipped = 0u32;
        let mut matched_color: Option<BasicManaColor> = None;

        if let Some(color) = get_card_color(last_card.as_str()) {
            let crystal_count = dummy.crystals.get(&color).copied().unwrap_or(0);
            if crystal_count > 0 {
                matched_color = Some(color);
                bonus_flipped = (crystal_count as usize).min(remaining.len()) as u32;
                remaining.drain(..(bonus_flipped as usize));
            }
        }

        turns.push(PrecomputedDummyTurn {
            cards_flipped: base_flip as u32,
            bonus_flipped,
            matched_color,
            deck_remaining_after: remaining.len(),
        });
    }

    turns
}

/// Execute one pre-computed dummy turn: advance index and move cards to discard.
///
/// Returns `None` if the dummy's deck is exhausted (no more turns).
pub fn execute_dummy_turn(dummy: &mut DummyPlayer) -> Option<PrecomputedDummyTurn> {
    let turn = dummy.precomputed_turns.get(dummy.current_turn_index)?.clone();
    let total_cards = (turn.cards_flipped + turn.bonus_flipped) as usize;

    // Move cards from front of deck to discard
    let moved: Vec<CardId> = dummy.deck.drain(..total_cards).collect();
    dummy.discard.extend(moved);
    dummy.current_turn_index += 1;

    Some(turn)
}

/// Prepare the dummy player for a new round.
///
/// Combines deck + discard, shuffles, resets turn index, re-precomputes turns.
pub fn reset_dummy_for_new_round(dummy: &mut DummyPlayer, rng: &mut RngState) {
    let mut all_cards: Vec<CardId> = Vec::new();
    all_cards.append(&mut dummy.deck);
    all_cards.append(&mut dummy.discard);
    rng.shuffle(&mut all_cards);

    dummy.deck = all_cards;
    dummy.discard = Vec::new();
    dummy.current_turn_index = 0;
    dummy.precomputed_turns = precompute_dummy_turns(dummy);
}

/// Process dummy player gains from offer refresh at end of round.
///
/// Called BEFORE the normal offer refresh:
/// - Takes the last (bottom/oldest) AA from the offer → dummy's discard
/// - Reads the last spell's color → dummy gains a crystal of that color (no cap)
pub fn process_dummy_offer_gains(
    dummy: &mut DummyPlayer,
    aa_offer: &mut Vec<CardId>,
    spell_offer: &[CardId],
) {
    // 1. Take bottom AA card from offer
    if let Some(bottom_aa) = aa_offer.pop() {
        dummy.discard.push(bottom_aa);
    }

    // 2. Crystal from bottom spell's color (don't modify spell offer)
    if let Some(bottom_spell) = spell_offer.last() {
        if let Some(color) = get_spell_color(bottom_spell.as_str()) {
            *dummy.crystals.entry(color).or_insert(0) += 1;
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn make_dummy_with_deck(cards: &[&str], crystals: &[(BasicManaColor, u32)]) -> DummyPlayer {
        let mut crystal_map = BTreeMap::new();
        for &(color, count) in crystals {
            crystal_map.insert(color, count);
        }
        DummyPlayer {
            hero: Hero::Arythea,
            deck: cards.iter().map(|&s| CardId::from(s)).collect(),
            discard: Vec::new(),
            crystals: crystal_map,
            precomputed_turns: Vec::new(),
            current_turn_index: 0,
        }
    }

    // =========================================================================
    // precompute_dummy_turns
    // =========================================================================

    #[test]
    fn precompute_no_crystal_match() {
        // 6 wound cards → no crystal match possible (wounds have no basic color)
        let dummy = make_dummy_with_deck(
            &["wound", "wound", "wound", "wound", "wound", "wound"],
            &[],
        );
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns.len(), 2, "6 cards → 2 turns of 3");
        assert_eq!(turns[0].cards_flipped, 3);
        assert_eq!(turns[0].bonus_flipped, 0);
        assert!(turns[0].matched_color.is_none());
        assert_eq!(turns[0].deck_remaining_after, 3);
        assert_eq!(turns[1].cards_flipped, 3);
        assert_eq!(turns[1].deck_remaining_after, 0);
    }

    #[test]
    fn precompute_crystal_match_bonus() {
        // 8 cards: 3 base, last is red "rage", 2 red crystals → bonus 2
        let dummy = make_dummy_with_deck(
            &["wound", "wound", "rage", "march", "march", "march", "march", "march"],
            &[(BasicManaColor::Red, 2)],
        );
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns[0].cards_flipped, 3);
        assert_eq!(turns[0].bonus_flipped, 2);
        assert_eq!(turns[0].matched_color, Some(BasicManaColor::Red));
        assert_eq!(turns[0].deck_remaining_after, 3); // 8 - 3 - 2 = 3
    }

    #[test]
    fn precompute_partial_last_turn() {
        // 4 cards → first turn 3, second turn 1
        let dummy = make_dummy_with_deck(
            &["wound", "wound", "wound", "wound"],
            &[],
        );
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns.len(), 2);
        assert_eq!(turns[0].cards_flipped, 3);
        assert_eq!(turns[1].cards_flipped, 1);
    }

    #[test]
    fn precompute_empty_deck() {
        let dummy = make_dummy_with_deck(&[], &[]);
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns.len(), 0);
    }

    #[test]
    fn precompute_bonus_limited_by_remaining() {
        // 4 cards, last (3rd) is red, 5 red crystals → bonus limited to 1 remaining
        let dummy = make_dummy_with_deck(
            &["wound", "wound", "rage", "march"],
            &[(BasicManaColor::Red, 5)],
        );
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns[0].cards_flipped, 3);
        assert_eq!(turns[0].bonus_flipped, 1, "Bonus limited by remaining cards");
        assert_eq!(turns[0].deck_remaining_after, 0);
        assert_eq!(turns.len(), 1, "All cards consumed in one turn");
    }

    #[test]
    fn precompute_colorless_no_match() {
        // wound has CardColor::Wound → no basic mana color → no crystal bonus
        let dummy = make_dummy_with_deck(
            &["rage", "rage", "wound"],
            &[(BasicManaColor::Red, 3), (BasicManaColor::Blue, 3)],
        );
        let turns = precompute_dummy_turns(&dummy);
        assert_eq!(turns.len(), 1);
        assert!(turns[0].matched_color.is_none());
        assert_eq!(turns[0].bonus_flipped, 0);
    }

    // =========================================================================
    // execute_dummy_turn
    // =========================================================================

    #[test]
    fn execute_turn_moves_cards_to_discard() {
        let mut dummy = make_dummy_with_deck(
            &["card_a", "card_b", "card_c", "card_d", "card_e", "card_f"],
            &[],
        );
        dummy.precomputed_turns = vec![
            PrecomputedDummyTurn {
                cards_flipped: 3,
                bonus_flipped: 0,
                matched_color: None,
                deck_remaining_after: 3,
            },
            PrecomputedDummyTurn {
                cards_flipped: 3,
                bonus_flipped: 0,
                matched_color: None,
                deck_remaining_after: 0,
            },
        ];

        let turn = execute_dummy_turn(&mut dummy).unwrap();
        assert_eq!(turn.cards_flipped, 3);
        assert_eq!(dummy.deck.len(), 3);
        assert_eq!(dummy.discard.len(), 3);
        assert_eq!(dummy.current_turn_index, 1);
        assert_eq!(dummy.discard[0].as_str(), "card_a");
    }

    #[test]
    fn execute_turn_exhausted_returns_none() {
        let mut dummy = make_dummy_with_deck(&[], &[]);
        dummy.precomputed_turns = vec![];
        dummy.current_turn_index = 0;

        assert!(execute_dummy_turn(&mut dummy).is_none());
    }

    // =========================================================================
    // reset_dummy_for_new_round
    // =========================================================================

    #[test]
    fn reset_combines_deck_and_discard_and_shuffles() {
        let mut dummy = make_dummy_with_deck(&["card_a", "card_b"], &[]);
        dummy.discard = vec![CardId::from("card_c"), CardId::from("card_d")];
        dummy.current_turn_index = 1;
        dummy.precomputed_turns = vec![PrecomputedDummyTurn {
            cards_flipped: 2,
            bonus_flipped: 0,
            matched_color: None,
            deck_remaining_after: 0,
        }];

        let mut rng = RngState::new(42);
        reset_dummy_for_new_round(&mut dummy, &mut rng);

        assert_eq!(dummy.deck.len(), 4, "All cards should be in deck");
        assert!(dummy.discard.is_empty(), "Discard should be empty");
        assert_eq!(dummy.current_turn_index, 0, "Turn index should reset");
        assert!(!dummy.precomputed_turns.is_empty(), "Turns should be precomputed");
    }

    #[test]
    fn reset_preserves_crystals() {
        let mut dummy = make_dummy_with_deck(&["card_a"], &[(BasicManaColor::Red, 3)]);
        dummy.discard = vec![CardId::from("card_b")];

        let mut rng = RngState::new(42);
        reset_dummy_for_new_round(&mut dummy, &mut rng);

        assert_eq!(dummy.crystals.get(&BasicManaColor::Red), Some(&3));
    }

    // =========================================================================
    // process_dummy_offer_gains
    // =========================================================================

    #[test]
    fn offer_gains_takes_bottom_aa() {
        let mut dummy = make_dummy_with_deck(&[], &[]);
        let mut aa_offer = vec![
            CardId::from("aa_newest"),
            CardId::from("aa_middle"),
            CardId::from("aa_oldest"),
        ];
        let spell_offer = vec![CardId::from("fireball")];

        process_dummy_offer_gains(&mut dummy, &mut aa_offer, &spell_offer);

        assert_eq!(aa_offer.len(), 2, "Bottom AA should be taken");
        assert_eq!(aa_offer[0].as_str(), "aa_newest");
        assert_eq!(aa_offer[1].as_str(), "aa_middle");
        assert!(
            dummy.discard.iter().any(|c| c.as_str() == "aa_oldest"),
            "Oldest AA should be in dummy's discard"
        );
    }

    #[test]
    fn offer_gains_crystal_from_spell_color() {
        let mut dummy = make_dummy_with_deck(&[], &[]);
        let mut aa_offer = vec![CardId::from("aa_card")];
        // fireball is a red spell
        let spell_offer = vec![
            CardId::from("some_spell"),
            CardId::from("fireball"),
        ];

        process_dummy_offer_gains(&mut dummy, &mut aa_offer, &spell_offer);

        // fireball is red → dummy should gain red crystal
        let spell_color = get_spell_color("fireball");
        if let Some(color) = spell_color {
            assert_eq!(
                dummy.crystals.get(&color),
                Some(&1),
                "Dummy should gain crystal from spell color"
            );
        }
    }

    #[test]
    fn offer_gains_no_crystal_cap() {
        let mut dummy = make_dummy_with_deck(&[], &[(BasicManaColor::Red, 10)]);
        let mut aa_offer = vec![CardId::from("aa_card")];
        let spell_offer = vec![CardId::from("fireball")]; // red spell

        process_dummy_offer_gains(&mut dummy, &mut aa_offer, &spell_offer);

        let spell_color = get_spell_color("fireball");
        if let Some(color) = spell_color {
            assert_eq!(
                dummy.crystals.get(&color),
                Some(&11),
                "Dummy crystals should have no cap"
            );
        }
    }

    #[test]
    fn offer_gains_empty_offers_graceful() {
        let mut dummy = make_dummy_with_deck(&[], &[]);
        let mut aa_offer: Vec<CardId> = vec![];
        let spell_offer: Vec<CardId> = vec![];

        process_dummy_offer_gains(&mut dummy, &mut aa_offer, &spell_offer);

        assert!(dummy.discard.is_empty());
        assert!(dummy.crystals.is_empty() || dummy.crystals.values().all(|&v| v == 0));
    }

    // =========================================================================
    // select_dummy_hero
    // =========================================================================

    #[test]
    fn select_hero_excludes_used() {
        let mut rng = RngState::new(42);
        // Exclude all but one
        let used = [
            Hero::Arythea,
            Hero::Tovak,
            Hero::Goldyx,
            Hero::Norowas,
            Hero::Wolfhawk,
            Hero::Krang,
        ];
        let hero = select_dummy_hero(&used, &mut rng);
        assert_eq!(hero, Hero::Braevalar, "Only Braevalar should be available");
    }

    // =========================================================================
    // create_dummy_player
    // =========================================================================

    #[test]
    fn create_dummy_player_valid() {
        let mut rng = RngState::new(42);
        let dummy = create_dummy_player(Hero::Arythea, &mut rng);

        assert_eq!(dummy.hero, Hero::Arythea);
        assert_eq!(dummy.deck.len(), 16);
        assert!(dummy.discard.is_empty());
        assert_eq!(dummy.current_turn_index, 0);
        assert!(!dummy.precomputed_turns.is_empty());

        // Arythea: Red×2, White×1
        assert_eq!(dummy.crystals.get(&BasicManaColor::Red), Some(&2));
        assert_eq!(dummy.crystals.get(&BasicManaColor::White), Some(&1));
    }
}
