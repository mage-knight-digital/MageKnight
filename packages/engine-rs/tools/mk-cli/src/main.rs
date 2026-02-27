use std::env;
use std::io::{self, Write};
use std::path::PathBuf;

use dialoguer::{theme::ColorfulTheme, Select};
use serde::{Deserialize, Serialize};

use mk_data::cards::get_card;
use mk_data::enemies::get_enemy;
use mk_data::units::get_unit;
use mk_engine::action_pipeline::{apply_legal_action, initial_events};
use mk_engine::client_state::to_client_state;
use mk_engine::legal_actions::{enumerate_legal_actions, enumerate_legal_actions_with_undo};
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::*;
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{ActivePending, ChoiceResolution, PendingTacticDecision, SubsetSelectionKind};
use mk_types::state::*;

const HEROES: [(&str, Hero); 7] = [
    ("Arythea", Hero::Arythea),
    ("Tovak", Hero::Tovak),
    ("Goldyx", Hero::Goldyx),
    ("Norowas", Hero::Norowas),
    ("Wolfhawk", Hero::Wolfhawk),
    ("Krang", Hero::Krang),
    ("Braevalar", Hero::Braevalar),
];

// =============================================================================
// CLI args
// =============================================================================

struct CliArgs {
    hero: Hero,
    hero_name: &'static str,
    seed: u32,
    replay: Option<PathBuf>,
    step: bool,
    from_step: Option<usize>,
    to_artifact: Option<PathBuf>,
}

fn parse_args() -> CliArgs {
    let args: Vec<String> = env::args().collect();
    let mut hero: Option<(Hero, &'static str)> = None;
    let mut seed: Option<u32> = None;
    let mut replay: Option<PathBuf> = None;
    let mut step = false;
    let mut from_step: Option<usize> = None;
    let mut to_artifact: Option<PathBuf> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--hero" | "-h" => {
                i += 1;
                if i < args.len() {
                    let name = args[i].to_lowercase();
                    for &(hname, h) in &HEROES {
                        if hname.to_lowercase() == name {
                            hero = Some((h, hname));
                            break;
                        }
                    }
                }
            }
            "--seed" | "-s" => {
                i += 1;
                if i < args.len() {
                    seed = args[i].parse().ok();
                }
            }
            "--replay" => {
                i += 1;
                if i < args.len() {
                    replay = Some(PathBuf::from(&args[i]));
                }
            }
            "--step" => {
                step = true;
            }
            "--from-step" => {
                i += 1;
                if i < args.len() {
                    from_step = args[i].parse().ok();
                }
            }
            "--to-artifact" => {
                i += 1;
                if i < args.len() {
                    to_artifact = Some(PathBuf::from(&args[i]));
                }
            }
            _ => {}
        }
        i += 1;
    }
    CliArgs {
        hero: hero.map(|(h, _)| h).unwrap_or(Hero::Arythea),
        hero_name: hero.map(|(_, n)| n).unwrap_or("Arythea"),
        seed: seed.unwrap_or(42),
        replay,
        step,
        from_step,
        to_artifact,
    }
}

// =============================================================================
// Replay mode
// =============================================================================

#[derive(Deserialize)]
struct ReplayFile {
    seed: u32,
    hero: String,
    actions: Vec<usize>,
    #[serde(default)]
    steps: Option<usize>,
    #[serde(default)]
    fame: Option<u32>,
    #[serde(default)]
    episode: Option<u64>,
}

fn parse_replay_hero(name: &str) -> Hero {
    match name.to_lowercase().as_str() {
        "arythea" => Hero::Arythea,
        "tovak" => Hero::Tovak,
        "goldyx" => Hero::Goldyx,
        "norowas" => Hero::Norowas,
        "wolfhawk" => Hero::Wolfhawk,
        "krang" => Hero::Krang,
        "braevalar" => Hero::Braevalar,
        _ => {
            eprintln!("  Unknown hero '{}', defaulting to Arythea", name);
            Hero::Arythea
        }
    }
}

fn hero_display_name(hero: Hero) -> &'static str {
    for &(name, h) in &HEROES {
        if h == hero {
            return name;
        }
    }
    "Unknown"
}

fn run_replay(replay_path: PathBuf, step_mode: bool, from_step: Option<usize>) {
    let file_content = match std::fs::read_to_string(&replay_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("  Failed to read {}: {}", replay_path.display(), e);
            std::process::exit(1);
        }
    };

    let replay: ReplayFile = match serde_json::from_str(&file_content) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("  Failed to parse replay JSON: {}", e);
            std::process::exit(1);
        }
    };

    let hero = parse_replay_hero(&replay.hero);
    let hero_name = hero_display_name(hero);

    println!(
        "  Replaying: seed={} hero={} actions={}",
        replay.seed,
        hero_name,
        replay.actions.len()
    );
    if let Some(s) = replay.steps {
        print!("  (recorded steps={}", s);
        if let Some(f) = replay.fame {
            print!(", fame={}", f);
        }
        if let Some(ep) = replay.episode {
            print!(", episode={}", ep);
        }
        println!(")");
    }

    let interactive_from = if step_mode {
        0
    } else {
        from_step.unwrap_or(usize::MAX)
    };

    println!();

    let mut state = create_solo_game(replay.seed, hero);
    place_initial_tiles(&mut state);
    let mut undo = UndoStack::new();
    let player_idx = 0;

    for (step_num, &action_index) in replay.actions.iter().enumerate() {
        if state.game_ended {
            println!("\n  === GAME OVER at step {} ===", step_num);
            display_score(&state);
            return;
        }

        // Use enumerate_legal_actions (no undo) to match the Python GameEngine,
        // which records action indices without undo actions in the legal set.
        let action_set = enumerate_legal_actions(&state, player_idx);

        if action_set.actions.is_empty() {
            println!("  Step {}: No legal actions — game stuck!", step_num);
            display_state(&state, player_idx);
            return;
        }

        if action_index >= action_set.actions.len() {
            println!(
                "  Step {}: action index {} out of range (0..{})",
                step_num,
                action_index,
                action_set.actions.len()
            );
            display_state(&state, player_idx);
            return;
        }

        let action = action_set.actions[action_index].clone();
        let epoch = action_set.epoch;

        if step_num >= interactive_from {
            println!("  ── Step {} ──", step_num);
            display_state(&state, player_idx);
            println!("  Candidates ({}):", action_set.actions.len());
            for (i, a) in action_set.actions.iter().enumerate() {
                let marker = if i == action_index { ">>" } else { "  " };
                println!("  {} [{:>3}] {}", marker, i, format_action(a, &state, player_idx));
            }
            println!();
            print!("  Press Enter to continue (q to quit)...");
            io::stdout().flush().unwrap();
            let mut input = String::new();
            io::stdin().read_line(&mut input).unwrap();
            if input.trim().eq_ignore_ascii_case("q") {
                println!("  Stopped at step {}.", step_num);
                return;
            }
        }

        match apply_legal_action(&mut state, &mut undo, player_idx, &action, epoch) {
            Ok(result) => {
                if result.game_ended {
                    println!("\n  === GAME OVER at step {} ===", step_num + 1);
                    display_score(&state);
                    return;
                }
            }
            Err(e) => {
                println!("  Step {}: ERROR: {:?}", step_num, e);
                display_state(&state, player_idx);
                return;
            }
        }
    }

    // All actions exhausted
    println!("\n  === REPLAY COMPLETE ({} actions) ===", replay.actions.len());
    println!(
        "  Round {} | Fame {} | Game ended: {}",
        state.round,
        state.players[player_idx].fame,
        state.game_ended
    );
    display_score(&state);
}

