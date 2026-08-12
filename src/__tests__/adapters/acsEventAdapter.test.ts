import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatClient } from '@azure/communication-chat';
import type {
  ChatMessageReceivedEvent,
  ChatMessageEditedEvent,
  ChatMessageDeletedEvent,
  TypingIndicatorReceivedEvent,
  ReadReceiptReceivedEvent,
  ChatThreadCreatedEvent,
  ChatThreadDeletedEvent,
  ChatThreadPropertiesUpdatedEvent,
  ParticipantsAddedEvent,
  ParticipantsRemovedEvent,
} from '@azure/communication-signaling';
import {
  AcsEventAdapter,
  normalizeChatMessageReceived,
  normalizeChatMessageEdited,
  normalizeChatMessageDeleted,
  normalizeTypingIndicatorReceived,
  normalizeReadReceiptReceived,
  normalizeChatThreadCreated,
  normalizeChatThreadDeleted,
  normalizeChatThreadPropertiesUpdated,
  normalizeParticipantsAdded,
  normalizeParticipantsRemoved,
  normalizeRealTimeConnected,
  normalizeRealTimeDisconnected,
} from '../../adapters/acs/acsEventAdapter';
import type { CommunicationIdentifierKind } from '@azure/communication-common';
import { AcsChatError } from '../../types/errors.types';
import type { ChatEventHandler } from '../../types/events.types';

