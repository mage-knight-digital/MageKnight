//! Action encoder — produces per-action features (6 vocab IDs + 34 scalars).
//!
//! Each legal action is encoded with vocabulary indices for embedding layers
//! and scalar features for the scoring network.

use mk_data::enemies::get_enemy;
use mk_types::enums::{CombatType, ManaColor, SidewaysAs};
use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

use crate::source_derivation::derive_source;
use crate::types::{scale, ActionFeatures, ACTION_SCALAR_DIM};
use crate::vocab::{ACTION_TYPE_VOCAB, CARD_VOCAB, ENEMY_VOCAB, SKILL_VOCAB, UNIT_VOCAB};

/// Encode all legal actions into ActionFeatures.
pub fn encode_actions(
    state: &GameState,
    player_idx: usize,
    actions: &[LegalAction],
) -> Vec<ActionFeatures> {
    actions
        .iter()
        .map(|action| encode_single_action(state, player_idx, action))
        .collect()
}

fn encode_single_action(
    state: &GameState,
    player_idx: usize,
    action: &LegalAction,
) -> ActionFeatures {
    let action_type_id = derive_action_type(action);
    let source_id = derive_source(action, state, player_idx);
    let (card_id, unit_id, enemy_id, skill_id, target_enemy_ids) =
        extract_entity_ids(action, state, player_idx);
    let scalars = extract_action_scalars(action, state, player_idx);

    ActionFeatures {
        action_type_id,
        source_id,
        card_id,
        unit_id,
        enemy_id,
        skill_id,
        target_enemy_ids,
        scalars,
    }
}

// =============================================================================
// Action type derivation
// =============================================================================

