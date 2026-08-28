import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readReceiptService } from '../../services/readReceiptService';
import { websocketService } from '../../services/websocketService';
import { useChatStore } from '../../store/chatStore';
import { useParticipantStore } from '../../store/participantStore';
import type { ChatService } from '../../services/chatService';
import type { ChatParticipant } from '../../types/participant.types';

describe('ReadReceiptService', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useParticipantStore.getState().reset();
    useChatStore.getState().setCurrentUser({ id: 'user-1', displayName: 'Alice' });
  });

  afterEach(() => {
    readReceiptService.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should send immediate read message via WebSocket when connected', async () => {
    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(true);
    const sendReadSpy = vi.spyOn(websocketService, 'sendRead').mockReturnValue(true);

    await readReceiptService.sendReadReceipt('conv-1', 'msg-123');

    expect(sendReadSpy).toHaveBeenCalledWith('msg-123', 'conv-1');

    isConnectedSpy.mockRestore();
    sendReadSpy.mockRestore();
  });

  it('should not send duplicate read receipts for the same messageId in the same conversation', async () => {
    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(true);
    const sendReadSpy = vi.spyOn(websocketService, 'sendRead').mockReturnValue(true);

    await readReceiptService.sendReadReceipt('conv-1', 'msg-123');
    await readReceiptService.sendReadReceipt('conv-1', 'msg-123');

    expect(sendReadSpy).toHaveBeenCalledTimes(1);

    isConnectedSpy.mockRestore();
    sendReadSpy.mockRestore();
  });

  it('should retry sending if previous websocket sendRead returned false', async () => {
    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(true);
    const sendReadSpy = vi
      .spyOn(websocketService, 'sendRead')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await readReceiptService.sendReadReceipt('conv-1', 'msg-123');
    expect(sendReadSpy).toHaveBeenCalledTimes(1);

    // Because first send failed (false), subsequent call should try sending again
    await readReceiptService.sendReadReceipt('conv-1', 'msg-123');
    expect(sendReadSpy).toHaveBeenCalledTimes(2);

    isConnectedSpy.mockRestore();
    sendReadSpy.mockRestore();
  });

  it('should fall back to debounced ACS send when WebSocket is connected but sendRead fails', async () => {
    vi.useFakeTimers();

    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(true);
    const sendReadSpy = vi.spyOn(websocketService, 'sendRead').mockReturnValue(false);

    const mockSendReadReceipt = vi.fn().mockResolvedValue(undefined);
    const mockThreadClient = { sendReadReceipt: mockSendReadReceipt };
    const mockChatClient = {
      getChatThreadClient: vi.fn().mockReturnValue(mockThreadClient),
    };
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getChatClient: vi.fn().mockReturnValue(mockChatClient),
    } as unknown as ChatService;

    readReceiptService.setChatService(mockChatService);

    useParticipantStore.getState().setParticipants('conv-wsfail', [
      { id: 'user-1', displayName: 'Alice' },
    ]);

    await readReceiptService.sendReadReceipt('conv-wsfail', 'msg-wsfail-1');

    expect(sendReadSpy).toHaveBeenCalledTimes(1);
    expect(mockSendReadReceipt).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(mockChatClient.getChatThreadClient).toHaveBeenCalledWith('conv-wsfail');
    expect(mockSendReadReceipt).toHaveBeenCalledWith({ chatMessageId: 'msg-wsfail-1' });

    isConnectedSpy.mockRestore();
    sendReadSpy.mockRestore();
  });

  it('should throw error when messageId or conversationId is empty', async () => {
    await expect(readReceiptService.sendReadReceipt('', 'msg-1')).rejects.toThrow();
    await expect(readReceiptService.sendReadReceipt('conv-1', '')).rejects.toThrow();
  });

  it('should fallback to debounced ACS sendReadReceipt when WebSocket is offline', async () => {
    vi.useFakeTimers();

    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(false);
    const mockSendReadReceipt = vi.fn().mockResolvedValue(undefined);
    const mockThreadClient = {
      sendReadReceipt: mockSendReadReceipt,
    };
    const mockChatClient = {
      getChatThreadClient: vi.fn().mockReturnValue(mockThreadClient),
    };
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getChatClient: vi.fn().mockReturnValue(mockChatClient),
    } as unknown as ChatService;

    readReceiptService.setChatService(mockChatService);

    // 1 participant (<= 20)
    useParticipantStore.getState().setParticipants('conv-fallback', [
      { id: 'user-1', displayName: 'Alice' },
    ]);

    await readReceiptService.sendReadReceipt('conv-fallback', 'msg-acs-1');

    // Debounced (300ms) - should not have sent immediately
    expect(mockSendReadReceipt).not.toHaveBeenCalled();

    // Advance 300ms
    await vi.advanceTimersByTimeAsync(300);

    expect(mockChatClient.getChatThreadClient).toHaveBeenCalledWith('conv-fallback');
    expect(mockSendReadReceipt).toHaveBeenCalledWith({ chatMessageId: 'msg-acs-1' });

    isConnectedSpy.mockRestore();
  });

  it('should skip ACS fallback when conversation has more than 20 participants', async () => {
    vi.useFakeTimers();

    const isConnectedSpy = vi.spyOn(websocketService, 'isConnected').mockReturnValue(false);
    const mockSendReadReceipt = vi.fn().mockResolvedValue(undefined);
    const mockThreadClient = {
      sendReadReceipt: mockSendReadReceipt,
    };
    const mockChatClient = {
      getChatThreadClient: vi.fn().mockReturnValue(mockThreadClient),
    };
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getChatClient: vi.fn().mockReturnValue(mockChatClient),
    } as unknown as ChatService;

    readReceiptService.setChatService(mockChatService);

    // 25 participants (> 20)
    const largeParticipants: ChatParticipant[] = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i}`,
      displayName: `User ${i}`,
    }));
    useParticipantStore.getState().setParticipants('conv-large', largeParticipants);

    await readReceiptService.sendReadReceipt('conv-large', 'msg-large-1');

    // Advance timers
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSendReadReceipt).not.toHaveBeenCalled();

    isConnectedSpy.mockRestore();
  });
});
