use std::path::PathBuf;

/// Dump a game state + action history to `training/crashes/` for reproduction.
///
/// Works with any game whose State and Action types implement Serialize.
pub fn dump_crash_replay<S: serde::Serialize, A: serde::Serialize>(
    state: &S,
    seed: u32,
    step: u64,
    action_history: &[A],
) {
    let dir = PathBuf::from("training/crashes");
    if let Err(e) = std::fs::create_dir_all(&dir) {
        eprintln!("[VecEnv] failed to create crash dir: {e}");
        return;
    }

    // Dump game state
    let state_path = dir.join(format!("crash_{seed}_{step}_state.json"));
    match serde_json::to_string(state) {
        Ok(json) => match std::fs::write(&state_path, &json) {
            Ok(()) => eprintln!("[VecEnv] state dumped to {}", state_path.display()),
            Err(e) => eprintln!("[VecEnv] failed to write state dump: {e}"),
        },
        Err(e) => eprintln!("[VecEnv] failed to serialize state: {e}"),
    }

    // Dump action replay
    let replay_path = dir.join(format!("crash_{seed}_{step}_actions.json"));
    let replay = serde_json::json!({
        "seed": seed,
        "step": step,
        "action_count": action_history.len(),
        "actions": action_history,
    });
    match serde_json::to_string_pretty(&replay) {
        Ok(json) => match std::fs::write(&replay_path, &json) {
            Ok(()) => eprintln!("[VecEnv] action replay dumped to {}", replay_path.display()),
            Err(e) => eprintln!("[VecEnv] failed to write replay dump: {e}"),
        },
        Err(e) => eprintln!("[VecEnv] failed to serialize replay: {e}"),
    }
}