fn derive_action_type(action: &LegalAction) -> u16 {
    let type_str = match action {
        LegalAction::SelectTactic { .. } => "SELECT_TACTIC",
        LegalAction::PlayCardBasic { .. } | LegalAction::PlayCardPowered { .. } => "PLAY_CARD",
        LegalAction::PlayCardSideways { .. } => "PLAY_CARD_SIDEWAYS",
        LegalAction::Move { .. } => "MOVE",
        LegalAction::Explore { .. } => "EXPLORE",
        LegalAction::ResolveChoice { .. } => "RESOLVE_CHOICE",
        LegalAction::ResolveDiscardForBonus { .. } => "RESOLVE_DISCARD_FOR_BONUS",
        LegalAction::ResolveDecompose { .. } => "RESOLVE_DECOMPOSE",
        LegalAction::ResolveDiscardForCrystal { .. } => "RESOLVE_DISCARD_FOR_CRYSTAL",
        LegalAction::ChallengeRampaging { .. } => "CHALLENGE_RAMPAGING",
        LegalAction::DeclareBlock { .. } => "DECLARE_BLOCK",
        LegalAction::InitiateAttack { .. } => "DECLARE_ATTACK",
        LegalAction::SpendMoveOnCumbersome { .. } => "SPEND_MOVE_ON_CUMBERSOME",
        LegalAction::ResolveTacticDecision { .. } => "RESOLVE_TACTIC_DECISION",
        LegalAction::ActivateTactic => "ACTIVATE_TACTIC",
        LegalAction::InitiateManaSearch => "REROLL_SOURCE_DICE",
        LegalAction::EnterSite => "ENTER_SITE",
        LegalAction::InteractSite { .. } => "INTERACT",
        LegalAction::PlunderSite => "PLUNDER_VILLAGE",
        LegalAction::DeclinePlunder => "DECLINE_PLUNDER",
        LegalAction::ResolveGladeWound { .. } => "RESOLVE_GLADE_WOUND",
        LegalAction::RecruitUnit { .. } => "RECRUIT_UNIT",
        LegalAction::ActivateUnit { .. } => "ACTIVATE_UNIT",
        LegalAction::AssignDamageToHero { .. } | LegalAction::AssignDamageToUnit { .. } => "ASSIGN_DAMAGE",
        LegalAction::ChooseLevelUpReward { .. } => "CHOOSE_LEVEL_UP_REWARDS",
        LegalAction::SubsetSelect { .. } => "DECLARE_ATTACK_TARGETS",
        LegalAction::SubsetConfirm => "DECLARE_ATTACK_TARGETS",
        LegalAction::ResolveCrystalJoyReclaim { .. } => "RESOLVE_CRYSTAL_JOY_RECLAIM",
        LegalAction::ResolveSteadyTempoDeckPlacement { .. } => "RESOLVE_STEADY_TEMPO",
        LegalAction::ResolveBannerProtection { .. } => "RESOLVE_BANNER_PROTECTION",
        LegalAction::EndTurn => "END_TURN",
        LegalAction::DeclareRest => "DECLARE_REST",
        LegalAction::CompleteRest { .. } => "COMPLETE_REST",
        LegalAction::UseSkill { .. } => "USE_SKILL",
        LegalAction::ReturnInteractiveSkill { .. } => "RETURN_INTERACTIVE_SKILL",
        LegalAction::ResolveSourceOpeningReroll { .. } => "RESOLVE_SOURCE_OPENING_REROLL",
        LegalAction::ResolveTraining { .. } => "RESOLVE_TRAINING",
        LegalAction::ResolveMaximalEffect { .. } => "RESOLVE_MAXIMAL_EFFECT",
        LegalAction::ResolveMeditation { .. } => "RESOLVE_MEDITATION",
        LegalAction::MeditationDoneSelecting => "RESOLVE_MEDITATION",
        LegalAction::EndCombatPhase => "END_COMBAT_PHASE",
        LegalAction::AnnounceEndOfRound => "ANNOUNCE_END_OF_ROUND",
        LegalAction::ProposeCooperativeAssault { .. } => "PROPOSE_COOPERATIVE_ASSAULT",
        LegalAction::RespondToCooperativeProposal { .. } => "RESPOND_TO_COOPERATIVE_PROPOSAL",
        LegalAction::CancelCooperativeProposal => "CANCEL_COOPERATIVE_PROPOSAL",
        LegalAction::BuySpell { .. } => "BUY_SPELL",
        LegalAction::LearnAdvancedAction { .. } => "LEARN_ADVANCED_ACTION",
        LegalAction::BurnMonastery => "BURN_MONASTERY",
        LegalAction::AltarTribute { .. } => "ALTAR_TRIBUTE",
        LegalAction::SelectReward { .. } => "SELECT_REWARD",
        LegalAction::ResolveBookOfWisdom { .. } => "RESOLVE_BOOK_OF_WISDOM",
        LegalAction::ResolveTomeOfAllSpells { .. } => "RESOLVE_TOME_OF_ALL_SPELLS",
        LegalAction::ResolveCircletOfProficiency { .. } => "RESOLVE_CIRCLET_OF_PROFICIENCY",
        LegalAction::AssignBanner { .. } => "ASSIGN_BANNER",
        LegalAction::UseBannerCourage { .. } => "USE_BANNER_COURAGE",
        LegalAction::UseBannerFear { .. } => "USE_BANNER_FEAR",
        LegalAction::ConvertMoveToAttack { .. } => "CONVERT_MOVE_TO_ATTACK",
        LegalAction::ConvertInfluenceToBlock { .. } => "CONVERT_INFLUENCE_TO_BLOCK",
        LegalAction::PayHeroesAssaultInfluence => "PAY_HEROES_ASSAULT_INFLUENCE",
        LegalAction::PayThugsDamageInfluence { .. } => "PAY_THUGS_DAMAGE_INFLUENCE",
        LegalAction::ResolveUnitMaintenance { .. } => "RESOLVE_UNIT_MAINTENANCE",
        LegalAction::ResolveHexCostReduction { .. } => "RESOLVE_HEX_COST_REDUCTION",
        LegalAction::ResolveTerrainCostReduction { .. } => "RESOLVE_TERRAIN_COST_REDUCTION",
        LegalAction::ResolveCrystalRollColor { .. } => "RESOLVE_CRYSTAL_ROLL_COLOR",
        LegalAction::SelectArtifact { .. } => "SELECT_ARTIFACT",
        LegalAction::ForfeitUnitReward => "FORFEIT_UNIT_REWARD",
        LegalAction::DisbandUnitForReward { .. } => "DISBAND_UNIT_FOR_REWARD",
        LegalAction::ForfeitTurn => "FORFEIT_TURN",
        LegalAction::Undo => "UNDO",
    };
    ACTION_TYPE_VOCAB.encode(type_str)
}

