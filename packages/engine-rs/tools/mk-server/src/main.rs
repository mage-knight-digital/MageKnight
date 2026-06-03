//! WebSocket game server for Mage Knight.
//!
//! Protocol:
//! - Client sends JSON messages, server responds with state updates.
//! - Each WS connection owns one game session.
//!
//! Client → Server messages:
//!   { "type": "new_game", "hero": "arythea", "seed": 42 }
//!   { "type": "new_game", "launchMode": "hotseat", "scenarioId": "full_conquest_2p", "players": [...] }
//!   { "type": "action", "action": <LegalAction>, "epoch": 5 }
//!   { "type": "undo" }
//!
//! Server → Client messages:
//!   { "type": "state_update", "state": <ClientGameState>, "events": [...], "legal_actions": [...], "epoch": 5 }
//!   { "type": "error", "message": "..." }

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::{Html, IntoResponse},
    routing::get,
    Extension, Router,
};
use metrics_exporter_prometheus::PrometheusHandle;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tower_http::cors::CorsLayer;

use mk_engine::action_pipeline::{apply_legal_action, initial_events, ApplyError};
use mk_engine::client_state::to_client_state;
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::create_multiplayer_game;
use mk_engine::undo::UndoStack;
use mk_env::training_scenario::{create_training_game, TrainingScenario};
use mk_types::client_state::ClientGameState;
use mk_types::enums::{Hero, RoundPhase};
use mk_types::events::GameEvent;
use mk_types::ids::PlayerId;
use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

// =============================================================================
// Wire protocol types
// =============================================================================

const DEFAULT_PLAYER_ID: &str = "player_0";
const HOTSEAT_PLAYER_ID_PREFIX: &str = "player_";

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    NewGame {
        #[serde(default)]
        hero: Option<Hero>,
        #[serde(default)]
        seed: Option<u32>,
        /// Optional JSON string for TrainingScenario (e.g. ExplorationDrill).
        #[serde(default)]
        scenario: Option<String>,
        #[serde(default, rename = "launchMode")]
        launch_mode: Option<LaunchMode>,
        #[serde(default, rename = "scenarioId")]
        scenario_id: Option<String>,
        #[serde(default)]
        players: Option<Vec<NewGamePlayer>>,
    },
    Action {
        action: LegalAction,
        epoch: u64,
    },
    Ping,
    Undo,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum LaunchMode {
    Solo,
    Hotseat,
    Online,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewGamePlayer {
    player_id: String,
    hero: Hero,
}

static GENERATED_SEED_COUNTER: AtomicU32 = AtomicU32::new(0);

fn generate_seed() -> u32 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0);
    let counter = GENERATED_SEED_COUNTER.fetch_add(1, Ordering::Relaxed);
    let mixed = nanos ^ nanos.rotate_left(17) ^ u64::from(counter);
    (mixed as u32) ^ ((mixed >> 32) as u32)
}

fn resolve_new_game_seed(seed: Option<u32>) -> u32 {
    seed.unwrap_or_else(generate_seed)
}

