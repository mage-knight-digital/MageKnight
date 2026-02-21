//! WebSocket game server for Mage Knight.
//!
//! Protocol:
//! - Client sends JSON messages, server responds with game updates.
//! - Each WS connection owns one game session.
//!
//! Client → Server messages:
//!   { "type": "new_game", "hero": "arythea", "seed": 42 }
//!   { "type": "action", "action": <LegalAction>, "epoch": 5 }
//!   { "type": "undo" }
//!
//! Server → Client messages:
//!   { "type": "game_update", "state": <ClientGameState>, "legal_actions": [<LegalAction>], "epoch": 5 }
//!   { "type": "error", "message": "..." }

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

use mk_engine::action_pipeline::{apply_legal_action, ApplyError};
use mk_engine::client_state::to_client_state;
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_types::client_state::ClientGameState;
use mk_types::enums::Hero;
use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

// =============================================================================
// Wire protocol types
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    NewGame {
        hero: Hero,
        #[serde(default = "default_seed")]
        seed: u32,
    },
    Action {
        action: LegalAction,
        epoch: u64,
    },
    Undo,
}

fn default_seed() -> u32 {
    42
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    GameUpdate {
        state: Box<ClientGameState>,
        legal_actions: Vec<LegalAction>,
        epoch: u64,
    },
    Error {
        message: String,
    },
}

// =============================================================================
// Game session
// =============================================================================

struct GameSession {
    state: GameState,
    undo_stack: UndoStack,
    player_idx: usize,
}

impl GameSession {
    fn new(seed: u32, hero: Hero) -> Self {
        let mut state = create_solo_game(seed, hero);
        place_initial_tiles(&mut state);
        Self {
            state,
            undo_stack: UndoStack::new(),
            player_idx: 0,
        }
    }

    fn make_update(&self) -> ServerMessage {
        let player_id = self.state.players[self.player_idx].id.clone();
        let client_state = to_client_state(&self.state, &player_id);
        let action_set =
            enumerate_legal_actions_with_undo(&self.state, self.player_idx, &self.undo_stack);

        ServerMessage::GameUpdate {
            epoch: action_set.epoch,
            legal_actions: action_set.actions,
            state: Box::new(client_state),
        }
    }

    fn apply_action(&mut self, action: &LegalAction, epoch: u64) -> Result<(), ApplyError> {
        apply_legal_action(
            &mut self.state,
            &mut self.undo_stack,
            self.player_idx,
            action,
            epoch,
        )?;
        Ok(())
    }

    fn undo(&mut self) -> bool {
        if let Some(restored) = self.undo_stack.undo() {
            self.state = restored;
            true
        } else {
            false
        }
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
            ClientMessage::NewGame { hero, seed } => {
                let s = GameSession::new(seed, hero);
                let update = s.make_update();
                session = Some(s);
                update
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

async fn send_json(
    socket: &mut WebSocket,
    msg: &ServerMessage,
) -> Result<(), axum::Error> {
    let json = serde_json::to_string(msg).expect("ServerMessage should serialize");
    socket.send(Message::Text(json.into())).await
}

// =============================================================================
// Routes & main
// =============================================================================

async fn health() -> &'static str {
    "mk-server ok"
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

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3030);

    let app = Router::new()
        .route("/", get(index))
        .route("/health", get(health))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive());

    let addr = format!("0.0.0.0:{port}");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        eprintln!("Failed to bind to {addr}: {e}");
        eprintln!("Hint: kill the old process with `lsof -ti:{port} | xargs kill`");
        std::process::exit(1);
    });
    println!("mk-server listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}