// =============================================================================
// Entity ID extraction
// =============================================================================

fn extract_entity_ids(
    action: &LegalAction,
    state: &GameState,
    player_idx: usize,
) -> (u16, u16, u16, u16, Vec<u16>) {
    let mut card_id: u16 = 0;
    let mut unit_id: u16 = 0;
    let mut enemy_id: u16 = 0;
    let mut skill_id: u16 = 0;
    let target_enemy_ids: Vec<u16> = Vec::new();

    let player = &state.players[player_idx];

    match action {
        LegalAction::PlayCardBasic { card_id: cid, .. }
        | LegalAction::PlayCardPowered { card_id: cid, .. }
        | LegalAction::PlayCardSideways { card_id: cid, .. } => {
            card_id = CARD_VOCAB.encode(cid.as_str());
        }

        LegalAction::SelectTactic { tactic_id } => {
            card_id = CARD_VOCAB.encode(tactic_id.as_str());
        }

        LegalAction::ActivateUnit {
            unit_instance_id, ..
        } => {
            // Look up unit_id from instance
            if let Some(u) = player.units.iter().find(|u| u.instance_id == *unit_instance_id) {
                unit_id = UNIT_VOCAB.encode(u.unit_id.as_str());
            }
        }

        LegalAction::RecruitUnit {
            unit_id: uid, ..
        } => {
            unit_id = UNIT_VOCAB.encode(uid.as_str());
        }

        LegalAction::DeclareBlock {
            enemy_instance_id, ..
        } => {
            // Look up enemy token_id from combat state
            if let Some(ref combat) = state.combat {
                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *enemy_instance_id) {
                    enemy_id = ENEMY_VOCAB.encode(e.enemy_id.as_str());
                }
            }
        }

        LegalAction::SpendMoveOnCumbersome {
            enemy_instance_id, ..
        } => {
            if let Some(ref combat) = state.combat {
                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *enemy_instance_id) {
                    enemy_id = ENEMY_VOCAB.encode(e.enemy_id.as_str());
                }
            }
        }

        LegalAction::AssignDamageToUnit {
            unit_instance_id, ..
        } => {
            if let Some(u) = player.units.iter().find(|u| u.instance_id == *unit_instance_id) {
                unit_id = UNIT_VOCAB.encode(u.unit_id.as_str());
            }
        }

        LegalAction::UseSkill { skill_id: sid } | LegalAction::ReturnInteractiveSkill { skill_id: sid } => {
            skill_id = SKILL_VOCAB.encode(sid.as_str());
        }

        LegalAction::ChooseLevelUpReward {
            advanced_action_id, ..
        } => {
            card_id = CARD_VOCAB.encode(advanced_action_id.as_str());
        }

        LegalAction::ResolveDecompose { hand_index } => {
            if let Some(cid) = player.hand.get(*hand_index) {
                card_id = CARD_VOCAB.encode(cid.as_str());
            }
        }

        LegalAction::ResolveMaximalEffect { hand_index } => {
            if let Some(cid) = player.hand.get(*hand_index) {
                card_id = CARD_VOCAB.encode(cid.as_str());
            }
        }

        LegalAction::ResolveDiscardForCrystal {
            card_id: Some(cid),
        } => {
            card_id = CARD_VOCAB.encode(cid.as_str());
        }

        LegalAction::BuySpell { card_id: cid, .. }
        | LegalAction::LearnAdvancedAction { card_id: cid, .. }
        | LegalAction::SelectReward { card_id: cid, .. }
        | LegalAction::AssignBanner { card_id: cid, .. } => {
            card_id = CARD_VOCAB.encode(cid.as_str());
        }

        _ => {}
    }

    (card_id, unit_id, enemy_id, skill_id, target_enemy_ids)
}

// =============================================================================
// Action scalars (34 floats)
// =============================================================================

