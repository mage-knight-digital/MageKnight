//! Magic Talent's basic spell casting and powered spell acquisition.
//!
//! Choice ordering, legacy pending variants and different source attribution
//! between automatic and explicit spell selection are compatibility boundaries.

use super::utils::{
    colored_card_offer_entries, replenish_spell_offer, resolve_eligible_noop_choice,
};
use super::{eligible_colored_hand_cards, ColoredHandCardScope, ResolveResult};
use mk_types::effect::CardEffect;
use mk_types::enums::{BasicManaColor, ManaColor};
use mk_types::ids::CardId;
use mk_types::pending::ChoiceResolution;
use mk_types::state::GameState;

pub(crate) const MAGIC_TALENT_CARD_ID: &str = "magic_talent";

pub(super) fn apply_magic_talent_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let spell_entries =
        colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color);

    // Check if player has any colored cards to discard (to match spell colors)
    let has_discardable = !eligible_colored_hand_cards(
        &state.players[player_idx].hand,
        MAGIC_TALENT_CARD_ID,
        ColoredHandCardScope::ActionCards,
    )
    .is_empty();

    if !has_discardable {
        return ResolveResult::Skipped;
    }

    // Present spells as choice options (player will cast the selected spell's basic effect)
    resolve_eligible_noop_choice(
        spell_entries,
        |(_, spell_id, _)| {
            if let Some(card_def) = mk_data::cards::get_card(spell_id.as_str()) {
                ResolveResult::Decomposed(vec![card_def.basic_effect])
            } else {
                ResolveResult::Skipped
            }
        },
        |spell_entries| ChoiceResolution::MagicTalentSpellSelect { spell_entries },
    )
}

pub(super) fn apply_magic_talent_powered(
    state: &mut GameState,
    player_idx: usize,
) -> ResolveResult {
    // Find available mana token colors with matching spells in offer
    let player = &state.players[player_idx];
    let gain_entries: Vec<(usize, CardId, BasicManaColor)> =
        colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color)
            .into_iter()
            .filter(|(_, _, spell_color)| {
                let target_mana = ManaColor::from(*spell_color);
                player
                    .pure_mana
                    .iter()
                    .any(|token| token.color == target_mana)
            })
            .collect();

    resolve_eligible_noop_choice(
        gain_entries,
        |(offer_idx, spell_id, mana_color)| {
            gain_spell(state, player_idx, offer_idx, spell_id, mana_color);
            ResolveResult::Applied
        },
        |gain_entries| ChoiceResolution::MagicTalentGainSelect { gain_entries },
    )
}

/// Mirror the existing generic choice-filter gates; card play may call the
/// resolver directly, so keep its skip behavior as well.
pub(super) fn is_basic_resolvable(state: &GameState, player_idx: usize) -> bool {
    !colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color).is_empty()
        && !eligible_colored_hand_cards(
            &state.players[player_idx].hand,
            MAGIC_TALENT_CARD_ID,
            ColoredHandCardScope::ActionCards,
        )
        .is_empty()
}

pub(super) fn is_powered_resolvable(state: &GameState, player_idx: usize) -> bool {
    colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color)
        .iter()
        .any(|(_, _, color)| {
            let target = ManaColor::from(*color);
            state.players[player_idx]
                .pure_mana
                .iter()
                .any(|token| token.color == target)
        })
}

/// Resolve the chosen spell while leaving it in the offer. Explicit selection
/// attributes the nested effect to the selected spell, unlike the auto path.
pub(super) fn selected_basic_spell(
    entries: &[(usize, CardId, BasicManaColor)],
    index: usize,
) -> Option<(CardId, CardEffect)> {
    let (_, spell_id, _) = entries.get(index)?;
    let definition = mk_data::cards::get_card(spell_id.as_str())?;
    Some((spell_id.clone(), definition.basic_effect))
}

/// Consume the saved choice's token and gain the selected spell. The saved
/// index and card ID are intentionally not re-queried on resume.
pub(super) fn select_powered_spell(
    state: &mut GameState,
    player_idx: usize,
    entries: &[(usize, CardId, BasicManaColor)],
    index: usize,
) -> bool {
    let Some((offer_index, spell_id, mana_color)) = entries.get(index) else {
        return false;
    };
    gain_spell(
        state,
        player_idx,
        *offer_index,
        spell_id.clone(),
        *mana_color,
    );
    true
}

fn gain_spell(
    state: &mut GameState,
    player_idx: usize,
    offer_index: usize,
    spell_id: CardId,
    mana_color: BasicManaColor,
) {
    let target = ManaColor::from(mana_color);
    let player = &mut state.players[player_idx];
    if let Some(idx) = player
        .pure_mana
        .iter()
        .position(|token| token.color == target)
    {
        player.pure_mana.remove(idx);
    }
    if offer_index < state.offers.spells.len() {
        state.offers.spells.remove(offer_index);
        replenish_spell_offer(state);
    }
    state.players[player_idx].discard.push(spell_id);
}

pub(crate) fn describe_magic_talent_spell(
    entries: &[(usize, CardId, BasicManaColor)],
    index: usize,
) -> Option<String> {
    entries
        .get(index)
        .map(|(_, spell_id, _)| format!("Cast {}", spell_id))
}

pub(crate) fn describe_magic_talent_gain(
    entries: &[(usize, CardId, BasicManaColor)],
    index: usize,
) -> Option<String> {
    entries
        .get(index)
        .map(|(_, spell_id, color)| format!("Gain {} (spend {:?})", spell_id, color))
}
