import { useCallback } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { selectAllConversations, selectActiveConversation } from '../store/selectors';
import { conversationService } from '../services/conversationService';
import type { ListConversationsOptions } from '../services/conversationService';
import type { CreateDirectConversationOptions, CreateGroupConversationOptions } from '../types/conversation.types';

/**
 * Hook to manage the list of conversations and conversation-level operations.
 * @returns {Object} Conversation state and methods
 * @property {Conversation[]} conversations - The list of loaded conversations
 * @property {Conversation | null} activeConversation - The currently active conversation
 * @property {boolean} loading - True if conversations are currently loading
 * @property {boolean} loadingMore - True if fetching the next page of conversations
 * @property {boolean} hasMore - True if there are more conversations to load
 * @property {AcsChatError | null} error - Any error that occurred during operations
 * @property {Function} loadConversations - Method to load the initial list of conversations
 * @property {Function} loadMore - Method to load the next page of conversations
 * @property {Function} openConversation - Method to set a conversation as active
 * @property {Function} closeConversation - Method to clear the active conversation
 * @property {Function} createDirectConversation - Method to create a 1:1 conversation
 * @property {Function} createGroupConversation - Method to create a group conversation
 * @property {Function} deleteConversation - Method to delete a conversation
 * @property {Function} leaveConversation - Method to leave a conversation
 */
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