// =============================================================================
// Artifact generation
// =============================================================================

#[derive(Serialize)]
struct ArtifactFile {
    run: ArtifactRun,
    #[serde(rename = "messageLog")]
    message_log: Vec<ArtifactMessage>,
}

#[derive(Serialize)]
struct ArtifactRun {
    seed: u32,
    outcome: String,
    steps: usize,
    run_index: u32,
    game_id: String,
}

#[derive(Serialize)]
struct ArtifactMessage {
    player_id: String,
    message_type: String,
    payload: ArtifactPayload,
}

#[derive(Serialize)]
struct ArtifactPayload {
    events: Vec<mk_types::events::GameEvent>,
    state: mk_types::client_state::ClientGameState,
}

fn run_replay_to_artifact(replay_path: PathBuf, artifact_path: PathBuf) {
    let file_content = match std::fs::read_to_string(&replay_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("  Failed to read {}: {}", replay_path.display(), e);
            std::process::exit(1);
        }
    };

    let replay: ReplayFile = match serde_json::from_str(&file_content) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("  Failed to parse replay JSON: {}", e);
            std::process::exit(1);
        }
    };

    let hero = parse_replay_hero(&replay.hero);
    let hero_name = hero_display_name(hero);
    let player_id_str = "player_0";

    println!(
        "  Generating artifact: seed={} hero={} actions={}",
        replay.seed, hero_name, replay.actions.len()
    );

    let mut state = create_solo_game(replay.seed, hero);
    place_initial_tiles(&mut state);
    let mut undo = UndoStack::new();
    let player_idx = 0;
    let player_id = state.players[player_idx].id.clone();

    let mut message_log = Vec::new();

    // Initial frame
    let init_events = initial_events(&state, replay.seed, hero);
    let init_client = to_client_state(&state, &player_id);
    message_log.push(ArtifactMessage {
        player_id: player_id_str.to_string(),
        message_type: "state_update".to_string(),
        payload: ArtifactPayload {
            events: init_events,
            state: init_client,
        },
    });

    let mut outcome = "ended".to_string();

    for (step_num, &action_index) in replay.actions.iter().enumerate() {
        if state.game_ended {
            break;
        }

        let action_set = enumerate_legal_actions(&state, player_idx);

        if action_set.actions.is_empty() {
            eprintln!("  Step {}: No legal actions — game stuck!", step_num);
            outcome = "stuck".to_string();
            break;
        }

        if action_index >= action_set.actions.len() {
            eprintln!(
                "  Step {}: action index {} out of range (0..{})",
                step_num, action_index, action_set.actions.len()
            );
            outcome = "error".to_string();
            break;
        }

        let action = action_set.actions[action_index].clone();
        let epoch = action_set.epoch;

        match apply_legal_action(&mut state, &mut undo, player_idx, &action, epoch) {
            Ok(result) => {
                let client = to_client_state(&state, &player_id);
                message_log.push(ArtifactMessage {
                    player_id: player_id_str.to_string(),
                    message_type: "state_update".to_string(),
                    payload: ArtifactPayload {
                        events: result.events,
                        state: client,
                    },
                });
            }
            Err(e) => {
                eprintln!("  Step {}: ERROR: {:?}", step_num, e);
                outcome = "error".to_string();
                break;
            }
        }
    }

    let artifact = ArtifactFile {
        run: ArtifactRun {
            seed: replay.seed,
            outcome,
            steps: message_log.len() - 1, // subtract initial frame
            run_index: 0,
            game_id: format!("replay-{}", replay.seed),
        },
        message_log,
    };

    match std::fs::write(&artifact_path, serde_json::to_string(&artifact).unwrap()) {
        Ok(()) => {
            println!("  Wrote artifact to {}", artifact_path.display());
            println!(
                "  Frames: {}, Final fame: {}",
                artifact.run.steps,
                state.players[player_idx].fame
            );
        }
        Err(e) => {
            eprintln!("  Failed to write artifact: {}", e);
            std::process::exit(1);
        }
    }
}

// =============================================================================
// Main
// =============================================================================

