use mk_types::state::PlayerState;

pub(super) const WOUND_CARD_ID: &str = "wound";
pub(super) const EXPLORE_BASE_COST: u32 = 2;

/// Check if player must slow recover (hand is all wounds, deck empty).
pub(super) fn must_slow_recover(player: &PlayerState) -> bool {
    !player.hand.is_empty()
        && player.hand.iter().all(|c| c.as_str() == WOUND_CARD_ID)
        && player.deck.is_empty()
}
