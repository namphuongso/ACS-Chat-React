import type {
  WsClientMessage,
  WsServerMessage,
  WsConnectionState,
} from '../../types/websocket.types';
import { DEFAULT_WS_PATH, WS_CLOSE_CODE_NORMAL } from '../../constants/websocket';
import { logger } from '../../utils/logger';

export interface WebSocketAdapterOptions {
  /** Base URL or full WebSocket URL */
  url: string;
  /** JWT access token */
  accessToken: string;
  /** Optional device ID */
  deviceId?: string;
  /** Optional initial room ID */
  roomId?: string;
}

export type WsOpenHandler = () => void;
export type WsMessageHandler = (message: WsServerMessage) => void;
export type WsCloseHandler = (event: CloseEvent) => void;
export type WsErrorHandler = (error: Event) => void;

/**
 * Builds the full WebSocket URL with protocol normalization and query parameters.
 * Existing query parameters in the input URL are preserved and merged with the
 * session parameters instead of being clobbered.
 */
export function buildWebSocketUrl(options: WebSocketAdapterOptions): string {
  const { url, accessToken, deviceId, roomId } = options;

  let wsUrl = (url || '').trim();

  // Convert http/https to ws/wss
  if (wsUrl.startsWith('http://')) {
    wsUrl = 'ws://' + wsUrl.substring(7);
  } else if (wsUrl.startsWith('https://')) {
    wsUrl = 'wss://' + wsUrl.substring(8);
  } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    // Default to wss if no protocol
    wsUrl = `wss://${wsUrl}`;
  }

  // Remove trailing slash
  if (wsUrl.endsWith('/')) {
    wsUrl = wsUrl.slice(0, -1);
  }

  let urlObj: URL | null = null;
  try {
    urlObj = new URL(wsUrl);
  } catch {
    urlObj = null;
  }

  // Fall back to raw string concatenation if the URL cannot be parsed.
  if (!urlObj) {
    logger.warn('[WebSocketAdapter] URL could not be parsed by URL constructor; falling back to raw URL string:', wsUrl);
    return wsUrl;
  }

  // If URL doesn't contain a path, or ends with domain only, append DEFAULT_WS_PATH
  const hasWsPath =
    urlObj.pathname.includes('/ws/chat/view') || urlObj.pathname.includes('/ws/chat-view');
  if (!hasWsPath) {
    const basePath = urlObj.pathname.replace(/\/+$/, '');
    urlObj.pathname = `${basePath}${DEFAULT_WS_PATH}`;
  }

  // Merge with any existing query string (e.g. ?tenant=1)
  const queryParams = urlObj.searchParams;
  if (accessToken) {
    // Strip "Bearer " prefix if provided
    const cleanToken = accessToken.startsWith('Bearer ') ? accessToken.substring(7) : accessToken;
    queryParams.set('access_token', cleanToken);
  }

  if (deviceId) {
    queryParams.set('deviceId', deviceId);
  }

  if (roomId) {
    queryParams.set('roomId', roomId);
  }

  return urlObj.toString();
}

/**
 * Low-level adapter for managing raw WebSocket connection lifecycle and message transport.
 */
export class WebSocketAdapter {
  private ws: WebSocket | null = null;
  private connectionState: WsConnectionState = 'disconnected';
  private currentUrl: string = '';
  private pendingConnectReject: ((reason?: unknown) => void) | null = null;

  private onOpenCallbacks = new Set<WsOpenHandler>();
  private onMessageCallbacks = new Set<WsMessageHandler>();
  private onCloseCallbacks = new Set<WsCloseHandler>();
  private onErrorCallbacks = new Set<WsErrorHandler>();