fn main() {
    println!("\n  =============================");
    println!("    M A G E   K N I G H T");
    println!("  =============================\n");

    let cli = parse_args();

    // Replay mode
    if let Some(replay_path) = cli.replay {
        if let Some(artifact_path) = cli.to_artifact {
            run_replay_to_artifact(replay_path, artifact_path);
        } else {
            run_replay(replay_path, cli.step, cli.from_step);
        }
        return;
    }

    // Interactive mode
    let is_tty = is_terminal();

    let (hero, hero_name, seed) = if is_tty {
        let hero_names: Vec<&str> = HEROES.iter().map(|(n, _)| *n).collect();
        let hero_idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Choose your hero")
            .items(&hero_names)
            .default(0)
            .interact()
            .unwrap();
        let (hname, h) = HEROES[hero_idx];

        print!("Enter seed (or Enter for 42): ");
        io::stdout().flush().unwrap();
        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();
        let s: u32 = input.trim().parse().unwrap_or(42);
        (h, hname, s)
    } else {
        (cli.hero, cli.hero_name, cli.seed)
    };

    let mut state = create_solo_game(seed, hero);
    let mut undo = UndoStack::new();
    let player_idx = 0;

    println!("\n  >> playing as {}, seed {}\n", hero_name, seed);

    loop {
        if state.game_ended {
            println!("\n  === GAME OVER ===");
            display_score(&state);
            break;
        }

        display_state(&state, player_idx);

        let action_set = enumerate_legal_actions_with_undo(&state, player_idx, &undo);

        if action_set.actions.is_empty() {
            println!("  No legal actions available!");
            break;
        }

        let action_strings: Vec<String> = action_set
            .actions
            .iter()
            .map(|a| format_action(a, &state, player_idx))
            .collect();

        let selection = Select::with_theme(&ColorfulTheme::default())
            .with_prompt(format!("{} actions", action_strings.len()))
            .items(&action_strings)
            .default(0)
            .interact_opt()
            .unwrap();

        let Some(idx) = selection else {
            println!("\n  Goodbye!");
            break;
        };

        let action = action_set.actions[idx].clone();
        let epoch = action_set.epoch;

        match apply_legal_action(&mut state, &mut undo, player_idx, &action, epoch) {
            Ok(result) => {
                if result.game_ended {
                    println!("\n  === GAME OVER ===");
                    display_score(&state);
                    break;
                }
            }
            Err(e) => {
                println!("  ERROR: {:?}", e);
            }
        }
    }
}

// =============================================================================
// State display
// =============================================================================

fn display_state(state: &GameState, player_idx: usize) {
    let player = &state.players[player_idx];
    let time = match state.time_of_day {
        TimeOfDay::Day => "Day",
        TimeOfDay::Night => "Night",
    };

    println!("  ─────────────────────────────────────────");
    println!(
        "  Round {} | {} | Turn {}",
        state.round, time, state.current_player_index + 1
    );
    println!(
        "  Lv{} | Fame {} | Rep {} | Armor {}",
        player.level, player.fame, player.reputation, player.armor
    );

    if let Some(pos) = player.position {
        let terrain = state
            .map
            .hexes
            .get(&pos.key())
            .map(|h| format!("{:?}", h.terrain))
            .unwrap_or_else(|| "?".into());
        println!("  Position: ({},{}) {}", pos.q, pos.r, terrain);
    }

    // Resources
    let mut res = Vec::new();
    if player.move_points > 0 {
        res.push(format!("Move:{}", player.move_points));
    }
    if player.influence_points > 0 {
        res.push(format!("Influence:{}", player.influence_points));
    }
    if player.healing_points > 0 {
        res.push(format!("Heal:{}", player.healing_points));
    }
    if !res.is_empty() {
        println!("  {}", res.join("  "));
    }

    // Crystals
    let c = &player.crystals;
    if c.red + c.blue + c.green + c.white > 0 {
        println!(
            "  Crystals: R:{} B:{} G:{} W:{}",
            c.red, c.blue, c.green, c.white
        );
    }

    // Mana tokens
    if !player.pure_mana.is_empty() {
        let tokens: Vec<String> = player.pure_mana.iter().map(|t| mana_color_str(t.color)).collect();
        println!("  Mana tokens: {}", tokens.join(", "));
    }

    // Hand
    println!("  ── Hand ({}) ──", player.hand.len());
    for (i, card_id) in player.hand.iter().enumerate() {
        println!("    {}. {}", i + 1, card_display(card_id.as_str()));
    }

    // Play area
    if !player.play_area.is_empty() {
        let played: Vec<String> = player
            .play_area
            .iter()
            .map(|c| card_name(c.as_str()))
            .collect();
        println!("  Played: {}", played.join(", "));
    }

    // Units
    if !player.units.is_empty() {
        println!("  ── Units ──");
        for u in player.units.iter() {
            let name = get_unit(u.unit_id.as_str())
                .map(|d| d.name)
                .unwrap_or("?");
            let status = match (u.state, u.wounded) {
                (UnitState::Ready, false) => "Ready",
                (UnitState::Ready, true) => "Ready (wounded)",
                (UnitState::Spent, false) => "Spent",
                (UnitState::Spent, true) => "Spent (wounded)",
            };
            println!("    {} [{}]", name, status);
        }
    }

    // Mana source
    let available: Vec<String> = state
        .source
        .dice
        .iter()
        .filter(|d| !d.is_depleted && d.taken_by_player_id.is_none())
        .map(|d| mana_color_str(d.color))
        .collect();
    if !available.is_empty() {
        println!("  Source: {}", available.join(" "));
    }

    // Combat
    if let Some(ref combat) = state.combat {
        display_combat(combat, player);
    }

    // Pending
    if let Some(ref active) = player.pending.active {
        println!("  ── Pending: {} ──", pending_label(active));
    }

    // Tactic
    if let Some(ref tactic) = player.selected_tactic {
        let flipped = if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
            " (flipped)"
        } else {
            ""
        };
        println!("  Tactic: {}{}", tactic_display(tactic.as_str()), flipped);
    }

    println!();
}

