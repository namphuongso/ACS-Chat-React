import { useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../services/chatService';
import { connectionService } from '../services/connectionService';
import type { ChatConfig } from '../types/config.types';

/**
 * Hook to manage the top-level chat state.
 * @returns {Object} Chat state and methods
 * @property {ConnectionState} connectionState - The current connection state to ACS
 * @property {ChatUser | null} currentUser - The current authenticated user
 * @property {boolean} initializing - True if the chat client is currently initializing
 * @property {AcsChatError | null} initError - Error if initialization failed
 * @property {Function} initialize - Method to initialize the chat client with configuration
 * @property {Function} disconnect - Method to disconnect and teardown the chat client
 */
export const useChat = () => {
  const connectionState = useChatStore((state) => state.connectionState);
  const currentUser = useChatStore((state) => state.currentUser);
  const initializing = useChatStore((state) => state.initializing);
  const initError = useChatStore((state) => state.initError);

  const initialize = useCallback(async (config: ChatConfig) => {
    await chatService.initialize(config);
    connectionService.setupNetworkListeners();
  }, []);

  const disconnect = useCallback(async () => {
    connectionService.teardownNetworkListeners();
    await chatService.dispose();
  }, []);

  return {
    connectionState,
    currentUser,
    initializing,
    initError,
    initialize,
    disconnect,
  };
};
