import type { ChatMessage, SendMessageOptions } from '../types/message.types';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import { mapAcsErrorToChatError, mapAcsMessageToMessage } from '../adapters/acs/acsMappers';
import { AcsChatError } from '../types/errors.types';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';
import type { ChatService } from './chatService';

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
 * Works with ACS ChatThreadClient adapters and Zustand message store.
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
   * Get an ACS ChatThreadClient for a given conversation/thread ID.
   */
  private getThreadClient(conversationId: string) {
    const chatClient = this.getChatService().getChatClient();
    return chatClient.getChatThreadClient(conversationId);
  }

  /**
   * Load the initial page of messages for a conversation.
   * Supports optional startTime for fetching messages from a specific point.
   */
  public async loadMessages(
    conversationId: string,
    options?: { maxPageSize?: number; startTime?: Date }
  ): Promise<MessageResult[]> {
    const msgStore = useMessageStore.getState();

    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'loadMessages',
      });
    }

    msgStore.setLoading(conversationId, true);

    try {
      const threadClient = this.getThreadClient(conversationId);
      const maxPageSize = options?.maxPageSize || 50;
      const currentUserId = useChatStore.getState().currentUser?.id;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadMessages',
        });
      }

      const messages: ChatMessage[] = [];
      const iterable = threadClient.listMessages({
        maxPageSize,
        startTime: options?.startTime,
      });

      for await (const page of iterable.byPage()) {
        for (const acsMsg of page) {
          const { mapAcsMessageToMessage } = await import('../adapters/acs/acsMappers');
          const mapped = mapAcsMessageToMessage(acsMsg, conversationId, currentUserId);
          messages.push(mapped);
        }
        break; // Only first page for initial load
      }

      const hasMore = messages.length >= maxPageSize;
      msgStore.setMessages(conversationId, messages, hasMore);
      msgStore.setLoading(conversationId, false);

      return messages.map((message) => ({ message }));
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'loadMessages');
      msgStore.setLoading(conversationId, false);
      throw chatError;
    }
  }

  /**
   * Fetch only the latest message for a conversation, primarily used for state resync.
   * Does not replace the entire message list in the store, just adds/updates the latest.
   */
  public async loadLatestMessage(conversationId: string): Promise<MessageResult> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'loadLatestMessage',
      });
    }

    try {
      const threadClient = this.getThreadClient(conversationId);
      const currentUserId = useChatStore.getState().currentUser?.id;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadLatestMessage',
        });
      }

      // Fetch just the last 1 message
      const iterable = threadClient.listMessages({ maxPageSize: 1 });
      let latestMessage: ChatMessage | undefined;

      for await (const page of iterable.byPage()) {
        if (page.length > 0) {
          const { mapAcsMessageToMessage } = await import('../adapters/acs/acsMappers');
          latestMessage = mapAcsMessageToMessage(page[0], conversationId, currentUserId);
        }
        break; // Only need the very first message returned (which is the latest)
      }

      if (latestMessage) {
        // Add to message store
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
   * Load older messages for pagination (prepend before the oldest loaded message).
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
      const threadClient = this.getThreadClient(conversationId);
      const maxPageSize = options?.maxPageSize || 50;
      const currentUserId = useChatStore.getState().currentUser?.id;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadMore',
        });
      }

      // Use the oldest message timestamp as the end boundary for fetching older messages
      const oldestMsg = convData.messages[0];
      const endTime = oldestMsg?.createdAt
        ? new Date(oldestMsg.createdAt.getTime() - 1)
        : undefined;

      // List messages with startTime before the oldest message
      const olderMessages: ChatMessage[] = [];
      const pages = threadClient.listMessages({
        maxPageSize,
        startTime: endTime,
      });

      for await (const page of pages.byPage()) {
        // Filter out any messages that are already loaded (by ID)
        const existingIds = new Set(convData.messages.map((m) => m.id));
        for (const acsMsg of page) {
          const mapped = mapAcsMessageToMessage(acsMsg, conversationId, currentUserId);
          if (!existingIds.has(mapped.id)) {
            olderMessages.push(mapped);
          }
        }
        if (olderMessages.length > 0) break; // Only take first batch of new older messages
      }

      const hasMore = olderMessages.length >= maxPageSize;
      msgStore.prependMessages(conversationId, olderMessages, hasMore);
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

    if (!content || content.trim() === '') {
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
    const clientMessageId = generateId();
    const tempId = `temp-${clientMessageId}`;

    // Create optimistic message
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId,
      type: options?.type || 'text',
      content,
      sender: {
        id: currentUserId,
        displayName: currentUser?.displayName,
      },
      senderDisplayName: currentUser?.displayName,
      createdAt: new Date(),
      status: 'sending',
      clientMessageId,
      metadata: options?.metadata,
      attachments: options?.attachments,
    };

    // Add optimistic message to store immediately
    msgStore.addMessage(conversationId, optimisticMessage);

    try {
      const threadClient = this.getThreadClient(conversationId);

      const response = await threadClient.sendMessage(
        { content },
        {
          type: options?.type,
          metadata: options?.metadata,
        }
      );

      const serverMessageId = response.id;

      // Replace optimistic message with server-confirmed message
      const confirmedMessage: ChatMessage = {
        ...optimisticMessage,
        id: serverMessageId,
        clientMessageId,
        status: 'sent',
      };

      msgStore.addMessage(conversationId, confirmedMessage);

      logger.info(`Message sent to conversation ${conversationId}: ${serverMessageId}`);
      return { message: confirmedMessage };
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
      const threadClient = this.getThreadClient(conversationId);
      await threadClient.updateMessage(messageId, { content: newContent });

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
      const threadClient = this.getThreadClient(conversationId);
      await threadClient.deleteMessage(messageId);

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
}

/**
 * Singleton instance of MessageService for global application usage.
 */
export const messageService = new MessageService();