fn display_combat(combat: &CombatState, player: &PlayerState) {
    let phase = match combat.phase {
        CombatPhase::RangedSiege => "Ranged/Siege",
        CombatPhase::Block => "Block",
        CombatPhase::AssignDamage => "Assign Damage",
        CombatPhase::Attack => "Attack",
    };
    println!("  ── Combat ({}) ──", phase);
    for enemy in &combat.enemies {
        if enemy.is_defeated {
            continue;
        }
        if enemy.is_summoner_hidden {
            continue;
        }
        let def = get_enemy(enemy.enemy_id.as_str());
        let name = def.map(|d| d.name).unwrap_or("???");
        let armor = def.map(|d| d.armor).unwrap_or(0);
        let atk = def.map(|d| d.attack).unwrap_or(0);
        let elem = def
            .map(|d| element_str(d.attack_element))
            .unwrap_or("?");
        let blocked = if enemy.is_blocked { " [blocked]" } else { "" };
        println!(
            "    {} (atk:{} {} / armor:{}){}", name, atk, elem, armor, blocked
        );
    }

    // Show player's accumulated combat values
    let acc = &player.combat_accumulator;
    let mut parts = Vec::new();
    format_attack_part(&mut parts, "Melee", acc.attack.normal, &acc.attack.normal_elements);
    format_attack_part(&mut parts, "Ranged", acc.attack.ranged, &acc.attack.ranged_elements);
    format_attack_part(&mut parts, "Siege", acc.attack.siege, &acc.attack.siege_elements);
    format_block_part(&mut parts, "Block", &acc.block_elements);
    format_block_part(&mut parts, "Swift Block", &acc.swift_block_elements);
    if !parts.is_empty() {
        println!("  Player: {}", parts.join(" | "));
    }
}

fn format_attack_part(parts: &mut Vec<String>, label: &str, total: u32, elements: &ElementalValues) {
    if total == 0 {
        return;
    }
    let elem = dominant_element_str(elements);
    parts.push(format!("{} {} {}", label, total, elem));
}

fn format_block_part(parts: &mut Vec<String>, label: &str, elements: &ElementalValues) {
    let total = elements.total();
    if total == 0 {
        return;
    }
    let elem = dominant_element_str(elements);
    parts.push(format!("{} {} {}", label, total, elem));
}

fn dominant_element_str(ev: &ElementalValues) -> &'static str {
    if ev.cold_fire > 0 { "cold-fire" }
    else if ev.fire > 0 { "fire" }
    else if ev.ice > 0 { "ice" }
    else { "physical" }
}

fn display_score(state: &GameState) {
    for p in &state.players {
        println!(
            "  {} - Fame: {}, Level: {}, Rep: {}",
            p.hero_name(),
            p.fame,
            p.level,
            p.reputation
        );
    }
}

// =============================================================================
// Action formatting
// =============================================================================

