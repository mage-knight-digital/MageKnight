//! Source derivation — maps LegalAction variant + game context to a source string.
//!
//! The source string tells the network where in the action tree this action
//! comes from (e.g., "normal.move", "combat.play_card.basic", "pending_choice.gain_attack").

use mk_types::effect::CardEffect;
use mk_types::enums::SidewaysAs;
use mk_types::legal_action::LegalAction;
use mk_types::pending::{ActivePending, PendingTacticDecision};
use mk_types::state::GameState;

use crate::vocab::SOURCE_VOCAB;

/// Derive the source string for a legal action and return its SOURCE_VOCAB index.
pub fn derive_source(action: &LegalAction, state: &GameState, player_idx: usize) -> u16 {
    let source_str = derive_source_str(action, state, player_idx);
    SOURCE_VOCAB.encode(source_str)
}

/// Derive the source string for a legal action.
pub fn derive_source_str(action: &LegalAction, state: &GameState, player_idx: usize) -> &'static str {
    let in_combat = state.combat.is_some();

    match action {
        // === Movement & Exploration ===
        LegalAction::Move { .. } => "normal.move",
        LegalAction::Explore { .. } => "normal.explore",
        LegalAction::ChallengeRampaging { .. } => "normal.challenge",

        // === Card Play — context-dependent ===
        LegalAction::PlayCardBasic { .. } => {
            if in_combat { "combat.play_card.basic" } else { "normal.play_card.basic" }
        }
        LegalAction::PlayCardPowered { .. } => {
            if in_combat { "combat.play_card.powered" } else { "normal.play_card.powered" }
        }
        LegalAction::PlayCardSideways { sideways_as, .. } => {
            derive_sideways_source(in_combat, *sideways_as)
        }

        // === Combat-specific ===
        LegalAction::DeclareBlock { .. } => "combat.declare_block",
        LegalAction::InitiateAttack { .. } => "combat.declare_targets",
        LegalAction::EndCombatPhase => "combat.end_phase",
        LegalAction::SpendMoveOnCumbersome { .. } => "combat.cumbersome",
        LegalAction::AssignDamageToHero { .. } => "combat.assign_damage",
        LegalAction::AssignDamageToUnit { .. } => "combat.assign_damage",

        // === Subset selection (attack targets, rethink, meditation, etc.) ===
        LegalAction::SubsetSelect { .. } | LegalAction::SubsetConfirm => {
            // Context from pending state
            let player = &state.players[player_idx];
            if let Some(ActivePending::SubsetSelection(ref ss)) = player.pending.active {
                match &ss.kind {
                    mk_types::pending::SubsetSelectionKind::AttackTargets { .. } => "combat.declare_targets",
                    mk_types::pending::SubsetSelectionKind::ManaSearch { .. } => "normal.tactic.reroll",
                    mk_types::pending::SubsetSelectionKind::Rethink
                    | mk_types::pending::SubsetSelectionKind::MidnightMeditation => "meditation.select",
                    mk_types::pending::SubsetSelectionKind::RestWoundDiscard { .. } => "normal.turn.complete_rest",
                }
            } else {
                "pending_choice.index"
            }
        }

        // === Turn management ===
        LegalAction::EndTurn => {
            if in_combat { "combat.end_phase" } else { "normal.turn.end_turn" }
        }
        LegalAction::DeclareRest => "normal.turn.declare_rest",
        LegalAction::CompleteRest { .. } => "normal.turn.complete_rest",
        LegalAction::AnnounceEndOfRound => "normal.turn.announce_end_of_round",
        LegalAction::Undo => "turn.undo",

        // === Tactics ===
        LegalAction::SelectTactic { .. } => "tactics.available",
        LegalAction::ActivateTactic => "normal.tactic.activate",
        LegalAction::InitiateManaSearch => "normal.tactic.reroll",
        LegalAction::ResolveTacticDecision { data } => {
            derive_tactic_decision_source(data, state, player_idx)
        }

        // === Sites ===
        LegalAction::EnterSite => "normal.site.enter",
        LegalAction::InteractSite { .. } => "normal.site.interact",
        LegalAction::PlunderSite => "plunder_decision.plunder",
        LegalAction::DeclinePlunder => "plunder_decision.decline",
        LegalAction::ResolveGladeWound { choice } => {
            match choice {
                mk_types::enums::GladeWoundChoice::Hand => "glade.hand",
                mk_types::enums::GladeWoundChoice::Discard => "glade.discard",
                mk_types::enums::GladeWoundChoice::Skip => "glade.skip",
            }
        }

        // === Units ===
        LegalAction::RecruitUnit { .. } => "normal.units.recruit",
        LegalAction::ActivateUnit { .. } => {
            if in_combat { "combat.units.activate" } else { "normal.units.activate" }
        }

        // === Skills ===
        LegalAction::UseSkill { .. } => {
            if in_combat { "combat.skills.activate" } else { "normal.skills.activate" }
        }
        LegalAction::ReturnInteractiveSkill { .. } => "normal.skills.return",

        // === Pending resolutions ===
        LegalAction::ResolveChoice { choice_index } => {
            derive_resolve_choice_source(state, player_idx, *choice_index)
        }
        LegalAction::ResolveDiscardForBonus { .. } => "discard_for_bonus.choice",
        LegalAction::ResolveDecompose { .. } => "decompose.card",
        LegalAction::ResolveDiscardForCrystal { card_id } => {
            if card_id.is_some() { "discard_for_crystal.card" } else { "discard_for_crystal.skip" }
        }
        LegalAction::ResolveSourceOpeningReroll { reroll } => {
            if *reroll { "source_opening.reroll" } else { "source_opening.keep" }
        }
        LegalAction::ResolveTraining { .. } => "training.card",
        LegalAction::ResolveMaximalEffect { .. } => "maximal_effect.card",
        LegalAction::ResolveCrystalJoyReclaim { discard_index } => {
            if discard_index.is_some() { "crystal_joy.card" } else { "crystal_joy.skip" }
        }
        LegalAction::ResolveSteadyTempoDeckPlacement { place } => {
            if *place { "steady_tempo.place" } else { "steady_tempo.skip" }
        }
        LegalAction::ResolveBannerProtection { remove_all } => {
            if *remove_all { "banner_protection.remove" } else { "banner_protection.skip" }
        }

        // === Meditation ===
        LegalAction::ResolveMeditation { place_on_top, .. } => {
            match place_on_top {
                Some(true) => "meditation.place_top",
                Some(false) => "meditation.place_bottom",
                None => "meditation.select",
            }
        }
        LegalAction::MeditationDoneSelecting => "meditation.done",

        // === Level-up ===
        LegalAction::ChooseLevelUpReward { from_common_pool, .. } => {
            if *from_common_pool { "level_up.common" } else { "level_up.drawn" }
        }

        // === Cooperative assault ===
        LegalAction::ProposeCooperativeAssault { .. } => "cooperative.propose",
        LegalAction::RespondToCooperativeProposal { .. } => "cooperative.respond",
        LegalAction::CancelCooperativeProposal => "cooperative.cancel",

        // === Site commerce ===
        LegalAction::BuySpell { .. } => "normal.site.buy_spell",
        LegalAction::LearnAdvancedAction { .. } => "normal.site.buy_aa",
        LegalAction::BurnMonastery => "normal.site.burn_monastery",
        LegalAction::AltarTribute { .. } => "normal.site.altar_tribute",
        LegalAction::AssignBanner { .. } => "normal.assign_banner",
        LegalAction::UseBannerCourage { .. } => "combat.use_banner_courage",
        LegalAction::UseBannerFear { .. } => "combat.use_banner_fear",
        LegalAction::SelectReward { .. } => "pending_reward.card",
        LegalAction::ResolveBookOfWisdom { .. } => "book_of_wisdom.card",
        LegalAction::ResolveTomeOfAllSpells { .. } => "tome_of_all_spells.card",
        LegalAction::ResolveCircletOfProficiency { .. } => "circlet_of_proficiency.card",
        LegalAction::ConvertMoveToAttack { .. } => "combat.convert_move_to_attack",
        LegalAction::ConvertInfluenceToBlock { .. } => "combat.convert_influence_to_block",
        LegalAction::PayHeroesAssaultInfluence => "combat.heroes_assault_payment",
        LegalAction::PayThugsDamageInfluence { .. } => "combat.thugs_payment",
        LegalAction::ResolveUnitMaintenance { keep_unit, .. } => {
            if *keep_unit { "unit_maintenance.keep" } else { "unit_maintenance.disband" }
        }
        LegalAction::ResolveHexCostReduction { .. } => "hex_cost_reduction.coordinate",
        LegalAction::ResolveTerrainCostReduction { .. } => "terrain_cost_reduction.terrain",
    }
}

