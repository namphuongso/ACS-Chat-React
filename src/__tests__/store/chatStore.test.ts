import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore, initialChatState } from '../../store/chatStore';
import type { ChatUser, ConnectionState } from '../../types/chat.types';
import type { ChatError } from '../../types/errors.types';

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useChatStore.getState();

    expect(state.currentUser).toBeNull();
    expect(state.connectionState).toBe('disconnected');
    expect(state.initializing).toBe(false);
    expect(state.initError).toBeNull();
  });

  it('should update currentUser', () => {
    const user: ChatUser = {
      id: '8:acs:12345678-90ab-cdef-1234-567890abcdef_user1',
      displayName: 'Alice',
    };

    useChatStore.getState().setCurrentUser(user);
    expect(useChatStore.getState().currentUser).toEqual(user);

    useChatStore.getState().setCurrentUser(null);
    expect(useChatStore.getState().currentUser).toBeNull();
  });

  it('should update connectionState', () => {
    const states: ConnectionState[] = [
      'connecting',
      'connected',
      'reconnecting',
      'error',
      'disconnected',
    ];

    for (const connState of states) {
      useChatStore.getState().setConnectionState(connState);
      expect(useChatStore.getState().connectionState).toBe(connState);
    }
  });

  it('should update initializing flag', () => {
    useChatStore.getState().setInitializing(true);
    expect(useChatStore.getState().initializing).toBe(true);

    useChatStore.getState().setInitializing(false);
    expect(useChatStore.getState().initializing).toBe(false);
  });

  it('should update initError', () => {
    const error: ChatError = {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Token has expired',
      retryable: true,
      timestamp: new Date(),
    };

    useChatStore.getState().setInitError(error);
    expect(useChatStore.getState().initError).toEqual(error);

    useChatStore.getState().setInitError(null);
    expect(useChatStore.getState().initError).toBeNull();
  });

  it('should reset store to initial state', () => {
    const user: ChatUser = { id: 'user-1', displayName: 'Bob' };
    const error: ChatError = {
      code: 'NETWORK_ERROR',
      message: 'Network failed',
      retryable: true,
      timestamp: new Date(),
    };

    useChatStore.getState().setCurrentUser(user);
    useChatStore.getState().setConnectionState('connected');
    useChatStore.getState().setInitializing(true);
    useChatStore.getState().setInitError(error);

    expect(useChatStore.getState().currentUser).toEqual(user);
    expect(useChatStore.getState().connectionState).toBe('connected');

    useChatStore.getState().reset();

    expect(useChatStore.getState().currentUser).toEqual(initialChatState.currentUser);
    expect(useChatStore.getState().connectionState).toEqual(initialChatState.connectionState);
    expect(useChatStore.getState().initializing).toEqual(initialChatState.initializing);
    expect(useChatStore.getState().initError).toEqual(initialChatState.initError);
  });
});
