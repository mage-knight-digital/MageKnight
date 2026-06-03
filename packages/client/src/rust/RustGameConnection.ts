/**
 * WebSocket client for the Rust mk-server.
 *
 * Protocol:
 *   Client -> Server: { type: "new_game", ...config } | { type: "action", action, epoch } | { type: "ping" } | { type: "undo" }
 *   Server -> Client: { type: "state_update", state, events, legal_actions, epoch } | { type: "error", message } | { type: "pong" }
 */

import {
  GAME_LAUNCH_MODE_HOTSEAT,
  type GameConfig,
} from "@mage-knight/shared";
import type { ClientMessage, LegalAction, ServerMessage } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface RustGameConnectionOptions {
  serverUrl: string;
  onGameUpdate: (state: Record<string, unknown>, legalActions: LegalAction[], epoch: number, events: unknown[]) => void;
  onError: (message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;
const HEARTBEAT_INTERVAL_MS = 25_000;

type NewGameMessage = Extract<ClientMessage, { type: "new_game" }>;

export class RustGameConnection {
  private ws: WebSocket | null = null;
  private options: RustGameConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingNewGame: NewGameMessage | null = null;

  constructor(options: RustGameConnectionOptions) {
    this.options = options;
  }

  connect(): void {
    this.options.onStatusChange("connecting");
    this.ws = new WebSocket(this.options.serverUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onStatusChange("connected");
      this.startHeartbeat();
      // Send pending new_game if we have one
      if (this.pendingNewGame) {
        this.sendRaw(this.pendingNewGame);
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === "state_update") {
        this.options.onGameUpdate(msg.state, msg.legal_actions, msg.epoch, msg.events);
      } else if (msg.type === "error") {
        this.options.onError(msg.message);
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.options.onStatusChange("disconnected");
  }

  sendNewGame(config: GameConfig, seed?: number): void {
    const message = buildNewGameMessage(config, seed);
    this.pendingNewGame = message;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(message);
    }
  }

  sendAction(action: LegalAction, epoch: number): void {
    this.sendRaw({ type: "action", action, epoch });
  }

  sendUndo(): void {
    this.sendRaw({ type: "undo" });
  }

  private sendRaw(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: "ping" });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.options.onStatusChange("error");
      return;
    }

    this.reconnectAttempts++;
    this.options.onStatusChange("reconnecting");

    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

function buildNewGameMessage(config: GameConfig, seed?: number): NewGameMessage {
  if (config.launchMode === GAME_LAUNCH_MODE_HOTSEAT) {
    return {
      type: "new_game",
      seed,
      launchMode: config.launchMode,
      scenarioId: config.scenarioId,
      players: config.seats.map((seat) => ({
        playerId: seat.playerId,
        hero: seat.heroId,
      })),
    };
  }

  return {
    type: "new_game",
    hero: config.heroIds[0],
    seed,
    scenario: config.serverScenario,
  };
}
