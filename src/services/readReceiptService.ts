import type { ChatService } from './chatService';
import { useChatStore } from '../store/chatStore';
import { useParticipantStore } from '../store/participantStore';
import { AcsChatError } from '../types/errors.types';
import { mapAcsErrorToChatError } from '../adapters/acs/acsMappers';

/**
 * Service for managing and sending read receipts.
 * Handles debouncing and limits based on participant count.
 */
export class ReadReceiptService {
  private chatServiceRef: ChatService | null = null;

  // Track debounce timers per conversation ID
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Track the last sent messageId per conversation to avoid redundant calls
  private lastSentMessageIds = new Map<string, string>();

  private readonly READ_RECEIPT_DEBOUNCE_MS = 300;
  private readonly MAX_PARTICIPANTS_FOR_READ_RECEIPTS = 20;

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
   * Request to send a read receipt.
   * This function is debounced to avoid flooding ACS.
   */
  public async sendReadReceipt(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'sendReadReceipt',
      });
    }

    if (!messageId || messageId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'messageId is required.', {
        operation: 'sendReadReceipt',
      });
    }

    const currentUserId = useChatStore.getState().currentUser?.id;
    if (!currentUserId) {
      throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
        operation: 'sendReadReceipt',
      });
    }

    // Participant count check (disable for > 20 participants per ACS limits)
    const participants =
      useParticipantStore.getState().participantsByConversation[conversationId] || [];
    if (participants.length > this.MAX_PARTICIPANTS_FOR_READ_RECEIPTS) {
      return; // Skip sending read receipts for large groups
    }

    // Skip if we've already sent a read receipt for this specific message
    if (this.lastSentMessageIds.get(conversationId) === messageId) {
      return;
    }

    // Clear previous timer for this conversation
    const existingTimer = this.debounceTimers.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce the actual ACS API call
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(conversationId);

      try {
        const threadClient = this.getThreadClient(conversationId);
        await threadClient.sendReadReceipt({ chatMessageId: messageId });

        // Mark this messageId as the last one we successfully requested a read receipt for
        this.lastSentMessageIds.set(conversationId, messageId);
      } catch (error) {
        // Log the error but don't crash, read receipts are not critical
        const mappedError = mapAcsErrorToChatError(error, 'sendReadReceipt', {
          conversationId,
          messageId,
        });
        console.warn(
          `[ReadReceiptService] Failed to send read receipt for ${messageId} in ${conversationId}:`,
          mappedError
        );
      }
    }, this.READ_RECEIPT_DEBOUNCE_MS);

    this.debounceTimers.set(conversationId, timer);
  }
}
export const readReceiptService = new ReadReceiptService();
