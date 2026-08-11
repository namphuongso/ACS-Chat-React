import { useState, useCallback, useEffect } from 'react';
import { messageService } from '../services/messageService';
import { useMessageStore } from '../store/messageStore';
import type { PinnedMessage } from '../types/message.types';
import type { AcsChatError } from '../types/errors.types';

/**
 * Hook to manage pinned messages for a specific conversation.
 * @param conversationId The ID of the conversation
 * @param dependencies Optional dependencies to trigger a refetch (e.g., pinnedMessageIds)
 */
export const usePinnedMessages = (
  threadId: string,
  backendConversationId?: string,
  dependencies: unknown[] = []
) => {
  const { messagesByConversation, setLoadingPinned, setHasFetchedPinned, setPinnedMessages: setStorePinnedMessages } = useMessageStore();
  
  const conversationData = messagesByConversation[threadId] || {};
  const pinnedMessages = conversationData.pinnedMessages || [];
  const loading = conversationData.loadingPinned || false;

  const [error, setError] = useState<AcsChatError | null>(null);

  const loadPinnedMessages = useCallback(async () => {
    if (!threadId || !backendConversationId) return;
    
    // Prevent concurrent fetches if already loading or if we already fetched
    const currentConvData = useMessageStore.getState().messagesByConversation[threadId];
    if (currentConvData?.loadingPinned || currentConvData?.hasFetchedPinned) {
      return;
    }

    setLoadingPinned(threadId, true);
    setError(null);
    
    const { data, error: fetchError } = await messageService.getPinnedMessages(backendConversationId);
    
    if (fetchError) {
      setError(fetchError);
    } else if (data) {
      setStorePinnedMessages(threadId, data);
    }
    
    setHasFetchedPinned(threadId, true);
    setLoadingPinned(threadId, false);
  }, [threadId, backendConversationId, setLoadingPinned, setStorePinnedMessages, setHasFetchedPinned]);

  useEffect(() => {
    loadPinnedMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPinnedMessages, ...dependencies]);

  return {
    pinnedMessages,
    setPinnedMessages: (msgs: PinnedMessage[]) => setStorePinnedMessages(threadId, msgs),
    loading,
    error,
    loadPinnedMessages,
  };
};
