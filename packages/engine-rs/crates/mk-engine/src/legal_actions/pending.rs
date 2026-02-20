use mk_types::legal_action::LegalAction;
use mk_types::pending::ActivePending;

use crate::undo::UndoStack;

pub(super) fn enumerate_pending(
    active: &ActivePending,
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
    }
}
