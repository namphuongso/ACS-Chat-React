import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { websocketService } from '../../services/websocketService';

describe('useWebSocket hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    websocketService.dispose();
  });

  it('should return initial state and action handlers', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.activeRoomId).toBeNull();
    expect(typeof result.current.enterRoom).toBe('function');
    expect(typeof result.current.leaveRoom).toBe('function');
    expect(typeof result.current.sendRead).toBe('function');
    expect(typeof result.current.sendHeartbeat).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
  });

  it('should update activeRoomId when enterRoom and leaveRoom are called', () => {
    const enterRoomSpy = vi.spyOn(websocketService, 'enterRoom').mockReturnValue(true);
    const leaveRoomSpy = vi.spyOn(websocketService, 'leaveRoom').mockReturnValue(true);

    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.enterRoom('room-123', 'msg-1');
    });

    expect(enterRoomSpy).toHaveBeenCalledWith('room-123', 'msg-1');
    expect(result.current.activeRoomId).toBe('room-123');

    act(() => {
      result.current.leaveRoom('msg-2');
    });

    expect(leaveRoomSpy).toHaveBeenCalledWith('msg-2');
    expect(result.current.activeRoomId).toBeNull();
  });
});
