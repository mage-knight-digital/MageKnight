//! Snapshot-based undo — `state.clone()` before reversible actions.
//!
//! Replaces the TS closure-based undo mechanism with a simpler snapshot approach.
//! Before each reversible action, the full game state is cloned and pushed onto
//! a stack. Undo pops the stack and replaces the current state.
//!
//! Irreversible actions (tile reveal, RNG-consuming operations, combat entry)
//! set a checkpoint that clears the stack, preventing undo past that point.

use mk_types::state::GameState;

/// Snapshot-based undo stack.
#[derive(Debug, Clone)]
pub struct UndoStack {
    /// Stack of saved game states (most recent on top).
    snapshots: Vec<GameState>,
    /// Whether a checkpoint has been set (irreversible action occurred).
    checkpoint_active: bool,
}

impl UndoStack {
    /// Create an empty undo stack.
    pub fn new() -> Self {
        Self {
            snapshots: Vec::new(),
            checkpoint_active: false,
        }
    }

    /// Save a snapshot of the current state before a reversible action.
    pub fn save(&mut self, state: &GameState) {
        self.snapshots.push(state.clone());
    }

    /// Whether undo is available (at least one snapshot, no checkpoint blocking).
    pub fn can_undo(&self) -> bool {
        !self.snapshots.is_empty()
    }

    /// How many undo steps are available.
    pub fn depth(&self) -> usize {
        self.snapshots.len()
    }

    /// Pop the most recent snapshot. Returns `None` if stack is empty.
    pub fn undo(&mut self) -> Option<GameState> {
        self.snapshots.pop()
    }

    /// Set a checkpoint — clears the entire stack.
    /// Used after irreversible actions (tile reveal, combat entry, etc.).
    pub fn set_checkpoint(&mut self) {
        self.snapshots.clear();
        self.checkpoint_active = true;
    }

    /// Whether a checkpoint has been set since the last clear.
    pub fn is_checkpoint_active(&self) -> bool {
        self.checkpoint_active
    }

    /// Clear the stack and reset checkpoint flag (e.g., at start of new turn).
    pub fn clear(&mut self) {
        self.snapshots.clear();
        self.checkpoint_active = false;
    }
}

impl Default for UndoStack {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::enums::Hero;

    #[test]
    fn new_stack_is_empty() {
        let stack = UndoStack::new();
        assert!(!stack.can_undo());
        assert_eq!(stack.depth(), 0);
    }

    #[test]
    fn save_and_undo_restores_state() {
        let mut stack = UndoStack::new();
        let state = create_solo_game(42, Hero::Arythea);

        // Save state
        stack.save(&state);
        assert!(stack.can_undo());
        assert_eq!(stack.depth(), 1);

        // Modify some fields (simulating an action)
        // ... (the actual state would be modified by the caller)

        // Undo
        let restored = stack.undo().unwrap();
        assert_eq!(restored.players[0].hand, state.players[0].hand);
        assert!(!stack.can_undo());
    }

    #[test]
    fn multiple_saves_and_undos() {
        let mut stack = UndoStack::new();
        let state1 = create_solo_game(42, Hero::Arythea);
        let state2 = create_solo_game(99, Hero::Tovak);

        stack.save(&state1);
        stack.save(&state2);
        assert_eq!(stack.depth(), 2);

        // Undo in reverse order
        let restored2 = stack.undo().unwrap();
        assert_eq!(restored2.players[0].hero, Hero::Tovak);

        let restored1 = stack.undo().unwrap();
        assert_eq!(restored1.players[0].hero, Hero::Arythea);

        assert!(!stack.can_undo());
    }

    #[test]
    fn checkpoint_clears_stack() {
        let mut stack = UndoStack::new();
        let state = create_solo_game(42, Hero::Arythea);

        stack.save(&state);
        stack.save(&state);
        assert_eq!(stack.depth(), 2);

        stack.set_checkpoint();
        assert!(!stack.can_undo());
        assert_eq!(stack.depth(), 0);
        assert!(stack.is_checkpoint_active());
    }

    #[test]
    fn clear_resets_everything() {
        let mut stack = UndoStack::new();
        let state = create_solo_game(42, Hero::Arythea);

        stack.save(&state);
        stack.set_checkpoint();
        assert!(stack.is_checkpoint_active());

        stack.clear();
        assert!(!stack.can_undo());
        assert!(!stack.is_checkpoint_active());
    }

    #[test]
    fn undo_empty_returns_none() {
        let mut stack = UndoStack::new();
        assert!(stack.undo().is_none());
    }

    #[test]
    fn save_after_checkpoint_works() {
        let mut stack = UndoStack::new();
        let state = create_solo_game(42, Hero::Arythea);

        stack.set_checkpoint();
        assert!(!stack.can_undo());

        stack.save(&state);
        assert!(stack.can_undo());
        assert_eq!(stack.depth(), 1);
    }
}
