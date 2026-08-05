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
let mockOn: (event: string, callback: (...args: unknown[]) => void) => void = vi.fn();
const mockOff: (event: string, callback: (...args: unknown[]) => void) => void = vi.fn();
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
      startRealtimeNotifications: vi.fn().mockResolvedValue(undefined),
      stopRealtimeNotifications: vi.fn().mockResolvedValue(undefined),
      on: (event: string, cb: (...args: unknown[]) => void) => {
        mockOn(event, cb);
      },
      off: (event: string, cb: (...args: unknown[]) => void) => {
        mockOff(event, cb);
      },
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
  };

  // Map to store event callbacks registered by AcsEventAdapter
  let eventCallbacks: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();

    eventCallbacks = {};
    mockOn = vi.fn((event, cb) => {
      eventCallbacks[event] = cb;
    });

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
    expect(chatState.connectionState).toBe('connected');
    expect(chatState.currentUser?.id).toBe(mockConfig.userId);
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

    // Simulate real-time event from ACS SDK
    const messageEvent = {
      type: 'Text',
      id: 'msg-1',
      sender: { communicationUserId: '8:acs:999' },
      senderDisplayName: 'Jane Doe',
      createdOn: new Date(),
      message: 'Hello world',
      threadId: 'thread-1',
    };

    // Trigger the real-time event
    if (eventCallbacks['chatMessageReceived']) {
      eventCallbacks['chatMessageReceived'](messageEvent);
    } else {
      throw new Error('chatMessageReceived event callback not registered');
    }

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

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Test message' }),
      expect.any(Object)
    );
    expect(result.message).toBeDefined();
    expect(result.message?.id).toBe('msg-sent-1');
  });

  it('should send typing notification via typingService', async () => {
    mockSendTypingNotification.mockResolvedValue(true);

    await chatService.initialize(mockConfig);
    await typingService.sendTypingNotification('thread-1');

    expect(mockSendTypingNotification).toHaveBeenCalled();
  });
});
