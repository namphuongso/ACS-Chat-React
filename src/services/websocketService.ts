import { WebSocketAdapter } from '../adapters/websocket/websocketAdapter';
import { mapWsRoomEventToDomainEvent } from '../adapters/websocket/websocketMappers';
import {
  DEFAULT_HEARTBEAT_INTERVAL_SEC,
  DEFAULT_HEARTBEAT_TIMEOUT_SEC,
  WS_CLOSE_CODE_DUPLICATE_SESSION,
  WS_CLOSE_CODE_NORMAL,
} from '../constants/websocket';
import { useChatStore } from '../store/chatStore';
import type { ChatConfig, ReconnectPolicy } from '../types/config.types';
import type { ChatDomainEvent } from '../types/events.types';
import type {
  WsClientMessage,
  WsConnectionState,
  WsServerMessage,
  WsServerRoomEventMessage,
} from '../types/websocket.types';
import { logger } from '../utils/logger';
import type { ChatService } from './chatService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// Safety net in case a connect() neither opens nor fails within a reasonable window.
const CONNECT_TIMEOUT_MS = 15000;

export type WsEventListenerFn = (event: ChatDomainEvent) => void;

/**
 * Service for orchestrating App-wide WebSocket Chat connection lifecycle,
 * heartbeat management, room state tracking, read receipts, and real-time room events.
 */
export class WebsocketService {
  private adapter: WebSocketAdapter | null = null;
  private config: ChatConfig | null = null;
  private chatServiceRef: ChatService | null = null;

  private sessionId: string | null = null;
  private heartbeatIntervalSec: number = DEFAULT_HEARTBEAT_INTERVAL_SEC;
  private heartbeatTimeoutSec: number = DEFAULT_HEARTBEAT_TIMEOUT_SEC;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

  private activeRoomId: string | null = null;
  private lastVisibleMessageIds = new Map<string, string>();

  private isExplicitlyClosed = false;
  private isReconnecting = false;
  private reconnectGeneration = 0;

  private customListeners = new Set<WsEventListenerFn>();

  /**
   * Set ChatService reference for bidirectional event dispatching.
   */
  public setChatService(service: ChatService): void {
    this.chatServiceRef = service;
  }

  /**
   * Initialize and open WebSocket connection if configuration is present.
   */
  public initialize(config: ChatConfig): void {
    if (this.adapter) {
      this.dispose();
    }

    this.reconnectGeneration++;
    this.config = config;
    this.isExplicitlyClosed = false;
    this.isReconnecting = false;

    // enableWebSocket === false always disables the WebSocket connection,
    // even if a URL is present.
    if (config.enableWebSocket === false) {
      logger.info('[WebsocketService] WebSocket disabled by configuration, skipping init.');
      return;
    }

    // Determine target WebSocket URL
    const url = config.websocketUrl || config.backendUrl;
    if (!url) {
      logger.warn('[WebsocketService] Cannot initialize WebSocket without a target URL.');
      return;
    }

    // Determine JWT access token
    let token = config.accessToken;
    if (!token && config.backendHeaders) {
      const authHeader =
        config.backendHeaders['Authorization'] || config.backendHeaders['authorization'];
      if (authHeader) {
        token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      }
    }
    if (!token) {
      token = config.token;
    }

    this.adapter = new WebSocketAdapter();

    this.adapter.onOpen(() => {
      logger.info('[WebsocketService] Connected to WebSocket server.');
      this.isReconnecting = false;
    });

    this.adapter.onMessage((message: WsServerMessage) => {
      this.handleServerMessage(message);
    });

    this.adapter.onError((err) => {
      logger.error('[WebsocketService] Error from WebSocket adapter:', err);
    });

    this.adapter.onClose((event: CloseEvent) => {
      this.handleClose(event);
    });

    // connect() resolves when the socket is actually open (onopen);
    // rejections here are non-fatal for initialization.
    void this.adapter
      .connect({
        url,
        accessToken: token || '',
        deviceId: config.deviceId,
        roomId: config.initialRoomId,
      })
      .catch((err) => {
        logger.error('[WebsocketService] Failed to establish initial WebSocket connection:', err);
      });
  }

