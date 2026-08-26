import { describe, it, expect, beforeEach, vi } from 'vitest';
import { messageService } from '../../services/messageService';
import { useMessageStore } from '../../store/messageStore';
import { useChatStore } from '../../store/chatStore';
import type { ChatMessage } from '../../types/message.types';

describe('MessageService loadMessages and pagination', () => {
  const mockConfig = {
    backendUrl: 'https://namphuong-api-dev.azurewebsites.net',
  };

  beforeEach(() => {
    useMessageStore.getState().reset();
    useChatStore.getState().reset();
    useChatStore.getState().setCurrentUser({ id: 'current-user-id', displayName: 'Current User' });

    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue(mockConfig),
    } as never;

    messageService.setChatService(mockChatService);
  });

  it('should merge pre-existing realtime messages with server messages and set hasFetched: true and continuationToken', async () => {
    // 1. Simulate a realtime message received via WebSocket before opening room
    const realtimeMsg: ChatMessage = {
      id: 'msg-realtime-1',
      conversationId: 'room-1',
      type: 'text',
      content: 'Realtime incoming message',
      sender: { id: 'other-user', displayName: 'Other User' },
      createdAt: new Date('2026-08-20T10:00:00Z'),
      status: 'sent',
      sequenceId: '100',
    };

    useMessageStore.getState().addMessage('room-1', realtimeMsg);
    expect(useMessageStore.getState().messagesByConversation['room-1']?.hasFetched).toBe(false);
    expect(useMessageStore.getState().messagesByConversation['room-1']?.messages).toHaveLength(1);

    // 2. Mock fetch for /api/chat/get-messages
    const mockApiResponse = {
      statusCode: 200,
      message: 'Successful.',
      totalRecord: 0,
      data: {
        items: [
          {
            itemType: 'message',
            createdDate: '2026-08-20T09:30:00Z',
            data: {
              id: 'msg-hist-2',
              type: 'text',
              sequenceId: '99',
              version: '1787197307361',
              content: { message: 'Old message 2' },
              senderDisplayName: 'Current User',
              createdOn: '2026-08-20T09:30:00Z',
              senderCommunicationIdentifier: {
                rawId: 'current-user-id',
                communicationUser: { id: 'current-user-id' },
              },
            },
          },
          {
            itemType: 'message',
            createdDate: '2026-08-20T09:00:00Z',
            data: {
              id: 'msg-hist-1',
              type: 'text',
              sequenceId: '98',
              version: '1787197302674',
              content: { message: 'Old message 1' },
              senderDisplayName: 'Other User',
              createdOn: '2026-08-20T09:00:00Z',
              senderCommunicationIdentifier: {
                rawId: 'other-user',
                communicationUser: { id: 'other-user' },
              },
            },
          },
        ],
        continuationToken: 'mock-token-abc',
        hasMore: true,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    }) as never;

    // 3. Call loadMessages
    const results = await messageService.loadMessages('room-1', { maxPageSize: 2 });

    // 4. Verify API call
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/get-messages?roomId=room-1&pageSize=2'),
      expect.anything()
    );

    // 5. Verify store results
    const convData = useMessageStore.getState().messagesByConversation['room-1'];
    expect(convData.hasFetched).toBe(true);
    expect(convData.loading).toBe(false);
    expect(convData.hasMore).toBe(true);
    expect(convData.continuationToken).toBe('mock-token-abc');
    expect(convData.messages).toHaveLength(3);
    expect(convData.messages.map((m) => m.id)).toEqual(['msg-hist-1', 'msg-hist-2', 'msg-realtime-1']);
    expect(results).toHaveLength(3);
  });

  it('should load older messages via loadMore with continuationToken', async () => {
    // Initial messages in store
    useMessageStore.getState().setMessages(
      'room-1',
      [
        {
          id: 'msg-2',
          conversationId: 'room-1',
          type: 'text',
          content: 'Message 2',
          sender: { id: 'user-1' },
          createdAt: new Date('2026-08-20T10:00:00Z'),
          status: 'sent',
          sequenceId: '2',
        },
      ],
      true,
      'token-page-1'
    );

    const mockLoadMoreResponse = {
      statusCode: 200,
      message: 'Successful.',
      totalRecord: 0,
      data: {
        items: [
          {
            itemType: 'message',
            data: {
              id: 'msg-1',
              type: 'text',
              sequenceId: '1',
              content: { message: 'Message 1' },
              createdOn: '2026-08-20T09:00:00Z',
              senderCommunicationIdentifier: { rawId: 'user-1' },
            },
          },
        ],
        continuationToken: null,
        hasMore: false,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLoadMoreResponse),
    }) as never;

    const results = await messageService.loadMore('room-1', { maxPageSize: 10 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/get-messages?roomId=room-1&pageSize=10&continuationToken=token-page-1'),
      expect.anything()
    );

    const convData = useMessageStore.getState().messagesByConversation['room-1'];
    expect(convData.hasMore).toBe(false);
    expect(convData.messages).toHaveLength(2);
    expect(convData.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
    expect(results).toHaveLength(1);
  });
});
