import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatService, chatService } from '../../services/chatService';
import { useChatStore } from '../../store/chatStore';
import { useConversationStore } from '../../store/conversationStore';
import { useMessageStore } from '../../store/messageStore';
import { useParticipantStore } from '../../store/participantStore';
import { AcsChatError } from '../../types/errors.types';
import type { ChatConfig } from '../../types/config.types';
import type { ChatDomainEvent } from '../../types/events.types';
import type { ChatMessage } from '../../types/message.types';
import type { ConversationParticipant } from '../../types/participant.types';

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
      startRealtimeNotifications: vi.fn().mockResolvedValue(undefined),
      stopRealtimeNotifications: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      getChatThreadClient: vi.fn().mockReturnValue({}),
    })),
  };
});

describe('ChatService', () => {
  let service: ChatService;
  const mockConfig: ChatConfig = {
    endpoint: 'https://contoso.communication.azure.com',
    userId: '8:acs:12345',
    displayName: 'John Doe',
    token: 'mock-token-string',
    tokenRefresher: vi.fn().mockResolvedValue('mock-refreshed-token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();
    service = new ChatService();
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.dispose();
    }
  });

  describe('Initialization', () => {
    it('should throw AcsChatError when config is invalid or incomplete', async () => {
      await expect(service.initialize(null as unknown as ChatConfig)).rejects.toThrow(AcsChatError);
      await expect(service.initialize({ ...mockConfig, endpoint: '' })).rejects.toThrow(
        AcsChatError
      );
      await expect(service.initialize({ ...mockConfig, userId: '' })).rejects.toThrow(AcsChatError);
      await expect(service.initialize({ ...mockConfig, token: '' })).rejects.toThrow(AcsChatError);
    });

    it('should initialize successfully and update chatStore', async () => {
      await service.initialize(mockConfig);

      expect(service.isInitialized()).toBe(true);
      expect(service.getConfig()).toEqual(mockConfig);
      expect(service.getClientAdapter()).toBeDefined();
      expect(service.getEventAdapter()).toBeDefined();
      expect(service.getChatClient()).toBeDefined();

      const chatState = useChatStore.getState();
      expect(chatState.currentUser).toEqual({
        id: '8:acs:12345',
        displayName: 'John Doe',
      });
      expect(chatState.connectionState).toBe('connected');
      expect(chatState.initializing).toBe(false);
      expect(chatState.initError).toBeNull();
    });

    it('should support initialization with tokenRefresher callback', async () => {
      const tokenRefresher = vi.fn().mockResolvedValue('refreshed-token');
      const configWithRefresher: ChatConfig = {
        ...mockConfig,
        tokenRefresher,
      };

      await service.initialize(configWithRefresher);
      expect(service.isInitialized()).toBe(true);
    });

    it('should handle initialization errors gracefully and reset state', async () => {
      const { AcsClientAdapter } = await import('../../adapters/acs/acsClientAdapter');
      vi.spyOn(AcsClientAdapter.prototype, 'startRealtimeNotifications').mockRejectedValueOnce(
        new Error('Network error starting notifications')
      );

      await expect(service.initialize(mockConfig)).rejects.toThrow(AcsChatError);

      expect(service.isInitialized()).toBe(false);
      const chatState = useChatStore.getState();
      expect(chatState.connectionState).toBe('error');
      expect(chatState.initializing).toBe(false);
      expect(chatState.initError).toBeDefined();
      expect(chatState.initError?.code).toBe('CONNECTION_FAILED');
    });

    it('should re-initialize and dispose previous session if already initialized', async () => {
      await service.initialize(mockConfig);
      expect(service.isInitialized()).toBe(true);

      const disposeSpy = vi.spyOn(service, 'dispose');
      await service.initialize({
        ...mockConfig,
        userId: '8:acs:67890',
        displayName: 'Jane Doe',
      });

      expect(disposeSpy).toHaveBeenCalled();
      expect(useChatStore.getState().currentUser).toEqual({
        id: '8:acs:67890',
        displayName: 'Jane Doe',
      });
    });
  });

  describe('Cleanup & Disposal', () => {
    it('should dispose all adapters and reset all stores', async () => {
      await service.initialize(mockConfig);

      // Populate stores with some data
      useConversationStore.getState().addConversation({
        id: 'thread-1',
        type: 'direct',
        createdAt: new Date(),
        unreadCount: 2,
        participants: [],
        otherParticipant: { id: 'user-2', displayName: 'Alice' },
        name: 'Alice',
      });
      useMessageStore.getState().addMessage('thread-1', {
        id: 'msg-1',
        conversationId: 'thread-1',
        type: 'text',
        content: 'Hello',
        sender: { id: 'user-2' },
        createdAt: new Date(),
        status: 'sent',
      });

      await service.dispose();

      expect(service.isInitialized()).toBe(false);
      expect(useChatStore.getState().currentUser).toBeNull();
      expect(useChatStore.getState().connectionState).toBe('disconnected');
      expect(useConversationStore.getState().conversationIds).toHaveLength(0);
      expect(useMessageStore.getState().messagesByConversation).toEqual({});
    });

    it('should throw when accessing adapters on an uninitialized service', () => {
      expect(() => service.getClientAdapter()).toThrow(AcsChatError);
      expect(() => service.getEventAdapter()).toThrow(AcsChatError);
      expect(() => service.getChatClient()).toThrow(AcsChatError);
    });
  });

  describe('Event Routing', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should route message:received event to messageStore, conversationStore, and participantStore', () => {
      useConversationStore.getState().addConversation({
        id: 'thread-1',
        type: 'direct',
        createdAt: new Date(),
        unreadCount: 0,
        participants: [],
        otherParticipant: { id: 'user-2', displayName: 'Alice' },
        name: 'Alice',
      });

      useParticipantStore.getState().setTypingUser('thread-1', { id: 'user-2' });
      expect(useParticipantStore.getState().typingUsers['thread-1']?.['user-2']).toBeDefined();

      const message: ChatMessage = {
        id: 'msg-100',
        conversationId: 'thread-1',
        type: 'text',
        content: 'New message',
        sender: { id: 'user-2', displayName: 'Alice' },
        createdAt: new Date(),
        status: 'sent',
      };

      const event: ChatDomainEvent<ChatMessage> = {
        type: 'message:received',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: message,
      };

      service.handleDomainEvent(event);

      // Check messageStore
      const messages = useMessageStore.getState().messagesByConversation['thread-1']?.messages;
      expect(messages).toHaveLength(1);
      expect(messages?.[0].id).toBe('msg-100');

      // Check conversationStore lastMessage and unread count
      const conv = useConversationStore.getState().conversations['thread-1'];
      expect(conv?.lastMessage).toBe('msg-100');
      expect(conv?.unreadCount).toBe(1);

      // Check typing indicator cleared
      expect(useParticipantStore.getState().typingUsers['thread-1']?.['user-2']).toBeUndefined();
    });

    it('should not increment unreadCount for active conversation on message:received', () => {
      useConversationStore.getState().addConversation({
        id: 'thread-active',
        type: 'direct',
        createdAt: new Date(),
        unreadCount: 0,
        participants: [],
        otherParticipant: { id: 'user-2' },
        name: 'user-2',
      });
      useConversationStore.getState().setActiveConversation('thread-active');

      const message: ChatMessage = {
        id: 'msg-101',
        conversationId: 'thread-active',
        type: 'text',
        content: 'Active chat message',
        sender: { id: 'user-2' },
        createdAt: new Date(),
        status: 'sent',
      };

      service.handleDomainEvent({
        type: 'message:received',
        conversationId: 'thread-active',
        timestamp: new Date(),
        payload: message,
      });

      const conv = useConversationStore.getState().conversations['thread-active'];
      expect(conv?.unreadCount).toBe(0);
    });

    it('should route message:edited event', () => {
      useMessageStore.getState().addMessage('thread-1', {
        id: 'msg-1',
        conversationId: 'thread-1',
        type: 'text',
        content: 'Original content',
        sender: { id: 'user-1' },
        createdAt: new Date(),
        status: 'sent',
      });

      const editedMsg: ChatMessage = {
        id: 'msg-1',
        conversationId: 'thread-1',
        type: 'text',
        content: 'Updated content',
        sender: { id: 'user-1' },
        createdAt: new Date(),
        editedAt: new Date(),
        status: 'sent',
      };

      service.handleDomainEvent({
        type: 'message:edited',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: editedMsg,
      });

      const msg = useMessageStore.getState().messagesByConversation['thread-1']?.messages[0];
      expect(msg?.content).toBe('Updated content');
    });

    it('should route message:deleted event', () => {
      useMessageStore.getState().addMessage('thread-1', {
        id: 'msg-to-delete',
        conversationId: 'thread-1',
        type: 'text',
        content: 'To be deleted',
        sender: { id: 'user-1' },
        createdAt: new Date(),
        status: 'sent',
      });

      service.handleDomainEvent({
        type: 'message:deleted',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: { id: 'msg-to-delete', deletedAt: new Date() },
      });

      const messages = useMessageStore.getState().messagesByConversation['thread-1']?.messages;
      expect(messages).toHaveLength(1);
      expect(messages![0].deletedAt).toBeDefined();
    });

    it('should route typing:started event and ignore self typing', () => {
      // Event for another user
      service.handleDomainEvent({
        type: 'typing:started',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: { user: { id: 'user-2', displayName: 'Alice' } },
      });

      expect(useParticipantStore.getState().typingUsers['thread-1']?.['user-2']).toBeDefined();

      // Event for current user (8:acs:12345)
      service.handleDomainEvent({
        type: 'typing:started',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: { user: { id: '8:acs:12345', displayName: 'John Doe' } },
      });

      expect(
        useParticipantStore.getState().typingUsers['thread-1']?.['8:acs:12345']
      ).toBeUndefined();
    });

    it('should route readReceipt:received event', () => {
      const readOnDate = new Date();
      service.handleDomainEvent({
        type: 'readReceipt:received',
        conversationId: 'thread-1',
        timestamp: readOnDate,
        payload: {
          messageId: 'msg-1',
          user: { id: 'user-2', displayName: 'Alice' },
          readOn: readOnDate,
        },
      });

      const receipt = useParticipantStore.getState().readReceipts['thread-1']?.['user-2'];
      expect(receipt).toBeDefined();
      expect(receipt?.messageId).toBe('msg-1');
    });

    it('should route conversation:created, conversation:updated, and conversation:deleted events', () => {
      const participants: ConversationParticipant[] = [
        { id: 'user-1', displayName: 'John' },
        { id: 'user-2', displayName: 'Alice' },
      ];

      // conversation:created
      service.handleDomainEvent({
        type: 'conversation:created',
        conversationId: 'group-1',
        timestamp: new Date(),
        payload: {
          id: 'group-1',
          type: 'group',
          name: 'Project Discussion',
          createdAt: new Date(),
          participants,
        },
      });

      let conv = useConversationStore.getState().conversations['group-1'];
      expect(conv).toBeDefined();
      expect(conv?.type).toBe('group');
      expect((conv as { name?: string })?.name).toBe('Project Discussion');
      expect(useParticipantStore.getState().participantsByConversation['group-1']).toHaveLength(2);

      // conversation:updated
      service.handleDomainEvent({
        type: 'conversation:updated',
        conversationId: 'group-1',
        timestamp: new Date(),
        payload: {
          id: 'group-1',
          name: 'Renamed Project Discussion',
          updatedAt: new Date(),
        },
      });

      conv = useConversationStore.getState().conversations['group-1'];
      expect((conv as { name?: string })?.name).toBe('Renamed Project Discussion');

      // conversation:deleted
      service.handleDomainEvent({
        type: 'conversation:deleted',
        conversationId: 'group-1',
        timestamp: new Date(),
        payload: { id: 'group-1' },
      });

      expect(useConversationStore.getState().conversations['group-1']).toBeUndefined();
    });

    it('should route participant:added and participant:removed events', () => {
      useParticipantStore
        .getState()
        .setParticipants('thread-1', [{ id: 'user-1', displayName: 'John' }]);

      // participant:added
      service.handleDomainEvent({
        type: 'participant:added',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: {
          participants: [{ id: 'user-2', displayName: 'Alice' }],
        },
      });

      expect(useParticipantStore.getState().participantsByConversation['thread-1']).toHaveLength(2);

      // participant:removed
      service.handleDomainEvent({
        type: 'participant:removed',
        conversationId: 'thread-1',
        timestamp: new Date(),
        payload: {
          participants: [{ id: 'user-2', displayName: 'Alice' }],
        },
      });

      const parts = useParticipantStore.getState().participantsByConversation['thread-1'];
      expect(parts).toHaveLength(1);
      expect(parts[0].id).toBe('user-1');
    });

    it('should route connection:connected and connection:disconnected events', () => {
      service.handleDomainEvent({
        type: 'connection:disconnected',
        conversationId: '',
        timestamp: new Date(),
        payload: { status: 'disconnected' },
      });

      expect(useChatStore.getState().connectionState).toBe('disconnected');

      service.handleDomainEvent({
        type: 'connection:connected',
        conversationId: '',
        timestamp: new Date(),
        payload: { status: 'connected' },
      });

      expect(useChatStore.getState().connectionState).toBe('connected');
    });

    it('should notify custom subscribers when events are handled', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      const event: ChatDomainEvent = {
        type: 'connection:connected',
        conversationId: '',
        timestamp: new Date(),
        payload: { status: 'connected' },
      };

      service.handleDomainEvent(event);
      expect(listener).toHaveBeenCalledWith(event);

      unsubscribe();
      service.handleDomainEvent(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global Singleton chatService', () => {
    it('should export a default singleton instance', () => {
      expect(chatService).toBeInstanceOf(ChatService);
    });
  });
});
