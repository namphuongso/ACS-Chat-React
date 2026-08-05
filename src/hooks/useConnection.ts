import { useCallback, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { connectionService } from '../services/connectionService';
import type { ConnectionState } from '../types/chat.types';

export interface UseConnectionResult {
  /**
   * The current connection state of the chat client
   */
  connectionState: ConnectionState;
  
  /**
   * Manually trigger a reconnection attempt
   */
  reconnect: () => Promise<void>;
}

export const useConnection = (): UseConnectionResult => {
  const connectionState = useChatStore((state) => state.connectionState);

  const reconnect = useCallback(async () => {
    await connectionService.reconnect();
  }, []);

  return useMemo(() => ({
    connectionState,
    reconnect,
  }), [connectionState, reconnect]);
};
