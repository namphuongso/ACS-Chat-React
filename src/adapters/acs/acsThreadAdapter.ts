import type { ChatThreadClient } from '@azure/communication-chat';
import type {
  ChatMessage,
  SendMessageOptions,
  ListMessagesOptions,
  ConversationParticipant,
  AddParticipantOptions,
  Conversation,
} from '../../types';
import type { ReadReceipt } from '../../models/ReadReceipt';
import { AcsChatError } from '../../types/errors.types';
import {
  mapAcsMessageToMessage,
  mapAcsThreadPropertiesToConversation,
  mapAcsParticipantToParticipant,
  mapAcsReadReceiptToReadReceipt,
  mapAcsErrorToChatError,
} from './acsMappers';

/**
 * Adapter wrapping ACS ChatThreadClient operations and standardizing type responses.
 */
export class AcsThreadAdapter {
  private chatThreadClient: ChatThreadClient;
  private currentUserId: string;

  constructor(chatThreadClient: ChatThreadClient, currentUserId: string) {
    if (!chatThreadClient) {
      throw new AcsChatError('INVALID_INPUT', 'ChatThreadClient is required.', {
        operation: 'constructor',
      });
    }
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'currentUserId is required and must be a non-empty string.',
        { operation: 'constructor' }
      );
    }

    this.chatThreadClient = chatThreadClient;
    this.currentUserId = currentUserId;
  }

  /**
   * Get thread ID of the current ChatThreadClient.
   */
  public get threadId(): string {
    return this.chatThreadClient.threadId;
  }

  /**
   * Get underlying ChatThreadClient instance.
   */
  public getChatThreadClient(): ChatThreadClient {
    return this.chatThreadClient;
  }

  /**
   * Send a new chat message to the thread.
   */
  public async sendMessage(content: string, options?: SendMessageOptions): Promise<string> {
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Message content cannot be empty.', {
        operation: 'sendMessage',
      });
    }

    try {
      let acsMetadata: Record<string, string> | undefined;
      if (options?.metadata) {
        acsMetadata = {};
        for (const [key, val] of Object.entries(options.metadata)) {
          if (typeof val === 'string') {
            acsMetadata[key] = val;
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            acsMetadata[key] = String(val);
          } else if (val !== undefined && val !== null) {
            acsMetadata[key] = JSON.stringify(val);
          }
        }
      }

      const response = await this.chatThreadClient.sendMessage(
        { content },
        {
          type: options?.type,
          metadata: acsMetadata,
        }
      );
      return response.id;
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'sendMessage');
    }
  }

  /**
   * Fetch a single message by ID.
   */
  public async getMessage(messageId: string): Promise<ChatMessage> {
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'messageId is required and must be a non-empty string.',
        { operation: 'getMessage' }
      );
    }

    try {
      const acsMsg = await this.chatThreadClient.getMessage(messageId);
      return mapAcsMessageToMessage(acsMsg, this.threadId, this.currentUserId);
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'getMessage');
    }
  }

  /**
   * List messages in thread as paged pages of ChatMessage arrays.
   */
  public async *listMessages(options?: ListMessagesOptions): AsyncIterableIterator<ChatMessage[]> {
    try {
      const paged = this.chatThreadClient.listMessages({
        maxPageSize: options?.maxPageSize,
        startTime: options?.startTime,
      });
      for await (const page of paged.byPage()) {
        yield page.map((msg) => mapAcsMessageToMessage(msg, this.threadId, this.currentUserId));
      }
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'listMessages');
    }
  }

  /**
   * Update message content.
   */
  public async updateMessage(messageId: string, content: string): Promise<void> {
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'messageId is required and must be a non-empty string.',
        { operation: 'updateMessage' }
      );
    }
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Message content cannot be empty.', {
        operation: 'updateMessage',
      });
    }

    try {
      await this.chatThreadClient.updateMessage(messageId, { content });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'updateMessage');
    }
  }

  /**
   * Delete a message from the thread.
   */
  public async deleteMessage(messageId: string): Promise<void> {
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'messageId is required and must be a non-empty string.',
        { operation: 'deleteMessage' }
      );
    }

    try {
      await this.chatThreadClient.deleteMessage(messageId);
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'deleteMessage');
    }
  }

  /**
   * Add new participants to the thread.
   */
  public async addParticipants(participants: AddParticipantOptions[]): Promise<void> {
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new AcsChatError('INVALID_INPUT', 'participants must be a non-empty array.', {
        operation: 'addParticipants',
      });
    }

    for (const p of participants) {
      if (!p.userId || typeof p.userId !== 'string' || p.userId.trim() === '') {
        throw new AcsChatError(
          'INVALID_INPUT',
          'Each participant must have a valid non-empty userId.',
          { operation: 'addParticipants' }
        );
      }
    }

    try {
      const acsParticipants = participants.map((p) => ({
        id: { communicationUserId: p.userId },
        displayName: p.displayName,
        shareHistoryTime: p.shareHistoryTime,
      }));
      await this.chatThreadClient.addParticipants({ participants: acsParticipants });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'addParticipants');
    }
  }

  /**
   * Remove a participant from the thread by userId.
   */
  public async removeParticipant(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'userId is required and must be a non-empty string.',
        { operation: 'removeParticipant' }
      );
    }

    try {
      await this.chatThreadClient.removeParticipant({
        communicationUserId: userId,
      });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'removeParticipant');
    }
  }

  /**
   * List all participants in the thread.
   */
  public async *listParticipants(): AsyncIterableIterator<ConversationParticipant[]> {
    try {
      const paged = this.chatThreadClient.listParticipants();
      for await (const page of paged.byPage()) {
        yield page.map((p) => mapAcsParticipantToParticipant(p));
      }
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'listParticipants');
    }
  }

  /**
   * Send a read receipt for a message.
   */
  public async sendReadReceipt(messageId: string): Promise<void> {
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      throw new AcsChatError(
        'INVALID_INPUT',
        'messageId is required and must be a non-empty string.',
        { operation: 'sendReadReceipt' }
      );
    }

    try {
      await this.chatThreadClient.sendReadReceipt({ chatMessageId: messageId });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'sendReadReceipt');
    }
  }

  /**
   * List read receipts for the thread.
   */
  public async *listReadReceipts(): AsyncIterableIterator<ReadReceipt[]> {
    try {
      const paged = this.chatThreadClient.listReadReceipts();
      for await (const page of paged.byPage()) {
        yield page.map((r) => mapAcsReadReceiptToReadReceipt(r));
      }
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'listReadReceipts');
    }
  }

  /**
   * Send a typing notification in the thread.
   */
  public async sendTypingNotification(): Promise<void> {
    try {
      await this.chatThreadClient.sendTypingNotification();
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'sendTypingNotification');
    }
  }

  /**
   * Update the topic of the thread.
   */
  public async updateTopic(topic: string): Promise<void> {
    if (typeof topic !== 'string' || topic.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'topic is required and must be a non-empty string.', {
        operation: 'updateTopic',
      });
    }

    try {
      await this.chatThreadClient.updateTopic(topic);
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'updateTopic');
    }
  }

  /**
   * Get properties of the thread.
   */
  public async getProperties(): Promise<Partial<Conversation>> {
    try {
      const props = await this.chatThreadClient.getProperties();
      return mapAcsThreadPropertiesToConversation(props);
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'getProperties');
    }
  }
}
