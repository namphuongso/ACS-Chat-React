import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebsocketService } from '../../services/websocketService';
import { ChatService } from '../../services/chatService';
import { useChatStore } from '../../store/chatStore';
import { useConversationStore } from '../../store/conversationStore';
import { useMessageStore } from '../../store/messageStore';
import { useParticipantStore } from '../../store/participantStore';
import type { ChatConfig } from '../../types/config.types';
import type {
  WsServerConnectedMessage,
  WsServerRoomEventMessage,
  WsNewMessagePayload,
} from '../../types/websocket.types';

// Mock ACS SDK modules to avoid actual network calls
vi.mock('@azure/communication-common', () => {
  return {
    AzureCommunicationTokenCredential: vi.fn().mockImplementation(() => ({
      getToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresOn: new Date() }),
      dispose: vi.fn(),
    })),
  };
});

vi.mock('@azure/communication-chat', () => {
  return {
    ChatClient: vi.fn().mockImplementation(() => ({
      getChatThreadClient: vi.fn().mockReturnValue({}),
    })),
  };
});

// Mock WebSocket
class MockWebSocket {
  public static OPEN = 1;
  public static CONNECTING = 0;
  public static CLOSING = 2;
  public static CLOSED = 3;

  public readyState = MockWebSocket.OPEN;
  public url: string;
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: { code: number; reason: string }) => void) | null = null;
  public sentData: string[] = [];

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  public send(data: string): void {
    this.sentData.push(data);
  }

  public close(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('WebsocketService', () => {
  let wsService: WebsocketService;
  const originalWebSocket = global.WebSocket;

  const mockConfig: ChatConfig = {
    endpoint: 'https://example.communication.azure.com',
    userId: 'user-1',
    displayName: 'Alice',
    token: 'token-123',
    tokenRefresher: async () => 'refreshed-token',
    backendUrl: 'https://example.com',
    accessToken: 'jwt-token-456',
  };

  beforeEach(() => {
    // @ts-expect-error mocking global WebSocket
    global.WebSocket = MockWebSocket;

    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();

    useChatStore.getState().setCurrentUser({ id: 'user-1', displayName: 'Alice' });

    wsService = new WebsocketService();
  });

  afterEach(() => {
    wsService.dispose();
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  it('should initialize and connect successfully', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });
  });

  it('should handle connected handshake message and setup heartbeat', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    const connectedMsg: WsServerConnectedMessage = {
      type: 'connected',
      sessionId: 'session-xyz',
      heartbeatIntervalSeconds: 30,
      heartbeatTimeoutSeconds: 90,
    };

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    helper.adapter.ws.onmessage?.({ data: JSON.stringify(connectedMsg) });

    expect(wsService.getSessionId()).toBe('session-xyz');
  });

  it('should enter room and send enter_room message', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    const success = wsService.enterRoom('room-123', 'last-msg-1');
    expect(success).toBe(true);
    expect(wsService.getActiveRoomId()).toBe('room-123');

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;

    const lastSent = JSON.parse(ws.sentData[ws.sentData.length - 1]);
    expect(lastSent).toEqual({
      type: 'enter_room',
      roomId: 'room-123',
      lastVisibleMessageId: 'last-msg-1',
    });
  });

  it('should leave room and send leave_room message', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    wsService.enterRoom('room-123');
    wsService.leaveRoom('last-msg-1');

    expect(wsService.getActiveRoomId()).toBeNull();

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;

    const lastSent = JSON.parse(ws.sentData[ws.sentData.length - 1]);
    expect(lastSent).toEqual({
      type: 'leave_room',
      lastVisibleMessageId: 'last-msg-1',
    });
  });

  it('should reconnect after unexpected close and re-enter the active room', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    wsService.enterRoom('room-123');

    // Simulate an unexpected server-side close (not the duplicate-session code)
    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    helper.adapter.ws.onclose?.({ code: 1006, reason: 'connection dropped' });
    expect(wsService.isConnected()).toBe(false);

    // Reconnect should succeed (MockWebSocket opens automatically) and the
    // previously active room must be re-entered after the handshake.
    await vi.waitFor(
      () => {
        expect(wsService.isConnected()).toBe(true);
      },
      { timeout: 5000 }
    );

    const reconnectedHelper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = reconnectedHelper.adapter.ws;
    ws.onmessage?.({
      data: JSON.stringify({
        type: 'connected',
        sessionId: 'session-2',
        heartbeatIntervalSeconds: 25,
        heartbeatTimeoutSeconds: 75,
      }),
    });

    const lastSent = JSON.parse(ws.sentData[ws.sentData.length - 1]);
    expect(lastSent).toEqual({
      type: 'enter_room',
      roomId: 'room-123',
    });
  });

  it('should send read receipt via sendRead and deduplicate repeated calls in active room', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    wsService.enterRoom('room-100');

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;
    const initialSentCount = ws.sentData.length;

    const success1 = wsService.sendRead('msg-999');
    expect(success1).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    const lastSent = JSON.parse(ws.sentData[ws.sentData.length - 1]);
    expect(lastSent).toEqual({
      type: 'read',
      lastVisibleMessageId: 'msg-999',
    });

    // Second call with same messageId in active room should be deduplicated
    const success2 = wsService.sendRead('msg-999');
    expect(success2).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1); // No new WS frame sent
  });

  it('should deduplicate sendRead calls globally when activeRoomId is not set', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    expect(wsService.getActiveRoomId()).toBeNull();

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;
    const initialSentCount = ws.sentData.length;

    const success1 = wsService.sendRead('msg-global-1');
    expect(success1).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    const lastSent = JSON.parse(ws.sentData[ws.sentData.length - 1]);
    expect(lastSent).toEqual({
      type: 'read',
      lastVisibleMessageId: 'msg-global-1',
    });

    // Second call without active room should be deduplicated globally
    const success2 = wsService.sendRead('msg-global-1');
    expect(success2).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    // Sending a different message ID sends a new frame
    const success3 = wsService.sendRead('msg-global-2');
    expect(success3).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 2);
  });

  it('should deduplicate sendRead calls per explicit roomId', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;
    const initialSentCount = ws.sentData.length;

    // Send for room-A
    const successA1 = wsService.sendRead('msg-100', 'room-A');
    expect(successA1).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    // Send duplicate for room-A -> deduplicated
    const successA2 = wsService.sendRead('msg-100', 'room-A');
    expect(successA2).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    // Send same message ID for different room-B -> not deduplicated
    const successB = wsService.sendRead('msg-100', 'room-B');
    expect(successB).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 2);
  });

  it('should not cache messageId in sendRead when disconnected, allowing subsequent send on reconnect', async () => {
    // Before initialization / connection, sendRead should return false and not cache
    const failBeforeConnect = wsService.sendRead('msg-offline-1', 'room-offline');
    expect(failBeforeConnect).toBe(false);

    // Global sendRead while disconnected also returns false
    const failGlobalBeforeConnect = wsService.sendRead('msg-offline-global');
    expect(failGlobalBeforeConnect).toBe(false);

    // Now initialize and wait for connection
    wsService.initialize(mockConfig);
    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    const ws = helper.adapter.ws;
    const initialSentCount = ws.sentData.length;

    // Retrying with the same messageId that failed while offline should now send successfully
    const successRoom = wsService.sendRead('msg-offline-1', 'room-offline');
    expect(successRoom).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 1);

    const successGlobal = wsService.sendRead('msg-offline-global');
    expect(successGlobal).toBe(true);
    expect(ws.sentData.length).toBe(initialSentCount + 2);
  });

  it('should process NewMessage room_event and update stores idempotently', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    // Wire a real ChatService so the domain event is routed to the stores
    const chatOnlyConfig: ChatConfig = {
      endpoint: mockConfig.endpoint,
      userId: mockConfig.userId,
      displayName: mockConfig.displayName,
      token: mockConfig.token,
      tokenRefresher: mockConfig.tokenRefresher,
    };
    const chatServiceInstance = new ChatService();
    await chatServiceInstance.initialize(chatOnlyConfig);
    wsService.setChatService(chatServiceInstance);

    const roomEvent: WsServerRoomEventMessage<WsNewMessagePayload> = {
      type: 'room_event',
      success: true,
      roomId: 'room-100',
      eventType: 'NewMessage',
      payload: {
        messageId: 'msg-abc',
        content: 'Hi everyone!',
        createdDate: '2026-08-18T10:00:00Z',
        senderId: 'user-2',
        senderName: 'Bob',
      },
      serverTimeUtc: '2026-08-18T10:00:00Z',
    };

    const helper = wsService as unknown as { adapter: { ws: MockWebSocket } };
    helper.adapter.ws.onmessage?.({ data: JSON.stringify(roomEvent) });

    const messages = useMessageStore.getState().messagesByConversation['room-100']?.messages;
    expect(messages).toBeDefined();
    expect(messages?.length).toBe(1);
    expect(messages?.[0].content).toBe('Hi everyone!');

    await chatServiceInstance.dispose();
  });

  it('should trigger watchdog disconnect when heartbeat timeout expires without server response', async () => {
    vi.useFakeTimers();

    wsService.initialize(mockConfig);
    // Fast-forward initial connect setTimeout(0)
    await vi.advanceTimersByTimeAsync(10);

    const helper = wsService as unknown as {
      heartbeatTimeoutSec: number;
      adapter: { disconnect: (code?: number, reason?: string) => void };
    };
    helper.heartbeatTimeoutSec = 2; // 2 seconds

    const disconnectSpy = vi.spyOn(helper.adapter, 'disconnect');

    // Send heartbeat -> arms watchdog for 2 seconds
    wsService.sendHeartbeat();

    // Advance 1 second -> watchdog should NOT have fired yet
    await vi.advanceTimersByTimeAsync(1000);
    expect(disconnectSpy).not.toHaveBeenCalled();

    // Advance 1.5 more seconds (total 2.5s > 2s) -> watchdog fires and disconnects
    await vi.advanceTimersByTimeAsync(1500);
    expect(disconnectSpy).toHaveBeenCalledWith(1000, 'Heartbeat timeout');

    vi.useRealTimers();
  });

  it('should reset all state and cancel timers on dispose', async () => {
    wsService.initialize(mockConfig);

    await vi.waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    });

    wsService.dispose();

    expect(wsService.isConnected()).toBe(false);
    expect(wsService.getActiveRoomId()).toBeNull();
    expect(wsService.getSessionId()).toBeNull();
  });
});
