import { useCallback, useMemo } from 'react';
import { useParticipantStore } from '../store/participantStore';
import { selectTypingUsersByConversation } from '../store/selectors';
import { typingService } from '../services/typingService';
import { useChatStore } from '../store/chatStore';

/**
 * Hook to manage typing indicators for a specific conversation.
 * @param {string} conversationId - The ID of the conversation
 * @returns {Object} Typing indicator state and methods
 * @property {ChatParticipant[]} typingUsers - The list of users currently typing (excluding current user)
 * @property {string} typingDisplayText - A formatted string representing who is typing (e.g. "John is typing...")
 * @property {boolean} typingSupported - Whether typing indicators are supported for this conversation
 * @property {Function} sendTyping - Method to send a typing notification from the current user
 */
export const useTypingIndicator = (conversationId: string) => {
  const typingUsers = useParticipantStore((state) => 
    selectTypingUsersByConversation(state, conversationId)
  );

  const currentUser = useChatStore((state) => state.currentUser);

  // Filter out the current user if they happen to be in the typing map
  const activeTypingUsers = useMemo(() => {
    if (!currentUser) return typingUsers;
    return typingUsers.filter((user) => user.user.id !== currentUser.id);
  }, [typingUsers, currentUser]);

  const typingDisplayText = useMemo(() => {
    if (activeTypingUsers.length === 0) return '';
    
    if (activeTypingUsers.length === 1) {
      return `${activeTypingUsers[0].user.displayName || 'Someone'} is typing...`;
    }
    
    if (activeTypingUsers.length === 2) {
      const name1 = activeTypingUsers[0].user.displayName || 'Someone';
      const name2 = activeTypingUsers[1].user.displayName || 'Someone';
      return `${name1} and ${name2} are typing...`;
    }
    
    return `${activeTypingUsers.length} people are typing...`;
  }, [activeTypingUsers]);

  const typingSupported = true; // ACS chat supports typing notifications

  const sendTyping = useCallback(async (options?: { senderDisplayName?: string }) => {
    if (!conversationId) return;
    try {
      await typingService.sendTypingNotification(conversationId, options);
    } catch (err) {
      // Ephemeral error; generally ignored or just warned in console.
      console.warn('Failed to send typing notification:', err);
    }
  }, [conversationId]);

  return {
    typingUsers: activeTypingUsers,
    typingDisplayText,
    typingSupported,
    sendTyping,
  };
};
