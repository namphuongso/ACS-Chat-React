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
import type { ChatClient } from '@azure/communication-chat';
import type { ChatDomainEvent, ChatEventHandler } from '../../types/events.types';
import type {
  ChatMessage,
  ConversationParticipant,
  Conversation,
  BackendConversationItem,
} from '../../types';
import type { ReadReceipt } from '../../models/ReadReceipt';
import { AcsChatError } from '../../types/errors.types';
import type { ChatConfig } from '../../types/config.types';
import { fetchBackend } from '../../utils/apiClient';
import {
  mapAcsIdentifierToUser,
  mapAcsParticipantToParticipant,
  mapAcsReadReceiptToReadReceipt,
  mapBackendItemToConversation,
} from './acsMappers';

export type ChatEventHandlerFn = (event: ChatDomainEvent) => void;

/**
 * Normalization helper functions for each ACS signaling event.
 */
export function normalizeChatMessageReceived(
  e: ChatMessageReceivedEvent
): ChatDomainEvent<ChatMessage> {
  const threadId = e?.threadId || '';
  const createdOn = e?.createdOn ? new Date(e.createdOn) : new Date();
  const type =
    e?.type === 'html' || e?.type === 'RichText/Html'
      ? 'html'
      : e?.type === 'topicUpdated' ||
          e?.type === 'participantAdded' ||
          e?.type === 'participantRemoved'
        ? 'system'
        : 'text';

  const sender = mapAcsIdentifierToUser(e?.sender, e?.senderDisplayName);

  return {
    type: 'message:received',
    conversationId: threadId,
    timestamp: createdOn,
    payload: {
      id: e?.id || '',
      conversationId: threadId,
      type,
      content: e?.message || '',
      sender,
      senderDisplayName: e?.senderDisplayName,
      createdAt: createdOn,
      status: 'sent',
      metadata: e?.metadata,
    },
  };
}

export function normalizeChatMessageEdited(
  e: ChatMessageEditedEvent
): ChatDomainEvent<ChatMessage> {
  const threadId = e?.threadId || '';
  const createdOn = e?.createdOn ? new Date(e.createdOn) : new Date();
  const editedOn = e?.editedOn ? new Date(e.editedOn) : createdOn;
  const type = e?.type === 'html' || e?.type === 'RichText/Html' ? 'html' : 'text';
  const sender = mapAcsIdentifierToUser(e?.sender, e?.senderDisplayName);

  return {
    type: 'message:edited',
    conversationId: threadId,
    timestamp: editedOn,
    payload: {
      id: e?.id || '',
      conversationId: threadId,
      type,
      content: e?.message || '',
      sender,
      senderDisplayName: e?.senderDisplayName,
      createdAt: createdOn,
      editedAt: editedOn,
      status: 'sent',
      metadata: e?.metadata,
    },
  };
}

export function normalizeChatMessageDeleted(e: ChatMessageDeletedEvent): ChatDomainEvent<{
  id: string;
  conversationId: string;
  deletedAt: Date;
  sender: ReturnType<typeof mapAcsIdentifierToUser>;
}> {
  const threadId = e?.threadId || '';
  const deletedOn = e?.deletedOn ? new Date(e.deletedOn) : new Date();
  const sender = mapAcsIdentifierToUser(e?.sender, e?.senderDisplayName);

  return {
    type: 'message:deleted',
    conversationId: threadId,
    timestamp: deletedOn,
    payload: {
      id: e?.id || '',
      conversationId: threadId,
      deletedAt: deletedOn,
      sender,
    },
  };
}

export function normalizeTypingIndicatorReceived(e: TypingIndicatorReceivedEvent): ChatDomainEvent<{
  user: ReturnType<typeof mapAcsIdentifierToUser>;
  receivedOn: Date;
  version?: string;
}> {
  const threadId = e?.threadId || '';
  const receivedOn = e?.receivedOn ? new Date(e.receivedOn) : new Date();
  const user = mapAcsIdentifierToUser(e?.sender, e?.senderDisplayName);

  return {
    type: 'typing:started',
    conversationId: threadId,
    timestamp: receivedOn,
    payload: {
      user,
      receivedOn,
      version: e?.version,
    },
  };
}

export function normalizeReadReceiptReceived(
  e: ReadReceiptReceivedEvent
): ChatDomainEvent<ReadReceipt> {
  const threadId = e?.threadId || '';
  const readOn = e?.readOn ? new Date(e.readOn) : new Date();
  const readReceipt = mapAcsReadReceiptToReadReceipt(e || ({} as ReadReceiptReceivedEvent));

  return {
    type: 'readReceipt:received',
    conversationId: threadId,
    timestamp: readOn,
    payload: readReceipt,
  };
}

