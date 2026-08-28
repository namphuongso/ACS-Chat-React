import type {
  ChatMessage,
  SendMessageOptions,
  PinnedMessage,
  BackendGetMessagesData,
  BackendChatMessageItem,
} from '../types/message.types';
import { useMessageStore, dedupAndSortMessages } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { useConversationStore } from '../store/conversationStore';
import { mapAcsErrorToChatError, mapAcsMessageToMessage } from '../adapters/acs/acsMappers';
import { AcsChatError } from '../types/errors.types';
import { logger } from '../utils/logger';
import { findLastPersistedMessage, isDocumentVisible, isActiveConversation } from '../utils/messageUtils';
import { resolveRoomId } from '../utils/conversationKeys';
import { generateId } from '../utils/id';
import { fetchBackend } from '../utils/apiClient';
import type { ChatService } from './chatService';
import { websocketService } from './websocketService';

/**
 * Result of a message operation.
 */
export interface MessageResult {
  /** The message entity if operation succeeded */
  message?: ChatMessage;
  /** Error details if operation failed */
  error?: AcsChatError;
}

/**
 * Service for managing message CRUD operations with pagination support.
 * Uses backend API endpoints (/api/chat/...) and Zustand message store.
 */
export class MessageService {
  private chatServiceRef: ChatService | null = null;

  /**
   * Set the ChatService reference (injected after initialization).
   */
  public setChatService(service: ChatService): void {
    this.chatServiceRef = service;
  }

  /**
   * Get the initialized ChatService.
   */
  private getChatService(): ChatService {
    if (!this.chatServiceRef || !this.chatServiceRef.isInitialized()) {
      throw new AcsChatError('INVALID_INPUT', 'ChatService is not initialized.', {
        operation: 'getChatService',
      });
    }
    return this.chatServiceRef;
  }

  /**
   * Helper to resolve the backend room ID from a conversation/thread ID.
   */
  private getRoomId(conversationId: string): string {
    return resolveRoomId(conversationId, useConversationStore.getState().conversations);
  }

