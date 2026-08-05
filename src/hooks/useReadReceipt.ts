import { useCallback, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { useParticipantStore } from '../store/participantStore';
import { useMessageStore } from '../store/messageStore';
import { readReceiptService } from '../services/readReceiptService';

export interface MessageReadStatus {
  readBy: string[];
  readByAll: boolean;
}

/**
 * Hook to manage read receipts for a specific conversation.
 * @param {string} conversationId - The ID of the conversation
 * @returns {Object} Read receipt state and methods
 * @property {Function} getMessageReadStatus - Method to get the read status for a specific message
 * @property {boolean} readReceiptsSupported - Whether read receipts are supported (requires <= 20 participants)
 * @property {Function} sendReadReceipt - Method to send a read receipt for a specific message
 */
export function useReadReceipt(conversationId: string) {
  const currentUser = useChatStore((state) => state.currentUser);
  
  // Track read receipts for this conversation
  const readReceipts = useParticipantStore(
    (state) => state.readReceipts[conversationId] || {}
  );
  
  // Get participants to calculate readByAll
  const participants = useParticipantStore(
    (state) => state.participantsByConversation[conversationId] || []
  );

  // We need messages to get their createdAt time
  const messages = useMessageStore(
    (state) => state.messagesByConversation[conversationId]?.messages || []
  );

  const readReceiptsSupported = useMemo(() => {
    return participants.length > 0 && participants.length <= 20;
  }, [participants.length]);

  const getMessageReadStatus = useCallback(
    (messageId: string): MessageReadStatus => {
      const message = messages.find((m) => m.id === messageId || m.clientMessageId === messageId);
      
      if (!message || !message.createdAt) {
        return { readBy: [], readByAll: false };
      }
      
      const messageTime = new Date(message.createdAt).getTime();
      const readBy: string[] = [];
      
      // Other participants
      const otherParticipants = participants.filter(p => p.id !== currentUser?.id);
      
      otherParticipants.forEach((p) => {
        const receipt = readReceipts[p.id];
        if (receipt && new Date(receipt.readOn).getTime() >= messageTime) {
          readBy.push(p.id);
        }
      });
      
      return {
        readBy,
        readByAll: otherParticipants.length > 0 && readBy.length === otherParticipants.length,
      };
    },
    [messages, participants, currentUser, readReceipts]
  );

  const sendReadReceipt = useCallback(
    async (messageId: string) => {
      if (!readReceiptsSupported || !conversationId) return;
      try {
        await readReceiptService.sendReadReceipt(conversationId, messageId);
      } catch (error) {
        console.warn('Failed to send read receipt', error);
      }
    },
    [conversationId, readReceiptsSupported]
  );

  return useMemo(() => ({
    getMessageReadStatus,
    readReceiptsSupported,
    sendReadReceipt,
  }), [getMessageReadStatus, readReceiptsSupported, sendReadReceipt]);
}
