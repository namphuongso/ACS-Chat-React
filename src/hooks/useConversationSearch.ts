import { useState, useCallback } from 'react';
import { chatService } from '../services/chatService';
import { fetchBackend } from '../utils/apiClient';
import { BackendConversationItem, Conversation } from '../types';
import { mapBackendItemToConversation } from '../adapters/acs/acsMappers';

export const useConversationSearch = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setConversations([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const config = chatService.getConfig();
      if (!config || !config.backendUrl) {
        throw new Error('Chat is not initialized or backendUrl is missing');
      }

      const endpoint = `/api/chat/get-room-chats?keyword=${encodeURIComponent(keyword)}&pageIndex=1&pageSize=50`;
      
      const response = await fetchBackend<BackendConversationItem[]>(
        { ...config, backendUrl: config.backendUrl },
        endpoint,
        { method: 'GET' }
      );

      const data = Array.isArray(response?.data) ? response.data : [];
      const mappedConversations = data.map(item => mapBackendItemToConversation(item));
      setConversations(mappedConversations);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    conversations,
    loading,
    error,
    search,
  };
};
