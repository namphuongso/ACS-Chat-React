import type { ChatClient } from '@azure/communication-chat';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { unstable_batchedUpdates } from 'react-dom';
import { AcsClientAdapter } from '../adapters/acs/acsClientAdapter';
import type { ReadReceipt } from '../models/ReadReceipt';
import { useChatStore } from '../store/chatStore';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useParticipantStore } from '../store/participantStore';
import type { ChatUser } from '../types/chat.types';
import type { ChatConfig } from '../types/config.types';
import type { Conversation } from '../types/conversation.types';
import { AcsChatError } from '../types/errors.types';
import type { ChatDomainEvent } from '../types/events.types';
import type { ChatMessage, PinnedMessage } from '../types/message.types';
import type { ConversationParticipant } from '../types/participant.types';
import { findConversationKey, resolveConversationKeys } from '../utils/conversationKeys';
import { websocketService } from './websocketService';
import { messageService } from './messageService';
import { readReceiptService } from './readReceiptService';
import { linkPreviewService } from './linkPreviewService';
import { resolveMessageFileMetadata } from '../utils/fileUtils';
import { logger, setLogger } from '../utils';

export type EventListenerFn = (event: ChatDomainEvent) => void;

/**
 * Core orchestration service for managing ACS Chat client lifecycle,
 * initializing adapters, subscribing to real-time events, and routing events to Zustand stores.
 */
export class ChatService {
  private clientAdapter: AcsClientAdapter | null = null;
  private config: ChatConfig | null = null;
  private initialized = false;
  private isInitializingFlag = false;
  private listeners = new Set<EventListenerFn>();

  /**
   * Initialize ACS Chat client, start WebSocket connection, and configure stores.
   */
  public async initialize(config: ChatConfig): Promise<void> {
    this.validateConfig(config);

    if (this.isInitializingFlag) {
      throw new AcsChatError(
        'INVALID_INPUT',
        'ChatService initialization is already in progress.',
        { operation: 'initialize' }
      );
    }

    if (this.initialized) {
      await this.dispose();
    }

    if (config.logger) {
      setLogger(config.logger);
    }

    this.isInitializingFlag = true;
    const chatStore = useChatStore.getState();
    chatStore.setInitializing(true);
    chatStore.setInitError(null);
    chatStore.setConnectionState('connecting');

    try {
      let credential: AzureCommunicationTokenCredential;
      if (typeof config.tokenRefresher === 'function') {
        credential = new AzureCommunicationTokenCredential({
          tokenRefresher: async () => {
            try {
              const newToken = await config.tokenRefresher();
              this.handleDomainEvent({
                type: 'token:refreshed',
                conversationId: '',
                timestamp: new Date(),
                payload: { token: newToken },
              });
              return newToken;
            } catch (error) {
              this.handleDomainEvent({
                type: 'token:refreshFailed',
                conversationId: '',
                timestamp: new Date(),
                payload: { error },
              });
              throw error;
            }
          },
          refreshProactively: true,
          token: config.token,
        });
      } else {
        credential = new AzureCommunicationTokenCredential(config.token);
      }

      this.clientAdapter = new AcsClientAdapter(config.endpoint, credential);

      linkPreviewService.setChatService(this);
      websocketService.setChatService(this);
      try {
        websocketService.initialize(config);
      } catch (err) {
        logger.warn('[ChatService] WebSocket initialization error (non-fatal):', err);
      }

      const hasWebSocket =
        config.enableWebSocket !== false && Boolean(config.websocketUrl || config.backendUrl);

      if (!hasWebSocket) {
        logger.warn(
          '[ChatService] Realtime is DISABLED: WebSocket is turned off or no websocketUrl/backendUrl ' +
            'was provided. The chat will only update via manual refresh — the removed ACS signaling ' +
            'realtime adapter is not available as a fallback.'
        );
      }

      chatStore.setCurrentUser({
        id: config.userId,
        displayName: config.displayName,
      });

      // If WebSocket is not used, connection is immediately considered connected;
      // otherwise, connectionState transitions to 'connected' upon ws:connected event.
      if (!hasWebSocket) {
        chatStore.setConnectionState('connected');
      } else if (websocketService.isConnected()) {
        chatStore.setConnectionState('connected');
      }
      chatStore.setInitializing(false);

      this.config = config;
      this.initialized = true;
    } catch (error) {
      if (this.clientAdapter) {
        try {
          this.clientAdapter.dispose();
        } catch {
          // Silent catch on error cleanup
        }
        this.clientAdapter = null;
      }

      try {
        websocketService.dispose();
      } catch {
        // Silent catch on error cleanup
      }

      const chatError =
        error instanceof AcsChatError
          ? error
          : new AcsChatError(
              'CONNECTION_FAILED',
              error instanceof Error ? error.message : 'Initialization failed',
              { cause: error, operation: 'initialize' }
            );

      chatStore.setInitError(chatError);
      chatStore.setConnectionState('error');
      chatStore.setInitializing(false);
      this.initialized = false;

      throw chatError;
    } finally {
      this.isInitializingFlag = false;
    }
  }

