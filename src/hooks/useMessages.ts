import { useCallback, useState } from 'react';
import { useMessageStore } from '../store/messageStore';
import { messageService } from '../services/messageService';
import type { SendMessageOptions } from '../types/message.types';
import type { AcsChatError } from '../types/errors.types';
import { initialConversationMessages } from '../store/messageStore';

export const useMessages = (conversationId: string) => {
  const [error, setError] = useState<AcsChatError | null>(null);

  // Safely select conversation data, falling back to initial state if not present
  const convData = useMessageStore((state) => 
    state.messagesByConversation[conversationId] || initialConversationMessages
  );

  const { messages, loading, loadingMore, hasMore } = convData;

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

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    retryMessage,
    loadMore,
  };
};