export async function normalizeChatThreadCreated(
  e: ChatThreadCreatedEvent,
  config?: ChatConfig | null
): Promise<ChatDomainEvent<Conversation>> {
  console.log('🚀 ~ normalizeChatThreadCreated ~ e:', e);
  const threadId = e?.threadId || '';
  const createdOn = e?.createdOn ? new Date(e.createdOn) : new Date();
  const participants = Array.isArray(e?.participants)
    ? e.participants.map(mapAcsParticipantToParticipant)
    : [];
  const createdBy = e?.createdBy?.id
    ? mapAcsIdentifierToUser(e.createdBy.id, e.createdBy.displayName)
    : undefined;

  let name = e?.properties?.topic || '';
  let roomData: BackendConversationItem | undefined = undefined;

  if (config && threadId) {
    try {
      const endpoint = `api/chat/get-room-chats?keyword=${encodeURIComponent(threadId)}&pageIndex=1&pageSize=50`;
      const res = await fetchBackend<BackendConversationItem[]>(config, endpoint, {
        method: 'GET',
      });
      if (res && res.data && res.data.length > 0) {
        roomData = res.data[0];
        name = roomData.roomName || name;
      }
    } catch (err) {
      console.error('Error fetching room info for thread:', threadId, err);
    }
  }

  let payload: Conversation;

  if (roomData) {
    payload = mapBackendItemToConversation(roomData);
    // Merge participants if needed, though they might be in roomData
    if (participants.length > 0 && payload.participants.length === 0) {
      payload.participants = participants;
    }
    if (createdBy) {
      payload.createdBy = createdBy;
    }
  } else {
    // We do not have currentUserId here easily, but we just fallback to group if not sure
    // or just assume group if no backend data
    payload = {
      id: threadId,
      conversationId: threadId,
      type: 'group',
      name: name,
      createdAt: createdOn,
      metadata: e?.properties?.metadata,
      participants,
      unreadCount: 0,
      createdBy,
    };
  }

  return {
    type: 'conversation:created',
    conversationId: threadId,
    timestamp: createdOn,
    payload,
  };
}

export function normalizeChatThreadDeleted(e: ChatThreadDeletedEvent): ChatDomainEvent<{
  id: string;
  deletedAt: Date;
  deletedBy?: ReturnType<typeof mapAcsIdentifierToUser>;
  reason?: string;
}> {
  const threadId = e?.threadId || '';
  const deletedOn = e?.deletedOn ? new Date(e.deletedOn) : new Date();
  const deletedBy = e?.deletedBy?.id
    ? mapAcsIdentifierToUser(e.deletedBy.id, e.deletedBy.displayName)
    : undefined;

  return {
    type: 'conversation:deleted',
    conversationId: threadId,
    timestamp: deletedOn,
    payload: {
      id: threadId,
      deletedAt: deletedOn,
      deletedBy,
      reason: e?.reason,
    },
  };
}

export function normalizeChatThreadPropertiesUpdated(
  e: ChatThreadPropertiesUpdatedEvent
): ChatDomainEvent<{
  id: string;
  name: string;
  metadata?: Record<string, string>;
  updatedBy?: ReturnType<typeof mapAcsIdentifierToUser>;
  updatedAt: Date;
}> {
  const threadId = e?.threadId || '';
  const updatedOn = e?.updatedOn ? new Date(e.updatedOn) : new Date();
  const updatedBy = e?.updatedBy?.id
    ? mapAcsIdentifierToUser(e.updatedBy.id, e.updatedBy.displayName)
    : undefined;

  return {
    type: 'conversation:updated',
    conversationId: threadId,
    timestamp: updatedOn,
    payload: {
      id: threadId,
      name: e?.properties?.topic || '',
      metadata: e?.properties?.metadata,
      updatedBy,
      updatedAt: updatedOn,
    },
  };
}

export function normalizeParticipantsAdded(e: ParticipantsAddedEvent): ChatDomainEvent<{
  addedBy?: ReturnType<typeof mapAcsIdentifierToUser>;
  participants: ConversationParticipant[];
  addedAt: Date;
}> {
  const threadId = e?.threadId || '';
  const addedOn = e?.addedOn ? new Date(e.addedOn) : new Date();
  const addedBy = e?.addedBy?.id
    ? mapAcsIdentifierToUser(e.addedBy.id, e.addedBy.displayName)
    : undefined;
  const participants = Array.isArray(e?.participantsAdded)
    ? e.participantsAdded.map(mapAcsParticipantToParticipant)
    : [];

  return {
    type: 'participant:added',
    conversationId: threadId,
    timestamp: addedOn,
    payload: {
      addedBy,
      participants,
      addedAt: addedOn,
    },
  };
}

export function normalizeParticipantsRemoved(e: ParticipantsRemovedEvent): ChatDomainEvent<{
  removedBy?: ReturnType<typeof mapAcsIdentifierToUser>;
  participants: ConversationParticipant[];
  removedAt: Date;
}> {
  const threadId = e?.threadId || '';
  const removedOn = e?.removedOn ? new Date(e.removedOn) : new Date();
  const removedBy = e?.removedBy?.id
    ? mapAcsIdentifierToUser(e.removedBy.id, e.removedBy.displayName)
    : undefined;
  const participants = Array.isArray(e?.participantsRemoved)
    ? e.participantsRemoved.map(mapAcsParticipantToParticipant)
    : [];

  return {
    type: 'participant:removed',
    conversationId: threadId,
    timestamp: removedOn,
    payload: {
      removedBy,
      participants,
      removedAt: removedOn,
    },
  };
}

