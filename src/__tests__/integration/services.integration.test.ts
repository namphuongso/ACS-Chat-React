import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chatService } from '../../services/chatService';
import { conversationService } from '../../services/conversationService';
import { messageService } from '../../services/messageService';
import { typingService } from '../../services/typingService';
import { readReceiptService } from '../../services/readReceiptService';
import { useChatStore } from '../../store/chatStore';
import { useConversationStore } from '../../store/conversationStore';
import { useMessageStore } from '../../store/messageStore';
import { useParticipantStore } from '../../store/participantStore';
import type { ChatConfig } from '../../types/config.types';

// Mock ACS SDK modules
const mockListChatThreads = vi.fn();
const mockSendMessage = vi.fn();
const mockSendTypingNotification = vi.fn();

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
      getChatThreadClient: vi.fn().mockImplementation((threadId: string) => ({
        threadId,
        sendMessage: mockSendMessage,
        sendTypingNotification: mockSendTypingNotification,
        listMessages: vi.fn(),
        listParticipants: vi.fn().mockReturnValue({ byPage: () => [] }),
      })),
      listChatThreads: mockListChatThreads,
    })),
  };
});

describe('Services Integration', () => {
  const mockConfig: ChatConfig = {
    endpoint: 'https://contoso.communication.azure.com',
    userId: '8:acs:12345',
    displayName: 'John Doe',
    token: 'mock-token-string',
    tokenRefresher: vi.fn().mockResolvedValue('new-mock-token-string'),
    backendUrl: 'https://api.example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ statusCode: 200, data: [
        { id: 'thread-1', type: 'direct', threadId: 'thread-1', pid: 'user-2', roomName: 'Test Thread', created: new Date().toISOString() },
      ] }),
    }) as unknown as typeof fetch;
    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();

    // Wire up services
    conversationService.setChatService(chatService);
    messageService.setChatService(chatService);
    typingService.setChatService(chatService);
    readReceiptService.setChatService(chatService);
  });

  afterEach(async () => {
    if (chatService.isInitialized()) {
      await chatService.dispose();
    }
  });

  it('should initialize and orchestrate stores', async () => {
    await chatService.initialize(mockConfig);

    const chatState = useChatStore.getState();
    expect(chatState.currentUser?.id).toBe(mockConfig.userId);
    expect(chatService.isInitialized()).toBe(true);
  });

  it('should load conversations and update conversation store', async () => {
    mockListChatThreads.mockReturnValue({
      byPage: () => [
        [
          {
            id: 'thread-1',
            topic: 'Test Thread',
            createdOn: new Date(),
            deletedOn: undefined,
          },
        ],
      ],
    });

    await chatService.initialize(mockConfig);
    const result = await conversationService.loadConversations();

    expect(result.length).toBe(1);
    expect(result[0].conversation?.id).toBe('thread-1');
    expect(useConversationStore.getState().conversations['thread-1']).toBeDefined();
  });

  it('should handle real-time message received event and update message store', async () => {
    await chatService.initialize(mockConfig);

    // Trigger real-time domain event (e.g. from WebSocket)
    chatService.handleDomainEvent({
      type: 'message:received',
      conversationId: 'thread-1',
      timestamp: new Date(),
      payload: {
        id: 'msg-1',
        conversationId: 'thread-1',
        type: 'text',
        content: 'Hello world',
        sender: { id: '8:acs:999', displayName: 'Jane Doe' },
        createdAt: new Date(),
        status: 'sent',
      },
    });

    const messages = useMessageStore.getState().messagesByConversation['thread-1']?.messages;
    expect(messages).toBeDefined();
    expect(messages?.length).toBe(1);
    expect(messages?.[0].id).toBe('msg-1');
    expect(messages?.[0].content).toBe('Hello world');
  });

  it('should send a message via messageService and call underlying SDK', async () => {
    mockSendMessage.mockResolvedValue({ id: 'msg-sent-1' });

    await chatService.initialize(mockConfig);

    const result = await messageService.sendMessage('thread-1', 'Test message');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/send-message'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Test message'),
      })
    );
    expect(result.message).toBeDefined();
  });

  it('should send typing notification via typingService', async () => {
    mockSendTypingNotification.mockResolvedValue(true);

    await chatService.initialize(mockConfig);
    await typingService.sendTypingNotification('thread-1');

    expect(mockSendTypingNotification).toHaveBeenCalled();
  });

  it('should handle real-time message:pinned and message:unpinned only when data is cached', async () => {
    await chatService.initialize(mockConfig);

    // 1. Initial state: data has not been fetched (hasFetchedPinned is false/undefined)
    // Receiving a pin event should NOT update store
    chatService.handleDomainEvent({
      type: 'message:pinned',
      conversationId: 'thread-1',
      timestamp: new Date(),
      payload: {
        messageId: '1787198733909',
        actorId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
        actorName: 'Hà Anh Thảo 2',
        actionAtUtc: '2026-08-20T04:09:02.3617401Z',
      },
    });

    expect(useMessageStore.getState().messagesByConversation['thread-1']?.pinnedMessages).toBeUndefined();

    // 2. Set up cached data (simulating having called /api/chat/get-pinned-messages)
    useMessageStore.getState().setPinnedMessages('thread-1', [
      {
        messageId: '1786594746570',
        type: 'text',
        content: 'Old Pinned Message',
        createdDate: '2026-08-20T04:00:00Z',
        creator: 'Hà Anh Thảo 2',
        attachmentType: '',
        attachmentUrl: '',
        thumbUrl: '',
      },
    ]);
    useMessageStore.getState().addMessage('thread-1', {
      id: '1787198733909',
      conversationId: 'thread-1',
      type: 'text',
      content: 'New message to pin',
      sender: { id: 'user-1', displayName: 'Hà Anh Thảo 2' },
      createdAt: new Date('2026-08-20T04:09:02.361Z'),
      status: 'sent',
    });

    // 3. Receive message:pinned event
    chatService.handleDomainEvent({
      type: 'message:pinned',
      conversationId: 'thread-1',
      timestamp: new Date(),
      payload: {
        messageId: '1787198733909',
        actorId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
        actorName: 'Hà Anh Thảo 2',
        actionAtUtc: '2026-08-20T04:09:02.3617401Z',
      },
    });

    const pinnedMessagesAfterPin = useMessageStore.getState().messagesByConversation['thread-1']?.pinnedMessages;
    expect(pinnedMessagesAfterPin).toHaveLength(2);
    expect(pinnedMessagesAfterPin?.[0].messageId).toBe('1787198733909');
    expect(pinnedMessagesAfterPin?.[0].content).toBe('New message to pin');

    // 4. Receive message:unpinned event for '1786594746570'
    chatService.handleDomainEvent({
      type: 'message:unpinned',
      conversationId: 'thread-1',
      timestamp: new Date(),
      payload: {
        messageId: '1786594746570',
        actorId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
        actorName: 'Hà Anh Thảo 2',
        actionAtUtc: '2026-08-20T04:10:08.2670851Z',
      },
    });

    const pinnedMessagesAfterUnpin = useMessageStore.getState().messagesByConversation['thread-1']?.pinnedMessages;
    expect(pinnedMessagesAfterUnpin).toHaveLength(1);
    expect(pinnedMessagesAfterUnpin?.[0].messageId).toBe('1787198733909');
  });
});