/// Derive source for sideways card plays (8 possible strings).
fn derive_sideways_source(in_combat: bool, sideways_as: SidewaysAs) -> &'static str {
    match (in_combat, sideways_as) {
        (false, SidewaysAs::Move) => "normal.play_card.sideways.move",
        (false, SidewaysAs::Influence) => "normal.play_card.sideways.influence",
        (false, SidewaysAs::Attack) => "normal.play_card.sideways.attack",
        (false, SidewaysAs::Block) => "normal.play_card.sideways.block",
        (true, SidewaysAs::Move) => "combat.play_card.sideways.move",
        (true, SidewaysAs::Influence) => "combat.play_card.sideways.influence",
        (true, SidewaysAs::Attack) => "combat.play_card.sideways.attack",
        (true, SidewaysAs::Block) => "combat.play_card.sideways.block",
    }
}

/// Derive source for tactic decision resolutions.
fn derive_tactic_decision_source(
    data: &mk_types::legal_action::TacticDecisionData,
    state: &GameState,
    player_idx: usize,
) -> &'static str {
    let player = &state.players[player_idx];
    match &player.pending.active {
        Some(ActivePending::TacticDecision(td)) => match td {
            PendingTacticDecision::ManaSteal => "pending_tactic_decision.die",
            PendingTacticDecision::Preparation { .. } => {
                match data {
                    mk_types::legal_action::TacticDecisionData::Preparation { deck_card_index } => {
                        match deck_card_index {
                            0 => "pending_tactic_decision.cards.0",
                            1 => "pending_tactic_decision.cards.1",
                            2 => "pending_tactic_decision.cards.2",
                            3 => "pending_tactic_decision.cards.3",
                            _ => "pending_tactic_decision.card",
                        }
                    }
                    _ => "pending_tactic_decision.card",
                }
            }
            PendingTacticDecision::SparingPower => {
                match data {
                    mk_types::legal_action::TacticDecisionData::SparingPowerStash => "pending_tactic_decision.sparing.stash",
                    mk_types::legal_action::TacticDecisionData::SparingPowerTake => "pending_tactic_decision.sparing.take",
                    _ => "pending_tactic_decision.card",
                }
            }
        },
        _ => "pending_tactic_decision.card",
    }
}