/// Parse a scenario string: either a named preset or raw JSON.
fn parse_scenario_string(s: &str) -> Result<TrainingScenario, String> {
    match s {
        "exploration" => Ok(TrainingScenario::ExplorationDrill {
            countryside_count: Some(4),
            core_tile_count: None,
            hand_override: None,
            extra_cards: None,
            starting_move_points: None,
        }),
        "exploration_tiny" => Ok(TrainingScenario::ExplorationDrill {
            countryside_count: Some(2),
            core_tile_count: None,
            hand_override: None,
            extra_cards: None,
            starting_move_points: None,
        }),
        // First Recon layout (8 countryside + 2 core + 1 city), no enemies,
        // march deck for unlimited movement, 100 starting move points.
        "recon_explore" => Ok(TrainingScenario::ExplorationDrill {
            countryside_count: Some(8),
            core_tile_count: Some(2),
            hand_override: Some(vec!["march".into(); 5]),
            extra_cards: Some(vec!["march".into(); 20]),
            starting_move_points: Some(1000),
        }),
        _ => serde_json::from_str(s)
            .map_err(|e| format!("Unknown preset '{s}' and invalid JSON: {e}")),
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    StateUpdate {
        state: Box<ClientGameState>,
        events: Vec<GameEvent>,
        legal_actions: Vec<LegalAction>,
        epoch: u64,
    },
    Error {
        message: String,
    },
    Pong,
}

// =============================================================================
// Game session
// =============================================================================

#[derive(Debug)]
struct GameSession {
    state: GameState,
    undo_stack: UndoStack,
    view: SessionView,
    /// Pending events from the last action, consumed by `make_update`.
    pending_events: Vec<GameEvent>,
}

#[derive(Debug)]
enum SessionView {
    Solo { player_id: PlayerId },
    Hotseat,
}

impl GameSession {
    fn new_solo(seed: u32, hero: Hero, scenario: &TrainingScenario) -> Self {
        let result = create_training_game(seed, hero, scenario);
        let events = initial_events(&result.state, seed, hero);
        Self {
            state: result.state,
            undo_stack: result.undo_stack,
            view: SessionView::Solo {
                player_id: PlayerId::from(DEFAULT_PLAYER_ID),
            },
            pending_events: events,
        }
    }

    fn new_hotseat(
        seed: u32,
        scenario_id: &str,
        players: &[NewGamePlayer],
    ) -> Result<Self, String> {
        let player_count = players.len();
        if !(2..=4).contains(&player_count) {
            return Err(format!("Hotseat requires 2-4 players, got {player_count}."));
        }

        for (index, player) in players.iter().enumerate() {
            let expected_player_id = format!("{HOTSEAT_PLAYER_ID_PREFIX}{index}");
            if player.player_id != expected_player_id {
                return Err(format!(
                    "Hotseat player at seat {} must use playerId '{}'.",
                    index + 1,
                    expected_player_id
                ));
            }
        }

        let scenario_config = mk_data::scenarios::get_scenario(scenario_id)
            .ok_or_else(|| format!("Unknown scenarioId '{scenario_id}'."))?;

        let player_count_u32 = player_count as u32;
        if player_count_u32 < scenario_config.min_players
            || player_count_u32 > scenario_config.max_players
        {
            return Err(format!(
                "Scenario '{scenario_id}' requires {}-{} players, got {player_count}.",
                scenario_config.min_players, scenario_config.max_players
            ));
        }

        let heroes: Vec<Hero> = players.iter().map(|player| player.hero).collect();
        let state = create_multiplayer_game(seed, &heroes, scenario_config, scenario_id);
        let first_hero = heroes
            .first()
            .copied()
            .ok_or_else(|| "Hotseat requires at least one hero.".to_string())?;
        let active_player_id = state
            .current_tactic_selector
            .clone()
            .or_else(|| state.turn_order.first().cloned())
            .unwrap_or_else(|| PlayerId::from(DEFAULT_PLAYER_ID));
        let events = vec![
            GameEvent::GameStarted {
                seed,
                hero: first_hero,
            },
            GameEvent::TurnStarted {
                player_id: active_player_id,
                round: state.round,
                time_of_day: state.time_of_day,
            },
        ];

        Ok(Self {
            state,
            undo_stack: UndoStack::new(),
            view: SessionView::Hotseat,
            pending_events: events,
        })
    }

    fn make_update(&mut self) -> ServerMessage {
        let player_idx = self.view_player_idx();
        let player_id = self.state.players[player_idx].id.clone();
        let client_state = to_client_state(&self.state, &player_id);
        let action_set =
            enumerate_legal_actions_with_undo(&self.state, player_idx, &self.undo_stack);
        let events = std::mem::take(&mut self.pending_events);

        ServerMessage::StateUpdate {
            epoch: action_set.epoch,
            legal_actions: action_set.actions,
            state: Box::new(client_state),
            events,
        }
    }

    fn apply_action(&mut self, action: &LegalAction, epoch: u64) -> Result<(), ApplyError> {
        let player_idx = self.view_player_idx();
        let result = apply_legal_action(
            &mut self.state,
            &mut self.undo_stack,
            player_idx,
            action,
            epoch,
        )?;
        self.pending_events = result.events;
        Ok(())
    }

    fn undo(&mut self) -> bool {
        if let Some(restored) = self.undo_stack.undo() {
            self.state = restored;
            let player_idx = self.view_player_idx();
            self.pending_events = vec![GameEvent::Undone {
                player_id: self.state.players[player_idx].id.clone(),
            }];
            true
        } else {
            false
        }
    }

    fn view_player_idx(&self) -> usize {
        let player_id = match &self.view {
            SessionView::Solo { player_id } => player_id.clone(),
            SessionView::Hotseat => self.hotseat_active_player_id(),
        };

        self.state
            .players
            .iter()
            .position(|player| player.id == player_id)
            .unwrap_or(0)
    }

    fn hotseat_active_player_id(&self) -> PlayerId {
        match self.state.round_phase {
            RoundPhase::TacticsSelection => self
                .state
                .current_tactic_selector
                .clone()
                .unwrap_or_else(|| self.first_player_id()),
            RoundPhase::PlayerTurns => {
                let idx = self.state.current_player_index as usize;
                self.state
                    .turn_order
                    .get(idx)
                    .cloned()
                    .unwrap_or_else(|| self.first_player_id())
            }
        }
    }

    fn first_player_id(&self) -> PlayerId {
        self.state
            .players
            .first()
            .map(|player| player.id.clone())
            .unwrap_or_else(|| PlayerId::from(DEFAULT_PLAYER_ID))
    }
}

fn create_session_from_new_game(
    hero: Option<Hero>,
    seed: Option<u32>,
    scenario: Option<String>,
    launch_mode: Option<LaunchMode>,
    scenario_id: Option<String>,
    players: Option<Vec<NewGamePlayer>>,
) -> Result<GameSession, String> {
    let seed = resolve_new_game_seed(seed);
    match launch_mode.unwrap_or(LaunchMode::Solo) {
        LaunchMode::Solo => {
            let hero = hero.ok_or_else(|| "Solo new_game requires hero.".to_string())?;
            let training_scenario = match scenario.as_deref() {
                None | Some("") => TrainingScenario::FullGame,
                Some(s) => parse_scenario_string(s)?,
            };
            Ok(GameSession::new_solo(seed, hero, &training_scenario))
        }
        LaunchMode::Hotseat => {
            let scenario_id =
                scenario_id.ok_or_else(|| "Hotseat new_game requires scenarioId.".to_string())?;
            let players =
                players.ok_or_else(|| "Hotseat new_game requires players.".to_string())?;
            GameSession::new_hotseat(seed, &scenario_id, &players)
        }
        LaunchMode::Online => Err("Online launch mode is not supported by this server yet.".into()),
    }
}

// =============================================================================
// WebSocket handler
// =============================================================================

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    let mut session: Option<GameSession> = None;

    while let Some(msg) = socket.recv().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(_) => return, // client disconnected
        };

        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => return,
            _ => continue, // ignore binary/ping/pong
        };

        let client_msg: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let _ = send_json(
                    &mut socket,
                    &ServerMessage::Error {
                        message: format!("Invalid JSON: {e}"),
                    },
                )
                .await;
                continue;
            }
        };

        let response = match client_msg {
            ClientMessage::NewGame {
                hero,
                seed,
                scenario,
                launch_mode,
                scenario_id,
                players,
            } => {
                match create_session_from_new_game(
                    hero,
                    seed,
                    scenario,
                    launch_mode,
                    scenario_id,
                    players,
                ) {
                    Ok(mut s) => {
                        let update = s.make_update();
                        session = Some(s);
                        update
                    }
                    Err(e) => {
                        let _ = send_json(
                            &mut socket,
                            &ServerMessage::Error {
                                message: format!("Invalid new_game: {e}"),
                            },
                        )
                        .await;
                        continue;
                    }
                }
            }

            ClientMessage::Action { action, epoch } => match session.as_mut() {
                None => ServerMessage::Error {
                    message: "No active game. Send new_game first.".into(),
                },
                Some(s) => match s.apply_action(&action, epoch) {
                    Ok(()) => s.make_update(),
                    Err(ApplyError::StaleActionSet { expected, got }) => ServerMessage::Error {
                        message: format!(
                            "Stale epoch: state is at {expected}, you sent {got}. Re-fetch actions."
                        ),
                    },
                    Err(ApplyError::InternalError(msg)) => ServerMessage::Error {
                        message: format!("Internal error: {msg}"),
                    },
                },
            },

            ClientMessage::Ping => ServerMessage::Pong,

            ClientMessage::Undo => match session.as_mut() {
                None => ServerMessage::Error {
                    message: "No active game. Send new_game first.".into(),
                },
                Some(s) => {
                    if s.undo() {
                        s.make_update()
                    } else {
                        ServerMessage::Error {
                            message: "Nothing to undo.".into(),
                        }
                    }
                }
            },
        };

        if send_json(&mut socket, &response).await.is_err() {
            return; // client disconnected
        }
    }
}