fn format_action(action: &LegalAction, state: &GameState, player_idx: usize) -> String {
    match action {
        LegalAction::SelectTactic { tactic_id } => {
            format!("Select tactic: {}", tactic_display(tactic_id.as_str()))
        }
        LegalAction::PlayCardBasic { card_id, .. } => {
            format!("Play {} (basic)", card_name(card_id.as_str()))
        }
        LegalAction::PlayCardPowered {
            card_id,
            mana_color,
            ..
        } => {
            format!(
                "Play {} (powered, {} mana)",
                card_name(card_id.as_str()),
                basic_color_str(*mana_color)
            )
        }
        LegalAction::PlayCardSideways {
            card_id,
            sideways_as,
            ..
        } => {
            let as_str = match sideways_as {
                SidewaysAs::Move => "Move 1",
                SidewaysAs::Influence => "Influence 1",
                SidewaysAs::Attack => "Attack 1",
                SidewaysAs::Block => "Block 1",
            };
            format!(
                "Play {} sideways as {}",
                card_name(card_id.as_str()),
                as_str
            )
        }
        LegalAction::Move { target, cost } => {
            let terrain = state
                .map
                .hexes
                .get(&target.key())
                .map(|h| format!("{:?}", h.terrain))
                .unwrap_or_else(|| "?".into());
            format!("Move to ({},{}) {} [cost:{}]", target.q, target.r, terrain, cost)
        }
        LegalAction::Explore { direction } => {
            format!("Explore {:?}", direction)
        }
        LegalAction::ResolveChoice { choice_index } => {
            format_resolve_choice(*choice_index, state, player_idx)
        }
        LegalAction::ResolveDiscardForBonus {
            choice_index,
            discard_count,
        } => {
            format!("Discard {} cards (option {})", discard_count, choice_index + 1)
        }
        LegalAction::ResolveDecompose { hand_index } => {
            let player = &state.players[player_idx];
            let name = player
                .hand
                .get(*hand_index)
                .map(|c| card_name(c.as_str()))
                .unwrap_or_else(|| "?".into());
            format!("Decompose {}", name)
        }
        LegalAction::ChallengeRampaging { hex } => {
            format!("Challenge rampaging enemies at ({},{})", hex.q, hex.r)
        }
        LegalAction::DeclareBlock {
            enemy_instance_id,
            attack_index,
        } => {
            let enemy_name = combat_enemy_name(state, enemy_instance_id.as_str());
            format!("Block {} attack #{}", enemy_name, attack_index + 1)
        }
        LegalAction::InitiateAttack { attack_type } => {
            let atype = match attack_type {
                CombatType::Melee => "melee",
                CombatType::Ranged => "ranged",
                CombatType::Siege => "siege",
            };
            format!("Declare {} attack", atype)
        }
        LegalAction::SpendMoveOnCumbersome { enemy_instance_id } => {
            let name = combat_enemy_name(state, enemy_instance_id.as_str());
            format!("Spend move on {} (cumbersome)", name)
        }
        LegalAction::ResolveTacticDecision { data } => format_tactic_decision(data, state, player_idx),
        LegalAction::ActivateTactic => "Activate tactic".into(),
        LegalAction::InitiateManaSearch => "Mana Search (reroll dice)".into(),
        LegalAction::BeginInteraction => {
            let site_name = player_site_name(state, player_idx);
            format!("Begin interaction with {}", site_name)
        }
        LegalAction::EnterSite => {
            let site_name = player_site_name(state, player_idx);
            format!("Enter {}", site_name)
        }
        LegalAction::InteractSite { healing } => {
            format!("Interact with site (heal {} wounds)", healing)
        }
        LegalAction::PlunderSite => "Plunder site".into(),
        LegalAction::DeclinePlunder => "Decline plunder".into(),
        LegalAction::ResolveGladeWound { choice } => {
            format!("Remove wound from {:?}", choice)
        }
        LegalAction::RecruitUnit {
            unit_id,
            influence_cost,
            ..
        } => {
            let name = get_unit(unit_id.as_str())
                .map(|d| d.name)
                .unwrap_or("?");
            format!("Recruit {} (cost: {} influence)", name, influence_cost)
        }
        LegalAction::ActivateUnit {
            unit_instance_id,
            ability_index,
        } => format_activate_unit(state, player_idx, unit_instance_id.as_str(), *ability_index),
        LegalAction::UseSkill { skill_id } => {
            format!("Use skill: {}", skill_id.as_str())
        }
        LegalAction::ChooseLevelUpReward {
            skill_index,
            from_common_pool,
            advanced_action_id,
        } => {
            let source = if *from_common_pool { "common" } else { "drawn" };
            format!(
                "Level up: skill #{} ({}) + AA {}",
                skill_index + 1,
                source,
                card_name(advanced_action_id.as_str())
            )
        }
        LegalAction::EndTurn => "End turn".into(),
        LegalAction::DeclareRest => "Declare rest".into(),
        LegalAction::CompleteRest {
            discard_hand_index,
        } => match discard_hand_index {
            Some(idx) => {
                let player = &state.players[player_idx];
                let name = player
                    .hand
                    .get(*idx)
                    .map(|c| card_name(c.as_str()))
                    .unwrap_or_else(|| "?".into());
                format!("Complete rest (discard {})", name)
            }
            None => "Complete rest".into(),
        },
        LegalAction::SubsetSelect { index } => {
            let player = &state.players[player_idx];
            if let Some(ActivePending::SubsetSelection(ref ss)) = player.pending.active {
                match &ss.kind {
                    SubsetSelectionKind::AttackTargets { eligible_instance_ids, .. } => {
                        let name = eligible_instance_ids.get(*index)
                            .and_then(|iid| state.combat.as_ref()
                                .and_then(|c| c.enemies.iter().find(|e| &e.instance_id == iid))
                                .and_then(|e| get_enemy(e.enemy_id.as_str()))
                                .map(|d| d.name))
                            .unwrap_or("???");
                        format!("Target {}", name)
                    }
                    _ => format!("Select #{}", index + 1),
                }
            } else {
                format!("Select #{}", index + 1)
            }
        }
        LegalAction::SubsetConfirm => "Confirm selection".into(),
        LegalAction::EndCombatPhase => "End combat phase".into(),
        LegalAction::AssignDamageToHero { enemy_index, attack_index } => {
            let enemy_name = state.combat.as_ref()
                .and_then(|c| c.enemies.get(*enemy_index))
                .and_then(|e| get_enemy(e.enemy_id.as_str()))
                .map(|d| d.name)
                .unwrap_or("???");
            format!("Assign {} (attack {}) damage to hero", enemy_name, attack_index)
        }
        LegalAction::AssignDamageToUnit { enemy_index, attack_index, unit_instance_id } => {
            let enemy_name = state.combat.as_ref()
                .and_then(|c| c.enemies.get(*enemy_index))
                .and_then(|e| get_enemy(e.enemy_id.as_str()))
                .map(|d| d.name)
                .unwrap_or("???");
            let unit_name = state.players[player_idx].units.iter()
                .find(|u| u.instance_id == *unit_instance_id)
                .and_then(|u| get_unit(u.unit_id.as_str()))
                .map(|d| d.name)
                .unwrap_or("???");
            format!("Assign {} (attack {}) damage to {}", enemy_name, attack_index, unit_name)
        }
        LegalAction::ResolveCrystalJoyReclaim { discard_index } => match discard_index {
            Some(i) => format!("Reclaim card from discard (index {})", i),
            None => "Skip Crystal Joy reclaim".into(),
        },
        LegalAction::ResolveSteadyTempoDeckPlacement { place } => {
            if *place { "Place Steady Tempo on deck".into() } else { "Skip Steady Tempo placement".into() }
        }
        LegalAction::ResolveBannerProtection { remove_all } => {
            if *remove_all { "Remove all wounds (Banner of Protection)".into() } else { "Keep wounds".into() }
        }
        LegalAction::ReturnInteractiveSkill { skill_id } => {
            format!("Return interactive skill: {}", skill_id.as_str())
        }
        LegalAction::AnnounceEndOfRound => "Announce end of round".into(),
        LegalAction::ForfeitTurn => "Forfeit turn (no cards)".into(),
        LegalAction::Undo => "Undo".into(),
        LegalAction::ResolveSourceOpeningReroll { reroll } => {
            if *reroll { "Reroll extra die (Source Opening)".into() } else { "Skip reroll (Source Opening)".into() }
        }
        LegalAction::ResolveDiscardForCrystal { card_id } => {
            match card_id {
                None => "Skip discard (Offering)".into(),
                Some(cid) => format!("Discard {} for crystal (Offering)", cid.as_str()),
            }
        }
        LegalAction::ResolveTraining { selection_index } => {
            format!("Training: select card #{}", selection_index + 1)
        }
        LegalAction::ResolveMaximalEffect { hand_index } => {
            let player = &state.players[player_idx];
            let name = player
                .hand
                .get(*hand_index)
                .map(|c| card_name(c.as_str()))
                .unwrap_or_else(|| "?".into());
            format!("Maximal Effect: select {}", name)
        }
        LegalAction::ResolveMeditation {
            selection_index,
            place_on_top,
        } => match place_on_top {
            Some(true) => format!("Meditation: place card {} on top of deck", selection_index),
            Some(false) => format!("Meditation: place card {} on bottom of deck", selection_index),
            None => format!("Meditation: select card {}", selection_index),
        },
        LegalAction::MeditationDoneSelecting => "Meditation: done selecting".to_string(),
        LegalAction::ProposeCooperativeAssault { .. } => "Propose cooperative assault".into(),
        LegalAction::RespondToCooperativeProposal { accept } => {
            if *accept { "Accept cooperative assault".into() } else { "Decline cooperative assault".into() }
        }
        LegalAction::CancelCooperativeProposal => "Cancel cooperative assault".into(),
        LegalAction::BuySpell { card_id, mana_color, .. } => {
            format!("Buy spell: {} (pay {:?} mana)", card_name(card_id.as_str()), mana_color)
        }
        LegalAction::LearnAdvancedAction { card_id, .. } => {
            format!("Learn AA: {}", card_name(card_id.as_str()))
        }
        LegalAction::BuyArtifact => "Buy artifact (red city, draw 2 pick 1)".into(),
        LegalAction::BuyCityAdvancedAction { card_id, .. } => {
            format!("Buy city AA: {}", card_name(card_id.as_str()))
        }
        LegalAction::BuyCityAdvancedActionFromDeck => "Buy AA blind from deck (green city)".into(),
        LegalAction::AddEliteToOffer => "Add elite unit to offer (white city)".into(),
        LegalAction::SelectArtifact { card_id } => {
            format!("Select artifact: {}", card_name(card_id.as_str()))
        }
        LegalAction::BurnMonastery => "Burn monastery".into(),
        LegalAction::AltarTribute { .. } => "Pay altar tribute".into(),
        LegalAction::SelectReward { card_id, unit_id, .. } => {
            if let Some(uid) = unit_id {
                format!("Select reward unit: {}", uid.as_str())
            } else {
                format!("Select reward: {}", card_name(card_id.as_str()))
            }
        }
        LegalAction::ResolveBookOfWisdom { selection_index } => {
            format!("Book of Wisdom: select #{}", selection_index + 1)
        }
        LegalAction::ResolveTomeOfAllSpells { selection_index } => {
            format!("Tome of All Spells: select #{}", selection_index + 1)
        }
        LegalAction::ResolveCircletOfProficiency { selection_index } => {
            format!("Circlet of Proficiency: select #{}", selection_index + 1)
        }
        LegalAction::AssignBanner { card_id, unit_instance_id, .. } => {
            format!("Assign {} to unit {}", card_name(card_id.as_str()), unit_instance_id)
        }
        LegalAction::UseBannerCourage { unit_instance_id } => {
            format!("Use Banner of Courage (unit {})", unit_instance_id)
        }
        LegalAction::UseBannerFear { unit_instance_id, enemy_instance_id, .. } => {
            format!("Use Banner of Fear (unit {} → enemy {})", unit_instance_id, enemy_instance_id)
        }
        LegalAction::ConvertMoveToAttack { move_points, attack_type } => {
            format!("Convert {} move → {:?} attack", move_points, attack_type)
        }
        LegalAction::ConvertInfluenceToBlock { influence_points, element } => {
            format!("Convert {} influence → {:?} block", influence_points, element)
        }
        LegalAction::PayHeroesAssaultInfluence => {
            "Pay 2 influence for Heroes assault".into()
        }
        LegalAction::PayThugsDamageInfluence { unit_instance_id } => {
            format!("Pay 2 influence for Thugs {} damage", unit_instance_id)
        }
        LegalAction::ResolveUnitMaintenance { unit_instance_id, keep_unit, crystal_color, new_mana_token_color } => {
            if *keep_unit {
                format!("Keep unit {} (pay {:?} crystal, new {:?} token)", unit_instance_id, crystal_color, new_mana_token_color)
            } else {
                format!("Disband unit {}", unit_instance_id)
            }
        }
        LegalAction::ResolveHexCostReduction { coordinate } => {
            format!("Reduce cost at hex ({},{})", coordinate.q, coordinate.r)
        }
        LegalAction::ResolveTerrainCostReduction { terrain } => {
            format!("Reduce cost for {:?} terrain", terrain)
        }
        LegalAction::ResolveCrystalRollColor { color } => {
            format!("Choose {:?} crystal", color)
        }
        LegalAction::ForfeitUnitReward => "Forfeit unit reward".into(),
        LegalAction::DisbandUnitForReward { unit_instance_id, reward_unit_id } => {
            format!("Disband {} to take {}", unit_instance_id.as_str(), reward_unit_id.as_str())
        }
    }
}

