//! Action encoder — produces per-action features (6 vocab IDs + 34 scalars).
//!
//! Each legal action is encoded with vocabulary indices for embedding layers
//! and scalar features for the scoring network.

use mk_data::cards::{get_card, get_card_color};
use mk_data::enemies::get_enemy;
use mk_types::effect::CardEffect;
use mk_types::enums::{BasicManaColor, CombatType, Element, ManaColor, ResistanceElement, SidewaysAs};
use mk_types::legal_action::LegalAction;
use mk_types::pending::{
    ActivePending, ChoiceResolution, KnowYourPreyApplyOption, PeacefulMomentOption,
    RegenerateManaSource,
};
use mk_types::state::GameState;

use crate::source_derivation::derive_source;
use crate::types::{scale, terrain_difficulty, ActionFeatures, ACTION_SCALAR_DIM};
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
        LegalAction::ResolveAttack => "RESOLVE_ATTACK",
        LegalAction::SpendMoveOnCumbersome { .. } => "SPEND_MOVE_ON_CUMBERSOME",
        LegalAction::ResolveTacticDecision { .. } => "RESOLVE_TACTIC_DECISION",
        LegalAction::ActivateTactic => "ACTIVATE_TACTIC",
        LegalAction::InitiateManaSearch => "REROLL_SOURCE_DICE",
        LegalAction::BeginInteraction => "BEGIN_INTERACTION",
        LegalAction::BeginPeacefulMomentHealing => "BEGIN_PEACEFUL_MOMENT_HEALING",
        LegalAction::EnterSite => "ENTER_SITE",
        LegalAction::InteractSite { .. } => "INTERACT",
        LegalAction::PlunderSite => "PLUNDER_VILLAGE",
        LegalAction::DeclinePlunder => "DECLINE_PLUNDER",
        LegalAction::ResolveGladeWound { .. } => "RESOLVE_GLADE_WOUND",
        LegalAction::RecruitUnit { .. } => "RECRUIT_UNIT",
        LegalAction::ActivateUnit { .. } => "ACTIVATE_UNIT",
        LegalAction::AssignDamageToHero { .. } | LegalAction::AssignDamageToUnit { .. } => "ASSIGN_DAMAGE",
        LegalAction::ChooseLevelUpSkill { .. } => "CHOOSE_LEVEL_UP_SKILL",
        LegalAction::ChooseLevelUpAdvancedAction { .. } => "CHOOSE_LEVEL_UP_AA",
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
        LegalAction::BuyArtifact => "BUY_ARTIFACT",
        LegalAction::BuyCityAdvancedAction { .. } => "BUY_CITY_ADVANCED_ACTION",
        LegalAction::BuyCityAdvancedActionFromDeck => "BUY_CITY_ADVANCED_ACTION_FROM_DECK",
        LegalAction::AddEliteToOffer => "ADD_ELITE_TO_OFFER",
        LegalAction::SelectArtifact { .. } => "SELECT_ARTIFACT",
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
        LegalAction::ApplyBlockBoost { .. } => "APPLY_BLOCK_BOOST",
        LegalAction::PayHeroesAssaultInfluence => "PAY_HEROES_ASSAULT_INFLUENCE",
        LegalAction::PayThugsDamageInfluence { .. } => "PAY_THUGS_DAMAGE_INFLUENCE",
        LegalAction::ResolveUnitMaintenance { .. } => "RESOLVE_UNIT_MAINTENANCE",
        LegalAction::ResolveHexCostReduction { .. } => "RESOLVE_HEX_COST_REDUCTION",
        LegalAction::ResolveTerrainCostReduction { .. } => "RESOLVE_TERRAIN_COST_REDUCTION",
        LegalAction::ResolveCrystalRollColor { .. } => "RESOLVE_CRYSTAL_ROLL_COLOR",
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
    let mut target_enemy_ids: Vec<u16> = Vec::new();

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

        LegalAction::ResolveTacticDecision {
            data: mk_types::legal_action::TacticDecisionData::Preparation { deck_card_index },
        } => {
            // Look up the card at this deck position from the pending snapshot
            if let Some(mk_types::pending::ActivePending::TacticDecision(
                mk_types::pending::PendingTacticDecision::Preparation { deck_snapshot }
            )) = &player.pending.active {
                if let Some(cid) = deck_snapshot.get(*deck_card_index) {
                    card_id = CARD_VOCAB.encode(cid.as_str());
                }
            }
        }

        LegalAction::UseSkill { skill_id: sid } | LegalAction::ReturnInteractiveSkill { skill_id: sid } => {
            skill_id = SKILL_VOCAB.encode(sid.as_str());
        }

        LegalAction::ChooseLevelUpAdvancedAction {
            advanced_action_id,
        } => {
            card_id = CARD_VOCAB.encode(advanced_action_id.as_str());
        }

        LegalAction::ChooseLevelUpSkill { skill_index, from_common_pool } => {
            // Look up the actual skill ID from the pending state
            if let Some(ActivePending::LevelUpReward(ref reward)) = player.pending.active {
                let sid = if *from_common_pool {
                    state.offers.common_skills.get(*skill_index)
                } else {
                    reward.drawn_skills.get(*skill_index)
                };
                if let Some(sid) = sid {
                    skill_id = SKILL_VOCAB.encode(sid.as_str());
                }
            }
        }

        LegalAction::CompleteRest { discard_hand_index: Some(idx) } => {
            if let Some(cid) = player.hand.get(*idx) {
                card_id = CARD_VOCAB.encode(cid.as_str());
            }
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
        | LegalAction::BuyCityAdvancedAction { card_id: cid, .. }
        | LegalAction::SelectReward { card_id: cid, .. }
        | LegalAction::AssignBanner { card_id: cid, .. }
        | LegalAction::SelectArtifact { card_id: cid } => {
            card_id = CARD_VOCAB.encode(cid.as_str());
        }

        LegalAction::SubsetSelect { index } => {
            // For attack targets, resolve the enemy at this pool index
            if let Some(mk_types::pending::ActivePending::SubsetSelection(ref ss)) = player.pending.active {
                if let mk_types::pending::SubsetSelectionKind::AttackTargets { ref eligible_instance_ids, .. } = ss.kind {
                    if let Some(iid) = eligible_instance_ids.get(*index) {
                        if let Some(ref combat) = state.combat {
                            if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *iid) {
                                target_enemy_ids.push(ENEMY_VOCAB.encode(e.enemy_id.as_str()));
                            }
                        }
                    }
                }
            } else if let Some(ref combat) = state.combat {
                // Lazy attack target selection: no pending yet, resolve from combat context
                let attack_type = match combat.phase {
                    mk_types::enums::CombatPhase::RangedSiege => CombatType::Siege,
                    mk_types::enums::CombatPhase::Attack => CombatType::Melee,
                    _ => CombatType::Melee,
                };
                let player_id_str = player.id.as_str();
                let eligible = mk_engine::legal_actions::combat::eligible_attack_targets(
                    combat, attack_type, &state.active_modifiers, Some(player_id_str),
                );
                if let Some(iid) = eligible.get(*index) {
                    if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *iid) {
                        target_enemy_ids.push(ENEMY_VOCAB.encode(e.enemy_id.as_str()));
                    }
                }
            }
        }

        LegalAction::SubsetConfirm => {
            // For attack targets, resolve all selected enemies
            if let Some(mk_types::pending::ActivePending::SubsetSelection(ref ss)) = player.pending.active {
                if let mk_types::pending::SubsetSelectionKind::AttackTargets { ref eligible_instance_ids, .. } = ss.kind {
                    if let Some(ref combat) = state.combat {
                        for &sel_idx in &ss.selected {
                            if let Some(iid) = eligible_instance_ids.get(sel_idx) {
                                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id == *iid) {
                                    target_enemy_ids.push(ENEMY_VOCAB.encode(e.enemy_id.as_str()));
                                }
                            }
                        }
                    }
                }
            }
        }

        LegalAction::ResolveChoice { choice_index } => {
            if let Some(ActivePending::Choice(ref choice)) = player.pending.active {
                match &choice.resolution {
                    ChoiceResolution::ReadyUnitTarget { eligible_unit_indices }
                    | ChoiceResolution::HealUnitTarget { eligible_unit_indices }
                    | ChoiceResolution::EnergyFlowTarget { eligible_unit_indices, .. }
                    | ChoiceResolution::SelectUnitModifier { eligible_unit_indices } => {
                        if let Some(&idx) = eligible_unit_indices.get(*choice_index) {
                            if let Some(u) = player.units.get(idx) {
                                unit_id = UNIT_VOCAB.encode(u.unit_id.as_str());
                            }
                        }
                    }
                    // choice_index 0 = "Done", 1+ maps to eligible_unit_indices[choice_index - 1]
                    ChoiceResolution::ReadyUnitsBudgetSelect { eligible_unit_indices, .. }
                        if *choice_index > 0 =>
                    {
                        if let Some(&idx) = eligible_unit_indices.get(*choice_index - 1) {
                            if let Some(u) = player.units.get(idx) {
                                unit_id = UNIT_VOCAB.encode(u.unit_id.as_str());
                            }
                        }
                    }
                    ChoiceResolution::ReadyUnitsBudgetSelect { .. } => {}
                    ChoiceResolution::CallToArmsUnitSelect { eligible_unit_indices }
                    | ChoiceResolution::FreeRecruitTarget { eligible_unit_indices } => {
                        if let Some(&idx) = eligible_unit_indices.get(*choice_index) {
                            if let Some(uid) = state.offers.units.get(idx) {
                                unit_id = UNIT_VOCAB.encode(uid.as_str());
                            }
                        }
                    }
                    ChoiceResolution::DuelingTarget { eligible_enemy_ids }
                    | ChoiceResolution::CurseTarget { eligible_enemy_ids }
                    | ChoiceResolution::KnowYourPreyTarget { eligible_enemy_ids }
                    | ChoiceResolution::NaturesVengeanceTarget { eligible_enemy_ids, .. }
                    | ChoiceResolution::PossessEnemyTarget { eligible_enemy_ids } => {
                        if let Some(instance_id) = eligible_enemy_ids.get(*choice_index) {
                            if let Some(ref combat) = state.combat {
                                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id.as_str() == instance_id.as_str()) {
                                    enemy_id = ENEMY_VOCAB.encode(e.enemy_id.as_str());
                                }
                            }
                        }
                    }
                    ChoiceResolution::ForkedLightningTarget { already_targeted, .. } => {
                        // Rebuild eligible: alive enemies not in already_targeted
                        if let Some(ref combat) = state.combat {
                            let eligible: Vec<&str> = combat.enemies.iter()
                                .filter(|e| !e.is_defeated && !already_targeted.contains(&e.instance_id.as_str().to_string()))
                                .map(|e| e.instance_id.as_str())
                                .collect();
                            if *choice_index < eligible.len() {
                                if let Some(e) = combat.enemies.iter().find(|e| e.instance_id.as_str() == eligible[*choice_index]) {
                                    enemy_id = ENEMY_VOCAB.encode(e.enemy_id.as_str());
                                }
                            }
                        }
                    }
                    ChoiceResolution::WingsOfNightTarget { eligible_enemy_ids, targets_so_far } => {
                        // When targets_so_far > 0, index 0 = "Done", enemies start at index 1
                        let done_offset = if *targets_so_far > 0 { 1 } else { 0 };
                        if *choice_index >= done_offset {
                            if let Some(instance_id) = eligible_enemy_ids.get(*choice_index - done_offset) {
                                if let Some(ref combat) = state.combat {
                                    if let Some(e) = combat.enemies.iter().find(|e| e.instance_id.as_str() == instance_id.as_str()) {
                                        enemy_id = ENEMY_VOCAB.encode(e.enemy_id.as_str());
                                    }
                                }
                            }
                        }
                    }
                    // Card-targeting resolutions (hand-indexed)
                    ChoiceResolution::BoostTarget { eligible_hand_indices } => {
                        if let Some(&hand_idx) = eligible_hand_indices.get(*choice_index) {
                            if let Some(cid) = player.hand.get(hand_idx) {
                                card_id = CARD_VOCAB.encode(cid.as_str());
                            }
                        }
                    }
                    ChoiceResolution::DiscardThenContinue { eligible_indices } => {
                        if let Some(&hand_idx) = eligible_indices.get(*choice_index) {
                            if let Some(cid) = player.hand.get(hand_idx) {
                                card_id = CARD_VOCAB.encode(cid.as_str());
                            }
                        }
                    }
                    ChoiceResolution::ShapeshiftCardSelect { options } => {
                        if let Some(opt) = options.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(opt.card_id.as_str());
                        }
                    }
                    ChoiceResolution::DiscardForCrystalSelect { eligible_card_ids, optional } => {
                        // When optional, index 0 = skip
                        let card_offset = if *optional { 1 } else { 0 };
                        if *choice_index >= card_offset {
                            if let Some(cid) = eligible_card_ids.get(*choice_index - card_offset) {
                                card_id = CARD_VOCAB.encode(cid.as_str());
                            }
                        }
                    }
                    ChoiceResolution::InvocationDiscard { options } => {
                        if let Some(opt) = options.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(opt.card_id.as_str());
                        }
                    }
                    // Card-targeting resolutions (offer-indexed)
                    ChoiceResolution::BloodBasicAaSelect { color } => {
                        let matching_aas: Vec<_> = state.offers.advanced_actions.iter()
                            .filter(|cid| get_card_color(cid.as_str()) == Some(*color))
                            .collect();
                        if let Some(cid) = matching_aas.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(cid.as_str());
                        }
                    }
                    ChoiceResolution::BloodPoweredAaSelect => {
                        if let Some(cid) = state.offers.advanced_actions.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(cid.as_str());
                        }
                    }
                    ChoiceResolution::MagicTalentSpellSelect { spell_entries } => {
                        if let Some((_, spell_id, _)) = spell_entries.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(spell_id.as_str());
                        }
                    }
                    ChoiceResolution::MagicTalentGainSelect { gain_entries } => {
                        if let Some((_, spell_id, _)) = gain_entries.get(*choice_index) {
                            card_id = CARD_VOCAB.encode(spell_id.as_str());
                        }
                    }
                    _ => {}
                }
            }
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
        LegalAction::PlayCardBasic { card_id, .. } => {
            scalars[2] = 1.0; // is_basic
            if let Some(card_def) = get_card(card_id.as_str()) {
                let h = extract_headline_values(&card_def.basic_effect);
                apply_headline_scalars(&mut scalars, &h);
            }
        }
        LegalAction::PlayCardPowered { card_id, mana_color, .. } => {
            scalars[1] = 1.0; // is_powered
            scalars[8] = 1.0; // has_card
            if let Some(color) = mana_color {
                scalars[6] = scale(1.0, 5.0); // num_mana
                set_mana_color_one_hot(&mut scalars, 12, ManaColor::from(*color));
            }
            if let Some(card_def) = get_card(card_id.as_str()) {
                let h = extract_headline_values(&card_def.powered_effect);
                apply_headline_scalars(&mut scalars, &h);
            }
        }
        LegalAction::PlayCardSideways { card_id, sideways_as, .. } => {
            scalars[3] = 1.0; // is_sideways
            let sw_val = get_card(card_id.as_str())
                .map(|c| c.sideways_value)
                .unwrap_or(1);
            match sideways_as {
                SidewaysAs::Move => {
                    scalars[18] = scale(sw_val as f32, 10.0);
                    scalars[0] = scale(sw_val as f32, 10.0);
                }
                SidewaysAs::Influence => {
                    scalars[0] = scale(sw_val as f32, 10.0);
                }
                SidewaysAs::Attack => {
                    scalars[28] = scale(sw_val as f32, 10.0);
                    scalars[0] = scale(sw_val as f32, 10.0);
                }
                SidewaysAs::Block => {
                    scalars[0] = scale(sw_val as f32, 10.0);
                }
            }
        }
        LegalAction::Move { target, cost } => {
            let player = &state.players[player_idx];
            let pos = player.position.unwrap_or(mk_types::hex::HexCoord::new(0, 0));
            scalars[4] = scale((target.q - pos.q) as f32, 10.0);
            scalars[5] = scale((target.r - pos.r) as f32, 10.0);
            scalars[10] = scale(*cost as f32, 10.0);
            // Target hex context
            if let Some(hex) = state.map.hexes.get(&target.key()) {
                scalars[24] = terrain_difficulty(hex.terrain);
                scalars[25] = if hex.site.is_some() { 1.0 } else { 0.0 };
                scalars[26] = if !hex.enemies.is_empty() { 1.0 } else { 0.0 };
            }
            // Will this move provoke rampaging enemies? (skirting past adjacent rampagers)
            let provoked = mk_engine::movement::find_provoked_rampaging_enemies(
                state, player_idx, pos, *target,
            );
            scalars[27] = if provoked.is_empty() { 0.0 } else { 1.0 };
        }
        LegalAction::Explore { target_center } => {
            scalars[4] = scale(target_center.q as f32, 10.0);
            scalars[5] = scale(target_center.r as f32, 10.0);
        }
        LegalAction::ResolveChoice { choice_index } => {
            scalars[19] = scale(*choice_index as f32, 5.0);
            // Enrich with effect parameters from the pending choice option
            let player = &state.players[player_idx];
            if let Some(ActivePending::Choice(ref choice)) = player.pending.active {
                if let Some(option) = choice.options.get(*choice_index) {
                    enrich_choice_scalars(&mut scalars, option, &choice.resolution, *choice_index);
                }
                // State-dependent enrichment for variants needing game state lookups
                match &choice.resolution {
                    ChoiceResolution::SourceOpeningDieSelect { die_ids } if *choice_index > 0 => {
                        if let Some(die_id) = die_ids.get(*choice_index - 1) {
                            if let Some(die) = state.source.dice.iter().find(|d| d.id.as_str() == die_id.as_str()) {
                                set_mana_color_one_hot(&mut scalars, 12, die.color);
                            }
                        }
                    }
                    ChoiceResolution::SourceOpeningDieSelect { .. } => {}
                    ChoiceResolution::CurseAttackIndex { enemy_instance_id, .. } => {
                        if let Some(ref combat) = state.combat {
                            if let Some(e) = combat.enemies.iter().find(|e| e.instance_id.as_str() == enemy_instance_id.as_str()) {
                                if let Some(def) = get_enemy(e.enemy_id.as_str()) {
                                    if let Some(attacks) = def.attacks {
                                        if let Some(atk) = attacks.get(*choice_index) {
                                            scalars[30] = scale(atk.damage as f32, 10.0);
                                            set_element_one_hot(&mut scalars, 23, atk.element);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    ChoiceResolution::PuppetMasterSelectToken { token_indices } => {
                        if let Some(&token_idx) = token_indices.get(*choice_index) {
                            if let Some(token) = player.kept_enemy_tokens.get(token_idx) {
                                scalars[7] = 1.0;
                                scalars[30] = scale(token.attack as f32, 10.0);
                                scalars[33] = scale(token.armor as f32, 20.0);
                            }
                        }
                    }
                    _ => {}
                }
            }
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
        LegalAction::ResolveAttack => {
            // Encode attack type from declared state
            if let Some(ref combat) = state.combat {
                if let Some(attack_type) = combat.declared_attack_type {
                    match attack_type {
                        CombatType::Melee => scalars[20] = 1.0,
                        CombatType::Ranged => scalars[21] = 1.0,
                        CombatType::Siege => scalars[22] = 1.0,
                    }
                }
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
        LegalAction::ResolveTacticDecision { data } => {
            match data {
                mk_types::legal_action::TacticDecisionData::ManaSteal { die_index } => {
                    // Encode the color of the die being stolen
                    if let Some(die) = state.source.dice.get(*die_index) {
                        set_mana_color_one_hot(&mut scalars, 12, die.color);
                    }
                    scalars[19] = scale(*die_index as f32, 5.0);
                }
                mk_types::legal_action::TacticDecisionData::Preparation { deck_card_index } => {
                    scalars[19] = scale(*deck_card_index as f32, 5.0);
                }
                _ => {}
            }
        }
        LegalAction::SubsetSelect { index } => {
            scalars[19] = scale(*index as f32, 5.0);
        }
        LegalAction::SubsetConfirm => {
            scalars[11] = 1.0; // is_confirm (distinguishes from SubsetSelect(0))
        }
        LegalAction::BuySpell { .. } => {
            scalars[8] = 1.0; // has_card
            scalars[10] = scale(7.0, 10.0); // influence cost
        }
        LegalAction::LearnAdvancedAction { .. } => {
            scalars[8] = 1.0; // has_card
            scalars[10] = scale(6.0, 10.0); // influence cost
        }
        LegalAction::BuyArtifact => {
            scalars[10] = scale(12.0, 10.0); // influence cost
        }
        LegalAction::BuyCityAdvancedAction { .. } => {
            scalars[8] = 1.0; // has_card
            scalars[10] = scale(6.0, 10.0); // influence cost
        }
        LegalAction::BuyCityAdvancedActionFromDeck => {
            scalars[10] = scale(6.0, 10.0); // influence cost
        }
        LegalAction::AddEliteToOffer => {
            scalars[10] = scale(2.0, 10.0); // influence cost
        }
        LegalAction::SelectArtifact { .. } => {
            scalars[8] = 1.0; // has_card
        }
        LegalAction::SelectReward { .. } => {
            scalars[8] = 1.0; // has_card
        }
        LegalAction::AssignBanner { .. } => {
            scalars[8] = 1.0; // has_card
        }
        LegalAction::ApplyBlockBoost { element } => {
            set_element_one_hot(&mut scalars, 23, *element);
            scalars[0] = scale(1.0, 10.0); // amount (+1)
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

fn set_element_one_hot(scalars: &mut [f32], base: usize, element: Element) {
    match element {
        Element::Physical => scalars[base] = 1.0,
        Element::Fire => scalars[base + 1] = 1.0,
        Element::Ice => scalars[base + 2] = 1.0,
        Element::ColdFire => scalars[base + 3] = 1.0,
    }
}

// =============================================================================
// Headline value extraction for card plays
// =============================================================================

/// Summary values extracted from a CardEffect tree for encoding.
#[derive(Default)]
struct HeadlineValues {
    move_val: u32,
    attack_val: u32,
    block_val: u32,
    influence_val: u32,
    heal_val: u32,
    draw_val: u32,
    combat_type: Option<CombatType>,
    element: Option<Element>,
}

/// Recursively extract headline values from a CardEffect tree.
fn extract_headline_values(effect: &CardEffect) -> HeadlineValues {
    let mut h = HeadlineValues::default();
    match effect {
        CardEffect::GainMove { amount } => h.move_val = *amount,
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => {
            h.attack_val = *amount;
            h.combat_type = Some(*combat_type);
            h.element = Some(*element);
        }
        CardEffect::AttackWithDefeatBonus {
            amount,
            combat_type,
            element,
            ..
        } => {
            h.attack_val = *amount;
            h.combat_type = Some(*combat_type);
            h.element = Some(*element);
        }
        CardEffect::GainBlock { amount, element } | CardEffect::GainBlockElement { amount, element } => {
            h.block_val = *amount;
            h.element = Some(*element);
        }
        CardEffect::GainInfluence { amount } => h.influence_val = *amount,
        CardEffect::GainHealing { amount } => h.heal_val = *amount,
        CardEffect::DrawCards { count } => h.draw_val = *count,
        CardEffect::GainFame { amount } => {
            // Fame doesn't map to a headline channel but contributes to max
            h.heal_val = h.heal_val.max(*amount);
        }
        CardEffect::Cure { amount } => h.heal_val = *amount,
        CardEffect::CardBoost { bonus } => h.attack_val = *bonus,
        CardEffect::PureMagic { amount } => h.move_val = *amount,
        CardEffect::Compound { effects } => {
            for sub in effects {
                let sub_h = extract_headline_values(sub);
                h.move_val += sub_h.move_val;
                h.attack_val += sub_h.attack_val;
                h.block_val += sub_h.block_val;
                h.influence_val += sub_h.influence_val;
                h.heal_val += sub_h.heal_val;
                h.draw_val += sub_h.draw_val;
                if h.combat_type.is_none() {
                    h.combat_type = sub_h.combat_type;
                }
                if h.element.is_none() {
                    h.element = sub_h.element;
                }
            }
        }
        CardEffect::Choice { options } => {
            for opt in options {
                let opt_h = extract_headline_values(opt);
                h.move_val = h.move_val.max(opt_h.move_val);
                h.attack_val = h.attack_val.max(opt_h.attack_val);
                h.block_val = h.block_val.max(opt_h.block_val);
                h.influence_val = h.influence_val.max(opt_h.influence_val);
                h.heal_val = h.heal_val.max(opt_h.heal_val);
                h.draw_val = h.draw_val.max(opt_h.draw_val);
                if h.combat_type.is_none() {
                    h.combat_type = opt_h.combat_type;
                }
                if h.element.is_none() {
                    h.element = opt_h.element;
                }
            }
        }
        CardEffect::Conditional { then_effect, .. } => {
            h = extract_headline_values(then_effect);
        }
        CardEffect::Scaling { base_effect, .. } => {
            h = extract_headline_values(base_effect);
        }
        _ => {} // Complex/interactive effects → zeros
    }
    h
}

/// Apply headline values to the scalar array for card play actions.
fn apply_headline_scalars(scalars: &mut [f32], h: &HeadlineValues) {
    let max_val = h
        .move_val
        .max(h.attack_val)
        .max(h.block_val)
        .max(h.influence_val)
        .max(h.heal_val)
        .max(h.draw_val);
    if max_val > 0 {
        scalars[0] = scale(max_val as f32, 10.0);
    }
    if h.move_val > 0 {
        scalars[18] = scale(h.move_val as f32, 10.0);
    }
    if h.attack_val > 0 {
        scalars[28] = scale(h.attack_val as f32, 10.0);
    }
    if let Some(ct) = h.combat_type {
        match ct {
            CombatType::Melee => scalars[20] = 1.0,
            CombatType::Ranged => scalars[21] = 1.0,
            CombatType::Siege => scalars[22] = 1.0,
        }
    }
    if let Some(elem) = h.element {
        set_element_one_hot(scalars, 23, elem);
    }
}

/// Enrich scalars for a ResolveChoice action with the chosen CardEffect's parameters.
/// Uses the same scalar positions as equivalent direct actions so the network
/// sees consistent semantics (e.g., mana color at [12..18], amount at [0]).
fn enrich_choice_scalars(scalars: &mut [f32], effect: &CardEffect, resolution: &ChoiceResolution, choice_index: usize) {
    match effect {
        CardEffect::GainMana { color, amount } => {
            set_mana_color_one_hot(scalars, 12, *color);
            scalars[0] = scale(*amount as f32, 10.0);
        }
        CardEffect::GainAttack { amount, combat_type, element } => {
            scalars[0] = scale(*amount as f32, 10.0);
            match combat_type {
                CombatType::Melee => scalars[20] = 1.0,
                CombatType::Ranged => scalars[21] = 1.0,
                CombatType::Siege => scalars[22] = 1.0,
            }
            set_element_one_hot(scalars, 23, *element);
        }
        CardEffect::AttackWithDefeatBonus { amount, combat_type, element, .. } => {
            scalars[0] = scale(*amount as f32, 10.0);
            match combat_type {
                CombatType::Melee => scalars[20] = 1.0,
                CombatType::Ranged => scalars[21] = 1.0,
                CombatType::Siege => scalars[22] = 1.0,
            }
            set_element_one_hot(scalars, 23, *element);
        }
        CardEffect::GainBlock { amount, element } => {
            scalars[0] = scale(*amount as f32, 10.0);
            set_element_one_hot(scalars, 23, *element);
        }
        CardEffect::GainMove { amount } => {
            scalars[0] = scale(*amount as f32, 10.0);
        }
        CardEffect::GainInfluence { amount } => {
            scalars[0] = scale(*amount as f32, 10.0);
        }
        CardEffect::GainHealing { amount } => {
            scalars[0] = scale(*amount as f32, 10.0);
        }
        CardEffect::GainFame { amount } => {
            scalars[0] = scale(*amount as f32, 10.0);
        }
        CardEffect::DrawCards { count } => {
            scalars[0] = scale(*count as f32, 10.0);
        }
        CardEffect::GainCrystal { color: Some(basic_color) } => {
            set_mana_color_one_hot(scalars, 12, ManaColor::from(*basic_color));
        }
        CardEffect::Noop => {
            // Noop options carry no info in the effect — extract from the resolution instead.
            if let ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors }
                | ChoiceResolution::CrystalMasteryGainColor { eligible_colors } = resolution
            {
                if let Some(&color) = eligible_colors.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(color));
                }
            } else if let ChoiceResolution::ManaMeltdownColorSelect { available_colors }
                | ChoiceResolution::UniversalPowerMana { available_colors } = resolution
            {
                if let Some(&color) = available_colors.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(color));
                }
            } else if let ChoiceResolution::ManaStormDieSelect { die_colors, .. }
                | ChoiceResolution::ManaClaimDieSelect { die_colors, .. } = resolution
            {
                if let Some(&color) = die_colors.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(color));
                }
            } else if let ChoiceResolution::SpellForgeCrystal { spell_entries, .. } = resolution {
                if let Some((_, color)) = spell_entries.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(*color));
                }
            } else if let ChoiceResolution::RegenerateMana { sources, .. } = resolution {
                if let Some(src) = sources.get(choice_index) {
                    let color = match src {
                        RegenerateManaSource::Token(c) | RegenerateManaSource::SourceDie(c) => *c,
                        RegenerateManaSource::Crystal(c) => ManaColor::from(*c),
                    };
                    set_mana_color_one_hot(scalars, 12, color);
                }
            } else if let ChoiceResolution::ManaSourceSelect { sources, .. } = resolution {
                if let Some(src) = sources.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, src.color);
                }
            } else if let ChoiceResolution::PolarizationConvert { options } = resolution {
                if let Some(opt) = options.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, opt.source_color);
                }
            } else if let ChoiceResolution::BloodBasicManaSelect { mana_options } = resolution {
                if let Some((_, color)) = mana_options.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(*color));
                }
            // --- Group 1: Color one-hot from resolution metadata ---
            } else if matches!(resolution, ChoiceResolution::MindReadColorSelect) {
                let colors = [BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White];
                if let Some(&color) = colors.get(choice_index) {
                    set_mana_color_one_hot(scalars, 12, ManaColor::from(color));
                }
            } else if let ChoiceResolution::ManaClaimModeSelect { color, .. } = resolution {
                set_mana_color_one_hot(scalars, 12, ManaColor::from(*color));
                scalars[0] = if choice_index == 0 { scale(3.0, 10.0) } else { scale(1.0, 10.0) };
            } else if matches!(resolution, ChoiceResolution::SecretWaysLake | ChoiceResolution::SongOfWindLake) {
                if choice_index == 1 {
                    set_mana_color_one_hot(scalars, 12, ManaColor::Blue);
                }
            // --- Group 2: Metadata-driven scalars ---
            } else if matches!(resolution, ChoiceResolution::RitualOfPainDiscard { .. }) {
                scalars[0] = scale(choice_index as f32, 5.0);
            } else if matches!(resolution, ChoiceResolution::BloodPoweredWoundSelect) {
                scalars[0] = scale(choice_index as f32, 2.0);
            } else if matches!(resolution, ChoiceResolution::CurseMode { .. }) {
                if choice_index == 0 {
                    scalars[28] = scale(2.0, 10.0); // attack reduction
                } else {
                    scalars[33] = scale(1.0, 20.0); // armor reduction
                }
            } else if let ChoiceResolution::PuppetMasterUseMode { attack_value, attack_element, block_value, block_element, .. } = resolution {
                if choice_index == 0 {
                    scalars[28] = scale(*attack_value as f32, 10.0);
                    set_element_one_hot(scalars, 23, *attack_element);
                } else {
                    scalars[0] = scale(*block_value as f32, 10.0);
                    set_element_one_hot(scalars, 23, *block_element);
                }
            } else if let ChoiceResolution::ShapeshiftTypeSelect { amount, element, original_type, .. } = resolution {
                use mk_types::modifier::ShapeshiftTarget;
                let all = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
                let available: Vec<_> = all.iter().filter(|&&t| t != *original_type).collect();
                if let Some(target) = available.get(choice_index) {
                    match target {
                        ShapeshiftTarget::Move => scalars[18] = scale(*amount as f32, 10.0),
                        ShapeshiftTarget::Attack => scalars[28] = scale(*amount as f32, 10.0),
                        ShapeshiftTarget::Block => scalars[0] = scale(*amount as f32, 10.0),
                    }
                }
                scalars[0] = scalars[0].max(scale(*amount as f32, 10.0));
                if let Some(elem) = element {
                    set_element_one_hot(scalars, 23, *elem);
                }
            } else if let ChoiceResolution::KnowYourPreyOption { options, .. } = resolution {
                if let Some(opt) = options.get(choice_index) {
                    match opt {
                        KnowYourPreyApplyOption::NullifyAbility { .. } => {
                            scalars[7] = 1.0;
                        }
                        KnowYourPreyApplyOption::RemoveResistance { element } => {
                            match element {
                                ResistanceElement::Physical => scalars[23] = 1.0,
                                ResistanceElement::Fire => scalars[24] = 1.0,
                                ResistanceElement::Ice => scalars[25] = 1.0,
                            }
                        }
                        KnowYourPreyApplyOption::ConvertElement { to, .. } => {
                            set_element_one_hot(scalars, 23, *to);
                        }
                    }
                }
            // --- Group 4: Re-route CardEffect from metadata ---
            } else if let ChoiceResolution::CallToArmsAbilitySelect { ability_entries } = resolution {
                if let Some((_, ref card_effect)) = ability_entries.get(choice_index) {
                    let h = extract_headline_values(card_effect);
                    apply_headline_scalars(scalars, &h);
                }
            } else if let ChoiceResolution::PeacefulMomentConversion { option_map, .. } = resolution {
                if let Some(opt) = option_map.get(choice_index) {
                    match opt {
                        PeacefulMomentOption::Done => scalars[11] = 1.0,
                        PeacefulMomentOption::HealWound => scalars[0] = scale(1.0, 10.0),
                        PeacefulMomentOption::RefreshUnit => scalars[9] = 1.0,
                        PeacefulMomentOption::HealUnit { .. } => { scalars[9] = 1.0; scalars[0] = scale(1.0, 10.0); }
                    }
                }
            } else if matches!(
                resolution,
                ChoiceResolution::ReadyUnitTarget { .. }
                | ChoiceResolution::HealUnitTarget { .. }
                | ChoiceResolution::EnergyFlowTarget { .. }
                | ChoiceResolution::SelectUnitModifier { .. }
                | ChoiceResolution::ReadyUnitsBudgetSelect { .. }
                | ChoiceResolution::CallToArmsUnitSelect { .. }
                | ChoiceResolution::FreeRecruitTarget { .. }
            ) {
                scalars[9] = 1.0; // has_unit
            } else if matches!(
                resolution,
                ChoiceResolution::DuelingTarget { .. }
                | ChoiceResolution::CurseTarget { .. }
                | ChoiceResolution::KnowYourPreyTarget { .. }
                | ChoiceResolution::NaturesVengeanceTarget { .. }
                | ChoiceResolution::PossessEnemyTarget { .. }
                | ChoiceResolution::ForkedLightningTarget { .. }
                | ChoiceResolution::WingsOfNightTarget { .. }
            ) {
                scalars[7] = 1.0; // has_enemy_target
            } else if matches!(
                resolution,
                ChoiceResolution::ShapeshiftCardSelect { .. }
                | ChoiceResolution::DiscardForCrystalSelect { .. }
                | ChoiceResolution::BloodBasicAaSelect { .. }
                | ChoiceResolution::BloodPoweredAaSelect
                | ChoiceResolution::MagicTalentSpellSelect { .. }
                | ChoiceResolution::MagicTalentGainSelect { .. }
                | ChoiceResolution::InvocationDiscard { .. }
            ) {
                scalars[8] = 1.0; // has_card
                // Bonus: mana color for variants that carry it
                if let ChoiceResolution::MagicTalentSpellSelect { spell_entries } = resolution {
                    if let Some((_, _, color)) = spell_entries.get(choice_index) {
                        set_mana_color_one_hot(scalars, 12, ManaColor::from(*color));
                    }
                } else if let ChoiceResolution::MagicTalentGainSelect { gain_entries } = resolution {
                    if let Some((_, _, color)) = gain_entries.get(choice_index) {
                        set_mana_color_one_hot(scalars, 12, ManaColor::from(*color));
                    }
                } else if let ChoiceResolution::InvocationDiscard { options } = resolution {
                    if let Some(opt) = options.get(choice_index) {
                        set_mana_color_one_hot(scalars, 12, opt.mana_color);
                    }
                }
            }
        }
        _ => {}
    }

    // Set has_card flag for card-targeting resolutions with real effects (not Noop)
    if matches!(
        resolution,
        ChoiceResolution::BoostTarget { .. }
        | ChoiceResolution::DiscardThenContinue { .. }
    ) {
        scalars[8] = 1.0; // has_card
    }

    // Mana color enrichment for mana-targeting resolutions with real effects
    if let ChoiceResolution::PureMagicConsume { token_colors } = resolution {
        if let Some(&color) = token_colors.get(choice_index) {
            set_mana_color_one_hot(scalars, 12, color);
        }
    }
    if let ChoiceResolution::ManaBoltTokenSelect { token_options } = resolution {
        if let Some((color, ..)) = token_options.get(choice_index) {
            set_mana_color_one_hot(scalars, 12, *color);
        }
    }
    if let ChoiceResolution::SacrificePairSelect { pair_options } = resolution {
        if let Some((color_a, ..)) = pair_options.get(choice_index) {
            set_mana_color_one_hot(scalars, 12, ManaColor::from(*color_a));
        }
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

    // =========================================================================
    // Headline value encoding tests
    // =========================================================================

    use mk_types::enums::BasicManaColor;
    use mk_types::ids::CardId;

    /// Helper: extract scalars for a single action without needing game state.
    fn scalars_for(action: &LegalAction) -> Vec<f32> {
        let state = {
            let mut s = mk_engine::setup::create_solo_game(1, Hero::Arythea);
            mk_engine::setup::place_initial_tiles(&mut s);
            s
        };
        extract_action_scalars(action, &state, 0)
    }

    #[test]
    fn march_basic_encodes_move_2() {
        let action = LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("march"),
        };
        let s = scalars_for(&action);
        assert_eq!(s[2], 1.0, "is_basic flag");
        assert_eq!(s[18], scale(2.0, 10.0), "move_value");
        assert_eq!(s[0], scale(2.0, 10.0), "headline amount");
        // No attack
        assert_eq!(s[28], 0.0, "attack_value should be 0");
    }

    #[test]
    fn march_powered_encodes_move_4() {
        let action = LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from("march"),
            mana_color: Some(BasicManaColor::Green),
        };
        let s = scalars_for(&action);
        assert_eq!(s[1], 1.0, "is_powered flag");
        assert_eq!(s[18], scale(4.0, 10.0), "move_value");
        assert_eq!(s[0], scale(4.0, 10.0), "headline amount");
    }

    #[test]
    fn march_sideways_move_encodes_move_1() {
        let action = LegalAction::PlayCardSideways {
            hand_index: 0,
            card_id: CardId::from("march"),
            sideways_as: SidewaysAs::Move,
        };
        let s = scalars_for(&action);
        assert_eq!(s[3], 1.0, "is_sideways flag");
        assert_eq!(s[18], scale(1.0, 10.0), "move_value");
        assert_eq!(s[0], scale(1.0, 10.0), "headline amount");
    }

    #[test]
    fn rage_basic_encodes_choice_max() {
        // Rage basic = Choice { Attack 2 Melee Physical, Block 2 Physical }
        // Max attack=2, max block=2 → headline=2
        let action = LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("rage"),
        };
        let s = scalars_for(&action);
        assert_eq!(s[0], scale(2.0, 10.0), "headline amount (max of attack/block)");
        assert_eq!(s[28], scale(2.0, 10.0), "attack_value from choice max");
        // Combat type melee from attack option
        assert_eq!(s[20], 1.0, "combat_type melee");
        // Element physical
        assert_eq!(s[23], 1.0, "element physical");
    }

    #[test]
    fn rage_powered_encodes_attack_4() {
        let action = LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from("rage"),
            mana_color: Some(BasicManaColor::Red),
        };
        let s = scalars_for(&action);
        assert_eq!(s[28], scale(4.0, 10.0), "attack_value");
        assert_eq!(s[0], scale(4.0, 10.0), "headline amount");
        assert_eq!(s[20], 1.0, "combat_type melee");
    }

    #[test]
    fn swiftness_powered_encodes_ranged_attack_3() {
        let action = LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from("swiftness"),
            mana_color: Some(BasicManaColor::White),
        };
        let s = scalars_for(&action);
        assert_eq!(s[28], scale(3.0, 10.0), "attack_value");
        assert_eq!(s[0], scale(3.0, 10.0), "headline amount");
        assert_eq!(s[21], 1.0, "combat_type ranged");
        assert_eq!(s[23], 1.0, "element physical");
    }

    #[test]
    fn threaten_powered_encodes_compound_influence() {
        // Threaten powered = Compound { Influence 5, RepChange -1 }
        let action = LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from("threaten"),
            mana_color: Some(BasicManaColor::Red),
        };
        let s = scalars_for(&action);
        assert_eq!(s[0], scale(5.0, 10.0), "headline amount = influence 5");
        // No move or attack
        assert_eq!(s[18], 0.0, "no move");
        assert_eq!(s[28], 0.0, "no attack");
    }

    #[test]
    fn sideways_attack_encodes_attack_channel() {
        let action = LegalAction::PlayCardSideways {
            hand_index: 0,
            card_id: CardId::from("march"),
            sideways_as: SidewaysAs::Attack,
        };
        let s = scalars_for(&action);
        assert_eq!(s[28], scale(1.0, 10.0), "attack_value for sideways attack");
        assert_eq!(s[0], scale(1.0, 10.0), "headline amount");
        assert_eq!(s[18], 0.0, "no move for sideways attack");
    }

    #[test]
    fn headline_dimension_unchanged() {
        assert_eq!(ACTION_SCALAR_DIM, 34);
    }

    #[test]
    fn extract_headline_simple_move() {
        let effect = CardEffect::GainMove { amount: 3 };
        let h = extract_headline_values(&effect);
        assert_eq!(h.move_val, 3);
        assert_eq!(h.attack_val, 0);
        assert!(h.combat_type.is_none());
    }

    #[test]
    fn extract_headline_compound_sums() {
        let effect = CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainInfluence { amount: 4 },
            ],
        };
        let h = extract_headline_values(&effect);
        assert_eq!(h.move_val, 2);
        assert_eq!(h.influence_val, 4);
    }

    #[test]
    fn extract_headline_choice_takes_max() {
        let effect = CardEffect::Choice {
            options: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
            ],
        };
        let h = extract_headline_values(&effect);
        assert_eq!(h.move_val, 2);
        assert_eq!(h.attack_val, 3);
    }
}
