import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebSocketAdapter,
  buildWebSocketUrl,
} from '../../adapters/websocket/websocketAdapter';
import { WS_CLOSE_CODE_NORMAL } from '../../constants/websocket';

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

  public close(code: number = WS_CLOSE_CODE_NORMAL, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('WebSocketAdapter and buildWebSocketUrl', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    // @ts-expect-error mocking global WebSocket
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  describe('buildWebSocketUrl', () => {
    it('should convert https to wss and append default path', () => {
      const url = buildWebSocketUrl({
        url: 'https://example.com',
        accessToken: 'jwt-token-123',
      });
      expect(url).toBe('wss://example.com/ws/chat/view?access_token=jwt-token-123');
    });

    it('should convert http to ws', () => {
      const url = buildWebSocketUrl({
        url: 'http://example.com',
        accessToken: 'jwt-token-123',
      });
      expect(url).toBe('ws://example.com/ws/chat/view?access_token=jwt-token-123');
    });

    it('should not duplicate /ws/chat/view if already in url', () => {
      const url = buildWebSocketUrl({
        url: 'wss://example.com/ws/chat/view',
        accessToken: 'jwt-token-123',
      });
      expect(url).toBe('wss://example.com/ws/chat/view?access_token=jwt-token-123');
    });

    it('should strip Bearer prefix from access token', () => {
      const url = buildWebSocketUrl({
        url: 'https://example.com',
        accessToken: 'Bearer jwt-token-123',
      });
      expect(url).toBe('wss://example.com/ws/chat/view?access_token=jwt-token-123');
    });

    it('should include deviceId and roomId query parameters if provided', () => {
      const url = buildWebSocketUrl({
        url: 'https://example.com',
        accessToken: 'jwt-token-123',
        deviceId: 'device-abc',
        roomId: 'room-xyz',
      });
      expect(url).toContain('access_token=jwt-token-123');
      expect(url).toContain('deviceId=device-abc');
      expect(url).toContain('roomId=room-xyz');
    });

    it('should preserve existing query parameters when building the URL', () => {
      const url = buildWebSocketUrl({
        url: 'https://example.com/ws/chat-view?tenant=1&locale=vi',
        accessToken: 'jwt-token-123',
      });
      expect(url).toContain('/ws/chat-view?tenant=1&locale=vi');
      expect(url).toContain('access_token=jwt-token-123');
      expect(url.indexOf('?')).toBeLessThan(url.indexOf('tenant=1'));
      expect(url.indexOf('&access_token')).toBeGreaterThan(url.indexOf('locale=vi'));
    });
  });

  describe('WebSocketAdapter connection lifecycle', () => {
    it('should connect, open and send message', async () => {
      const adapter = new WebSocketAdapter();
      const openSpy = vi.fn();
      adapter.onOpen(openSpy);

      const connectPromise = adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      await expect(connectPromise).resolves.toBeUndefined();
      expect(openSpy).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(true);

      const sendResult = adapter.send({
        type: 'heartbeat',
      });
      expect(sendResult).toBe(true);

      adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should receive and parse messages', async () => {
      const adapter = new WebSocketAdapter();
      const messageSpy = vi.fn();
      adapter.onMessage(messageSpy);

      adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      await vi.waitFor(() => {
        expect(adapter.isConnected()).toBe(true);
      });

      // @ts-expect-error accessing private ws for test
      const wsInstance = adapter['ws'] as MockWebSocket;
      wsInstance.onmessage?.({
        data: JSON.stringify({ type: 'connected', sessionId: 'sess-1', heartbeatIntervalSeconds: 25, heartbeatTimeoutSeconds: 75 }),
      });

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connected',
          sessionId: 'sess-1',
        })
      );
    });

    it('should handle close event', async () => {
      const adapter = new WebSocketAdapter();
      const closeSpy = vi.fn();
      adapter.onClose(closeSpy);

      await adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      expect(adapter.isConnected()).toBe(true);

      adapter.disconnect(WS_CLOSE_CODE_NORMAL, 'closed');
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should not create a new socket while the existing one is CLOSING', async () => {
      const adapter = new WebSocketAdapter();
      await adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      // @ts-expect-error accessing private ws for test
      const firstSocket = adapter['ws'] as MockWebSocket;
      firstSocket.readyState = MockWebSocket.CLOSING;

      // Reconnect while the old socket is still closing must NOT replace it
      await expect(
        adapter.connect({
          url: 'https://example.com',
          accessToken: 'token-123',
        })
      ).resolves.toBeUndefined();

      expect(adapter['ws']).toBe(firstSocket);
    });

    it('should detach handlers of a stale CLOSED socket before creating a new one', async () => {
      const adapter = new WebSocketAdapter();
      await adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      // @ts-expect-error accessing private ws for test
      const firstSocket = adapter['ws'] as MockWebSocket;
      firstSocket.readyState = MockWebSocket.CLOSED;

      await adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      // A fresh socket was created and the stale one's handlers were detached
      expect(adapter['ws']).not.toBe(firstSocket);
      expect(firstSocket.onclose).toBeNull();
    });

    it('should reject connect() when the socket closes before opening', async () => {
      class CloseBeforeOpenWebSocket {
        public static OPEN = 1;
        public static CONNECTING = 0;
        public static CLOSING = 2;
        public static CLOSED = 3;
        public readyState = CloseBeforeOpenWebSocket.CLOSED;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onerror: ((event: Event) => void) | null = null;
        public onclose: ((event: { code: number; reason: string }) => void) | null = null;
        constructor(_url: string) {
          setTimeout(() => {
            this.onclose?.({ code: 1006, reason: 'connection failed' });
          }, 0);
        }
        public send(_data: string): void {}
        public close(_code?: number, _reason?: string): void {}
      }

      // @ts-expect-error mocking global WebSocket
      global.WebSocket = CloseBeforeOpenWebSocket;
      const adapter = new WebSocketAdapter();

      await expect(
        adapter.connect({ url: 'https://example.com', accessToken: 'token-123' })
      ).rejects.toBeDefined();
      expect(adapter.isConnected()).toBe(false);
      // @ts-expect-error mocking global WebSocket
      global.WebSocket = MockWebSocket;
    });

    it('should reject a pending connect() when disconnect() is called', async () => {
      class NeverOpenWebSocket {
        public static OPEN = 1;
        public static CONNECTING = 0;
        public static CLOSING = 2;
        public static CLOSED = 3;
        public readyState = NeverOpenWebSocket.CONNECTING;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onerror: ((event: Event) => void) | null = null;
        public onclose: ((event: { code: number; reason: string }) => void) | null = null;
        public send(_data: string): void {}
        public close(_code?: number, _reason?: string): void {}
      }

      // @ts-expect-error mocking global WebSocket
      global.WebSocket = NeverOpenWebSocket;
      const adapter = new WebSocketAdapter();

      const connectPromise = adapter.connect({
        url: 'https://example.com',
        accessToken: 'token-123',
      });

      // Nothing ever opens or closes the socket; connect() stays pending.
      // disconnect() must reject it so no promise leaks.
      const rejection = connectPromise.catch((err: Error) => err);
      adapter.disconnect();
      await expect(rejection).resolves.toBeInstanceOf(Error);
      await expect(connectPromise).rejects.toThrow('client disconnected');
      expect(adapter.isConnected()).toBe(false);
      // @ts-expect-error mocking global WebSocket
      global.WebSocket = MockWebSocket;
    });
  });
});