  /**
   * Load the initial page of messages for a conversation via backend API.
   * Supports optional continuationToken / maxPageSize.
   */
  public async loadMessages(
    conversationId: string,
    options?: { maxPageSize?: number; startTime?: Date; continuationToken?: string }
  ): Promise<MessageResult[]> {
    const msgStore = useMessageStore.getState();

    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'loadMessages',
      });
    }

    msgStore.setLoading(conversationId, true);

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'loadMessages',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'loadMessages',
        });
      }

      const currentUserId = useChatStore.getState().currentUser?.id;
      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadMessages',
        });
      }

      const roomId = this.getRoomId(conversationId);
      const pageSize = options?.maxPageSize || 50;
      let endpoint = `/api/chat/get-messages?roomId=${encodeURIComponent(roomId)}&pageSize=${pageSize}`;
      if (options?.continuationToken) {
        endpoint += `&continuationToken=${encodeURIComponent(options.continuationToken)}`;
      }
      if (options?.startTime) {
        endpoint += `&startTime=${encodeURIComponent(options.startTime.toISOString())}`;
      }

      const response = await fetchBackend<BackendGetMessagesData>(config, endpoint, {
        method: 'GET',
      });

      const responseData = response.data;
      const items = responseData?.items || [];
      const messages: ChatMessage[] = [];

      for (const item of items) {
        const rawMsg = (item as BackendChatMessageItem).data || item;
        const mapped = mapAcsMessageToMessage(rawMsg, conversationId, currentUserId);
        messages.push(mapped);
      }

      const nextContinuationToken = responseData?.continuationToken || null;
      const hasMore =
        responseData?.hasMore !== undefined
          ? responseData.hasMore
          : Boolean(nextContinuationToken && messages.length >= pageSize);

      const convState = msgStore.messagesByConversation[conversationId];
      const currentMessages = convState?.messages || [];
      const isInitialFetchBeforeOpen = !convState?.hasFetched;

      // If this is a subsequent refresh (hasFetched === true and no continuation token),
      // only keep pending optimistic messages so server-side recalled/deleted messages vanish.
      // If this is the first load (hasFetched === false), preserve any realtime messages
      // received via WebSocket before opening the room.
      const baseMessages =
        options?.continuationToken || isInitialFetchBeforeOpen
          ? currentMessages
          : currentMessages.filter((m) => m.status === 'sending' || m.id.startsWith('temp-'));
      const mergedMessages = dedupAndSortMessages(baseMessages, messages);

      msgStore.setMessages(conversationId, mergedMessages, hasMore, nextContinuationToken);
      msgStore.setLoading(conversationId, false);

      // If this conversation is currently active, mark the latest message as read via WebSocket
      const convStore = useConversationStore.getState();
      const isActive = isActiveConversation(
        convStore.activeConversationId,
        conversationId,
        roomId,
        convStore.conversations
      );
      if (isActive && isDocumentVisible() && mergedMessages.length > 0) {
        const lastMsg = findLastPersistedMessage(mergedMessages);
        if (lastMsg?.id) {
          websocketService.sendRead(lastMsg.id, roomId);
        }
      }

      return mergedMessages.map((message) => ({ message }));
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'loadMessages');
      msgStore.setLoading(conversationId, false);
      throw chatError;
    }
  }

  /**
   * Fetch only the latest message for a conversation via backend API, primarily used for state resync.
   * Does not replace the entire message list in the store, just adds/updates the latest.
   */
  public async loadLatestMessage(conversationId: string): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'loadLatestMessage',
      });
    }

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'loadLatestMessage',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'loadLatestMessage',
        });
      }

      const currentUserId = useChatStore.getState().currentUser?.id;
      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadLatestMessage',
        });
      }

      const roomId = this.getRoomId(conversationId);
      const endpoint = `/api/chat/get-messages?roomId=${encodeURIComponent(roomId)}&pageSize=1`;

      const response = await fetchBackend<BackendGetMessagesData>(config, endpoint, {
        method: 'GET',
      });

      const responseData = response.data;
      const items = responseData?.items || [];
      let latestMessage: ChatMessage | undefined;

      if (items.length > 0) {
        const rawMsg = (items[0] as BackendChatMessageItem).data || items[0];
        latestMessage = mapAcsMessageToMessage(rawMsg, conversationId, currentUserId);
      }

      if (latestMessage) {
        const msgStore = useMessageStore.getState();
        msgStore.addMessage(conversationId, latestMessage);
      }

      return { message: latestMessage };
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'loadLatestMessage');
      throw chatError;
    }
  }

  /**
   * Load older messages for pagination via backend API (prepend before the oldest loaded message).
   */
  public async loadMore(
    conversationId: string,
    options?: { maxPageSize?: number }
  ): Promise<MessageResult[]> {
    const msgStore = useMessageStore.getState();
    const convData = msgStore.messagesByConversation[conversationId];

    if (!convData) {
      throw new AcsChatError(
        'CONVERSATION_NOT_FOUND',
        `Conversation ${conversationId} not found.`,
        {
          operation: 'loadMore',
          conversationId,
        }
      );
    }

    if (!convData.hasMore || convData.loadingMore) {
      return [];
    }

    msgStore.setLoadingMore(conversationId, true);

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'loadMore',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'loadMore',
        });
      }

      const currentUserId = useChatStore.getState().currentUser?.id;
      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadMore',
        });
      }

      const roomId = this.getRoomId(conversationId);
      const pageSize = options?.maxPageSize || 50;
      const continuationToken = convData.continuationToken;

      let endpoint = `/api/chat/get-messages?roomId=${encodeURIComponent(roomId)}&pageSize=${pageSize}`;
      if (continuationToken) {
        endpoint += `&continuationToken=${encodeURIComponent(continuationToken)}`;
      }

      const response = await fetchBackend<BackendGetMessagesData>(config, endpoint, {
        method: 'GET',
      });

      const responseData = response.data;
      const items = responseData?.items || [];
      const olderMessages: ChatMessage[] = [];

      const existingIds = new Set(convData.messages.map((m) => m.id));
      for (const item of items) {
        const rawMsg = (item as BackendChatMessageItem).data || item;
        const mapped = mapAcsMessageToMessage(rawMsg, conversationId, currentUserId);
        if (!existingIds.has(mapped.id)) {
          olderMessages.push(mapped);
        }
      }

      const nextContinuationToken = responseData?.continuationToken || null;
      const hasMore =
        responseData?.hasMore !== undefined
          ? responseData.hasMore
          : Boolean(nextContinuationToken);

      msgStore.prependMessages(conversationId, olderMessages, hasMore, nextContinuationToken);
      msgStore.setLoadingMore(conversationId, false);

      return olderMessages.map((message) => ({ message }));
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'loadMore');
      msgStore.setLoadingMore(conversationId, false);
      throw chatError;
    }
  }

  /**
   * Send a new message with optimistic update.
   * Creates a temporary message in the store immediately, then replaces it with the server response.
   */
  public async sendMessage(
    conversationId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'sendMessage',
      });
    }

    const msgType = options?.metadata?.type;
    const isMediaOrFile = msgType === 'image' || msgType === 'video' || msgType === 'file';
    if (!isMediaOrFile && (!content || content.trim() === '')) {
      throw new AcsChatError('INVALID_INPUT', 'Message content cannot be empty.', {
        operation: 'sendMessage',
      });
    }

    const msgStore = useMessageStore.getState();
    const currentUser = useChatStore.getState().currentUser;
    const currentUserId = currentUser?.id;

    if (!currentUserId) {
      throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
        operation: 'sendMessage',
      });
    }

    // Generate temporary client ID for optimistic update
    const clientMessageId = options?.clientMessageId || generateId();
    const tempId = `temp-${clientMessageId}`;

    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId,
      type: options?.type || 'text',
      content,
      sender: {
        id: currentUserId,
        displayName: options?.senderDisplayName || currentUser?.displayName,
      },
      senderDisplayName: options?.senderDisplayName || currentUser?.displayName,
      createdAt: new Date(),
      status: 'sending',
      clientMessageId,
      metadata: options?.metadata,
      attachments: options?.attachments,
    };

    // Add optimistic message to store immediately
    msgStore.addMessage(conversationId, optimisticMessage);
    useConversationStore.getState().updateLastMessage(conversationId, optimisticMessage);

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'sendMessage',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'sendMessage',
        });
      }

      const roomId = this.getRoomId(conversationId);

      const responseData = await fetchBackend<string>(config, '/api/chat/send-message', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          content,
          metaData: {
            ...options?.metadata,
            clientMessageId,
          },
          attachments: options?.attachments,
        }),
      });

      let serverMessageId: string = '';
      if (typeof responseData.data === 'string') {
        serverMessageId = responseData.data;
      } else if (responseData.data && typeof responseData.data === 'object') {
        const d = responseData.data as Record<string, unknown>;
        serverMessageId = String(d.messageId ?? d.MessageId ?? d.id ?? d.Id ?? '');
      }

      if (serverMessageId && serverMessageId !== '[object Object]' && serverMessageId !== 'null' && serverMessageId !== 'undefined') {
        // Replace optimistic message with server-confirmed message
        const confirmedMessage: ChatMessage = {
          ...optimisticMessage,
          id: serverMessageId,
          clientMessageId,
          status: 'sent',
        };

        msgStore.addMessage(conversationId, confirmedMessage);
      }

      logger.info(`Message sent to conversation ${conversationId}: ${serverMessageId || 'ok'}`);
      return {
        message: {
          ...optimisticMessage,
          id: serverMessageId || tempId,
          status: 'sent',
        },
      };
    } catch (error) {
      // Optimistic update failed - mark message as failed
      msgStore.updateMessage(conversationId, tempId, { status: 'failed' });

      const chatError = mapAcsErrorToChatError(error, 'sendMessage', { messageId: tempId });
      logger.error(`Failed to send message to conversation ${conversationId}`, error);
      return { error: chatError };
    }
  }

  /**
   * Edit an existing message (only the sender can edit their own message).
   */
  public async editMessage(
    conversationId: string,
    messageId: string,
    newContent: string
  ): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'editMessage',
      });
    }

    if (!messageId || messageId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'messageId is required.', {
        operation: 'editMessage',
      });
    }

    if (!newContent || newContent.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Message content cannot be empty.', {
        operation: 'editMessage',
      });
    }

    const msgStore = useMessageStore.getState();
    const convData = msgStore.messagesByConversation[conversationId];
    const existingMessage = convData?.messages.find(
      (msg) => msg.id === messageId || msg.clientMessageId === messageId
    );

    if (!existingMessage) {
      return {
        error: new AcsChatError('MESSAGE_NOT_FOUND', `Message ${messageId} not found.`, {
          operation: 'editMessage',
          conversationId,
          messageId,
        }),
      };
    }

    // Store backup for rollback
    const backupContent = existingMessage.content;

    // Optimistic update
    msgStore.updateMessage(conversationId, messageId, {
      content: newContent,
      editedAt: new Date(),
      status: 'sent',
    });

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'editMessage',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'editMessage',
        });
      }

      const roomId = this.getRoomId(conversationId);

      await fetchBackend<boolean>(config, '/api/chat/update-message', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          content: newContent,
          messageId,
        }),
      });

      logger.info(`Message ${messageId} edited in conversation ${conversationId}`);
      return {
        message: {
          ...existingMessage,
          content: newContent,
          editedAt: new Date(),
        },
      };
    } catch (error) {
      // Rollback optimistic update
      msgStore.updateMessage(conversationId, messageId, {
        content: backupContent,
        editedAt: existingMessage.editedAt,
      });

      const chatError = mapAcsErrorToChatError(error, 'editMessage', { messageId });
      logger.error(`Failed to edit message ${messageId}`, error);
      return { error: chatError };
    }
  }

  /**
   * Delete a message (marks as deleted in the store, removes from ACS).
   */
  public async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<{ error?: AcsChatError }> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'deleteMessage',
      });
    }

    if (!messageId || messageId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'messageId is required.', {
        operation: 'deleteMessage',
      });
    }

    const msgStore = useMessageStore.getState();
    const convData = msgStore.messagesByConversation[conversationId];
    const existingMessage = convData?.messages.find(
      (msg) => msg.id === messageId || msg.clientMessageId === messageId
    );

    if (!existingMessage) {
      return {
        error: new AcsChatError('MESSAGE_NOT_FOUND', `Message ${messageId} not found.`, {
          operation: 'deleteMessage',
          conversationId,
          messageId,
        }),
      };
    }

    // Store backup for rollback
    const backupDeletedAt = existingMessage.deletedAt;

    // Optimistic update to deleted state
    msgStore.updateMessage(conversationId, messageId, {
      deletedAt: new Date(),
    });

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'deleteMessage',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'deleteMessage',
        });
      }

      const roomId = this.getRoomId(conversationId);

      await fetchBackend<boolean>(config, '/api/chat/delete-message', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          messageId,
        }),
      });

      logger.info(`Message ${messageId} deleted from conversation ${conversationId}`);
      return {};
    } catch (error) {
      // Rollback: restore the original deletedAt state
      msgStore.updateMessage(conversationId, messageId, {
        deletedAt: backupDeletedAt,
      });

      const chatError = mapAcsErrorToChatError(error, 'deleteMessage', { messageId });
      logger.error(`Failed to delete message ${messageId}`, error);
      return { error: chatError };
    }
  }

  /**
   * Retry sending a failed message.
   * Removes the failed message and resends it.
   */
  public async retryMessage(conversationId: string, messageId: string): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'retryMessage',
      });
    }

    if (!messageId || messageId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'messageId is required.', {
        operation: 'retryMessage',
      });
    }

    const msgStore = useMessageStore.getState();
    const convData = msgStore.messagesByConversation[conversationId];
    const failedMessage = convData?.messages.find(
      (msg) => msg.id === messageId && msg.status === 'failed'
    );

    if (!failedMessage) {
      return {
        error: new AcsChatError(
          'MESSAGE_NOT_FOUND',
          `Failed message ${messageId} not found in conversation ${conversationId}.`,
          {
            operation: 'retryMessage',
            conversationId,
            messageId,
          }
        ),
      };
    }

    // Remove the failed message from the store
    msgStore.removeMessage(conversationId, messageId);

    // Resend with the original content and metadata
    const result = await this.sendMessage(conversationId, failedMessage.content, {
      type: failedMessage.type as 'text' | 'html',
      metadata: failedMessage.metadata,
      attachments: failedMessage.attachments,
    });

    if (result.error) {
      logger.error(`Failed to retry message ${messageId}`, result.error);
    } else {
      logger.info(`Message ${messageId} retried successfully`);
    }

    return result;
  }

  /**
   * Pin or unpin a message.
   */
  public async pinMessage(
    conversationId: string,
    messageId: string,
    pin: boolean
  ): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'pinMessage',
      });
    }

    if (!messageId || messageId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'messageId is required.', {
        operation: 'pinMessage',
      });
    }

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'pinMessage',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'pinMessage',
        });
      }

      await fetchBackend<boolean>(
        config,
        `/api/chat/pin-message?messageId=${messageId}&pin=${pin}`,
        {
          method: 'POST',
        }
      );

      logger.info(
        `Message ${messageId} pin status updated to ${pin} in conversation ${conversationId}`
      );
      return {};
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'pinMessage', { messageId });
      logger.error(`Failed to update pin status for message ${messageId}`, error);
      return { error: chatError };
    }
  }

  /**
   * Fetch pinned messages for a conversation
   */
  public async getPinnedMessages(
    conversationId: string
  ): Promise<{ data?: PinnedMessage[]; error?: AcsChatError }> {
    if (!conversationId || conversationId.trim() === '') {
      return {
        error: new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
          operation: 'getPinnedMessages',
        }),
      };
    }

    try {
      const config = this.getChatService().getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'getPinnedMessages',
        });
      }

      if (!config.backendUrl) {
        throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
          operation: 'getPinnedMessages',
        });
      }

      const res = await fetchBackend<PinnedMessage[]>(
        config,
        `/api/chat/get-pinned-messages/${conversationId}`,
        { method: 'GET' }
      );

      return { data: res.data };
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'getPinnedMessages', { conversationId });
      logger.error(`Failed to fetch pinned messages for conversation ${conversationId}`, error);
      return { error: chatError };
    }
  }
}

/**
 * Singleton instance of MessageService for global application usage.
 */
export const messageService = new MessageService();