export function normalizeRealTimeConnected(): ChatDomainEvent<{ status: string }> {
  return {
    type: 'connection:connected',
    conversationId: '',
    timestamp: new Date(),
    payload: { status: 'connected' },
  };
}

export function normalizeRealTimeDisconnected(): ChatDomainEvent<{ status: string }> {
  return {
    type: 'connection:disconnected',
    conversationId: '',
    timestamp: new Date(),
    payload: { status: 'disconnected' },
  };
}

/**
 * Adapter responsible for subscribing to ACS real-time notifications
 * and normalizing events into domain events.
 */
export class AcsEventAdapter {
  private chatClient: ChatClient;
  private eventHandler: ChatEventHandler | ChatEventHandlerFn;
  private config?: ChatConfig | null;
  private listeners: Map<string, (...args: unknown[]) => void> = new Map();
  private isSubscribed = false;

  constructor(
    chatClient: ChatClient,
    eventHandler: ChatEventHandler | ChatEventHandlerFn,
    config?: ChatConfig | null
  ) {
    if (!chatClient) {
      throw new AcsChatError('INVALID_INPUT', 'ChatClient is required.', {
        operation: 'constructor',
      });
    }

    if (
      !eventHandler ||
      (typeof eventHandler !== 'function' &&
        typeof (eventHandler as ChatEventHandler).onEvent !== 'function')
    ) {
      throw new AcsChatError(
        'INVALID_INPUT',
        'ChatEventHandler is required and must implement onEvent or be a function.',
        {
          operation: 'constructor',
        }
      );
    }

    this.chatClient = chatClient;
    this.eventHandler = eventHandler;
    this.config = config;
  }

  /**
   * Subscribe to all 12 ACS real-time events.
   */
  public subscribeAll(): void {
    if (this.isSubscribed) {
      this.unsubscribeAll();
    }

    this.register('chatMessageReceived', (e: ChatMessageReceivedEvent) =>
      this.dispatch(normalizeChatMessageReceived(e))
    );
    this.register('chatMessageEdited', (e: ChatMessageEditedEvent) =>
      this.dispatch(normalizeChatMessageEdited(e))
    );
    this.register('chatMessageDeleted', (e: ChatMessageDeletedEvent) =>
      this.dispatch(normalizeChatMessageDeleted(e))
    );
    this.register('typingIndicatorReceived', (e: TypingIndicatorReceivedEvent) =>
      this.dispatch(normalizeTypingIndicatorReceived(e))
    );
    this.register('readReceiptReceived', (e: ReadReceiptReceivedEvent) =>
      this.dispatch(normalizeReadReceiptReceived(e))
    );
    this.register('chatThreadCreated', async (e: ChatThreadCreatedEvent) =>
      this.dispatch(await normalizeChatThreadCreated(e, this.config))
    );
    this.register('chatThreadDeleted', (e: ChatThreadDeletedEvent) =>
      this.dispatch(normalizeChatThreadDeleted(e))
    );
    this.register('chatThreadPropertiesUpdated', (e: ChatThreadPropertiesUpdatedEvent) =>
      this.dispatch(normalizeChatThreadPropertiesUpdated(e))
    );
    this.register('participantsAdded', (e: ParticipantsAddedEvent) =>
      this.dispatch(normalizeParticipantsAdded(e))
    );
    this.register('participantsRemoved', (e: ParticipantsRemovedEvent) =>
      this.dispatch(normalizeParticipantsRemoved(e))
    );
    this.register('realTimeNotificationConnected', () =>
      this.dispatch(normalizeRealTimeConnected())
    );
    this.register('realTimeNotificationDisconnected', () =>
      this.dispatch(normalizeRealTimeDisconnected())
    );

    this.isSubscribed = true;
  }

  /**
   * Unsubscribe from all 12 ACS real-time events.
   */
  public unsubscribeAll(): void {
    for (const [eventName, listener] of this.listeners.entries()) {
      if (typeof (this.chatClient as unknown as Record<string, unknown>).off === 'function') {
        (
          this.chatClient as unknown as {
            off: (event: string, listener: (...args: unknown[]) => void) => void;
          }
        ).off(eventName, listener);
      }
    }
    this.listeners.clear();
    this.isSubscribed = false;
  }

  private register<T = unknown>(eventName: string, listener: (e: T) => void): void {
    const fn = listener as (...args: unknown[]) => void;
    this.listeners.set(eventName, fn);
    if (typeof (this.chatClient as unknown as Record<string, unknown>).on === 'function') {
      (
        this.chatClient as unknown as {
          on: (event: string, listener: (...args: unknown[]) => void) => void;
        }
      ).on(eventName, fn);
    }
  }

  private dispatch(event: ChatDomainEvent): void {
    if (typeof this.eventHandler === 'function') {
      this.eventHandler(event);
    } else if (typeof this.eventHandler?.onEvent === 'function') {
      this.eventHandler.onEvent(event);
    }
  }
}
