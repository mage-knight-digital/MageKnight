/**
 * WebSocket client for the Rust mk-server.
 *
 * Protocol:
 *   Client -> Server: { type: "new_game", hero, seed } | { type: "action", action, epoch } | { type: "undo" }
 *   Server -> Client: { type: "game_update", state, legal_actions, epoch } | { type: "error", message }
 */

import type { LegalAction, ServerMessage } from "./types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface RustGameConnectionOptions {
  serverUrl: string;
  onGameUpdate: (state: Record<string, unknown>, legalActions: LegalAction[], epoch: number) => void;
  onError: (message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;

export class RustGameConnection {
  private ws: WebSocket | null = null;
  private options: RustGameConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingNewGame: { hero: string; seed?: number } | null = null;

  constructor(options: RustGameConnectionOptions) {
    this.options = options;
  }

  connect(): void {
    this.options.onStatusChange("connecting");
    this.ws = new WebSocket(this.options.serverUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onStatusChange("connected");
      // Send pending new_game if we have one
      if (this.pendingNewGame) {
        this.sendRaw({
          type: "new_game",
          hero: this.pendingNewGame.hero,
          seed: this.pendingNewGame.seed,
        });
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === "game_update") {
        this.options.onGameUpdate(msg.state, msg.legal_actions, msg.epoch);
      } else if (msg.type === "error") {
        this.options.onError(msg.message);
      }
    };

    this.ws.onclose = () => {
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
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.options.onStatusChange("disconnected");
  }

  sendNewGame(hero: string, seed?: number): void {
    this.pendingNewGame = { hero, seed };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: "new_game", hero, seed });
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
