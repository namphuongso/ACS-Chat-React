import { useCallback, useMemo } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { selectAllConversations, selectActiveConversation } from '../store/selectors';
import { conversationService } from '../services/conversationService';
import type { ListConversationsOptions } from '../services/conversationService';
import type { CreateDirectConversationOptions, CreateGroupConversationOptions } from '../types/conversation.types';
import type { Contact } from '../types/contact.types';

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
 * @property {Function} updateTopic - Method to update the topic of a group conversation
 * @property {Function} deleteConversation - Method to delete a conversation
 * @property {Function} leaveConversation - Method to leave a conversation
 * @property {Function} joinRoom - Method to join a room by id
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
    if (loadingMore || !hasMore) return;
    
    // Read the current state to figure out how many pages we have
    // Assuming each page is maxPageSize (50 by default), we can calculate the next page
    // Or we could track a separate page state. Let's use conversation counts as an estimate.
    const currentCount = useConversationStore.getState().conversationIds.length;
    const nextPage = Math.floor(currentCount / 50) + 1;
    
    useConversationStore.getState().setLoadingMore(true);
    try {
      await conversationService.loadConversations({ page: nextPage, maxPageSize: 50 });
    } catch (e) {
      console.error('Failed to load more conversations', e);
    } finally {
      useConversationStore.getState().setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  const openConversation = useCallback((conversationId: string, contact?: Contact) => {
    conversationService.openConversation(conversationId, contact);
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

  const updateTopic = useCallback(async (conversationId: string, topic: string) => {
    return await conversationService.updateGroupTopic(conversationId, topic);
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    return await conversationService.deleteConversation(conversationId);
  }, []);

  const leaveConversation = useCallback(async (conversationId: string) => {
    return await conversationService.leaveConversation(conversationId);
  }, []);

  const joinRoom = useCallback(async (conversationId: string) => {
    return await conversationService.joinRoom(conversationId);
  }, []);

  return useMemo(() => ({
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
    updateTopic,
    deleteConversation,
    leaveConversation,
    joinRoom,
  }), [conversations, activeConversation, loading, loadingMore, hasMore, error, loadConversations, loadMore, openConversation, closeConversation, createDirectConversation, createGroupConversation, updateTopic, deleteConversation, leaveConversation, joinRoom]);
};
