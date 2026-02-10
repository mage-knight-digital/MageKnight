import type { ClientGameState, GameEvent, PlayerAction } from "@mage-knight/shared";

export const CONNECTION_STATUS_CONNECTING = "connecting" as const;
export const CONNECTION_STATUS_CONNECTED = "connected" as const;
export const CONNECTION_STATUS_RECONNECTING = "reconnecting" as const;
export const CONNECTION_STATUS_DISCONNECTED = "disconnected" as const;
export const CONNECTION_STATUS_ERROR = "error" as const;

export type ConnectionStatus =
  | typeof CONNECTION_STATUS_CONNECTING
  | typeof CONNECTION_STATUS_CONNECTED
  | typeof CONNECTION_STATUS_RECONNECTING
  | typeof CONNECTION_STATUS_DISCONNECTED
  | typeof CONNECTION_STATUS_ERROR;

export interface ConnectionStatusInfo {
  status: ConnectionStatus;
  error?: string;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
}

interface ClientActionMessage {
  type: "action";
  action: PlayerAction;
}

interface StateUpdateMessage {
  type: "state_update";
  events: readonly GameEvent[];
  state: ClientGameState;
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type ServerMessage = StateUpdateMessage | ErrorMessage;

export interface WebSocketConnectionOptions {
  gameId: string;
  playerId: string;
  serverUrl: string;
  onStateUpdate: (events: readonly GameEvent[], state: ClientGameState) => void;
  onStatusChange: (status: ConnectionStatusInfo) => void;
  reconnectBaseDelay?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_RECONNECT_BASE_DELAY = 500;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const SESSION_STORAGE_KEY_PREFIX = "mage_knight_session_";

/**
 * WebSocket connection manager for multiplayer games.
 * Handles connection lifecycle, reconnection with exponential backoff,
 * and session persistence for refresh recovery.
 */
export class WebSocketConnection {
  private readonly gameId: string;
  private readonly playerId: string;
  private readonly serverUrl: string;
  private readonly onStateUpdate: (events: readonly GameEvent[], state: ClientGameState) => void;
  private readonly onStatusChange: (status: ConnectionStatusInfo) => void;
  private readonly reconnectBaseDelay: number;
  private readonly maxReconnectAttempts: number;

  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;
  private currentStatus: ConnectionStatus = CONNECTION_STATUS_CONNECTING;
  private sessionToken: string | null = null;

  constructor(options: WebSocketConnectionOptions) {
    this.gameId = options.gameId;
    this.playerId = options.playerId;
    this.serverUrl = options.serverUrl;
    this.onStateUpdate = options.onStateUpdate;
    this.onStatusChange = options.onStatusChange;
    this.reconnectBaseDelay = options.reconnectBaseDelay ?? DEFAULT_RECONNECT_BASE_DELAY;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;

    // Try to restore session from storage
    this.loadSession();
  }

  /**
   * Establish WebSocket connection to the server.
   */
  connect(): void {
    this.isManualDisconnect = false;
    this.updateStatus(CONNECTION_STATUS_CONNECTING);

    const url = this.buildWebSocketUrl();
    console.log(`[WebSocket] Connecting to ${url}`);

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      this.updateStatus(CONNECTION_STATUS_ERROR, this.getErrorMessage(error));
      this.scheduleReconnect();
    }
  }

  /**
   * Send a player action to the server.
   */
  sendAction(action: PlayerAction): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send action - not connected");
      return;
    }

