import { useCallback, useState, useMemo } from 'react';
import { useMessageStore } from '../store/messageStore';
import { messageService } from '../services/messageService';
import type { SendMessageOptions } from '../types/message.types';
import type { AcsChatError } from '../types/errors.types';
import { initialConversationMessages } from '../store/messageStore';

/**
 * Hook to manage messages for a specific conversation.
 * @param {string} conversationId - The ID of the conversation to manage messages for
 * @returns {Object} Message state and methods for the conversation
 * @property {ChatMessage[]} messages - The list of messages in the conversation
 * @property {boolean} loading - True if messages are currently loading
 * @property {boolean} loadingMore - True if fetching older messages
 * @property {boolean} hasMore - True if there are more older messages to load
 * @property {AcsChatError | null} error - Any error that occurred during message operations
 * @property {Function} sendMessage - Method to send a new message
 * @property {Function} editMessage - Method to edit an existing message
 * @property {Function} deleteMessage - Method to delete an existing message
 * @property {Function} retryMessage - Method to retry sending a failed message
 * @property {Function} loadMore - Method to load older messages
 */
export const useMessages = (conversationId: string) => {
  const [error, setError] = useState<AcsChatError | null>(null);

  // Safely select conversation data, falling back to initial state if not present
  const convData = useMessageStore((state) => 
    state.messagesByConversation[conversationId] || initialConversationMessages
  );

  const { messages, loading, loadingMore, hasMore } = convData;

  const loadMessages = useCallback(async (options?: { maxPageSize?: number; startTime?: Date }) => {
    setError(null);
    try {
      return await messageService.loadMessages(conversationId, options);
    } catch (err) {
      setError(err as AcsChatError);
      throw err;
    }
  }, [conversationId]);

  const loadMore = useCallback(async (options?: { maxPageSize?: number }) => {
    setError(null);
    try {
      return await messageService.loadMore(conversationId, options);
    } catch (err) {
      setError(err as AcsChatError);
      throw err;
    }
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    setError(null);
    const result = await messageService.sendMessage(conversationId, content, options);
    if (result.error) {
      setError(result.error);
    }
    return result;
  }, [conversationId]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    setError(null);
    const result = await messageService.editMessage(conversationId, messageId, newContent);
    if (result.error) {
      setError(result.error);
    }
    return result;
  }, [conversationId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    setError(null);
    const result = await messageService.deleteMessage(conversationId, messageId);
    if (result.error) {
      setError(result.error);
    }
    return result;
  }, [conversationId]);

  const retryMessage = useCallback(async (messageId: string) => {
    setError(null);
    const result = await messageService.retryMessage(conversationId, messageId);
    if (result.error) {
      setError(result.error);
    }
    return result;
  }, [conversationId]);

  return useMemo(() => ({
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    retryMessage,
    loadMessages,
    loadMore,
  }), [messages, loading, loadingMore, hasMore, error, sendMessage, editMessage, deleteMessage, retryMessage, loadMessages, loadMore]);
};