  /**
   * Stop WebSocket notifications, dispose adapters, and reset all store states.
   */
  public async dispose(): Promise<void> {
    useChatStore.getState().setConnectionState('disconnected');

    if (this.clientAdapter) {
      try {
        this.clientAdapter.dispose();
      } catch {
        // Ignore error during cleanup
      }
      this.clientAdapter = null;
    }

    try {
      websocketService.dispose();
    } catch {
      // Ignore error during cleanup
    }

    try {
      readReceiptService.dispose();
    } catch {
      // Ignore error during cleanup
    }

    setLogger(null);
    this.config = null;
    this.initialized = false;
    this.listeners.clear();

    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();
  }

  /**
   * Check whether ChatService has completed initialization.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the initialized AcsClientAdapter instance.
   */
  public getClientAdapter(): AcsClientAdapter {
    if (!this.clientAdapter || !this.initialized) {
      throw new AcsChatError('INVALID_INPUT', 'ChatService is not initialized.', {
        operation: 'getClientAdapter',
      });
    }
    return this.clientAdapter;
  }

  /**
   * Get the underlying ACS ChatClient instance.
   */
  public getChatClient(): ChatClient {
    return this.getClientAdapter().getChatClient();
  }

  /**
   * Get current ChatConfig used during initialization.
   */
  public getConfig(): ChatConfig | null {
    return this.config;
  }

  /**
   * Subscribe a listener callback to normalized domain events.
   */
  public subscribe(listener: EventListenerFn): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Handle incoming domain event and route it to the appropriate Zustand store actions.
   */
  public handleDomainEvent(event: ChatDomainEvent): void {
    unstable_batchedUpdates(() => {
      this.processDomainEvent(event);
    });
  }

