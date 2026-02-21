use mk_types::enums::{DeedCardType, DiscardForBonusFilter, GladeWoundChoice};
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{ActivePending, PendingLevelUpReward, PendingTacticDecision};

use crate::effect_queue::{is_resolvable, WOUND_CARD_ID};
use crate::undo::UndoStack;

pub(super) fn enumerate_pending(
    active: &ActivePending,
    state: &mk_types::state::GameState,
    player_idx: usize,
    undo: &UndoStack,
    actions: &mut Vec<LegalAction>,
) {
    match active {
        ActivePending::Choice(choice) => {
            // Category 7: ResolveChoice by index.
            for i in 0..choice.options.len() {
                actions.push(LegalAction::ResolveChoice { choice_index: i });
            }
        }
        ActivePending::DiscardForBonus(dfb) => {
            // Count eligible cards for discard
            let player = &state.players[player_idx];
            let eligible_count = count_eligible_for_discard(
                &player.hand,
                dfb.discard_filter,
            );
            let actual_max = (dfb.max_discards as usize).min(eligible_count);

            // Enumerate: for each resolvable choice option × each discard count (0..=actual_max)
            for (ci, opt) in dfb.choice_options.iter().enumerate() {
                if !is_resolvable(state, player_idx, opt) {
                    continue;
                }
                for dc in 0..=actual_max {
                    actions.push(LegalAction::ResolveDiscardForBonus {
                        choice_index: ci,
                        discard_count: dc,
                    });
                }
            }
        }
        ActivePending::Decompose(_decompose) => {
            // Enumerate eligible hand cards (BasicAction or AdvancedAction)
            let player = &state.players[player_idx];
            for (idx, card_id) in player.hand.iter().enumerate() {
                if let Some(def) = mk_data::cards::get_card(card_id.as_str()) {
                    if matches!(
                        def.card_type,
                        DeedCardType::BasicAction | DeedCardType::AdvancedAction
                    ) {
                        actions.push(LegalAction::ResolveDecompose { hand_index: idx });
                    }
                }
            }
        }
        ActivePending::TacticDecision(td) => {
            enumerate_tactic_decision(td, state, player_idx, actions);
        }
        ActivePending::SubsetSelection(ss) => {
            // Auto-regressive subset selection: pick one item or confirm.
            if ss.selected.len() < ss.max_selections {
                for i in 0..ss.pool_size {
                    if !ss.selected.contains(&i) {
                        actions.push(LegalAction::SubsetSelect { index: i });
                    }
                }
            }
            // Kind-specific confirm gating
            let can_confirm = match &ss.kind {
                mk_types::pending::SubsetSelectionKind::AttackTargets {
                    eligible_instance_ids,
                    attack_type,
                } => {
                    !ss.selected.is_empty()
                        && crate::legal_actions::combat::is_attack_subset_sufficient(
                            state,
                            player_idx,
                            ss,
                            eligible_instance_ids,
                            *attack_type,
                        )
                }
                _ => ss.selected.len() >= ss.min_selections,
            };
            if can_confirm {
                actions.push(LegalAction::SubsetConfirm);
            }
        }
        ActivePending::DeepMineChoice { colors } => {
            for i in 0..colors.len() {
                actions.push(LegalAction::ResolveChoice { choice_index: i });
            }
        }
        ActivePending::PlunderDecision => {
            actions.push(LegalAction::PlunderSite);
            actions.push(LegalAction::DeclinePlunder);
        }
        ActivePending::GladeWoundChoice => {
            let player = &state.players[player_idx];
            let has_hand_wound = player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID);
            let has_discard_wound = player.discard.iter().any(|c| c.as_str() == WOUND_CARD_ID);
            if has_hand_wound {
                actions.push(LegalAction::ResolveGladeWound {
                    choice: GladeWoundChoice::Hand,
                });
            }
            if has_discard_wound {
                actions.push(LegalAction::ResolveGladeWound {
                    choice: GladeWoundChoice::Discard,
                });
            }
        }
        ActivePending::UnitAbilityChoice { options, .. } => {
            // One ResolveChoice per option (move/influence or attack/block).
            for i in 0..options.len() {
                actions.push(LegalAction::ResolveChoice { choice_index: i });
            }
        }
        ActivePending::SelectCombatEnemy { eligible_enemy_ids, .. } => {
            // One ResolveChoice per eligible enemy.
            for i in 0..eligible_enemy_ids.len() {
                actions.push(LegalAction::ResolveChoice { choice_index: i });
            }
        }
        ActivePending::LevelUpReward(reward) => {
            enumerate_level_up_reward(reward, state, actions);
        }
        ActivePending::CrystalJoyReclaim(ref pending) => {
            let player = &state.players[player_idx];
            for (i, card) in player.discard.iter().enumerate() {
                let eligible = match pending.version {
                    mk_types::pending::EffectMode::Basic => card.as_str() != WOUND_CARD_ID,
                    mk_types::pending::EffectMode::Powered => true,
                };
                if eligible {
                    actions.push(LegalAction::ResolveCrystalJoyReclaim {
                        discard_index: Some(i),
                    });
                }
            }
            // Always allow skipping
            actions.push(LegalAction::ResolveCrystalJoyReclaim {
                discard_index: None,
            });
        }
        ActivePending::SteadyTempoDeckPlacement(ref pending) => {
            let can_place = match pending.version {
                mk_types::pending::EffectMode::Basic => {
                    !state.players[player_idx].deck.is_empty()
                }
                mk_types::pending::EffectMode::Powered => true,
            };
            if can_place {
                actions.push(LegalAction::ResolveSteadyTempoDeckPlacement { place: true });
            }
            // Always allow skipping
            actions.push(LegalAction::ResolveSteadyTempoDeckPlacement { place: false });
        }
        ActivePending::BannerProtectionChoice => {
            actions.push(LegalAction::ResolveBannerProtection { remove_all: true });
            actions.push(LegalAction::ResolveBannerProtection { remove_all: false });
        }
        // Non-choice pending states are not wired into LegalAction yet.
        // Panic instead of silently returning no actions to avoid deadlocked turns.
        other => panic!(
            "Unsupported active pending in legal action pipeline: {}",
            active_pending_kind(other)
        ),
    }

    // Category 12: Undo.
    if undo.can_undo() {
        actions.push(LegalAction::Undo);
    }
}