fn extract_action_scalars(
    action: &LegalAction,
    state: &GameState,
    player_idx: usize,
) -> Vec<f32> {
    let mut scalars = vec![0.0f32; ACTION_SCALAR_DIM];

    match action {
        LegalAction::PlayCardBasic { .. } => {
            scalars[2] = 1.0; // is_basic
        }
        LegalAction::PlayCardPowered { mana_color, .. } => {
            scalars[1] = 1.0; // is_powered
            scalars[8] = 1.0; // has_card
            scalars[6] = scale(1.0, 5.0); // num_mana
            set_mana_color_one_hot(&mut scalars, 12, ManaColor::from(*mana_color));
        }
        LegalAction::PlayCardSideways { sideways_as, .. } => {
            scalars[3] = 1.0; // is_sideways
            match sideways_as {
                SidewaysAs::Move => {}
                SidewaysAs::Influence => {}
                SidewaysAs::Attack => {}
                SidewaysAs::Block => {}
            }
        }
        LegalAction::Move { target, cost } => {
            let player = &state.players[player_idx];
            let pos = player.position.unwrap_or(mk_types::hex::HexCoord::new(0, 0));
            scalars[4] = scale((target.q - pos.q) as f32, 10.0);
            scalars[5] = scale((target.r - pos.r) as f32, 10.0);
            scalars[10] = scale(*cost as f32, 10.0);
        }
        LegalAction::Explore { direction } => {
            let (dq, dr) = direction.offset();
            scalars[4] = scale(dq as f32, 10.0);
            scalars[5] = scale(dr as f32, 10.0);
        }
        LegalAction::ResolveChoice { choice_index } => {
            scalars[19] = scale(*choice_index as f32, 5.0);
        }
        LegalAction::ResolveDiscardForBonus { choice_index, discard_count } => {
            scalars[19] = scale(*choice_index as f32, 5.0);
            scalars[0] = scale(*discard_count as f32, 10.0);
        }
        LegalAction::DeclareBlock { enemy_instance_id, attack_index } => {
            scalars[7] = 1.0; // has_enemy_target
            // Derive block metadata from enemy definition
            if let Some(ref combat) = state.combat {
                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *enemy_instance_id) {
                    if let Some(def) = get_enemy(e.enemy_id.as_str()) {
                        let idx = *attack_index;
                        if let Some(attacks) = def.attacks {
                            if idx < attacks.len() {
                                let atk = &attacks[idx];
                                scalars[29] = scale(atk.damage as f32, 20.0); // required_block
                                scalars[30] = scale(atk.damage as f32, 10.0); // enemy_attack
                            }
                        } else {
                            // Single attack enemy
                            scalars[29] = scale(def.attack as f32, 20.0);
                            scalars[30] = scale(def.attack as f32, 10.0);
                        }
                        scalars[31] = if def.abilities.iter().any(|a| matches!(a, mk_types::enums::EnemyAbilityType::Swift)) { 1.0 } else { 0.0 };
                        scalars[32] = if def.abilities.iter().any(|a| matches!(a, mk_types::enums::EnemyAbilityType::Brutal)) { 1.0 } else { 0.0 };
                        scalars[33] = scale(def.armor as f32, 20.0); // target_armor
                    }
                }
            }
        }
        LegalAction::InitiateAttack { attack_type } => {
            match attack_type {
                CombatType::Melee => scalars[20] = 1.0,
                CombatType::Ranged => scalars[21] = 1.0,
                CombatType::Siege => scalars[22] = 1.0,
            }
        }
        LegalAction::EndTurn | LegalAction::EndCombatPhase => {
            scalars[11] = 1.0; // is_end
        }
        LegalAction::RecruitUnit { influence_cost, .. } => {
            scalars[10] = scale(*influence_cost as f32, 10.0);
            scalars[9] = 1.0; // has_unit
        }
        LegalAction::ActivateUnit { .. } => {
            scalars[9] = 1.0; // has_unit
        }
        LegalAction::ChallengeRampaging { hex } => {
            let player = &state.players[player_idx];
            let pos = player.position.unwrap_or(mk_types::hex::HexCoord::new(0, 0));
            scalars[4] = scale((hex.q - pos.q) as f32, 10.0);
            scalars[5] = scale((hex.r - pos.r) as f32, 10.0);
            scalars[7] = 1.0; // has_enemy_target
        }
        LegalAction::AssignDamageToHero { .. } => {
            scalars[7] = 1.0; // has_enemy_target
        }
        LegalAction::AssignDamageToUnit { .. } => {
            scalars[7] = 1.0; // has_enemy_target
            scalars[9] = 1.0; // has_unit
        }
        LegalAction::InteractSite { healing } => {
            scalars[0] = scale(*healing as f32, 10.0);
        }
        LegalAction::SpendMoveOnCumbersome { .. } => {
            scalars[7] = 1.0; // has_enemy_target
        }
        LegalAction::ResolveBannerProtection { remove_all } => {
            scalars[0] = if *remove_all { 1.0 } else { 0.0 };
        }
        LegalAction::ResolveSteadyTempoDeckPlacement { place } => {
            scalars[0] = if *place { 1.0 } else { 0.0 };
        }
        LegalAction::ResolveSourceOpeningReroll { reroll } => {
            scalars[0] = if *reroll { 1.0 } else { 0.0 };
        }
        LegalAction::SubsetSelect { index } => {
            scalars[19] = scale(*index as f32, 5.0);
        }
        LegalAction::BuySpell { .. } => {
            scalars[8] = 1.0; // has_card
            scalars[10] = scale(7.0, 10.0); // influence cost
        }
        LegalAction::LearnAdvancedAction { .. } => {
            scalars[8] = 1.0; // has_card
            scalars[10] = scale(6.0, 10.0); // influence cost
        }
        LegalAction::SelectReward { .. } => {
            scalars[8] = 1.0; // has_card
        }
        LegalAction::AssignBanner { .. } => {
            scalars[8] = 1.0; // has_card
        }
        _ => {}
    }

    // Set has_card flag for card-related actions
    match action {
        LegalAction::PlayCardBasic { .. }
        | LegalAction::PlayCardPowered { .. }
        | LegalAction::PlayCardSideways { .. }
        | LegalAction::ResolveDecompose { .. }
        | LegalAction::ResolveMaximalEffect { .. } => {
            scalars[8] = 1.0;
        }
        _ => {}
    }

    scalars
}