  /**
   * Open WebSocket connection.
   *
   * The returned Promise resolves when the connection is actually open
   * (onopen fired) and rejects if the connection fails before opening
   * (onerror / onclose with no prior onopen), or if disconnect() is called
   * while the connection is still pending.
   */
  public connect(options: WebSocketAdapterOptions): Promise<void> {
    if (this.ws) {
      const state = this.ws.readyState;
      if (
        state === WebSocket.OPEN ||
        state === WebSocket.CONNECTING ||
        state === WebSocket.CLOSING
      ) {
        logger.warn('[WebSocketAdapter] Connection already in progress, open, or closing.');
        return Promise.resolve();
      }
      // Stale CLOSED socket: detach handlers so its onclose cannot null
      // out a freshly created connection, then discard it.
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = null;
    }

    this.currentUrl = buildWebSocketUrl(options);
    this.connectionState = 'connecting';

    return new Promise<void>((resolve, reject) => {
      let opened = false;
      this.pendingConnectReject = (reason?: unknown) => {
        if (!opened) {
          reject(reason);
        }
      };

      try {
        this.ws = new WebSocket(this.currentUrl);

        this.ws.onopen = () => {
          opened = true;
          this.pendingConnectReject = null;
          this.connectionState = 'connected';
          logger.info('[WebSocketAdapter] WebSocket connection established.');
          for (const cb of this.onOpenCallbacks) {
            try {
              cb();
            } catch (err) {
              logger.error('[WebSocketAdapter] Error in onOpen callback:', err);
            }
          }
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            if (typeof event.data !== 'string') return;
            const parsed = JSON.parse(event.data) as WsServerMessage;
            for (const cb of this.onMessageCallbacks) {
              try {
                cb(parsed);
              } catch (err) {
                logger.error('[WebSocketAdapter] Error in onMessage callback:', err);
              }
            }
          } catch (err) {
            logger.error('[WebSocketAdapter] Failed to parse message JSON:', err, event.data);
          }
        };

        this.ws.onerror = (error: Event) => {
          logger.error('[WebSocketAdapter] WebSocket error:', error);
          for (const cb of this.onErrorCallbacks) {
            try {
              cb(error);
            } catch (err) {
              logger.error('[WebSocketAdapter] Error in onError callback:', err);
            }
          }
          // Only transition to 'error' while the socket has not opened yet.
          // After opening, the eventual onclose event owns the state transition.
          if (!opened) {
            this.connectionState = 'error';
            this.pendingConnectReject = null;
            reject(error);
          }
        };

        this.ws.onclose = (event: CloseEvent) => {
          this.connectionState = 'disconnected';
          logger.info(`[WebSocketAdapter] WebSocket closed with code ${event.code}, reason: ${event.reason}`);
          if (!opened) {
            this.pendingConnectReject = null;
            reject(event);
          }
          for (const cb of this.onCloseCallbacks) {
            try {
              cb(event);
            } catch (err) {
              logger.error('[WebSocketAdapter] Error in onClose callback:', err);
            }
          }
          this.ws = null;
        };
      } catch (err) {
        this.connectionState = 'error';
        this.pendingConnectReject = null;
        logger.error('[WebSocketAdapter] Error creating WebSocket instance:', err);
        reject(err);
      }
    });
  }

  /**
   * Send a strongly-typed JSON message over the WebSocket connection.
   */
  public send(message: WsClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('[WebSocketAdapter] Cannot send message, WebSocket is not open.');
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
      return true;
    } catch (err) {
      logger.error('[WebSocketAdapter] Failed to serialize or send message:', err);
      return false;
    }
  }

  /**
   * Disconnect and close the underlying WebSocket connection.
   * Rejects any connect() promise still waiting for onopen so callers never
   * hang indefinitely.
   */
  public disconnect(code: number = WS_CLOSE_CODE_NORMAL, reason?: string): void {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close(code, reason);
      } catch (err) {
        logger.warn('[WebSocketAdapter] Error closing WebSocket:', err);
      }
    }
    this.connectionState = 'disconnected';

    const rejectPending = this.pendingConnectReject;
    this.pendingConnectReject = null;
    if (rejectPending) {
      rejectPending(new Error('WebSocket connection aborted: client disconnected'));
    }

    // Note: we intentionally synthesize a CloseEvent here because the socket
    // handlers are detached before close() is invoked. Consumers therefore
    // receive a locally-built event (wasClean: true) rather than the real
    // code/reason produced by the server during a normal server-side close.
    const closeEvent = new CloseEvent('close', { code, reason, wasClean: true });
    for (const cb of this.onCloseCallbacks) {
      try {
        cb(closeEvent);
      } catch (err) {
        logger.error('[WebSocketAdapter] Error in onClose callback:', err);
      }
    }
  }

  /**
   * Check if WebSocket is currently in OPEN state.
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state.
   */
  public getState(): WsConnectionState {
    return this.connectionState;
  }

  /**
   * Register onOpen listener.
   */
  public onOpen(handler: WsOpenHandler): () => void {
    this.onOpenCallbacks.add(handler);
    return () => {
      this.onOpenCallbacks.delete(handler);
    };
  }

  /**
   * Register onMessage listener.
   */
  public onMessage(handler: WsMessageHandler): () => void {
    this.onMessageCallbacks.add(handler);
    return () => {
      this.onMessageCallbacks.delete(handler);
    };
  }

  /**
   * Register onClose listener.
   */
  public onClose(handler: WsCloseHandler): () => void {
    this.onCloseCallbacks.add(handler);
    return () => {
      this.onCloseCallbacks.delete(handler);
    };
  }

  /**
   * Register onError listener.
   */
  public onError(handler: WsErrorHandler): () => void {
    this.onErrorCallbacks.add(handler);
    return () => {
      this.onErrorCallbacks.delete(handler);
    };
  }

  /**
   * Remove all registered listeners.
   */
  public clearListeners(): void {
    this.onOpenCallbacks.clear();
    this.onMessageCallbacks.clear();
    this.onCloseCallbacks.clear();
    this.onErrorCallbacks.clear();
  }
}