  private processDomainEvent(event: ChatDomainEvent): void {
    const chatStore = useChatStore.getState();
    const convStore = useConversationStore.getState();
    const msgStore = useMessageStore.getState();
    const partStore = useParticipantStore.getState();

    switch (event.type) {
      case 'message:received': {
        const msg = event.payload as ChatMessage;
        msgStore.addMessage(event.conversationId, msg);
        convStore.updateLastMessage(event.conversationId, msg);
        const currentUserId = chatStore.currentUser?.id;
        const activeKey = convStore.activeConversationId
          ? findConversationKey(convStore.activeConversationId, convStore.conversations) ||
            convStore.activeConversationId
          : null;
        const eventKey =
          findConversationKey(event.conversationId, convStore.conversations) ||
          event.conversationId;
        if (activeKey !== eventKey && msg.sender?.id !== currentUserId) {
          convStore.incrementUnreadCount(event.conversationId, 1);
        } else if (activeKey === eventKey) {
          convStore.resetUnreadCount(event.conversationId);
        }
        if (msg.sender?.id) {
          partStore.removeTypingUser(event.conversationId, msg.sender.id);
        }
        break;
      }

      case 'message:edited': {
        const msg = event.payload as ChatMessage;
        msgStore.updateMessage(event.conversationId, msg.id, msg);

        // Refresh the conversation preview only if the edited message was
        // the most recent message in the conversation (sorted by sequenceId
        // then createdAt), instead of relying on content heuristics.
        const keys = resolveConversationKeys(event.conversationId, convStore.conversations);
        const isLastMessage = keys.some((k) => {
          const messages = useMessageStore.getState().messagesByConversation[k]?.messages;
          return !!messages?.length && messages[messages.length - 1].id === msg.id;
        });
        if (isLastMessage) {
          convStore.updateLastMessage(event.conversationId, msg);
        }
        break;
      }

      case 'message:deleted': {
        const payload = event.payload as { id: string; deletedAt: Date };
        msgStore.updateMessage(event.conversationId, payload.id, {
          deletedAt: payload.deletedAt,
        });
        break;
      }

      case 'message:pinned': {
        const payload = event.payload as {
          messageId: string;
          actorId?: string;
          actorName?: string;
          actionAtUtc?: string;
        };
        if (!payload?.messageId) break;

        const keys = resolveConversationKeys(event.conversationId, convStore.conversations);
        const convState = useMessageStore.getState().messagesByConversation;
        const isCachedAndFetched = keys.some((k) => convState[k]?.hasFetchedPinned === true);

        // Handling flow:
        // 1. If the get-pinned-messages API has been called and the data is cached,
        //    process the event against that cached set.
        // 2. If the API was never called or the data is not cached yet,
        //    skip the event entirely.
        if (!isCachedAndFetched) {
          break;
        }

        let foundMsg: ChatMessage | undefined;
        for (const key of keys) {
          const conv = convState[key];
          if (conv?.messages) {
            foundMsg = conv.messages.find(
              (m) => m.id === payload.messageId || m.clientMessageId === payload.messageId
            );
            if (foundMsg) break;
          }
        }

        const fileMeta = resolveMessageFileMetadata({
          meta: foundMsg?.metadata,
          attachments: foundMsg?.attachments,
          content: foundMsg?.content,
          type: foundMsg?.type,
        });

        const pinnedMsg: PinnedMessage = {
          messageId: payload.messageId,
          type: fileMeta.resolvedType,
          content: foundMsg?.content || fileMeta.fileName || '',
          createdDate:
            foundMsg?.createdAt instanceof Date
              ? foundMsg.createdAt.toISOString()
              : foundMsg?.createdAt
                ? String(foundMsg.createdAt)
                : payload.actionAtUtc || new Date().toISOString(),
          creator:
            foundMsg?.senderDisplayName || foundMsg?.sender?.displayName || payload.actorName || '',
          attachmentType: fileMeta.mimeType,
          attachmentUrl: fileMeta.url,
          thumbUrl: fileMeta.thumbUrl || (fileMeta.resolvedType === 'image' ? fileMeta.url : ''),
        };

        msgStore.addPinnedMessage(event.conversationId, pinnedMsg);

        // If the full message wasn't in cache, we can also fetch getPinnedMessages in background to ensure accurate content
        if (!foundMsg) {
          messageService
            .getPinnedMessages(event.conversationId)
            .then(({ data }) => {
              if (data) {
                msgStore.setPinnedMessages(event.conversationId, data);
              }
            })
            .catch((err) => {
              logger.warn(
                `Failed to sync pinned messages for conversation ${event.conversationId}`,
                err
              );
            });
        }
        break;
      }

      case 'message:unpinned': {
        const payload = event.payload as {
          messageId: string;
          actorId?: string;
          actorName?: string;
          actionAtUtc?: string;
        };
        if (!payload?.messageId) break;

        const keys = resolveConversationKeys(event.conversationId, convStore.conversations);
        const convState = useMessageStore.getState().messagesByConversation;
        const isCachedAndFetched = keys.some((k) => convState[k]?.hasFetchedPinned === true);

        // Handling flow:
        // 1. If the get-pinned-messages API has been called and the data is cached,
        //    process the event against that cached set.
        // 2. If the API was never called or the data is not cached yet,
        //    skip the event entirely.
        if (!isCachedAndFetched) {
          break;
        }

        msgStore.removePinnedMessage(event.conversationId, payload.messageId);
        break;
      }

      case 'typing:started': {
        const payload = event.payload as { user: ChatUser };
        const currentUserId = chatStore.currentUser?.id;
        if (payload.user?.id && payload.user.id !== currentUserId) {
          partStore.setTypingUser(event.conversationId, payload.user);
        }
        break;
      }

      case 'readReceipt:received': {
        const receipt = event.payload as ReadReceipt;
        partStore.addReadReceipt(event.conversationId, receipt);
        break;
      }

      case 'conversation:created': {
        const payload = event.payload as Conversation;

        convStore.addConversation(payload);
        if (payload.participants?.length > 0) {
          partStore.setParticipants(payload.id, payload.participants);
        }
        break;
      }

      case 'conversation:deleted': {
        const payload = event.payload as { id: string };
        convStore.removeConversation(payload.id || event.conversationId);
        break;
      }

      case 'conversation:updated': {
        const payload = event.payload as {
          id: string;
          name?: string;
          avatarUrl?: string;
          roomType?: string;
          metadata?: Record<string, string>;
          updatedAt?: Date;
        };
        // Only merge fields actually present in the payload. Backend events
        // (e.g. RoomUpdated) may omit optional fields, and merging undefined
        // would overwrite existing data with undefined via object spread.
        const updates: Partial<Conversation> = {};
        if (payload.name !== undefined) updates.name = payload.name;
        if (payload.avatarUrl !== undefined) updates.avatarUrl = payload.avatarUrl;
        if (payload.roomType !== undefined) updates.roomType = payload.roomType;
        if (payload.metadata !== undefined) updates.metadata = payload.metadata;
        if (payload.updatedAt !== undefined) updates.updatedAt = payload.updatedAt;
        convStore.updateConversation(payload.id || event.conversationId, updates);
        break;
      }

      case 'participant:added': {
        const payload = event.payload as { participants: ConversationParticipant[] };
        if (payload.participants?.length > 0) {
          partStore.addParticipants(event.conversationId, payload.participants);
        }
        break;
      }

      case 'participant:removed': {
        const payload = event.payload as {
          participants?: ConversationParticipant[];
          userId?: string;
          removedUserId?: string;
        };
        const currentUserId = chatStore.currentUser?.id;
        const targetUserId =
          payload.userId || payload.removedUserId || payload.participants?.[0]?.id;
        if (targetUserId && targetUserId === currentUserId) {
          convStore.removeConversation(event.conversationId);
        } else if (payload.participants?.length) {
          for (const p of payload.participants) {
            partStore.removeParticipant(event.conversationId, p.id);
          }
        } else if (targetUserId) {
          partStore.removeParticipant(event.conversationId, targetUserId);
        }
        break;
      }

      case 'ws:connected':
      case 'connection:connected': {
        chatStore.setConnectionState('connected');
        break;
      }

      case 'ws:disconnected':
      case 'connection:disconnected': {
        chatStore.setConnectionState('disconnected');
        break;
      }

      case 'room:pinned': {
        const payload = event.payload as { roomId?: string; pin?: boolean };
        const convId = payload?.roomId || event.conversationId;
        if (convId) {
          convStore.updateConversation(convId, { pin: true });
        }
        break;
      }

      case 'room:unpinned': {
        const payload = event.payload as { roomId?: string; pin?: boolean };
        const convId = payload?.roomId || event.conversationId;
        if (convId) {
          convStore.updateConversation(convId, { pin: false });
        }
        break;
      }

      case 'room:disbanded': {
        const convId = event.conversationId;
        if (convId) {
          convStore.removeConversation(convId);
        }
        break;
      }

      // TODO(message-reactions): wire up reaction store when reactions UI ships.
      case 'message:reacted':
      case 'message:reactionRemoved': {
        // Intentionally not handled yet; mapped by wsMappers but has no store
        // consumer. Kept explicit to avoid silent drops through default.
        break;
      }

      // TODO(room-roles): wire up owner/member-role store when role UI ships.
      case 'room:roleChanged':
      case 'room:ownershipTransferred': {
        // Intentionally not handled yet; mapped by wsMappers but has no store
        // consumer. Kept explicit to avoid silent drops through default.
        break;
      }

      default:
        break;
    }

    // Broadcast to custom listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // Protect loop from listener exceptions
        console.error('Error in ChatService event listener:', err);
      }
    }
  }

  private validateConfig(config: ChatConfig): void {
    if (!config || typeof config !== 'object') {
      throw new AcsChatError('INVALID_INPUT', 'ChatConfig is required.', {
        operation: 'initialize',
      });
    }

    if (!config.endpoint || typeof config.endpoint !== 'string' || config.endpoint.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Endpoint is required in ChatConfig.', {
        operation: 'initialize',
      });
    }

    if (!config.userId || typeof config.userId !== 'string' || config.userId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'UserId is required in ChatConfig.', {
        operation: 'initialize',
      });
    }

    if (!config.token || typeof config.token !== 'string' || config.token.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Token is required in ChatConfig.', {
        operation: 'initialize',
      });
    }
  }
}

/**
 * Singleton instance of ChatService for global application usage.
 */
export const chatService = new ChatService();