  /**
   * Handle incoming messages from WebSocket server.
   */
  private handleServerMessage(message: WsServerMessage): void {
    if (!message || typeof message !== 'object') return;

    // Receiving any server message confirms the connection is alive
    this.disarmHeartbeatWatchdog();

    switch (message.type) {
      case 'connected': {
        this.sessionId = message.sessionId || null;
        if (
          typeof message.heartbeatIntervalSeconds === 'number' &&
          message.heartbeatIntervalSeconds > 0
        ) {
          this.heartbeatIntervalSec = message.heartbeatIntervalSeconds;
        }
        if (
          typeof message.heartbeatTimeoutSeconds === 'number' &&
          message.heartbeatTimeoutSeconds > 0
        ) {
          this.heartbeatTimeoutSec = message.heartbeatTimeoutSeconds;
        }

        logger.info(
          `[WebsocketService] Handshake complete. Session: ${this.sessionId}, Heartbeat Interval: ${this.heartbeatIntervalSec}s, Timeout: ${this.heartbeatTimeoutSec}s`
        );

        // Schedule periodic heartbeat
        this.startHeartbeatTimer();

        // If we were already in an active room before reconnecting, re-enter room
        if (this.activeRoomId) {
          const lastMsgId = this.lastVisibleMessageIds.get(this.activeRoomId);
          this.enterRoom(this.activeRoomId, lastMsgId);
        }

        // Notify chatService and custom listeners
        this.dispatchDomainEvent({
          type: 'ws:connected',
          conversationId: '',
          timestamp: new Date(),
          payload: {
            sessionId: this.sessionId,
            heartbeatIntervalSeconds: this.heartbeatIntervalSec,
            heartbeatTimeoutSeconds: this.heartbeatTimeoutSec,
          },
        });
        break;
      }

      case 'enter_room_ack': {
        logger.info(`[WebsocketService] Successfully entered room: ${this.activeRoomId}`);
        break;
      }

      case 'leave_ack': {
        logger.info('[WebsocketService] Successfully left room.');
        break;
      }

      case 'heartbeat_ack': {
        // Heartbeat confirmed by server
        break;
      }

      case 'read_ack': {
        logger.info('[WebsocketService] Read state updated:', message.readAtUtc, message.updated);
        break;
      }

      case 'error': {
        logger.warn(
          `[WebsocketService] Server returned error: [${message.errorCode}] ${message.message}`
        );
        this.dispatchDomainEvent({
          type: 'ws:error',
          conversationId: this.activeRoomId || '',
          timestamp: new Date(),
          payload: message,
        });
        break;
      }

      case 'room_event': {
        logger.debug(
          `[WebsocketService] Room event received: eventType=${String(
            message.eventType ?? message.EventType
          )}, roomId=${String(message.roomId ?? message.RoomId ?? '')}`
        );

        this.handleRoomEvent(message as WsServerRoomEventMessage);
        break;
      }

      default:
        logger.warn('[WebsocketService] Unknown message received from server:', message);
        break;
    }
  }

  /**
   * Handle server room_event push messages and update stores reactively and idempotently.
   */
  private handleRoomEvent(event: WsServerRoomEventMessage): void {
    const currentUserId = useChatStore.getState().currentUser?.id;
    const domainEvent = mapWsRoomEventToDomainEvent(event, currentUserId);
    if (domainEvent) {
      this.dispatchDomainEvent(domainEvent);
    }
  }

