//! Mode derivation — maps game state to one of ~28 mode strings.
//!
//! The mode tells the network what "phase" the game is in, which determines
//! what kinds of actions are available.

use mk_types::enums::RoundPhase;
use mk_types::pending::ActivePending;
use mk_types::state::GameState;

use crate::vocab::MODE_VOCAB;

/// Derive the mode string from game state and return its MODE_VOCAB index.
pub fn derive_mode(state: &GameState, player_idx: usize) -> u16 {
    let mode_str = derive_mode_str(state, player_idx);
    MODE_VOCAB.encode(mode_str)
}

/// Derive the mode string from game state.
pub fn derive_mode_str(state: &GameState, player_idx: usize) -> &'static str {
    // Tactics selection takes priority
    if state.round_phase == RoundPhase::TacticsSelection {
        return "tactics_selection";
    }

    let player = &state.players[player_idx];

    // Check for active pending state
    if let Some(ref pending) = player.pending.active {
        return match pending {
            ActivePending::Choice(_) => "pending_choice",
            ActivePending::Discard(_) => "pending_discard_cost",
            ActivePending::DiscardForAttack(_) => "pending_discard_for_attack",
            ActivePending::DiscardForBonus(_) => "pending_discard_for_bonus",
            ActivePending::DiscardForCrystal(_) => "pending_discard_for_crystal",
            ActivePending::Decompose(_) => "pending_decompose",
            ActivePending::MaximalEffect(_) => "pending_maximal_effect",
            ActivePending::BookOfWisdom(_) => "pending_book_of_wisdom",
            ActivePending::Training(_) => "pending_training",
            ActivePending::TacticDecision(_) => "pending_tactic_decision",
            ActivePending::LevelUpReward(_) => "pending_level_up",
            ActivePending::DeepMineChoice { .. } => "pending_deep_mine",
            ActivePending::GladeWoundChoice => "pending_glade_wound",
            ActivePending::BannerProtectionChoice => "pending_banner_protection",
            ActivePending::SourceOpeningReroll { .. } => "pending_source_opening_reroll",
            ActivePending::Meditation(_) => "pending_meditation",
            ActivePending::PlunderDecision => "pending_plunder_decision",
            ActivePending::UnitMaintenance(_) => "pending_unit_maintenance",
            ActivePending::TerrainCostReduction(ref tcr) => {
                match tcr.mode {
                    mk_types::pending::TerrainCostReductionMode::Hex => "pending_hex_cost_reduction",
                    mk_types::pending::TerrainCostReductionMode::Terrain => "pending_terrain_cost_reduction",
                }
            }
            ActivePending::CrystalJoyReclaim(_) => "pending_crystal_joy_reclaim",
            ActivePending::SteadyTempoDeckPlacement(_) => "pending_steady_tempo",
            ActivePending::UnitAbilityChoice { .. } => "pending_choice",
            ActivePending::SubsetSelection(_) => "pending_choice",
            ActivePending::SelectCombatEnemy { .. } => "pending_choice",
            ActivePending::SiteRewardChoice { .. } => "pending_reward",
            ActivePending::TomeOfAllSpells(_) => "pending_choice",
            ActivePending::CircletOfProficiency(_) => "pending_choice",
        };
    }

    // Check deferred pending for rewards/level-ups
    for deferred in &player.pending.deferred {
        match deferred {
            mk_types::pending::DeferredPending::Rewards(_) => return "pending_reward",
            mk_types::pending::DeferredPending::LevelUpRewards(_) => return "pending_level_up",
            _ => {}
        }
    }

    // Combat mode
    if state.combat.is_some() {
        return "combat";
    }

    "normal_turn"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_turn_mode() {
        let mode = MODE_VOCAB.encode("normal_turn");
        assert!(mode > 0);
    }

    #[test]
    fn combat_mode() {
        let mode = MODE_VOCAB.encode("combat");
        assert!(mode > 0);
    }

    #[test]
    fn all_mode_strings_in_vocab() {
        let modes = [
            "cannot_act", "combat", "normal_turn",
            "pending_choice", "pending_discard_cost", "pending_discard_for_attack",
            "pending_discard_for_bonus", "pending_discard_for_crystal",
            "pending_decompose", "pending_maximal_effect", "pending_book_of_wisdom",
            "pending_training", "pending_tactic_decision", "pending_level_up",
            "pending_deep_mine", "pending_glade_wound", "pending_banner_protection",
            "pending_source_opening_reroll", "pending_meditation",
            "pending_plunder_decision", "pending_unit_maintenance",
            "pending_terrain_cost_reduction", "pending_crystal_joy_reclaim",
            "pending_steady_tempo", "pending_reward", "tactics_selection",
        ];
        for mode in &modes {
            assert!(
                MODE_VOCAB.encode(mode) > 0,
                "Mode '{}' not found in MODE_VOCAB",
                mode
            );
        }
    }
}