    const message: ClientActionMessage = {
      type: "action",
      action,
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log("[WebSocket] Sent action:", action.type);
    } catch (error) {
      console.error("[WebSocket] Failed to send action:", error);
    }
  }

  /**
   * Manually disconnect from the server.
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearReconnectTimeout();
    this.clearSession();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateStatus(CONNECTION_STATUS_DISCONNECTED);
  }

  /**
   * Get current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Store session token for reconnection.
   */
  setSessionToken(token: string): void {
    this.sessionToken = token;
    this.saveSession(token);
  }

  private buildWebSocketUrl(): string {
    const url = new URL(this.serverUrl);
    url.searchParams.set("gameId", this.gameId);
    url.searchParams.set("playerId", this.playerId);
    return url.toString();
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] Connection established");
      this.reconnectAttempt = 0;
      this.updateStatus(CONNECTION_STATUS_CONNECTED);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.handleServerMessage(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };

    this.ws.onerror = (event) => {
      console.error("[WebSocket] Connection error:", event);
      this.updateStatus(CONNECTION_STATUS_ERROR, "Connection error occurred");
    };

    this.ws.onclose = (event) => {
      console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`);
      this.ws = null;

      if (this.isManualDisconnect) {
        this.updateStatus(CONNECTION_STATUS_DISCONNECTED);
        return;
      }

      // Check if this is a terminal error (auth/session failure)
      if (this.isTerminalCloseCode(event.code)) {
        console.error("[WebSocket] Terminal error - session invalid or expired");
        this.updateStatus(
          CONNECTION_STATUS_ERROR,
          "Session expired or invalid. Please rejoin the game."
        );
        this.clearSession();
        return;
      }

      // Transient error - attempt reconnect
      this.scheduleReconnect();
    };
  }

  private handleServerMessage(message: ServerMessage): void {
    if (message.type === "state_update") {
      console.log(`[WebSocket] Received state update with ${message.events.length} events`);
      this.onStateUpdate(message.events, message.state);
    } else if (message.type === "error") {
      console.error("[WebSocket] Server error:", message.message);
      this.updateStatus(CONNECTION_STATUS_ERROR, message.message);
    }
  }

  private scheduleReconnect(): void {
    if (this.isManualDisconnect) {
      return;
    }

    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnect attempts reached");
      this.updateStatus(
        CONNECTION_STATUS_ERROR,
        `Failed to reconnect after ${this.maxReconnectAttempts} attempts`
      );
      return;
    }

    // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt);
    this.reconnectAttempt++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts})`);
    this.updateStatus(CONNECTION_STATUS_RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private isTerminalCloseCode(code: number): boolean {
    // 1008 = Policy Violation (invalid request)
    // 4001 = Replaced by another connection (custom code from server)
    return code === 1008 || code === 4001;
  }

  private updateStatus(status: ConnectionStatus, error?: string): void {
    this.currentStatus = status;

    const statusInfo: ConnectionStatusInfo = {
      status,
      error,
    };

    if (status === CONNECTION_STATUS_RECONNECTING) {
      statusInfo.reconnectAttempt = this.reconnectAttempt;
      statusInfo.maxReconnectAttempts = this.maxReconnectAttempts;
    }

    this.onStatusChange(statusInfo);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private getSessionStorageKey(): string {
    return `${SESSION_STORAGE_KEY_PREFIX}${this.gameId}`;
  }

  private saveSession(token: string): void {
    try {
      const sessionData = {
        gameId: this.gameId,
        playerId: this.playerId,
        sessionToken: token,
      };
      sessionStorage.setItem(this.getSessionStorageKey(), JSON.stringify(sessionData));
      console.log("[WebSocket] Session saved for refresh recovery");
    } catch (error) {
      console.warn("[WebSocket] Failed to save session:", error);
    }
  }

  private loadSession(): void {
    try {
      const key = this.getSessionStorageKey();
      const data = sessionStorage.getItem(key);
      if (data) {
        const session = JSON.parse(data) as { sessionToken: string };
        this.sessionToken = session.sessionToken;
        console.log("[WebSocket] Session restored from storage");
      }
    } catch (error) {
      console.warn("[WebSocket] Failed to load session:", error);
    }
  }

  private clearSession(): void {
    try {
      sessionStorage.removeItem(this.getSessionStorageKey());
      this.sessionToken = null;
      console.log("[WebSocket] Session cleared");
    } catch (error) {
      console.warn("[WebSocket] Failed to clear session:", error);
    }
  }
}
