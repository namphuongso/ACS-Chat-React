import { useState, useEffect, useCallback, useMemo } from 'react';
import { websocketService } from '../services/websocketService';
import type { WsConnectionState } from '../types/websocket.types';

/**
 * Hook to access App-wide WebSocket Chat connection state and room actions.
 */
export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<WsConnectionState>(() =>
    websocketService.getConnectionState()
  );
  const [sessionId, setSessionId] = useState<string | null>(() =>
    websocketService.getSessionId()
  );
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    websocketService.getActiveRoomId()
  );

  useEffect(() => {
    // Sync initial state
    setConnectionState(websocketService.getConnectionState());
    setSessionId(websocketService.getSessionId());
    setActiveRoomId(websocketService.getActiveRoomId());

    const unsubscribe = websocketService.subscribe((event) => {
      if (event.type === 'ws:connected') {
        setConnectionState('connected');
        setSessionId(websocketService.getSessionId());
        setActiveRoomId(websocketService.getActiveRoomId());
      } else if (event.type === 'ws:disconnected') {
        setConnectionState('disconnected');
      } else if (event.type === 'ws:error') {
        setConnectionState(websocketService.getConnectionState());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const enterRoom = useCallback((roomId: string, lastVisibleMessageId?: string): boolean => {
    const success = websocketService.enterRoom(roomId, lastVisibleMessageId);
    setActiveRoomId(roomId);
    return success;
  }, []);

  const leaveRoom = useCallback((lastVisibleMessageId?: string): boolean => {
    const success = websocketService.leaveRoom(lastVisibleMessageId);
    setActiveRoomId(null);
    return success;
  }, []);

  const sendRead = useCallback((lastVisibleMessageId: string): boolean => {
    return websocketService.sendRead(lastVisibleMessageId);
  }, []);

  const sendHeartbeat = useCallback((lastVisibleMessageId?: string): boolean => {
    return websocketService.sendHeartbeat(lastVisibleMessageId);
  }, []);

  const reconnect = useCallback(async (): Promise<void> => {
    await websocketService.scheduleReconnect();
  }, []);

  const isConnected = connectionState === 'connected';

  return useMemo(
    () => ({
      connectionState,
      isConnected,
      sessionId,
      activeRoomId,
      enterRoom,
      leaveRoom,
      sendRead,
      sendHeartbeat,
      reconnect,
    }),
    [
      connectionState,
      isConnected,
      sessionId,
      activeRoomId,
      enterRoom,
      leaveRoom,
      sendRead,
      sendHeartbeat,
      reconnect,
    ]
  );
}