fn set_mana_color_one_hot(scalars: &mut [f32], base: usize, color: ManaColor) {
    match color {
        ManaColor::Red => scalars[base] = 1.0,
        ManaColor::Blue => scalars[base + 1] = 1.0,
        ManaColor::Green => scalars[base + 2] = 1.0,
        ManaColor::White => scalars[base + 3] = 1.0,
        ManaColor::Gold => scalars[base + 4] = 1.0,
        ManaColor::Black => scalars[base + 5] = 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
    use mk_engine::setup::{create_solo_game, place_initial_tiles};
    use mk_engine::undo::UndoStack;
    use mk_types::enums::Hero;

    #[test]
    fn encode_actions_produces_correct_dimensions() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let undo = UndoStack::new();
        let action_set = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let features = encode_actions(&state, 0, &action_set.actions);

        assert!(!features.is_empty(), "Should have at least one action");
        for (i, af) in features.iter().enumerate() {
            assert_eq!(
                af.scalars.len(),
                ACTION_SCALAR_DIM,
                "Action {} has wrong scalar dim",
                i
            );
        }
    }

    #[test]
    fn encode_actions_no_nan() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let undo = UndoStack::new();
        let action_set = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let features = encode_actions(&state, 0, &action_set.actions);

        for (i, af) in features.iter().enumerate() {
            for (j, &s) in af.scalars.iter().enumerate() {
                assert!(!s.is_nan(), "Action {} scalar {} is NaN", i, j);
            }
        }
    }

    #[test]
    fn action_type_mapping() {
        assert!(ACTION_TYPE_VOCAB.encode("PLAY_CARD") > 0);
        assert!(ACTION_TYPE_VOCAB.encode("MOVE") > 0);
        assert!(ACTION_TYPE_VOCAB.encode("END_TURN") > 0);
        assert!(ACTION_TYPE_VOCAB.encode("EXPLORE") > 0);
    }
}
