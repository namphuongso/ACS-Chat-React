import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useConnection } from '../useConnection';
import { useChatStore } from '../../store/chatStore';
import { connectionService } from '../../services/connectionService';

// Mock dependencies
vi.mock('../../store/chatStore', () => ({
  useChatStore: vi.fn(),
}));

vi.mock('../../services/connectionService', () => ({
  connectionService: {
    reconnect: vi.fn(),
  },
}));

describe('useConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns connectionState from chatStore', () => {
    (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { connectionState: 'connected' };
      return selector(state);
    });

    const { result } = renderHook(() => useConnection());

    expect(result.current.connectionState).toBe('connected');
  });

  it('calls connectionService.reconnect when reconnect is invoked', async () => {
    (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { connectionState: 'disconnected' };
      return selector(state);
    });
    
    (connectionService.reconnect as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { result } = renderHook(() => useConnection());

    await act(async () => {
      await result.current.reconnect();
    });

    expect(connectionService.reconnect).toHaveBeenCalledTimes(1);
  });

  it('memoizes reconnect function', () => {
    (useChatStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { connectionState: 'connecting' };
      return selector(state);
    });

    const { result, rerender } = renderHook(() => useConnection());
    const initialReconnect = result.current.reconnect;

    rerender();

    expect(result.current.reconnect).toBe(initialReconnect);
  });
});