describe('AcsEventAdapter', () => {
  let mockOn: ReturnType<typeof vi.fn>;
  let mockOff: ReturnType<typeof vi.fn>;
  let mockChatClient: ChatClient;
  let eventListenerMap: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    eventListenerMap = new Map();
    mockOn = vi.fn().mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
      eventListenerMap.set(event, listener);
    });
    mockOff = vi.fn();

    mockChatClient = {
      on: mockOn,
      off: mockOff,
    } as unknown as ChatClient;
  });

  describe('Constructor & Validation', () => {
    it('should initialize successfully with valid client and eventHandler object', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      const adapter = new AcsEventAdapter(mockChatClient, handler);
      expect(adapter).toBeDefined();
    });

    it('should initialize successfully with valid client and callback function', () => {
      const fn = vi.fn();
      const adapter = new AcsEventAdapter(mockChatClient, fn);
      expect(adapter).toBeDefined();
    });

    it('should throw INVALID_INPUT if chatClient is missing', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      expect(() => new AcsEventAdapter(null as unknown as ChatClient, handler)).toThrow(
        AcsChatError
      );
      try {
        new AcsEventAdapter(null as unknown as ChatClient, handler);
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('INVALID_INPUT');
      }
    });

    it('should throw INVALID_INPUT if eventHandler is missing or invalid', () => {
      expect(
        () => new AcsEventAdapter(mockChatClient, null as unknown as ChatEventHandler)
      ).toThrow(AcsChatError);
      try {
        new AcsEventAdapter(mockChatClient, {} as unknown as ChatEventHandler);
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('subscribeAll & unsubscribeAll', () => {
    it('should subscribe to all 12 ACS events', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      const adapter = new AcsEventAdapter(mockChatClient, handler);

      adapter.subscribeAll();

      expect(mockOn).toHaveBeenCalledTimes(12);
      const expectedEvents = [
        'chatMessageReceived',
        'chatMessageEdited',
        'chatMessageDeleted',
        'typingIndicatorReceived',
        'readReceiptReceived',
        'chatThreadCreated',
        'chatThreadDeleted',
        'chatThreadPropertiesUpdated',
        'participantsAdded',
        'participantsRemoved',
        'realTimeNotificationConnected',
        'realTimeNotificationDisconnected',
      ];

      expectedEvents.forEach((eventName) => {
        expect(eventListenerMap.has(eventName)).toBe(true);
      });
    });

    it('should unsubscribe from all 12 ACS events on unsubscribeAll', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      const adapter = new AcsEventAdapter(mockChatClient, handler);

      adapter.subscribeAll();
      adapter.unsubscribeAll();

      expect(mockOff).toHaveBeenCalledTimes(12);
    });

    it('should re-subscribe cleanly if subscribeAll is called twice', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      const adapter = new AcsEventAdapter(mockChatClient, handler);

      adapter.subscribeAll();
      adapter.subscribeAll();

      expect(mockOff).toHaveBeenCalledTimes(12);
      expect(mockOn).toHaveBeenCalledTimes(24);
    });

    it('should dispatch events to eventHandler object when ACS events fire', () => {
      const handler: ChatEventHandler = { onEvent: vi.fn() };
      const adapter = new AcsEventAdapter(mockChatClient, handler);

      adapter.subscribeAll();

      const receivedListener = eventListenerMap.get('chatMessageReceived');
      expect(receivedListener).toBeDefined();

      const mockEvent: ChatMessageReceivedEvent = {
        id: 'msg-1',
        threadId: 'thread-1',
        sender: { communicationUserId: 'user-1' } as unknown as CommunicationIdentifierKind,
        senderDisplayName: 'Alice',
        createdOn: new Date('2026-01-01T00:00:00Z'),
        version: '1',
        type: 'text',
        message: 'Hello World',
        metadata: {},
        recipient: { communicationUserId: 'user-2' } as unknown as CommunicationIdentifierKind,
      };

      receivedListener!(mockEvent);

      expect(handler.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message:received',
          conversationId: 'thread-1',
          payload: expect.objectContaining({
            id: 'msg-1',
            content: 'Hello World',
          }),
        })
      );
    });

    it('should dispatch events to function handler when callback function is used', () => {
      const callback = vi.fn();
      const adapter = new AcsEventAdapter(mockChatClient, callback);

      adapter.subscribeAll();

      const listener = eventListenerMap.get('realTimeNotificationConnected');
      expect(listener).toBeDefined();

      listener!();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection:connected',
          conversationId: '',
          payload: { status: 'connected' },
        })
      );
    });
  });

  describe('Event Normalization Functions', () => {
    it('normalizeChatMessageReceived should map text message event', () => {
      const now = new Date();
      const acsEvent: ChatMessageReceivedEvent = {
        id: 'msg-101',
        threadId: 'thread-abc',
        sender: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
        senderDisplayName: 'Alice',
        createdOn: now,
        version: '1',
        type: 'text',
        message: 'Hello Bob',
        metadata: { foo: 'bar' },
        recipient: { communicationUserId: 'user-bob' } as unknown as CommunicationIdentifierKind,
      };

      const domainEvent = normalizeChatMessageReceived(acsEvent);

      expect(domainEvent.type).toBe('message:received');
      expect(domainEvent.conversationId).toBe('thread-abc');
      expect(domainEvent.timestamp).toEqual(now);
      expect(domainEvent.payload).toEqual({
        id: 'msg-101',
        conversationId: 'thread-abc',
        type: 'text',
        content: 'Hello Bob',
        sender: { id: 'user-alice', displayName: 'Alice' },
        senderDisplayName: 'Alice',
        createdAt: now,
        status: 'sent',
        metadata: { foo: 'bar' },
      });
    });

    it('normalizeChatMessageReceived should map HTML message event', () => {
      const acsEvent = {
        id: 'msg-html',
        threadId: 'thread-abc',
        sender: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
        type: 'RichText/Html',
        message: '<p>Bold Text</p>',
      } as ChatMessageReceivedEvent;

      const domainEvent = normalizeChatMessageReceived(acsEvent);
      expect(domainEvent.payload.type).toBe('html');
      expect(domainEvent.payload.content).toBe('<p>Bold Text</p>');
    });

    it('normalizeChatMessageEdited should map edited message event', () => {
      const createdOn = new Date('2026-01-01T10:00:00Z');
      const editedOn = new Date('2026-01-01T10:05:00Z');
      const acsEvent: ChatMessageEditedEvent = {
        id: 'msg-edited',
        threadId: 'thread-abc',
        sender: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
        senderDisplayName: 'Alice',
        createdOn,
        editedOn,
        version: '2',
        type: 'text',
        message: 'Updated content',
        metadata: {},
        recipient: { communicationUserId: 'user-bob' } as unknown as CommunicationIdentifierKind,
      };

      const domainEvent = normalizeChatMessageEdited(acsEvent);

      expect(domainEvent.type).toBe('message:edited');
      expect(domainEvent.conversationId).toBe('thread-abc');
      expect(domainEvent.timestamp).toEqual(editedOn);
      expect(domainEvent.payload.content).toBe('Updated content');
      expect(domainEvent.payload.editedAt).toEqual(editedOn);
    });

    it('normalizeChatMessageDeleted should map deleted message event', () => {
      const deletedOn = new Date('2026-01-01T10:10:00Z');
      const acsEvent: ChatMessageDeletedEvent = {
        id: 'msg-del',
        threadId: 'thread-abc',
        sender: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
        senderDisplayName: 'Alice',
        createdOn: new Date(),
        deletedOn,
        version: '3',
        type: 'text',
        recipient: { communicationUserId: 'user-bob' } as unknown as CommunicationIdentifierKind,
      };

      const domainEvent = normalizeChatMessageDeleted(acsEvent);

      expect(domainEvent.type).toBe('message:deleted');
      expect(domainEvent.conversationId).toBe('thread-abc');
      expect(domainEvent.timestamp).toEqual(deletedOn);
      expect(domainEvent.payload.id).toBe('msg-del');
      expect(domainEvent.payload.deletedAt).toEqual(deletedOn);
    });

    it('normalizeTypingIndicatorReceived should map typing indicator event', () => {
      const receivedOn = new Date();
      const acsEvent: TypingIndicatorReceivedEvent = {
        threadId: 'thread-abc',
        sender: { communicationUserId: 'user-bob' } as unknown as CommunicationIdentifierKind,
        senderDisplayName: 'Bob',
        receivedOn,
        version: '1',
        recipient: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
      };

      const domainEvent = normalizeTypingIndicatorReceived(acsEvent);

      expect(domainEvent.type).toBe('typing:started');
      expect(domainEvent.conversationId).toBe('thread-abc');
      expect(domainEvent.payload.user).toEqual({ id: 'user-bob', displayName: 'Bob' });
      expect(domainEvent.payload.receivedOn).toEqual(receivedOn);
    });

    it('normalizeReadReceiptReceived should map read receipt event', () => {
      const readOn = new Date();
      const acsEvent: ReadReceiptReceivedEvent = {
        threadId: 'thread-abc',
        chatMessageId: 'msg-99',
        sender: { communicationUserId: 'user-bob' } as unknown as CommunicationIdentifierKind,
        readOn,
        senderDisplayName: 'Bob',
        recipient: { communicationUserId: 'user-alice' } as unknown as CommunicationIdentifierKind,
      };

      const domainEvent = normalizeReadReceiptReceived(acsEvent);

      expect(domainEvent.type).toBe('readReceipt:received');
      expect(domainEvent.conversationId).toBe('thread-abc');
      expect(domainEvent.payload).toEqual({
        messageId: 'msg-99',
        user: { id: 'user-bob', displayName: undefined },
        readOn,
      });
    });

    it('normalizeChatThreadCreated should map thread created event', async () => {
      const createdOn = new Date();
      const acsEvent: ChatThreadCreatedEvent = {
        threadId: 'thread-new',
        version: '1',
        createdOn,
        createdBy: {
          id: { communicationUserId: 'user-admin' } as unknown as CommunicationIdentifierKind,
          displayName: 'Admin User',
          metadata: {},
        },
        properties: {
          topic: 'Project Planning',
          metadata: { category: 'dev' },
        },
        participants: [
          {
            id: { communicationUserId: 'user-1' } as unknown as CommunicationIdentifierKind,
            displayName: 'User 1',
            metadata: {},
          },
        ],
        retentionPolicy: { kind: 'none' },
      };

      const domainEvent = await normalizeChatThreadCreated(acsEvent);

      expect(domainEvent.type).toBe('conversation:created');
      expect(domainEvent.conversationId).toBe('thread-new');
      expect(domainEvent.payload.name).toBe('Project Planning');
      expect(domainEvent.payload.createdBy).toEqual({
        id: 'user-admin',
        displayName: 'Admin User',
      });
      expect(domainEvent.payload.participants.length).toBe(1);
      expect(domainEvent.payload.participants[0].id).toBe('user-1');
    });

    it('normalizeChatThreadDeleted should map thread deleted event', () => {
      const deletedOn = new Date();
      const acsEvent: ChatThreadDeletedEvent = {
        threadId: 'thread-del',
        version: '2',
        deletedOn,
        deletedBy: {
          id: { communicationUserId: 'user-admin' } as unknown as CommunicationIdentifierKind,
          displayName: 'Admin',
          metadata: {},
        },
        reason: 'Archived',
      };

      const domainEvent = normalizeChatThreadDeleted(acsEvent);

      expect(domainEvent.type).toBe('conversation:deleted');
      expect(domainEvent.conversationId).toBe('thread-del');
      expect(domainEvent.payload.reason).toBe('Archived');
      expect(domainEvent.payload.deletedBy).toEqual({ id: 'user-admin', displayName: 'Admin' });
    });

    it('normalizeChatThreadPropertiesUpdated should map thread updated event', () => {
      const updatedOn = new Date();
      const acsEvent: ChatThreadPropertiesUpdatedEvent = {
        threadId: 'thread-1',
        version: '3',
        updatedOn,
        updatedBy: {
          id: { communicationUserId: 'user-editor' } as unknown as CommunicationIdentifierKind,
          displayName: 'Editor',
          metadata: {},
        },
        properties: {
          topic: 'New Topic Name',
          metadata: { status: 'active' },
        },
        retentionPolicy: { kind: 'none' },
      };

      const domainEvent = normalizeChatThreadPropertiesUpdated(acsEvent);

      expect(domainEvent.type).toBe('conversation:updated');
      expect(domainEvent.conversationId).toBe('thread-1');
      expect(domainEvent.payload.name).toBe('New Topic Name');
      expect(domainEvent.payload.updatedBy).toEqual({ id: 'user-editor', displayName: 'Editor' });
    });

    it('normalizeParticipantsAdded should map participants added event', () => {
      const addedOn = new Date();
      const acsEvent: ParticipantsAddedEvent = {
        threadId: 'thread-1',
        version: '4',
        addedOn,
        addedBy: {
          id: { communicationUserId: 'user-admin' } as unknown as CommunicationIdentifierKind,
          displayName: 'Admin',
          metadata: {},
        },
        participantsAdded: [
          {
            id: { communicationUserId: 'user-new' } as unknown as CommunicationIdentifierKind,
            displayName: 'New Member',
            metadata: {},
          },
        ],
      };

      const domainEvent = normalizeParticipantsAdded(acsEvent);

      expect(domainEvent.type).toBe('participant:added');
      expect(domainEvent.conversationId).toBe('thread-1');
      expect(domainEvent.payload.participants.length).toBe(1);
      expect(domainEvent.payload.participants[0].displayName).toBe('New Member');
    });

    it('normalizeParticipantsRemoved should map participants removed event', () => {
      const removedOn = new Date();
      const acsEvent: ParticipantsRemovedEvent = {
        threadId: 'thread-1',
        version: '5',
        removedOn,
        removedBy: {
          id: { communicationUserId: 'user-admin' } as unknown as CommunicationIdentifierKind,
          displayName: 'Admin',
          metadata: {},
        },
        participantsRemoved: [
          {
            id: { communicationUserId: 'user-old' } as unknown as CommunicationIdentifierKind,
            displayName: 'Old Member',
            metadata: {},
          },
        ],
      };

      const domainEvent = normalizeParticipantsRemoved(acsEvent);

      expect(domainEvent.type).toBe('participant:removed');
      expect(domainEvent.conversationId).toBe('thread-1');
      expect(domainEvent.payload.participants.length).toBe(1);
      expect(domainEvent.payload.participants[0].id).toBe('user-old');
    });

    it('normalizeRealTimeConnected and normalizeRealTimeDisconnected should map connection status', () => {
      const connectedEvent = normalizeRealTimeConnected();
      expect(connectedEvent.type).toBe('connection:connected');
      expect(connectedEvent.payload.status).toBe('connected');

      const disconnectedEvent = normalizeRealTimeDisconnected();
      expect(disconnectedEvent.type).toBe('connection:disconnected');
      expect(disconnectedEvent.payload.status).toBe('disconnected');
    });
  });
});
