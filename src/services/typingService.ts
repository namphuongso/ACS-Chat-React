import type { ChatService } from './chatService';
import { useChatStore } from '../store/chatStore';
import { AcsChatError } from '../types/errors.types';
import { mapAcsErrorToChatError } from '../adapters/acs/acsMappers';

/**
 * Service for sending typing notifications.
 * Works with ACS ChatThreadClient adapters and handles request throttling.
 */
export class TypingService {
  private chatServiceRef: ChatService | null = null;

  // Track the last time a typing notification was sent per conversation ID
  private typingTimestamps = new Map<string, number>();

  // ACS typing indicators typically last 8 seconds.
  // We throttle to once every 8 seconds per conversation to prevent quota/rate limits.
  private readonly TYPING_THROTTLE_MS = 8000;

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
   * Send a typing notification to a conversation.
   * Throttles requests to avoid hitting rate limits.
   */
  public async sendTypingNotification(
    conversationId: string,
    options?: { senderDisplayName?: string }
  ): Promise<void> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'sendTypingNotification',
      });
    }

    const currentUserId = useChatStore.getState().currentUser?.id;
    if (!currentUserId) {
      throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
        operation: 'sendTypingNotification',
      });
    }

    const now = Date.now();
    const lastSent = this.typingTimestamps.get(conversationId) || 0;

    // Throttle: only send if the throttle duration has passed
    if (now - lastSent < this.TYPING_THROTTLE_MS) {
      return;
    }

    // Optimistically update timestamp to prevent immediate duplicate calls
    this.typingTimestamps.set(conversationId, now);

    try {
      const threadClient = this.getThreadClient(conversationId);
      const senderDisplayName =
        options?.senderDisplayName ||
        useChatStore.getState().currentUser?.displayName ||
        'Unknown User';

      await threadClient.sendTypingNotification({
        senderDisplayName,
      });
    } catch (error) {
      // Revert the timestamp on failure so it can be retried immediately if needed
      this.typingTimestamps.delete(conversationId);
      throw mapAcsErrorToChatError(error, 'sendTypingNotification', { conversationId });
    }
  }
}