  /**
   * Dispatch domain event to ChatService and registered custom listeners.
   * The ChatService reference is injected via setChatService() before any
   * connection is established, so no module-level fallback is needed here.
   */
  private dispatchDomainEvent(event: ChatDomainEvent): void {
    const service = this.chatServiceRef;
    if (service) {
      try {
        service.handleDomainEvent(event);
      } catch (err) {
        logger.error('[WebsocketService] Error dispatching domain event to ChatService:', err);
      }
    } else {
      // Standalone usage (without setChatService) would otherwise swallow every
      // WS event silently; surface it so integration gaps are visible.
      logger.warn(
        '[WebsocketService] No ChatService bound (setChatService not called); ' +
          `dropping domain event type=${event.type}`
      );
    }

    for (const listener of this.customListeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('[WebsocketService] Error in custom listener:', err);
      }
    }
  }

  /**
   * Handle WebSocket close event with auto-reconnection logic.
   */
  private handleClose(event: CloseEvent): void {
    this.stopHeartbeatTimer();
    this.disarmHeartbeatWatchdog();

    this.dispatchDomainEvent({
      type: 'ws:disconnected',
      conversationId: '',
      timestamp: new Date(),
      payload: { code: event.code, reason: event.reason },
    });

    if (this.isExplicitlyClosed) {
      logger.info('[WebsocketService] Connection closed intentionally.');
      return;
    }

    if (event.code === WS_CLOSE_CODE_DUPLICATE_SESSION) {
      logger.info(
        `[WebsocketService] Connection closed by server due to duplicate session on another device (code: ${WS_CLOSE_CODE_DUPLICATE_SESSION}).`
      );
      return;
    }

    if (event.code === WS_CLOSE_CODE_NORMAL) {
      logger.info('[WebsocketService] Normal connection closure.');
      return;
    }

    // Unexpected disconnection -> Trigger automatic reconnect
    logger.warn(
      `[WebsocketService] WebSocket dropped (code: ${event.code}). Initiating auto-reconnect...`
    );
    void this.scheduleReconnect();
  }

  /**
   * Schedule reconnection with exponential backoff.
   */
  public async scheduleReconnect(): Promise<void> {
    if (this.isReconnecting || this.isExplicitlyClosed || !this.config) return;

    this.isReconnecting = true;
    const currentGeneration = this.reconnectGeneration;
    const policy = this.config.reconnectPolicy || DEFAULT_RECONNECT_POLICY;

    let attempt = 0;
    let delay = policy.initialDelayMs;

    while (
      attempt < policy.maxRetries &&
      !this.isExplicitlyClosed &&
      currentGeneration === this.reconnectGeneration
    ) {
      attempt++;
      logger.info(
        `[WebsocketService] Reconnection attempt ${attempt}/${policy.maxRetries} in ${delay}ms...`
      );
      await sleep(delay);

      if (this.isExplicitlyClosed || currentGeneration !== this.reconnectGeneration) break;

      try {
        const url = this.config?.websocketUrl || this.config?.backendUrl;
        let token = this.config?.accessToken;
        if (!token && this.config?.backendHeaders) {
          const authHeader =
            this.config.backendHeaders['Authorization'] ||
            this.config.backendHeaders['authorization'];
          if (authHeader) {
            token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
          }
        }
        if (!token) {
          token = this.config?.token;
        }

        if (this.adapter && url) {
          // Wait for the real onopen event instead of sleeping a fixed duration,
          // so slow connections are not mistaken for failures.
          let connectTimeout: ReturnType<typeof setTimeout> | null = null;
          try {
            await Promise.race([
              this.adapter.connect({
                url,
                accessToken: token || '',
                deviceId: this.config?.deviceId,
                roomId: this.activeRoomId || this.config?.initialRoomId,
              }),
              new Promise<void>((_, reject) => {
                connectTimeout = setTimeout(
                  () => reject(new Error('WebSocket connect timed out')),
                  CONNECT_TIMEOUT_MS
                );
              }),
            ]);
          } catch (connErr) {
            // Discard the hung / failed socket so subsequent retries create a fresh connection
            if (this.adapter) {
              this.adapter.disconnect(WS_CLOSE_CODE_NORMAL, 'Reconnect attempt failed or timed out');
            }
            throw connErr;
          } finally {
            if (connectTimeout) {
              clearTimeout(connectTimeout);
            }
          }
          if (this.adapter.isConnected()) {
            logger.info('[WebsocketService] Reconnection successful.');
            this.isReconnecting = false;
            return;
          }
        }
      } catch (err) {
        logger.error(`[WebsocketService] Reconnect attempt ${attempt} failed:`, err);
      }

      delay = Math.min(delay * policy.backoffMultiplier, policy.maxDelayMs);
    }

    if (currentGeneration === this.reconnectGeneration && !this.isExplicitlyClosed) {
      logger.error('[WebsocketService] Max reconnection retries reached. Stopping reconnection.');
    }
    this.isReconnecting = false;
  }

  /* -------------------------------------------------------------------------- */
  /*                            Heartbeat Management                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Start periodic heartbeat timer based on negotiated interval.
   */
  private startHeartbeatTimer(): void {
    this.stopHeartbeatTimer();
    const intervalMs = Math.max(this.heartbeatIntervalSec, 5) * 1000;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }

  /**
   * Stop periodic heartbeat timer and disarm any active watchdog.
   */
  private stopHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.disarmHeartbeatWatchdog();
  }

  /**
   * Arms watchdog timer expecting a response within heartbeatTimeoutSec.
   */
  private armHeartbeatWatchdog(): void {
    this.disarmHeartbeatWatchdog();
    if (this.heartbeatTimeoutSec <= 0) return;

    this.heartbeatWatchdogTimer = setTimeout(() => {
      logger.warn(
        `[WebsocketService] Heartbeat watchdog timeout (${this.heartbeatTimeoutSec}s expired without server ack). Disconnecting to trigger reconnect...`
      );
      if (this.adapter) {
        this.adapter.disconnect(WS_CLOSE_CODE_NORMAL, 'Heartbeat timeout');
      }
    }, this.heartbeatTimeoutSec * 1000);
  }

  /**
   * Disarms the watchdog timer when server responds.
   */
  private disarmHeartbeatWatchdog(): void {
    if (this.heartbeatWatchdogTimer) {
      clearTimeout(this.heartbeatWatchdogTimer);
      this.heartbeatWatchdogTimer = null;
    }
  }

  /**
   * Send heartbeat message to keep connection alive, optionally attaching lastVisibleMessageId.
   */
  public sendHeartbeat(lastVisibleMessageId?: string): boolean {
    if (!this.adapter || !this.adapter.isConnected()) {
      return false;
    }

    this.armHeartbeatWatchdog();

    const lastMsgId =
      lastVisibleMessageId ||
      (this.activeRoomId ? this.lastVisibleMessageIds.get(this.activeRoomId) : undefined);
    const msg: WsClientMessage = {
      type: 'heartbeat',
      lastVisibleMessageId: lastMsgId,
    };
    return this.adapter.send(msg);
  }

  /* -------------------------------------------------------------------------- */
  /*                              Room Operations                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Enter a chat room. Sets active room ID and sends enter_room to server.
   */
  public enterRoom(roomId: string, lastVisibleMessageId?: string): boolean {
    if (!roomId || roomId.trim() === '') {
      logger.warn('[WebsocketService] enterRoom called without roomId.');
      return false;
    }

    this.activeRoomId = roomId;

    if (lastVisibleMessageId) {
      this.lastVisibleMessageIds.set(roomId, lastVisibleMessageId);
    }

    if (!this.adapter || !this.adapter.isConnected()) {
      logger.info(
        `[WebsocketService] enterRoom recorded for ${roomId}, will dispatch upon connection.`
      );
      return false;
    }

    const msg: WsClientMessage = {
      type: 'enter_room',
      roomId,
      lastVisibleMessageId: lastVisibleMessageId || this.lastVisibleMessageIds.get(roomId),
    };
    return this.adapter.send(msg);
  }

  /**
   * Leave a chat room. Sends leave_room to server.
   * Note: Connection remains alive.
   */
  public leaveRoom(lastVisibleMessageId?: string): boolean {
    const currentActiveRoom = this.activeRoomId;
    if (lastVisibleMessageId && currentActiveRoom) {
      this.lastVisibleMessageIds.set(currentActiveRoom, lastVisibleMessageId);
    }

    this.activeRoomId = null;

    if (!this.adapter || !this.adapter.isConnected()) {
      return false;
    }

    const msg: WsClientMessage = {
      type: 'leave_room',
      lastVisibleMessageId:
        lastVisibleMessageId ||
        (currentActiveRoom ? this.lastVisibleMessageIds.get(currentActiveRoom) : undefined),
    };
    return this.adapter.send(msg);
  }

  /**
   * Send an immediate read acknowledgement for a specific message.
   */
  public sendRead(lastVisibleMessageId: string): boolean {
    if (!lastVisibleMessageId || lastVisibleMessageId.trim() === '') {
      logger.warn('[WebsocketService] sendRead called without lastVisibleMessageId.');
      return false;
    }

    if (this.activeRoomId) {
      this.lastVisibleMessageIds.set(this.activeRoomId, lastVisibleMessageId);
    }

    if (!this.adapter || !this.adapter.isConnected()) {
      return false;
    }

    const msg: WsClientMessage = {
      type: 'read',
      lastVisibleMessageId,
    };
    return this.adapter.send(msg);
  }

  /* -------------------------------------------------------------------------- */
  /*                            Lifecycle & Accessors                           */
  /* -------------------------------------------------------------------------- */

  /**
   * Subscribe to WebSocket-specific or normalized domain events.
   */
  public subscribe(listener: WsEventListenerFn): () => void {
    this.customListeners.add(listener);
    return () => {
      this.customListeners.delete(listener);
    };
  }

  /**
   * Check if WebSocket is currently connected.
   */
  public isConnected(): boolean {
    return this.adapter !== null && this.adapter.isConnected();
  }

  /**
   * Get current WebSocket connection state.
   */
  public getConnectionState(): WsConnectionState {
    return this.adapter ? this.adapter.getState() : 'disconnected';
  }

  /**
   * Get active sessionId assigned by server during connection.
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get currently active room ID.
   */
  public getActiveRoomId(): string | null {
    return this.activeRoomId;
  }

  /**
   * Teardown and cleanly close WebSocket connection.
   */
  public dispose(): void {
    this.isExplicitlyClosed = true;
    this.reconnectGeneration++;
    this.isReconnecting = false;
    this.stopHeartbeatTimer();
    this.disarmHeartbeatWatchdog();

    if (this.adapter) {
      this.adapter.disconnect(WS_CLOSE_CODE_NORMAL, 'Client disposed');
      this.adapter.clearListeners();
      this.adapter = null;
    }

    this.sessionId = null;
    this.activeRoomId = null;
    this.lastVisibleMessageIds.clear();
    this.customListeners.clear();
    this.heartbeatIntervalSec = DEFAULT_HEARTBEAT_INTERVAL_SEC;
    this.heartbeatTimeoutSec = DEFAULT_HEARTBEAT_TIMEOUT_SEC;
    this.chatServiceRef = null;
    this.config = null;
  }
}

/**
 * Singleton instance of WebsocketService for global application usage.
 */
export const websocketService = new WebsocketService();