async fn send_json(socket: &mut WebSocket, msg: &ServerMessage) -> Result<(), axum::Error> {
    let json = serde_json::to_string(msg).expect("ServerMessage should serialize");
    socket.send(Message::Text(json.into())).await
}

// =============================================================================
// Routes & main
// =============================================================================

async fn health() -> &'static str {
    "mk-server ok"
}

async fn metrics_handler(Extension(handle): Extension<PrometheusHandle>) -> String {
    handle.render()
}

async fn index() -> Html<&'static str> {
    Html(
        r#"<!DOCTYPE html>
<html><head><title>MK Server</title></head>
<body>
<h1>Mage Knight WebSocket Server</h1>
<p>Connect via WebSocket at <code>/ws</code></p>
<pre>
// Example:
const ws = new WebSocket("ws://localhost:3030/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({ type: "new_game", hero: "arythea", seed: 42 }));
</pre>
</body></html>"#,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::ids::TacticId;

    #[test]
    fn new_game_without_seed_deserializes_as_unseeded() {
        let msg: ClientMessage =
            serde_json::from_str(r#"{"type":"new_game","hero":"arythea"}"#).unwrap();

        match msg {
            ClientMessage::NewGame { seed, .. } => assert_eq!(seed, None),
            _ => panic!("expected new_game"),
        }
    }

    #[test]
    fn new_game_with_seed_preserves_explicit_seed() {
        let msg: ClientMessage =
            serde_json::from_str(r#"{"type":"new_game","hero":"arythea","seed":12345}"#).unwrap();

        match msg {
            ClientMessage::NewGame { seed, .. } => assert_eq!(seed, Some(12345)),
            _ => panic!("expected new_game"),
        }
    }

    #[test]
    fn ping_message_deserializes() {
        let msg: ClientMessage = serde_json::from_str(r#"{"type":"ping"}"#).unwrap();

        match msg {
            ClientMessage::Ping => {}
            _ => panic!("expected ping"),
        }
    }

    #[test]
    fn generated_seed_is_not_fixed() {
        let first = resolve_new_game_seed(None);
        let second = resolve_new_game_seed(None);

        assert_ne!(first, second);
    }

    #[test]
    fn hotseat_new_game_deserializes() {
        let msg: ClientMessage = serde_json::from_str(
            r#"{
                "type":"new_game",
                "launchMode":"hotseat",
                "scenarioId":"full_conquest_2p",
                "players":[
                    {"playerId":"player_0","hero":"arythea"},
                    {"playerId":"player_1","hero":"tovak"}
                ]
            }"#,
        )
        .unwrap();

        match msg {
            ClientMessage::NewGame {
                launch_mode,
                scenario_id,
                players,
                ..
            } => {
                assert_eq!(launch_mode, Some(LaunchMode::Hotseat));
                assert_eq!(scenario_id.as_deref(), Some("full_conquest_2p"));
                assert_eq!(players.unwrap().len(), 2);
            }
            _ => panic!("expected new_game"),
        }
    }

    #[test]
    fn hotseat_rejects_unknown_scenario() {
        let result = create_session_from_new_game(
            None,
            Some(42),
            None,
            Some(LaunchMode::Hotseat),
            Some("unknown".to_string()),
            Some(vec![
                NewGamePlayer {
                    player_id: "player_0".to_string(),
                    hero: Hero::Arythea,
                },
                NewGamePlayer {
                    player_id: "player_1".to_string(),
                    hero: Hero::Tovak,
                },
            ]),
        );

        assert!(result.unwrap_err().contains("Unknown scenarioId"));
    }

    #[test]
    fn hotseat_rejects_wrong_player_count_for_scenario() {
        let result = create_session_from_new_game(
            None,
            Some(42),
            None,
            Some(LaunchMode::Hotseat),
            Some("full_conquest_3p".to_string()),
            Some(vec![
                NewGamePlayer {
                    player_id: "player_0".to_string(),
                    hero: Hero::Arythea,
                },
                NewGamePlayer {
                    player_id: "player_1".to_string(),
                    hero: Hero::Tovak,
                },
            ]),
        );

        assert!(result.unwrap_err().contains("requires 3-3 players"));
    }

    #[test]
    fn hotseat_creates_full_conquest_2p_session() {
        let session = create_session_from_new_game(
            None,
            Some(42),
            None,
            Some(LaunchMode::Hotseat),
            Some("full_conquest_2p".to_string()),
            Some(vec![
                NewGamePlayer {
                    player_id: "player_0".to_string(),
                    hero: Hero::Arythea,
                },
                NewGamePlayer {
                    player_id: "player_1".to_string(),
                    hero: Hero::Tovak,
                },
            ]),
        )
        .unwrap();

        assert_eq!(session.state.players.len(), 2);
        assert_eq!(session.state.scenario_config.total_rounds, 6);
        assert!(session.state.dummy_player.is_none());
    }

    #[test]
    fn hotseat_creates_blitz_conquest_2p_session() {
        let session = create_session_from_new_game(
            None,
            Some(42),
            None,
            Some(LaunchMode::Hotseat),
            Some("blitz_conquest_2p".to_string()),
            Some(vec![
                NewGamePlayer {
                    player_id: "player_0".to_string(),
                    hero: Hero::Arythea,
                },
                NewGamePlayer {
                    player_id: "player_1".to_string(),
                    hero: Hero::Tovak,
                },
            ]),
        )
        .unwrap();

        assert_eq!(session.state.players.len(), 2);
        assert_eq!(session.state.scenario_config.total_rounds, 4);
        assert!(session.state.dummy_player.is_none());
    }

    #[test]
    fn hotseat_updates_use_current_tactic_selector() {
        let mut session = create_session_from_new_game(
            None,
            Some(42),
            None,
            Some(LaunchMode::Hotseat),
            Some("full_conquest_2p".to_string()),
            Some(vec![
                NewGamePlayer {
                    player_id: "player_0".to_string(),
                    hero: Hero::Arythea,
                },
                NewGamePlayer {
                    player_id: "player_1".to_string(),
                    hero: Hero::Tovak,
                },
            ]),
        )
        .unwrap();

        assert_eq!(session.view_player_idx(), 1);
        let update = session.make_update();
        let epoch = match update {
            ServerMessage::StateUpdate {
                legal_actions,
                epoch,
                ..
            } => {
                assert!(legal_actions.iter().any(|action| {
                    matches!(
                        action,
                        LegalAction::SelectTactic { tactic_id }
                            if tactic_id.as_str() == "early_bird"
                    )
                }));
                epoch
            }
            _ => panic!("expected state update"),
        };

        session
            .apply_action(
                &LegalAction::SelectTactic {
                    tactic_id: TacticId::from("early_bird"),
                },
                epoch,
            )
            .unwrap();

        assert_eq!(session.view_player_idx(), 0);
    }
}

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3030);

    let prometheus_handle = metrics_exporter_prometheus::PrometheusBuilder::new()
        .install_recorder()
        .expect("failed to install Prometheus metrics recorder");

    let upkeep_handle = prometheus_handle.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            upkeep_handle.run_upkeep();
        }
    });

    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .layer(Extension(prometheus_handle));

    let addr = format!("0.0.0.0:{port}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            eprintln!("Failed to bind to {addr}: {e}");
            eprintln!("Hint: kill the old process with `lsof -ti:{port} | xargs kill`");
            std::process::exit(1);
        });
    println!("mk-server listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}