fn format_resolve_choice(
    choice_index: usize,
    state: &GameState,
    player_idx: usize,
) -> String {
    let player = &state.players[player_idx];
    if let Some(ActivePending::Choice(ref choice)) = player.pending.active {
        if let ChoiceResolution::ManaSourceSelect { ref sources, .. } = choice.resolution {
            if let Some(src) = sources.get(choice_index) {
                let src_type = match src.source_type {
                    ManaSourceType::Token => "token",
                    ManaSourceType::Crystal => "crystal",
                    ManaSourceType::Die => "die",
                };
                return format!("Pay {} mana ({})", mana_color_str(src.color), src_type);
            }
        }
        if let ChoiceResolution::DiscardThenContinue { ref eligible_indices } = choice.resolution {
            if let Some(&hand_idx) = eligible_indices.get(choice_index) {
                let card_name = player.hand.get(hand_idx)
                    .and_then(|id| get_card(id.as_str()))
                    .map(|def| def.name.to_string())
                    .unwrap_or_else(|| format!("card #{}", hand_idx + 1));
                return format!("Discard {}", card_name);
            }
        }
        if let Some(effect) = choice.options.get(choice_index) {
            return format!("Choose: {}", effect_summary(effect));
        }
    }
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = player.pending.active {
        if let Some(opt) = options.get(choice_index) {
            return format!("Choose: {:?}", opt);
        }
    }
    if let Some(ActivePending::DeepMineChoice { ref colors }) = player.pending.active {
        if let Some(color) = colors.get(choice_index) {
            return format!("Choose {} crystal", basic_color_str(*color));
        }
    }
    format!("Choose option {}", choice_index + 1)
}

