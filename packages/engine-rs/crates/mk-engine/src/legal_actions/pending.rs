use mk_types::enums::{CombatPhase, DeedCardType, DiscardForBonusFilter, GladeWoundChoice};
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{ActivePending, PendingLevelUpReward, PendingTacticDecision, SiteReward};
use mk_types::state::PlayerFlags;

use crate::effect_queue::{is_resolvable, WOUND_CARD_ID};
use crate::undo::UndoStack;

use super::cards::{is_dominated_in_attack, is_dominated_in_block, is_dominated_in_ranged_siege, is_influence_only, is_move_only};

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
            let player = &state.players[player_idx];
            let is_interacting = player.flags.contains(PlayerFlags::IS_INTERACTING);
            let in_combat = state.combat.is_some();
            let combat_phase = state.combat.as_ref().map(|c| c.phase);
            let pre_filter_len = actions.len();

            for (i, option) in choice.options.iter().enumerate() {
                // Skip influence-only options when not interacting (and not in combat).
                if !in_combat && !is_interacting && is_influence_only(option) {
                    continue;
                }
                // Skip move-only options when interacting (and not in combat).
                if !in_combat && is_interacting && is_move_only(option) {
                    continue;
                }
                // Prune options dominated in the current combat phase.
                if let Some(phase) = combat_phase {
                    let dominated = match phase {
                        CombatPhase::RangedSiege => {
                            is_dominated_in_ranged_siege(state, player_idx, option)
                        }
                        CombatPhase::Block => {
                            is_dominated_in_block(state, player_idx, option)
                        }
                        CombatPhase::Attack => {
                            is_dominated_in_attack(state, player_idx, option)
                        }
                        _ => false,
                    };
                    if dominated {
                        continue;
                    }
                }
                actions.push(LegalAction::ResolveChoice { choice_index: i });
            }

            // Safety: if ALL options were filtered, emit them all (don't deadlock).
            if !actions[pre_filter_len..]
                .iter()
                .any(|a| matches!(a, LegalAction::ResolveChoice { .. }))
            {
                for i in 0..choice.options.len() {
                    actions.push(LegalAction::ResolveChoice { choice_index: i });
                }
            }
        }
        ActivePending::DiscardForBonus(dfb) => {
            // Count eligible cards for discard
            let player = &state.players[player_idx];
            let is_interacting = player.flags.contains(PlayerFlags::IS_INTERACTING);
            let in_combat = state.combat.is_some();
            let combat_phase = state.combat.as_ref().map(|c| c.phase);
            let eligible_count = count_eligible_for_discard(
                &player.hand,
                dfb.discard_filter,
            );
            let actual_max = (dfb.max_discards as usize).min(eligible_count);
            let pre_filter_len = actions.len();

            // Enumerate: for each resolvable choice option × each discard count (0..=actual_max)
            for (ci, opt) in dfb.choice_options.iter().enumerate() {
                if !is_resolvable(state, player_idx, opt) {
                    continue;
                }
                // Mode gating
                if !in_combat && !is_interacting && is_influence_only(opt) {
                    continue;
                }
                if !in_combat && is_interacting && is_move_only(opt) {
                    continue;
                }
                // Prune options dominated in the current combat phase.
                if let Some(phase) = combat_phase {
                    let dominated = match phase {
                        CombatPhase::RangedSiege => {
                            is_dominated_in_ranged_siege(state, player_idx, opt)
                        }
                        CombatPhase::Block => {
                            is_dominated_in_block(state, player_idx, opt)
                        }
                        CombatPhase::Attack => {
                            is_dominated_in_attack(state, player_idx, opt)
                        }
                        _ => false,
                    };
                    if dominated {
                        continue;
                    }
                }
                for dc in 0..=actual_max {
                    actions.push(LegalAction::ResolveDiscardForBonus {
                        choice_index: ci,
                        discard_count: dc,
                    });
                }
            }

            // Safety: if ALL options were filtered, emit them all (don't deadlock).
            if !actions[pre_filter_len..].iter().any(|a| {
                matches!(a, LegalAction::ResolveDiscardForBonus { .. })
            }) {
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
                mk_types::pending::SubsetSelectionKind::AttackTargets { .. } => {
                    // Just require at least one target selected.
                    // Sufficiency is checked when ResolveAttack is enumerated.
                    !ss.selected.is_empty()
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
            // If no wounds found (removed by later end-turn steps), offer Skip
            // to clear the pending without deadlocking.
            if !has_hand_wound && !has_discard_wound {
                actions.push(LegalAction::ResolveGladeWound {
                    choice: GladeWoundChoice::Skip,
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
        ActivePending::SourceOpeningReroll { .. } => {
            actions.push(LegalAction::ResolveSourceOpeningReroll { reroll: true });
            actions.push(LegalAction::ResolveSourceOpeningReroll { reroll: false });
        }
        ActivePending::BookOfWisdom(ref bow) => {
            use mk_types::pending::BookOfWisdomPhase;
            let player = &state.players[player_idx];
            match bow.phase {
                BookOfWisdomPhase::SelectCard => {
                    // Enumerate eligible hand cards: non-wound, non-self, with color
                    for (idx, card_id) in player.hand.iter().enumerate() {
                        if card_id.as_str() == WOUND_CARD_ID || card_id.as_str() == "book_of_wisdom" {
                            continue;
                        }
                        if mk_data::cards::get_card_color(card_id.as_str()).is_none() {
                            continue;
                        }
                        // Basic mode: accept BasicAction/AdvancedAction cards
                        // Powered mode: accept spells too (any colored card)
                        let is_action = mk_data::cards::get_card(card_id.as_str())
                            .map(|d| matches!(d.card_type, DeedCardType::BasicAction | DeedCardType::AdvancedAction))
                            .unwrap_or(false);
                        let is_spell = mk_data::cards::get_spell_card(card_id.as_str()).is_some();
                        if is_action || is_spell {
                            actions.push(LegalAction::ResolveBookOfWisdom {
                                selection_index: idx,
                            });
                        }
                    }
                }
                BookOfWisdomPhase::SelectFromOffer => {
                    for i in 0..bow.available_offer_cards.len() {
                        actions.push(LegalAction::ResolveBookOfWisdom {
                            selection_index: i,
                        });
                    }
                }
            }
        }
        ActivePending::Training(ref t) => {
            use mk_types::pending::BookOfWisdomPhase;
            let player = &state.players[player_idx];
            match t.phase {
                BookOfWisdomPhase::SelectCard => {
                    // Enumerate eligible hand cards to throw away (BasicAction or AdvancedAction)
                    for (idx, card_id) in player.hand.iter().enumerate() {
                        if let Some(def) = mk_data::cards::get_card(card_id.as_str()) {
                            if matches!(
                                def.card_type,
                                DeedCardType::BasicAction | DeedCardType::AdvancedAction
                            ) {
                                actions.push(LegalAction::ResolveTraining {
                                    selection_index: idx,
                                });
                            }
                        }
                    }
                }
                BookOfWisdomPhase::SelectFromOffer => {
                    // Enumerate available offer cards
                    for i in 0..t.available_offer_cards.len() {
                        actions.push(LegalAction::ResolveTraining {
                            selection_index: i,
                        });
                    }
                }
            }
        }
        ActivePending::MaximalEffect(_) => {
            // Enumerate eligible hand cards (BasicAction or AdvancedAction)
            let player = &state.players[player_idx];
            for (idx, card_id) in player.hand.iter().enumerate() {
                if let Some(def) = mk_data::cards::get_card(card_id.as_str()) {
                    if matches!(
                        def.card_type,
                        DeedCardType::BasicAction | DeedCardType::AdvancedAction
                    ) {
                        actions.push(LegalAction::ResolveMaximalEffect {
                            hand_index: idx,
                        });
                    }
                }
            }
        }
        ActivePending::Meditation(ref med) => {
            use mk_types::pending::MeditationPhase;
            let player = &state.players[player_idx];
            match med.phase {
                MeditationPhase::SelectCards => {
                    // Powered: choose cards from discard (up to 3)
                    let max_selections = 3;
                    let current_count = med.selected_card_ids.len();
                    if current_count < max_selections {
                        for (i, card_id) in player.discard.iter().enumerate() {
                            if card_id.as_str() != WOUND_CARD_ID
                                && !med.selected_card_ids.contains(card_id)
                            {
                                actions.push(LegalAction::ResolveMeditation {
                                    selection_index: i,
                                    place_on_top: None,
                                });
                            }
                        }
                    }
                    // Allow finishing selection (if at least 1 selected)
                    if current_count > 0 {
                        actions.push(LegalAction::MeditationDoneSelecting);
                    }
                }
                MeditationPhase::PlaceCards => {
                    // Place each selected card on top or bottom of deck
                    // Present choices for the first remaining card
                    if !med.selected_card_ids.is_empty() {
                        actions.push(LegalAction::ResolveMeditation {
                            selection_index: 0,
                            place_on_top: Some(true),
                        });
                        actions.push(LegalAction::ResolveMeditation {
                            selection_index: 0,
                            place_on_top: Some(false),
                        });
                    }
                }
            }
        }
        ActivePending::SiteRewardChoice { ref reward, reward_index } => {
            enumerate_site_reward_choice(reward, *reward_index, state, player_idx, actions);
        }
        ActivePending::TomeOfAllSpells(ref tome) => {
            use mk_types::pending::TomeOfAllSpellsPhase;
            let player = &state.players[player_idx];
            match tome.phase {
                TomeOfAllSpellsPhase::SelectCard => {
                    // Eligible: colored non-wound, non-self cards (actions + spells)
                    for (idx, card_id) in player.hand.iter().enumerate() {
                        if card_id.as_str() == WOUND_CARD_ID || card_id.as_str() == "tome_of_all_spells" {
                            continue;
                        }
                        if mk_data::cards::get_card_color(card_id.as_str()).is_none() {
                            continue;
                        }
                        actions.push(LegalAction::ResolveTomeOfAllSpells {
                            selection_index: idx,
                        });
                    }
                }
                TomeOfAllSpellsPhase::SelectSpell => {
                    for i in 0..tome.available_spells.len() {
                        actions.push(LegalAction::ResolveTomeOfAllSpells {
                            selection_index: i,
                        });
                    }
                }
            }
        }
        ActivePending::CircletOfProficiency(ref circlet) => {
            for i in 0..circlet.available_skills.len() {
                actions.push(LegalAction::ResolveCircletOfProficiency {
                    selection_index: i,
                });
            }
        }
        ActivePending::UnitMaintenance(ref entries) => {
            let player = &state.players[player_idx];
            for entry in entries.iter() {
                // Disband option: always available
                actions.push(LegalAction::ResolveUnitMaintenance {
                    unit_instance_id: entry.unit_instance_id.clone(),
                    keep_unit: false,
                    crystal_color: None,
                    new_mana_token_color: None,
                });

                // Keep options: one per affordable crystal color × 4 mana token colors
                let crystal_colors = [
                    (mk_types::enums::BasicManaColor::Red, player.crystals.red),
                    (mk_types::enums::BasicManaColor::Blue, player.crystals.blue),
                    (mk_types::enums::BasicManaColor::Green, player.crystals.green),
                    (mk_types::enums::BasicManaColor::White, player.crystals.white),
                ];
                let all_basic = [
                    mk_types::enums::BasicManaColor::Red,
                    mk_types::enums::BasicManaColor::Blue,
                    mk_types::enums::BasicManaColor::Green,
                    mk_types::enums::BasicManaColor::White,
                ];
                for &(color, count) in &crystal_colors {
                    if count == 0 {
                        continue;
                    }
                    for &token_color in &all_basic {
                        actions.push(LegalAction::ResolveUnitMaintenance {
                            unit_instance_id: entry.unit_instance_id.clone(),
                            keep_unit: true,
                            crystal_color: Some(color),
                            new_mana_token_color: Some(token_color),
                        });
                    }
                }
            }
        }
        ActivePending::TerrainCostReduction(ref tcr) => {
            use mk_types::pending::TerrainCostReductionMode;
            match tcr.mode {
                TerrainCostReductionMode::Hex => {
                    for coord in &tcr.available_coordinates {
                        actions.push(LegalAction::ResolveHexCostReduction {
                            coordinate: *coord,
                        });
                    }
                }
                TerrainCostReductionMode::Terrain => {
                    for terrain in &tcr.available_terrains {
                        actions.push(LegalAction::ResolveTerrainCostReduction {
                            terrain: *terrain,
                        });
                    }
                }
            }
        }
        ActivePending::ArtifactSelection(ref selection) => {
            // One SelectArtifact per choice card
            for card_id in &selection.choices {
                actions.push(LegalAction::SelectArtifact {
                    card_id: card_id.clone(),
                });
            }
        }
        ActivePending::CrystalRollColorChoice { .. } => {
            // Player picks a crystal color (filtered by cap)
            let player = &state.players[player_idx];
            let max = crate::mana::MAX_CRYSTALS_PER_COLOR;
            if player.crystals.red < max {
                actions.push(LegalAction::ResolveCrystalRollColor {
                    color: mk_types::enums::BasicManaColor::Red,
                });
            }
            if player.crystals.blue < max {
                actions.push(LegalAction::ResolveCrystalRollColor {
                    color: mk_types::enums::BasicManaColor::Blue,
                });
            }
            if player.crystals.green < max {
                actions.push(LegalAction::ResolveCrystalRollColor {
                    color: mk_types::enums::BasicManaColor::Green,
                });
            }
            if player.crystals.white < max {
                actions.push(LegalAction::ResolveCrystalRollColor {
                    color: mk_types::enums::BasicManaColor::White,
                });
            }
        }
        ActivePending::Discard(_) | ActivePending::DiscardForCrystal(_) => {
            // These pending states have dedicated handling through
            // ResolveChoice/ResolveDiscardForCrystal actions, not via this function.
        }
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
            let current_player_id = &state.players[player_idx].id;
            for (idx, die) in state.source.dice.iter().enumerate() {
                if die.is_depleted || !die.color.is_basic() {
                    continue;
                }
                // Include unclaimed dice AND dice claimed by other players (steal)
                let is_available = die.taken_by_player_id.is_none();
                let is_stealable = die
                    .taken_by_player_id
                    .as_ref()
                    .is_some_and(|owner| owner != current_player_id);
                if is_available || is_stealable {
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

fn enumerate_site_reward_choice(
    reward: &SiteReward,
    reward_index: usize,
    state: &mk_types::state::GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    match reward {
        SiteReward::Spell { .. } => {
            for (idx, card_id) in state.offers.spells.iter().enumerate() {
                actions.push(LegalAction::SelectReward {
                    card_id: card_id.clone(),
                    reward_index: idx,
                    unit_id: None,
                });
            }
        }
        SiteReward::AdvancedAction { .. } => {
            for (idx, card_id) in state.offers.advanced_actions.iter().enumerate() {
                actions.push(LegalAction::SelectReward {
                    card_id: card_id.clone(),
                    reward_index: idx,
                    unit_id: None,
                });
            }
        }
        SiteReward::Unit => {
            let player = &state.players[player_idx];
            let available_slots = (player.command_tokens as usize).saturating_sub(player.units.len());

            if available_slots > 0 {
                // Has room: offer each unit from the offer
                for (idx, unit_id) in state.offers.units.iter().enumerate() {
                    actions.push(LegalAction::SelectReward {
                        card_id: mk_types::ids::CardId::from(unit_id.as_str()),
                        reward_index: idx,
                        unit_id: Some(unit_id.clone()),
                    });
                }
            } else {
                // No room: must disband an existing unit to take reward, or forfeit
                for existing_unit in &player.units {
                    for offer_unit_id in &state.offers.units {
                        actions.push(LegalAction::DisbandUnitForReward {
                            unit_instance_id: existing_unit.instance_id.clone(),
                            reward_unit_id: offer_unit_id.clone(),
                        });
                    }
                }
            }

            // Always can forfeit
            actions.push(LegalAction::ForfeitUnitReward);
        }
        _ => {
            // CrystalRoll, Artifact, Fame, DungeonRoll, Compound should be auto-resolved,
            // not presented as choices. This arm should never be reached.
            panic!(
                "enumerate_site_reward_choice: unexpected reward type at index {}: {:?}",
                reward_index, reward
            );
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