/// Derive source for RESOLVE_CHOICE actions based on the pending choice's option effect type.
fn derive_resolve_choice_source(
    state: &GameState,
    player_idx: usize,
    choice_index: usize,
) -> &'static str {
    let player = &state.players[player_idx];
    if let Some(ActivePending::Choice(ref choice)) = player.pending.active {
        if let Some(option) = choice.options.get(choice_index) {
            return effect_to_source_str(option);
        }
    }
    // Also check UnitAbilityChoice
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = player.pending.active {
        if choice_index < options.len() {
            return match &options[choice_index] {
                mk_types::pending::UnitAbilityChoiceOption::GainMove { .. } => "pending_choice.gain_move",
                mk_types::pending::UnitAbilityChoiceOption::GainInfluence { .. } => "pending_choice.gain_influence",
                mk_types::pending::UnitAbilityChoiceOption::GainAttack { .. } => "pending_choice.gain_attack",
                mk_types::pending::UnitAbilityChoiceOption::GainBlock { .. } => "pending_choice.gain_block",
            };
        }
    }
    "pending_choice.index"
}

/// Map a CardEffect variant to a source string for RESOLVE_CHOICE enrichment.
fn effect_to_source_str(effect: &CardEffect) -> &'static str {
    match effect {
        CardEffect::GainMove { .. } => "pending_choice.gain_move",
        CardEffect::GainAttack { .. }
        | CardEffect::AttackWithDefeatBonus { .. } => "pending_choice.gain_attack",
        CardEffect::GainBlock { .. } => "pending_choice.gain_block",
        CardEffect::GainHealing { .. } => "pending_choice.gain_healing",
        CardEffect::GainInfluence { .. } => "pending_choice.gain_influence",
        CardEffect::GainMana { .. } => "pending_choice.gain_mana",
        CardEffect::DrawCards { .. } => "pending_choice.draw_cards",
        CardEffect::GainFame { .. } => "pending_choice.gain_fame",
        CardEffect::GainCrystal { .. }
        | CardEffect::ConvertManaToCrystal => "pending_choice.gain_crystal",
        CardEffect::ApplyModifier { .. } => "pending_choice.apply_modifier",
        CardEffect::ChangeReputation { .. } => "pending_choice.change_reputation",
        CardEffect::Noop => "pending_choice.noop",
        CardEffect::CardBoost { .. } => "pending_choice.card_boost",
        CardEffect::ReadyUnit { .. }
        | CardEffect::ReadyUnitsBudget { .. } => "pending_choice.ready_unit",
        CardEffect::Compound { .. } => "pending_choice.compound",
        CardEffect::Conditional { .. } => "pending_choice.conditional",
        CardEffect::Scaling { .. } => "pending_choice.scaling",
        _ => "pending_choice.index",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sideways_sources_all_in_vocab() {
        let sources = [
            "normal.play_card.sideways.move",
            "normal.play_card.sideways.influence",
            "normal.play_card.sideways.attack",
            "normal.play_card.sideways.block",
            "combat.play_card.sideways.move",
            "combat.play_card.sideways.influence",
            "combat.play_card.sideways.attack",
            "combat.play_card.sideways.block",
        ];
        for s in &sources {
            assert!(SOURCE_VOCAB.encode(s) > 0, "Source '{}' not in vocab", s);
        }
    }

    #[test]
    fn common_sources_in_vocab() {
        let sources = [
            "normal.move", "normal.explore", "combat.play_card.basic",
            "normal.play_card.powered", "combat.end_phase", "normal.turn.end_turn",
            "tactics.available", "pending_choice.gain_move", "pending_choice.gain_attack",
        ];
        for s in &sources {
            assert!(SOURCE_VOCAB.encode(s) > 0, "Source '{}' not in vocab", s);
        }
    }
}
