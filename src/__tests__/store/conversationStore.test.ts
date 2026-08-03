import { describe, it, expect, beforeEach } from 'vitest';
import { useConversationStore, initialConversationState } from '../../store/conversationStore';
import {
  selectAllConversations,
  selectActiveConversation,
  selectConversationById,
  selectUnreadCountTotal,
  selectDirectConversations,
  selectGroupConversations,
} from '../../store/selectors';
import type { DirectConversation, GroupConversation } from '../../types/conversation.types';
import type { ChatMessage } from '../../types/message.types';
import type { ChatError } from '../../types/errors.types';

describe('conversationStore', () => {
  const sampleDirect: DirectConversation = {
    id: 'thread-1',
    type: 'direct',
    createdAt: new Date('2026-01-01'),
    unreadCount: 2,
    participants: [{ id: 'user-1', displayName: 'Alice' }],
    otherParticipant: { id: 'user-2', displayName: 'Bob' },
  };

  const sampleGroup: GroupConversation = {
    id: 'thread-2',
    type: 'group',
    name: 'General Chat',
    createdAt: new Date('2026-01-02'),
    unreadCount: 5,
    participants: [
      { id: 'user-1', displayName: 'Alice' },
      { id: 'user-2', displayName: 'Bob' },
    ],
  };

  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useConversationStore.getState();

    expect(state.conversations).toEqual({});
    expect(state.conversationIds).toEqual([]);
    expect(state.activeConversationId).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.loadingMore).toBe(false);
    expect(state.hasMore).toBe(true);
    expect(state.cursor).toBeNull();
    expect(state.error).toBeNull();
  });

  it('should setConversations with normalized state', () => {
    useConversationStore.getState().setConversations([sampleDirect, sampleGroup]);

    const state = useConversationStore.getState();
    expect(state.conversationIds).toEqual(['thread-1', 'thread-2']);
    expect(state.conversations['thread-1']).toEqual(sampleDirect);
    expect(state.conversations['thread-2']).toEqual(sampleGroup);
  });

  it('should appendConversations preserving order and avoiding duplicates', () => {
    useConversationStore.getState().setConversations([sampleDirect]);

    const newGroup: GroupConversation = {
      ...sampleGroup,
      id: 'thread-3',
    };

    useConversationStore.getState().appendConversations([sampleDirect, newGroup]);

    const state = useConversationStore.getState();
    expect(state.conversationIds).toEqual(['thread-1', 'thread-3']);
    expect(Object.keys(state.conversations)).toHaveLength(2);
  });

  it('should addConversation prepending new items', () => {
    useConversationStore.getState().setConversations([sampleDirect]);
    useConversationStore.getState().addConversation(sampleGroup);

    const state = useConversationStore.getState();
    expect(state.conversationIds).toEqual(['thread-2', 'thread-1']);
    expect(state.conversations['thread-2']).toEqual(sampleGroup);

    // If added again, should update record without duplicating ID
    const updatedGroup: GroupConversation = { ...sampleGroup, name: 'Updated General' };
    useConversationStore.getState().addConversation(updatedGroup);
    expect(useConversationStore.getState().conversationIds).toEqual(['thread-2', 'thread-1']);
    expect(
      (useConversationStore.getState().conversations['thread-2'] as GroupConversation).name
    ).toBe('Updated General');
  });

  it('should updateConversation properties', () => {
    useConversationStore.getState().setConversations([sampleGroup]);
    useConversationStore
      .getState()
      .updateConversation('thread-2', { name: 'New Topic' } as Partial<GroupConversation>);

    const updated = useConversationStore.getState().conversations['thread-2'] as GroupConversation;
    expect(updated.name).toBe('New Topic');
    expect(updated.unreadCount).toBe(5);
  });

  it('should removeConversation and clear activeConversationId if matching', () => {
    useConversationStore.getState().setConversations([sampleDirect, sampleGroup]);
    useConversationStore.getState().setActiveConversation('thread-1');

    useConversationStore.getState().removeConversation('thread-1');

    const state = useConversationStore.getState();
    expect(state.conversationIds).toEqual(['thread-2']);
    expect(state.conversations['thread-1']).toBeUndefined();
    expect(state.activeConversationId).toBeNull();
  });

  it('should increment and reset unread count', () => {
    useConversationStore.getState().setConversations([sampleDirect]);

    useConversationStore.getState().incrementUnreadCount('thread-1', 3);
    expect(useConversationStore.getState().conversations['thread-1'].unreadCount).toBe(5);

    useConversationStore.getState().resetUnreadCount('thread-1');
    expect(useConversationStore.getState().conversations['thread-1'].unreadCount).toBe(0);
  });

  it('should updateLastMessage and move conversation to top of list', () => {
    useConversationStore.getState().setConversations([sampleDirect, sampleGroup]);

    const lastMessage: ChatMessage = {
      id: 'msg-100',
      conversationId: 'thread-1',
      type: 'text',
      content: 'Hello world',
      sender: { id: 'user-1', displayName: 'Alice' },
      createdAt: new Date('2026-08-03T12:00:00Z'),
      status: 'sent',
    };

    useConversationStore.getState().updateLastMessage('thread-1', lastMessage);

    const state = useConversationStore.getState();
    expect(state.conversationIds).toEqual(['thread-1', 'thread-2']);
    expect(state.conversations['thread-1'].lastMessage).toEqual(lastMessage);
    expect(state.conversations['thread-1'].updatedAt).toEqual(lastMessage.createdAt);
  });

  it('should update loading, loadingMore, hasMore, cursor, error flags', () => {
    const error: ChatError = {
      code: 'CONVERSATION_NOT_FOUND',
      message: 'Not found',
      retryable: false,
      timestamp: new Date(),
    };

    useConversationStore.getState().setLoading(true);
    useConversationStore.getState().setLoadingMore(true);
    useConversationStore.getState().setHasMore(false);
    useConversationStore.getState().setCursor('cursor-xyz');
    useConversationStore.getState().setError(error);

    const state = useConversationStore.getState();
    expect(state.loading).toBe(true);
    expect(state.loadingMore).toBe(true);
    expect(state.hasMore).toBe(false);
    expect(state.cursor).toBe('cursor-xyz');
    expect(state.error).toEqual(error);
  });

  it('should reset store to initial state', () => {
    useConversationStore.getState().setConversations([sampleDirect]);
    useConversationStore.getState().setActiveConversation('thread-1');
    useConversationStore.getState().setLoading(true);

    useConversationStore.getState().reset();

    const state = useConversationStore.getState();
    expect(state.conversations).toEqual(initialConversationState.conversations);
    expect(state.conversationIds).toEqual(initialConversationState.conversationIds);
    expect(state.activeConversationId).toBe(initialConversationState.activeConversationId);
    expect(state.loading).toBe(initialConversationState.loading);
  });

  describe('selectors', () => {
    beforeEach(() => {
      useConversationStore.getState().setConversations([sampleDirect, sampleGroup]);
      useConversationStore.getState().setActiveConversation('thread-2');
    });

    it('selectAllConversations returns conversations in conversationIds order', () => {
      const state = useConversationStore.getState();
      const all = selectAllConversations(state);
      expect(all).toEqual([sampleDirect, sampleGroup]);
    });

    it('selectActiveConversation returns active conversation', () => {
      const state = useConversationStore.getState();
      const active = selectActiveConversation(state);
      expect(active).toEqual(sampleGroup);
    });

    it('selectConversationById returns target conversation', () => {
      const state = useConversationStore.getState();
      expect(selectConversationById(state, 'thread-1')).toEqual(sampleDirect);
      expect(selectConversationById(state, 'non-existent')).toBeUndefined();
    });

    it('selectUnreadCountTotal calculates sum of unread counts', () => {
      const state = useConversationStore.getState();
      expect(selectUnreadCountTotal(state)).toBe(7); // 2 + 5
    });

    it('selectDirectConversations and selectGroupConversations filter by type', () => {
      const state = useConversationStore.getState();
      expect(selectDirectConversations(state)).toEqual([sampleDirect]);
      expect(selectGroupConversations(state)).toEqual([sampleGroup]);
    });
  });
});