fn enumerate_tactic_decision(
    td: &PendingTacticDecision,
    state: &mk_types::state::GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    match td {
        PendingTacticDecision::ManaSteal => {
            for (idx, die) in state.source.dice.iter().enumerate() {
                if !die.is_depleted && die.taken_by_player_id.is_none() && die.color.is_basic() {
                    actions.push(LegalAction::ResolveTacticDecision {
                        data: TacticDecisionData::ManaSteal { die_index: idx },
                    });
                }
            }
        }
        PendingTacticDecision::Preparation { deck_snapshot } => {
            for idx in 0..deck_snapshot.len() {
                actions.push(LegalAction::ResolveTacticDecision {
                    data: TacticDecisionData::Preparation { deck_card_index: idx },
                });
            }
        }
        PendingTacticDecision::SparingPower => {
            // Stash: only if deck not empty
            if !state.players[player_idx].deck.is_empty() {
                actions.push(LegalAction::ResolveTacticDecision {
                    data: TacticDecisionData::SparingPowerStash,
                });
            }
            // Take: always available
            actions.push(LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::SparingPowerTake,
            });
        }
    }
}

fn enumerate_level_up_reward(
    reward: &PendingLevelUpReward,
    state: &mk_types::state::GameState,
    actions: &mut Vec<LegalAction>,
) {
    // Option A: Choose from drawn hero skills — free AA choice.
    for (i, _skill) in reward.drawn_skills.iter().enumerate() {
        for aa in &state.offers.advanced_actions {
            actions.push(LegalAction::ChooseLevelUpReward {
                skill_index: i,
                from_common_pool: false,
                advanced_action_id: aa.clone(),
            });
        }
    }
    // Option B: Choose from common skill pool — forced to take lowest-position AA.
    // Per rules: "take the Advanced Action card from the lowest position on the offer."
    if let Some(lowest_aa) = state.offers.advanced_actions.last() {
        for (i, _skill) in state.offers.common_skills.iter().enumerate() {
            actions.push(LegalAction::ChooseLevelUpReward {
                skill_index: i,
                from_common_pool: true,
                advanced_action_id: lowest_aa.clone(),
            });
        }
    }
}

fn count_eligible_for_discard(
    hand: &[mk_types::ids::CardId],
    filter: DiscardForBonusFilter,
) -> usize {
    match filter {
        DiscardForBonusFilter::WoundOnly => {
            hand.iter().filter(|c| c.as_str() == WOUND_CARD_ID).count()
        }
        DiscardForBonusFilter::AnyMaxOneWound => hand.len(),
    }
}

fn active_pending_kind(pending: &ActivePending) -> &'static str {
    match pending {
        ActivePending::Choice(_) => "choice",
        ActivePending::Discard(_) => "discard",
        ActivePending::DiscardForAttack(_) => "discard_for_attack",
        ActivePending::DiscardForBonus(_) => "discard_for_bonus",
        ActivePending::DiscardForCrystal(_) => "discard_for_crystal",
        ActivePending::Decompose(_) => "decompose",
        ActivePending::MaximalEffect(_) => "maximal_effect",
        ActivePending::BookOfWisdom(_) => "book_of_wisdom",
        ActivePending::Training(_) => "training",
        ActivePending::TacticDecision(_) => "tactic_decision",
        ActivePending::LevelUpReward(_) => "level_up_reward",
        ActivePending::DeepMineChoice { .. } => "deep_mine_choice",
        ActivePending::GladeWoundChoice => "glade_wound_choice",
        ActivePending::BannerProtectionChoice => "banner_protection_choice",
        ActivePending::SourceOpeningReroll { .. } => "source_opening_reroll",
        ActivePending::Meditation(_) => "meditation",
        ActivePending::PlunderDecision => "plunder_decision",
        ActivePending::UnitMaintenance(_) => "unit_maintenance",
        ActivePending::TerrainCostReduction(_) => "terrain_cost_reduction",
        ActivePending::CrystalJoyReclaim(_) => "crystal_joy_reclaim",
        ActivePending::SteadyTempoDeckPlacement(_) => "steady_tempo_deck_placement",
        ActivePending::UnitAbilityChoice { .. } => "unit_ability_choice",
        ActivePending::SubsetSelection(_) => "subset_selection",
        ActivePending::SelectCombatEnemy { .. } => "select_combat_enemy",
    }
}
