import { useCallback } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../services/chatService';
import { connectionService } from '../services/connectionService';
import type { ChatConfig } from '../types/config.types';

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