fn format_tactic_decision(data: &TacticDecisionData, state: &GameState, player_idx: usize) -> String {
    match data {
        TacticDecisionData::ManaSteal { die_index } => {
            let color = state
                .source
                .dice
                .get(*die_index)
                .map(|d| mana_color_str(d.color))
                .unwrap_or_else(|| "?".into());
            format!("Mana Steal: take {} die", color)
        }
        TacticDecisionData::Preparation { deck_card_index } => {
            let name = preparation_card_name(state, player_idx, *deck_card_index);
            format!("Preparation: take {}", name)
        }
        TacticDecisionData::SparingPowerStash => "Sparing Power: stash top card".into(),
        TacticDecisionData::SparingPowerTake => "Sparing Power: take all stored cards".into(),
    }
}

fn preparation_card_name(state: &GameState, player_idx: usize, deck_card_index: usize) -> String {
    if let Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation {
        ref deck_snapshot,
    })) = state.players[player_idx].pending.active
    {
        if let Some(cid) = deck_snapshot.get(deck_card_index) {
            return card_name(cid.as_str());
        }
    }
    format!("card #{}", deck_card_index + 1)
}

fn format_activate_unit(
    state: &GameState,
    player_idx: usize,
    instance_id: &str,
    ability_index: usize,
) -> String {
    let player = &state.players[player_idx];
    let unit = player.units.iter().find(|u| u.instance_id.as_str() == instance_id);
    if let Some(unit) = unit {
        let def = get_unit(unit.unit_id.as_str());
        let name = def.map(|d| d.name).unwrap_or("?");
        if let Some(def) = def {
            if let Some(slot) = def.abilities.get(ability_index) {
                let cost = slot
                    .mana_cost
                    .map(|c| format!(" [{}]", basic_color_str(c)))
                    .unwrap_or_default();
                return format!("{}: {}{}", name, unit_ability_str(&slot.ability), cost);
            }
        }
        return format!("{}: ability #{}", name, ability_index + 1);
    }
    format!("Activate unit ability #{}", ability_index + 1)
}

// =============================================================================
// Helpers
// =============================================================================

fn card_name(id: &str) -> String {
    if id == "wound" {
        return "Wound".into();
    }
    get_card(id)
        .map(|c| c.name.to_string())
        .unwrap_or_else(|| titlecase(id))
}

fn card_display(id: &str) -> String {
    if id == "wound" {
        return "Wound".into();
    }
    let def = get_card(id);
    match def {
        Some(c) => {
            let color = match c.color {
                CardColor::Red => "R",
                CardColor::Blue => "B",
                CardColor::Green => "G",
                CardColor::White => "W",
                CardColor::Wound => "wound",
                CardColor::Colorless => "-",
            };
            format!("{} ({})", c.name, color)
        }
        None => titlecase(id),
    }
}

fn titlecase(s: &str) -> String {
    s.split('_')
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn mana_color_str(c: ManaColor) -> String {
    match c {
        ManaColor::Red => "Red".into(),
        ManaColor::Blue => "Blue".into(),
        ManaColor::Green => "Green".into(),
        ManaColor::White => "White".into(),
        ManaColor::Gold => "Gold".into(),
        ManaColor::Black => "Black".into(),
    }
}

fn basic_color_str(c: BasicManaColor) -> &'static str {
    match c {
        BasicManaColor::Red => "Red",
        BasicManaColor::Blue => "Blue",
        BasicManaColor::Green => "Green",
        BasicManaColor::White => "White",
    }
}

fn element_str(e: Element) -> &'static str {
    match e {
        Element::Physical => "physical",
        Element::Fire => "fire",
        Element::Ice => "ice",
        Element::ColdFire => "cold-fire",
    }
}

fn tactic_display(id: &str) -> String {
    titlecase(id)
}

fn combat_enemy_name(state: &GameState, instance_id: &str) -> String {
    if let Some(ref combat) = state.combat {
        for enemy in &combat.enemies {
            if enemy.instance_id.as_str() == instance_id {
                return get_enemy(enemy.enemy_id.as_str())
                    .map(|d| d.name.to_string())
                    .unwrap_or_else(|| "???".into());
            }
        }
    }
    "???".into()
}

fn player_site_name(state: &GameState, player_idx: usize) -> String {
    let player = &state.players[player_idx];
    if let Some(pos) = player.position {
        if let Some(hex) = state.map.hexes.get(&pos.key()) {
            if let Some(ref site) = hex.site {
                return format!("{:?}", site.site_type);
            }
        }
    }
    "site".into()
}

