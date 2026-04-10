use rl_core::{SignalArray, StepSignals};

/// Per-step signals emitted by Mage Knight for reward computation.
///
/// All field names match the exact dict keys that Python's
/// `collect_vecenv_rollout()` reads from `step_batch()` results.
pub struct MkStepSignals {
    pub fame_delta: i32,
    pub fame: i32,
    pub panicked: bool,
    pub scenario_end_triggered: bool,
    pub new_hex: i32,
    pub wound_delta: i32,
    pub non_wound_hand_size: i32,
    pub new_tile: i32,
    pub wasted_move_points: i32,
    pub backtrack_move: i32,
    pub wound_count: i32,
    pub total_card_count: i32,
    pub in_combat: bool,
    pub rested_turn: i32,
    pub achievement_delta: i32,
    pub game_score: i32,
    pub achievement_categories: [i32; 6],
}

impl StepSignals for MkStepSignals {
    fn to_signal_map(&self) -> Vec<(&'static str, SignalArray)> {
        vec![
            ("fame_deltas", SignalArray::I32(vec![self.fame_delta])),
            ("fames", SignalArray::I32(vec![self.fame])),
            ("panicked", SignalArray::Bool(vec![self.panicked])),
            ("scenario_end_triggered", SignalArray::Bool(vec![self.scenario_end_triggered])),
            ("new_hexes", SignalArray::I32(vec![self.new_hex])),
            ("wound_deltas", SignalArray::I32(vec![self.wound_delta])),
            ("non_wound_hand_sizes", SignalArray::I32(vec![self.non_wound_hand_size])),
            ("new_tiles", SignalArray::I32(vec![self.new_tile])),
            ("wasted_move_points", SignalArray::I32(vec![self.wasted_move_points])),
            ("backtrack_moves", SignalArray::I32(vec![self.backtrack_move])),
            ("wound_counts", SignalArray::I32(vec![self.wound_count])),
            ("total_card_counts", SignalArray::I32(vec![self.total_card_count])),
            ("in_combat", SignalArray::Bool(vec![self.in_combat])),
            ("rested_turns", SignalArray::I32(vec![self.rested_turn])),
            ("achievement_deltas", SignalArray::I32(vec![self.achievement_delta])),
            ("game_scores", SignalArray::I32(vec![self.game_score])),
            ("achievement_categories", SignalArray::I32Fixed {
                data: self.achievement_categories.to_vec(),
                width: 6,
            }),
        ]
    }
}
