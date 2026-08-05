import { useCallback } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { selectAllConversations, selectActiveConversation } from '../store/selectors';
import { conversationService } from '../services/conversationService';
import type { ListConversationsOptions } from '../services/conversationService';
import type { CreateDirectConversationOptions, CreateGroupConversationOptions } from '../types/conversation.types';

export const useConversations = () => {
  const loading = useConversationStore((state) => state.loading);
  const loadingMore = useConversationStore((state) => state.loadingMore);
  const hasMore = useConversationStore((state) => state.hasMore);
  const error = useConversationStore((state) => state.error);
  
  const conversations = useConversationStore(selectAllConversations);
  const activeConversation = useConversationStore(selectActiveConversation);

  const loadConversations = useCallback(async (options?: ListConversationsOptions) => {
    return await conversationService.loadConversations(options);
  }, []);

  const loadMore = useCallback(async () => {
    // To be implemented: pagination logic
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    conversationService.openConversation(conversationId);
  }, []);

  const closeConversation = useCallback(() => {
    conversationService.closeConversation();
  }, []);

  const createDirectConversation = useCallback(async (options: CreateDirectConversationOptions) => {
    return await conversationService.createDirectConversation(options);
  }, []);

  const createGroupConversation = useCallback(async (options: CreateGroupConversationOptions) => {
    return await conversationService.createGroupConversation(options);
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    return await conversationService.deleteConversation(conversationId);
  }, []);

  const leaveConversation = useCallback(async (conversationId: string) => {
    return await conversationService.leaveConversation(conversationId);
  }, []);

  return {
    conversations,
    activeConversation,
    loading,
    loadingMore,
    hasMore,
    error,
    loadConversations,
    loadMore,
    openConversation,
    closeConversation,
    createDirectConversation,
    createGroupConversation,
    deleteConversation,
    leaveConversation,
  };
};