fn pending_label(active: &ActivePending) -> &'static str {
    match active {
        ActivePending::Choice(_) => "Choose an option",
        ActivePending::Discard(_) => "Discard cards",
        ActivePending::DiscardForBonus(_) => "Discard for bonus",
        ActivePending::DiscardForCrystal(_) => "Discard for crystal",
        ActivePending::Decompose(_) => "Decompose a card",
        ActivePending::MaximalEffect(_) => "Maximal effect choice",
        ActivePending::BookOfWisdom(_) => "Book of Wisdom",
        ActivePending::Training(_) => "Training",
        ActivePending::TacticDecision(_) => "Tactic decision",
        ActivePending::LevelUpReward(_) => "Level-up reward",
        ActivePending::DeepMineChoice { .. } => "Deep mine crystal",
        ActivePending::GladeWoundChoice => "Glade wound location",
        ActivePending::BannerProtectionChoice => "Banner protection",
        ActivePending::SourceOpeningReroll { .. } => "Source opening reroll",
        ActivePending::Meditation(_) => "Meditation",
        ActivePending::PlunderDecision => "Plunder decision",
        ActivePending::UnitMaintenance(_) => "Unit maintenance",
        ActivePending::TerrainCostReduction(_) => "Terrain cost reduction",
        ActivePending::CrystalJoyReclaim(_) => "Crystal joy reclaim",
        ActivePending::SteadyTempoDeckPlacement(_) => "Steady tempo placement",
        ActivePending::UnitAbilityChoice { .. } => "Unit ability choice",
        ActivePending::SubsetSelection(ss) => match &ss.kind {
            mk_types::pending::SubsetSelectionKind::ManaSearch { .. } => "Select dice to reroll",
            mk_types::pending::SubsetSelectionKind::AttackTargets { .. } => "Select attack targets",
            mk_types::pending::SubsetSelectionKind::RestWoundDiscard { .. } => "Select wounds to discard",
            _ => "Select cards",
        },
        ActivePending::SelectCombatEnemy { .. } => "Select combat enemy",
        ActivePending::SiteRewardChoice { .. } => "Select reward",
        ActivePending::TomeOfAllSpells(_) => "Tome of All Spells",
        ActivePending::CircletOfProficiency(_) => "Circlet of Proficiency",
        ActivePending::ArtifactSelection(_) => "Select artifact to keep",
        ActivePending::CrystalRollColorChoice { .. } => "Choose crystal color",
    }
}

fn effect_summary(effect: &CardEffect) -> String {
    match effect {
        CardEffect::GainMove { amount } => format!("Move {}", amount),
        CardEffect::GainInfluence { amount } => format!("Influence {}", amount),
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => {
            let ct = match combat_type {
                CombatType::Melee => "",
                CombatType::Ranged => "ranged ",
                CombatType::Siege => "siege ",
            };
            format!("{}Attack {} {}", ct, amount, element_str(*element))
        }
        CardEffect::GainBlock { amount, element } => {
            format!("Block {} {}", amount, element_str(*element))
        }
        CardEffect::GainHealing { amount } => format!("Heal {}", amount),
        CardEffect::GainMana { color, amount } => {
            format!("Gain {} {} mana", amount, mana_color_str(*color))
        }
        CardEffect::DrawCards { count } => format!("Draw {} cards", count),
        CardEffect::GainFame { amount } => format!("Gain {} fame", amount),
        CardEffect::ChangeReputation { amount } => format!("Rep {:+}", amount),
        CardEffect::GainCrystal { color } => match color {
            Some(c) => format!("Gain {} crystal", basic_color_str(*c)),
            None => "Gain crystal".into(),
        },
        CardEffect::TakeWound => "Take wound".into(),
        CardEffect::ConvertManaToCrystal => "Crystallize".into(),
        CardEffect::Noop => "Nothing".into(),
        _ => format!("{:?}", effect),
    }
}

fn unit_ability_str(ability: &mk_data::units::UnitAbility) -> String {
    use mk_data::units::UnitAbility;
    match ability {
        UnitAbility::Attack { value, element } => {
            format!("Attack {} {}", value, element_str(*element))
        }
        UnitAbility::Block { value, element } => {
            format!("Block {} {}", value, element_str(*element))
        }
        UnitAbility::RangedAttack { value, element } => {
            format!("Ranged {} {}", value, element_str(*element))
        }
        UnitAbility::SiegeAttack { value, element } => {
            format!("Siege {} {}", value, element_str(*element))
        }
        UnitAbility::Move { value } => format!("Move {}", value),
        UnitAbility::Influence { value } => format!("Influence {}", value),
        UnitAbility::Heal { value } => format!("Heal {}", value),
        UnitAbility::GainMana { color } => format!("{} mana", basic_color_str(*color)),
        UnitAbility::GainCrystal { color } => format!("{} crystal", basic_color_str(*color)),
        UnitAbility::GainManaAndCrystal { color } => {
            format!("{} mana + crystal", basic_color_str(*color))
        }
        UnitAbility::AttackWithRepCost {
            value,
            element,
            rep_change,
        } => format!("Attack {} {} (rep {:+})", value, element_str(*element), rep_change),
        UnitAbility::InfluenceWithRepCost { value, rep_change } => {
            format!("Influence {} (rep {:+})", value, rep_change)
        }
        UnitAbility::MoveOrInfluence { value } => format!("Move or Influence {}", value),
        UnitAbility::AttackOrBlockWoundSelf { value, element } => {
            format!("Attack/Block {} {} (wound self)", value, element_str(*element))
        }
        UnitAbility::ReadyUnit { max_level } => format!("Ready unit (lv<={})", max_level),
        UnitAbility::GrantAllResistances => "Grant all resistances".into(),
        UnitAbility::SelectCombatEnemy(_) => "Target enemy ability".into(),
        UnitAbility::CoordinatedFire {
            ranged_value,
            element,
            ..
        } => format!("Ranged {} {} + unit bonus", ranged_value, element_str(*element)),
        UnitAbility::MoveWithTerrainReduction { move_value, .. } => {
            format!("Move {} + terrain reduction", move_value)
        }
        UnitAbility::Other { description } => description.to_string(),
    }
}

fn is_terminal() -> bool {
    dialoguer::console::Term::stderr().is_term()
}

// Helper: PlayerState doesn't have hero_name, derive from hero enum
trait HeroName {
    fn hero_name(&self) -> &'static str;
}

impl HeroName for PlayerState {
    fn hero_name(&self) -> &'static str {
        match self.hero {
            Hero::Arythea => "Arythea",
            Hero::Tovak => "Tovak",
            Hero::Goldyx => "Goldyx",
            Hero::Norowas => "Norowas",
            Hero::Wolfhawk => "Wolfhawk",
            Hero::Krang => "Krang",
            Hero::Braevalar => "Braevalar",
        }
    }
}
